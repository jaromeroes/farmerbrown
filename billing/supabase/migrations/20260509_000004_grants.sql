-- ============================================================================
-- Farmer Brown Billing — explicit grants for the Data API
-- Migration: 20260509_000004_grants
--
-- Why this exists:
--   The Supabase project was created with "Automatically expose new tables"
--   DISABLED on purpose, so we can choose exactly which tables PostgREST sees.
--   That setting also skips the default GRANTs to the `authenticated`,
--   `anon`, and `service_role` roles — meaning even with RLS opened up, a
--   request via the Data API hits "permission denied for table X" because
--   PostgreSQL itself denies the SELECT before RLS even runs.
--
--   This migration grants the minimum each role needs:
--     • service_role  → ALL on every table + EXECUTE on RPCs (bypasses RLS,
--                       used by cron, webhook, checkout endpoints).
--     • authenticated → SELECT on the tables that RLS in 000001 already
--                       gates (so RLS does its job; PostgreSQL just stops
--                       blocking before RLS gets to run).
--     • anon          → nothing. Unauthenticated traffic is denied.
--
--   We also re-run NOTIFY to make PostgREST refresh its schema cache so the
--   RPCs (`meter_call`, `credit_topup`) become visible immediately.
-- ============================================================================

-- Schema usage. (Usually granted by default on `public`, but assert it.)
grant usage on schema public to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- service_role: full access to every table and the customer_balances view.
-- It bypasses RLS by design; this just satisfies PostgreSQL's GRANT layer.
-- ----------------------------------------------------------------------------
grant all on table
  public.customers,
  public.customer_users,
  public.calls,
  public.ledger_entries,
  public.topups,
  public.sync_state,
  public.stripe_events,
  public.low_balance_alerts
to service_role;

grant select on public.customer_balances to service_role;

grant execute on function
  public.meter_call(uuid, text, integer, integer, integer, text, text, text, text, timestamptz, timestamptz, integer, text, text, jsonb),
  public.credit_topup(uuid, text, text, integer, text),
  public.user_customer_ids()
to service_role;

-- ----------------------------------------------------------------------------
-- authenticated: SELECT on the tables that the portal reads. RLS in
-- 000001_rls.sql already restricts to the user's own customer_id.
-- ----------------------------------------------------------------------------
grant select on table
  public.customers,
  public.customer_users,
  public.calls,
  public.ledger_entries,
  public.topups,
  public.low_balance_alerts
to authenticated;

grant select on public.customer_balances to authenticated;

grant execute on function public.user_customer_ids() to authenticated;

-- anon role intentionally has no privileges. The login page uses the anon
-- key only to call supabase.auth.signInWithOtp(); it never reads our tables.

-- ----------------------------------------------------------------------------
-- Force PostgREST to reload its schema cache so RPCs become visible without
-- waiting for the next periodic refresh.
-- ----------------------------------------------------------------------------
notify pgrst, 'reload schema';
