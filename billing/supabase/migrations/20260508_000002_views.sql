-- ============================================================================
-- Farmer Brown Billing — views + RPC
-- Migration: 20260508_000002_views
--
-- Two server-side helpers used by the application:
--   • customer_balances view — single source of truth for current balance.
--     Reads SUM(ledger_entries.amount_cents) per customer. The portal queries
--     this; the cron consults it after each run for the low-balance check.
--   • meter_call() RPC — atomic insert of a (calls, ledger_entries) pair.
--     Wrapped in a Postgres function so both writes happen in one transaction.
--     Returns true if a new charge was posted, false if the call_id was
--     already metered (idempotency hit). Service-role only.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- customer_balances view — derived balance.
-- COALESCE keeps the row visible for customers with no ledger entries yet
-- (balance = 0). Currency comes from customers.currency for convenience.
-- ----------------------------------------------------------------------------
create or replace view public.customer_balances as
select
  c.id        as customer_id,
  c.currency,
  coalesce(sum(le.amount_cents), 0)::bigint as balance_cents
from public.customers c
left join public.ledger_entries le on le.customer_id = c.id
group by c.id, c.currency;

-- The view inherits RLS from its underlying tables. Authenticated users can
-- only see balances for their own customer (via customers and ledger_entries
-- read policies). Service role bypasses RLS as usual.

-- ----------------------------------------------------------------------------
-- meter_call() — atomic insert call + ledger entry.
--
-- Inputs:
--   p_customer_id     — which customer this call belongs to
--   p_vapi_call_id    — VAPI's id (idempotency key)
--   p_charge_cents    — already-margin-applied charge amount (positive)
--   p_vapi_cost_cents — raw VAPI cost (for the calls record)
--   p_margin_bps      — margin snapshot at metering time
--   p_assistant_id    — optional VAPI assistantId
--   p_squad_id        — optional VAPI squadId
--   p_phone_number_id — optional VAPI phoneNumberId
--   p_customer_phone  — optional caller number from VAPI customer.number
--   p_started_at      — call started at
--   p_ended_at        — call ended at
--   p_duration_seconds — call duration
--   p_ended_reason    — VAPI endedReason
--   p_currency        — currency code (mirrors customers.currency)
--   p_vapi_raw        — full VAPI call payload for forensics
--
-- Returns:
--   true if a new (call, ledger) pair was inserted
--   false if the call_id was already present (idempotent no-op)
-- ----------------------------------------------------------------------------
create or replace function public.meter_call(
  p_customer_id      uuid,
  p_vapi_call_id     text,
  p_charge_cents     integer,
  p_vapi_cost_cents  integer,
  p_margin_bps       integer,
  p_assistant_id     text,
  p_squad_id         text,
  p_phone_number_id  text,
  p_customer_phone   text,
  p_started_at       timestamptz,
  p_ended_at         timestamptz,
  p_duration_seconds integer,
  p_ended_reason     text,
  p_currency         text,
  p_vapi_raw         jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_call_id uuid;
begin
  insert into public.calls (
    customer_id, vapi_call_id, vapi_assistant_id, vapi_squad_id,
    vapi_phone_number_id, customer_phone,
    started_at, ended_at, duration_seconds, ended_reason,
    vapi_cost_cents, margin_bps, charge_cents, vapi_raw
  ) values (
    p_customer_id, p_vapi_call_id, p_assistant_id, p_squad_id,
    p_phone_number_id, p_customer_phone,
    p_started_at, p_ended_at, p_duration_seconds, p_ended_reason,
    p_vapi_cost_cents, p_margin_bps, p_charge_cents, p_vapi_raw
  )
  on conflict (vapi_call_id) do nothing
  returning id into v_call_id;

  -- v_call_id is null if the row already existed (the cron is replaying)
  if v_call_id is null then
    return false;
  end if;

  insert into public.ledger_entries (
    customer_id, kind, amount_cents, currency,
    call_id, external_ref
  ) values (
    p_customer_id, 'call_charge', -p_charge_cents, p_currency,
    v_call_id, 'call:' || p_vapi_call_id
  );

  return true;
end;
$$;

revoke all on function public.meter_call(
  uuid, text, integer, integer, integer,
  text, text, text, text,
  timestamptz, timestamptz, integer, text,
  text, jsonb
) from public;
-- Service role uses this; authenticated users have no need to call it.
grant execute on function public.meter_call(
  uuid, text, integer, integer, integer,
  text, text, text, text,
  timestamptz, timestamptz, integer, text,
  text, jsonb
) to service_role;

-- ----------------------------------------------------------------------------
-- credit_topup() — atomic update topup + insert ledger credit.
-- Used by the Stripe webhook on checkout.session.completed.
-- ----------------------------------------------------------------------------
create or replace function public.credit_topup(
  p_topup_id                uuid,
  p_stripe_event_id         text,
  p_stripe_payment_intent_id text,
  p_amount_cents            integer,
  p_currency                text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_topup record;
begin
  -- Lock the topup row so two concurrent webhook deliveries serialize.
  select * into v_topup from public.topups where id = p_topup_id for update;
  if not found then
    raise exception 'topup % not found', p_topup_id;
  end if;

  -- Already paid? No-op (replay-safe).
  if v_topup.status = 'paid' then
    return false;
  end if;

  update public.topups
     set status = 'paid',
         paid_at = now(),
         stripe_payment_intent_id = coalesce(stripe_payment_intent_id, p_stripe_payment_intent_id)
   where id = p_topup_id;

  insert into public.ledger_entries (
    customer_id, kind, amount_cents, currency,
    topup_id, external_ref
  ) values (
    v_topup.customer_id, 'topup', p_amount_cents, p_currency,
    p_topup_id, 'stripe:' || p_stripe_event_id
  );

  return true;
end;
$$;

revoke all on function public.credit_topup(uuid, text, text, integer, text) from public;
grant execute on function public.credit_topup(uuid, text, text, integer, text) to service_role;
