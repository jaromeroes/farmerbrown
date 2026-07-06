-- ============================================================================
-- Farmer Brown Billing — seed (env-gated)
-- Migration: 20260508_000003_seed_fb
--
-- Inserts John (Farmer Brown) as the first customer with all VAPI assistant /
-- squad / phone-number IDs that should bill to him.
--
-- IMPORTANT: this migration runs on EVERY `supabase db push`. The
-- `on conflict do nothing` guards make it idempotent on the email — re-runs
-- are safe but will NOT update the row if the data changes. To update an
-- existing customer, do it via a follow-up migration or directly in SQL.
--
-- TBD before running: replace the email placeholder with John's real email.
-- The user (José) said he would provide it; until then, leaving placeholder
-- means John can't log in (the magic-link will fail).
-- ============================================================================

insert into public.customers (
  id,
  email,
  display_name,
  currency,
  margin_bps,
  low_balance_threshold_cents,
  alert_emails,
  vapi_assistant_ids,
  vapi_squad_ids,
  vapi_phone_number_ids
) values (
  '00000000-0000-0000-0000-00000000fb01',
  -- TODO: replace with John's real email before go-live.
  'john@farmerbrown.example',
  'Farmer Brown Insurance',
  'USD',
  3500, -- 35% margin: 25% target + ~5% Stripe (non-EEA card + USD→EUR FX) + buffer
  2000,
  -- TODO: replace placeholder email here too.
  array['john@farmerbrown.example', 'jaromero.es@gmail.com'],
  array[
    -- Receptionists
    'fa2897bb-00ee-4680-af00-0e31abeed228',  -- Grace BR Sales (legacy)
    '52bda5c2-65c0-4604-b988-f56b9f1d98f3',  -- Grace BR Unified (current)
    '71c72af4-b87a-43cb-8f0a-661c3febe8ea',  -- Emma FB Sales
    'a1720268-a855-410e-bb7f-687910995dba',  -- Emma FB Service
    'b5f88994-e045-4996-9f2c-056516e9cf01',  -- Olivia CL Sales
    'e4597689-cf8c-4801-96af-302bdbc0eb2a',  -- Olivia CL Service
    '9f4ae2af-1286-41e6-894c-c09fd3d7d6c3',  -- Grace BR Service
    -- Specialists
    '273d2d5a-27e0-40aa-b817-76a51d1c302d',  -- Jennifer (BR)
    '1364ed31-51fa-41a4-8831-491b2ee3ef77',  -- Sarah (GL)
    '18902649-ea31-4782-a653-601a0c07a5e3',  -- Valeria (GL ES)
    'd1055f89-7175-4a51-8f03-a3332d1764ff',  -- Nora (CA)
    'b4957315-f53f-4296-9ca6-58748f4a4041',  -- Rachel (H&A)
    'bc789a3e-9e2b-4c60-9778-9e33d0cd826d',  -- Wendy (WC)
    -- Proxies
    'fb1e7022-e4ee-42d1-b1db-0977a4e05aad',  -- FB Live Agent Proxy
    'f06c2ad0-1a21-491d-916d-cbbf09e1118e',  -- CL Live Agent Proxy
    '180a9367-df40-4e46-91c8-a28b13901e53',  -- BR Live Agent Proxy
    '32dde873-910d-489f-93fa-3527e52befc1',  -- BR Direct-Dial Proxy
    -- Test dispatcher
    '753657c6-3ed4-487c-8c39-1f65fa4f8287',  -- Test Dispatcher Sales
    'e8a656cf-3017-4b3b-9dd7-78d8e85186ad'   -- Test Dispatcher Service
  ],
  array[
    'a3269fa7-6229-4bed-817a-c4684878a600',  -- BR Unified Squad
    '5cf7afbf-cee7-45cd-8fa1-9ff2989d8e28',  -- FB Sales EN Squad
    '3b29fd00-f58a-4282-9cb3-c26c393a7858',  -- CL Sales EN Squad
    'ab53f568-82bf-439f-8fda-d04070864632',  -- BR Sales EN Squad
    '05d75043-5f37-4d46-8225-9a95d1cbb7c3',  -- FB Service EN Squad
    'f80194e9-3989-4b18-b058-161b37ba5e22',  -- CL Service EN Squad
    '64e52ce6-64e7-4ea9-9cc3-6ae4478fba65',  -- BR Service EN Squad
    '2ae25a8b-6ff0-49db-abfc-197b751f533a',  -- Test Squad Sales
    'd989f711-a436-421d-a3c8-ce06b570ad40'   -- Test Squad Service
  ],
  array[]::text[]   -- VAPI phoneNumberId list — fill in if/when needed
)
on conflict (email) do nothing;

-- Seed sync_state with the start watermark. Per José, 2026-05-09: invoice
-- John for everything since 2026-04-25 (the earliest VAPI's 14-day retention
-- window allows; he had agreed to be billed for test calls too).
insert into public.sync_state (customer_id, last_vapi_call_created_at)
values (
  '00000000-0000-0000-0000-00000000fb01',
  '2026-04-25T00:00:00Z'::timestamptz
)
on conflict (customer_id) do nothing;
