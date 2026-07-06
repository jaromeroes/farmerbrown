-- ============================================================================
-- Farmer Brown Billing — Row Level Security
-- Migration: 20260508_000001_rls
--
-- Strategy:
--   • Authenticated users can ONLY read data scoped to their own customer.
--   • The `customer_users` table is the source of truth for that scope.
--   • There are NO write policies for `authenticated`. All writes go through
--     the service-role key in server endpoints (cron, webhook, /api/checkout).
--     The service role bypasses RLS — that is exactly the boundary we want:
--     clients (browser) can never mutate balance state directly.
--   • `stripe_events` and `sync_state` are server-only; even reads are denied
--     for authenticated users.
-- ============================================================================

alter table public.customers          enable row level security;
alter table public.customer_users     enable row level security;
alter table public.calls              enable row level security;
alter table public.ledger_entries     enable row level security;
alter table public.topups             enable row level security;
alter table public.sync_state         enable row level security;
alter table public.stripe_events      enable row level security;
alter table public.low_balance_alerts enable row level security;

-- Helper: which customers does the current auth user belong to?
-- security definer so it can read customer_users without recursing through RLS.
create or replace function public.user_customer_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select customer_id from public.customer_users where user_id = auth.uid();
$$;

revoke all on function public.user_customer_ids() from public;
grant execute on function public.user_customer_ids() to authenticated;

-- ----------------------------------------------------------------------------
-- Read policies: scoped to the user's own customer rows.
-- ----------------------------------------------------------------------------

create policy customers_read on public.customers
  for select to authenticated
  using (id in (select public.user_customer_ids()));

create policy calls_read on public.calls
  for select to authenticated
  using (customer_id in (select public.user_customer_ids()));

create policy ledger_read on public.ledger_entries
  for select to authenticated
  using (customer_id in (select public.user_customer_ids()));

create policy topups_read on public.topups
  for select to authenticated
  using (customer_id in (select public.user_customer_ids()));

create policy customer_users_self on public.customer_users
  for select to authenticated
  using (user_id = auth.uid());

-- low_balance_alerts: customer can see their own alert history.
create policy low_balance_alerts_read on public.low_balance_alerts
  for select to authenticated
  using (customer_id in (select public.user_customer_ids()));

-- sync_state and stripe_events have NO policies for `authenticated` — denying
-- by default. Service role bypasses RLS so the cron and webhook still work.
