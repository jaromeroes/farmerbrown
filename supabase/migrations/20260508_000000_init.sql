-- ============================================================================
-- Farmer Brown Billing — initial schema
-- Migration: 20260508_000000_init
--
-- Money rules (enforced at the application layer; this file just provides the
-- shape and the unique constraints that make the rules work):
--   • All amounts are integer cents.
--   • Balance is derived: SUM(ledger_entries.amount_cents) per customer
--     (see views migration). No balance column anywhere.
--   • Every billable VAPI call has a unique vapi_call_id (idempotency).
--   • Every Stripe-driven credit has a unique external_ref='stripe:<event_id>'.
--   • Every cron-driven debit has a unique external_ref='call:<vapi_call_id>'.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- customers — one row per billable client. Multi-tenant primary key.
-- Today: just John (Farmer Brown). The rest of the schema is keyed on this.
-- ----------------------------------------------------------------------------
create table public.customers (
  id                          uuid primary key default gen_random_uuid(),
  email                       text not null unique,
  display_name                text not null,
  currency                    text not null default 'USD'
                              check (char_length(currency) = 3),
  -- Margin in basis points. 2500 = 25.00%. Snapshotted onto each call so future
  -- changes don't retroactively rewrite past charges.
  margin_bps                  integer not null default 2500
                              check (margin_bps >= 0 and margin_bps <= 100000),
  -- Cents below which we email a low-balance alert. Default $20.
  low_balance_threshold_cents integer not null default 2000
                              check (low_balance_threshold_cents >= 0),
  -- People who receive low-balance + receipt emails. Customer's email is
  -- expected to be in this array. José's ops email also lives here.
  alert_emails                text[] not null default '{}',
  -- VAPI resources owned by this customer. The cron only bills calls whose
  -- assistantId / squadId / phoneNumberId is in one of these arrays. Single
  -- tenant today: all of John's IDs. Multi-tenant tomorrow: each customer
  -- has their own.
  vapi_assistant_ids          text[] not null default '{}',
  vapi_squad_ids              text[] not null default '{}',
  vapi_phone_number_ids       text[] not null default '{}',
  stripe_customer_id          text unique,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- customer_users — join between Supabase auth users and customers.
-- An auth user can have access to one or more customers (today: 1:1).
-- RLS uses this table to decide what the logged-in user is allowed to see.
-- ----------------------------------------------------------------------------
create table public.customer_users (
  customer_id uuid not null references public.customers(id) on delete cascade,
  user_id     uuid not null references auth.users(id)       on delete cascade,
  role        text not null default 'owner'
              check (role in ('owner','viewer')),
  created_at  timestamptz not null default now(),
  primary key (customer_id, user_id)
);
create index customer_users_user_idx on public.customer_users (user_id);

-- ----------------------------------------------------------------------------
-- calls — immutable record of every metered VAPI call.
-- vapi_call_id UNIQUE = idempotency key for the cron pipeline.
-- ----------------------------------------------------------------------------
create table public.calls (
  id                    uuid primary key default gen_random_uuid(),
  customer_id           uuid not null references public.customers(id)
                        on delete restrict,
  vapi_call_id          text not null unique,
  vapi_assistant_id     text,
  vapi_squad_id         text,
  vapi_phone_number_id  text,
  customer_phone        text,                                  -- VAPI customer.number
  started_at            timestamptz,
  ended_at              timestamptz,
  duration_seconds      integer,
  ended_reason          text,
  vapi_cost_cents       integer not null check (vapi_cost_cents >= 0),
  margin_bps            integer not null,                      -- snapshot at metering time
  charge_cents          integer not null check (charge_cents >= 0),
  vapi_raw              jsonb not null,                        -- full call payload (forensic)
  metered_at            timestamptz not null default now()
);
create index calls_customer_started_idx on public.calls (customer_id, started_at desc);
create index calls_metered_idx          on public.calls (metered_at desc);

-- ----------------------------------------------------------------------------
-- topups — Stripe Checkout sessions initiated from /api/checkout.
-- Created with status='pending'; webhook flips to 'paid' and posts ledger.
-- ----------------------------------------------------------------------------
create table public.topups (
  id                          uuid primary key default gen_random_uuid(),
  customer_id                 uuid not null references public.customers(id)
                              on delete restrict,
  amount_cents                integer not null check (amount_cents > 0),
  currency                    text not null,
  status                      text not null default 'pending'
                              check (status in ('pending','paid','expired','failed','refunded')),
  stripe_checkout_session_id  text unique,
  stripe_payment_intent_id    text unique,
  created_at                  timestamptz not null default now(),
  paid_at                     timestamptz
);
create index topups_customer_created_idx on public.topups (customer_id, created_at desc);

-- ----------------------------------------------------------------------------
-- ledger_entries — append-only money movements.
-- Balance = SUM(amount_cents) where customer_id = ?.
-- Positive = credit (topup, refund-in), negative = debit (call_charge, refund-out).
-- external_ref UNIQUE = idempotency for both cron debits and Stripe credits.
-- ----------------------------------------------------------------------------
create table public.ledger_entries (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references public.customers(id)
                on delete restrict,
  kind          text not null
                check (kind in ('topup','call_charge','adjustment','refund')),
  amount_cents  integer not null,
  currency      text not null,
  -- One of these is non-null depending on `kind`.
  call_id       uuid references public.calls(id),
  topup_id      uuid references public.topups(id),
  -- Free-form note for adjustments / refunds.
  memo          text,
  -- Idempotency primitive. Examples:
  --   'call:<vapi_call_id>'           — cron debit
  --   'stripe:<event_id>'             — Stripe credit
  --   'manual:<some-uuid>'            — adjustment
  external_ref  text unique,
  created_at    timestamptz not null default now()
);
create index ledger_customer_created_idx on public.ledger_entries (customer_id, created_at desc);

-- ----------------------------------------------------------------------------
-- sync_state — per-customer cron checkpoint.
-- The cron advances last_vapi_call_created_at only after a clean run.
-- ----------------------------------------------------------------------------
create table public.sync_state (
  customer_id                 uuid primary key references public.customers(id)
                              on delete cascade,
  last_vapi_call_created_at   timestamptz,
  last_run_at                 timestamptz,
  last_run_status             text,
  last_run_error              text,
  calls_processed_total       bigint not null default 0
);

-- ----------------------------------------------------------------------------
-- stripe_events — defense-in-depth idempotency for Stripe webhook.
-- ledger_entries.external_ref UNIQUE is the primary guard; this table prevents
-- even attempting to post the entry twice.
-- ----------------------------------------------------------------------------
create table public.stripe_events (
  id          text primary key,           -- Stripe event.id (evt_*)
  type        text not null,
  received_at timestamptz not null default now(),
  payload     jsonb not null
);

-- ----------------------------------------------------------------------------
-- low_balance_alerts — record of sent alerts to enforce a 24h cooldown.
-- ----------------------------------------------------------------------------
create table public.low_balance_alerts (
  id                    uuid primary key default gen_random_uuid(),
  customer_id           uuid not null references public.customers(id)
                        on delete cascade,
  sent_at               timestamptz not null default now(),
  balance_cents_at_send integer not null
);
create index low_balance_alerts_customer_sent_idx
  on public.low_balance_alerts (customer_id, sent_at desc);

-- ----------------------------------------------------------------------------
-- updated_at trigger for customers (only table that has the column today).
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();
