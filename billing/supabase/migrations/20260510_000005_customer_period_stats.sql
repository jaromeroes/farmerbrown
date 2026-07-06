-- ============================================================================
-- Farmer Brown Billing — period stats RPC for the portal
-- Migration: 20260510_000005_customer_period_stats
--
-- Why this exists:
--   The portal renders 4 metric cards above the calls table: total spent,
--   call count, average cost per call, and total talk time, all over a
--   user-chosen time range (last 7 / 30 / 90 days, or custom). Doing four
--   separate aggregate queries via the JS client is brittle (PostgREST
--   aggregate syntax requires `db-aggregates-enabled` and trips on RLS in
--   non-obvious ways). One RPC = one round-trip + one SQL plan.
--
-- Critical design choice — SECURITY INVOKER (not DEFINER):
--   The existing RPCs `meter_call` and `credit_topup` are SECURITY DEFINER
--   because only service_role calls them and they need to bypass RLS to
--   write across tables atomically. This RPC is the opposite: it's called
--   by `authenticated` users from the portal and MUST respect RLS on the
--   `calls` table so customers only see their own stats. SECURITY INVOKER
--   is the correct (and the safer) default. If you ever rewrite this with
--   `definer`, you must add `customer_id = ANY(ARRAY(SELECT public.user_customer_ids()))`
--   to the WHERE clause manually, or you'll silently leak data cross-tenant.
-- ============================================================================

create or replace function public.customer_period_stats(
  p_from timestamptz,
  p_to   timestamptz
)
returns table (
  total_charge_cents     bigint,
  call_count             integer,
  avg_charge_cents       numeric,
  total_duration_seconds bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    coalesce(sum(charge_cents), 0)::bigint     as total_charge_cents,
    count(*)::integer                          as call_count,
    coalesce(avg(charge_cents), 0)::numeric    as avg_charge_cents,
    coalesce(sum(duration_seconds), 0)::bigint as total_duration_seconds
  from public.calls
  where started_at >= p_from
    and started_at <  p_to;
  -- RLS on `calls` (see 20260508_000001_rls.sql) automatically scopes this
  -- to the rows the calling user can see. No extra customer_id filter needed.
$$;

revoke all on function public.customer_period_stats(timestamptz, timestamptz) from public;
grant execute on function public.customer_period_stats(timestamptz, timestamptz)
  to authenticated, service_role;

-- Force PostgREST to refresh its schema cache so the RPC becomes callable
-- via the Data API immediately, without waiting for the periodic refresh.
notify pgrst, 'reload schema';
