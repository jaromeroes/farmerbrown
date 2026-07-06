# Where we left off — Farmer Brown AI Hub

**Last touched:** 2026-05-26 — **Stripe live mode activated end-to-end.** The portal is now charging real cards. Today we flipped the account from test to live, fixed a silent webhook bug from the May rename (URL was still pointing at `*.vercel.app` → 308 redirect; Stripe drops 3xx deliveries on the floor so every event since 2026-05-12 had been failing silently), reset the ledger to $0 with a traceable `adjustment` row, gave Pedro / John / both José identities access, and confirmed the first real top-up ($1 with José's card) landed on the balance via a live webhook. One UX bug fixed along the way: Stripe Checkout was pre-filling the form with the customer's email (John's) regardless of who clicked "Add credit" — `customer:` + `customer_email` are mutually exclusive in Stripe Checkout, so we dropped the `customer:` association entirely and now pass the logged-in payer's email instead. CallsTable now flags rows from before the 2026-05-26T20:20:28Z cutoff with a "Pre go-live" amber badge so John can tell historical (already-invoiced) usage apart from the live-billed ones.

This is the resumption checkpoint for `farmerbrown-billing` (the repo name; the customer-visible product is "Farmer Brown AI Hub"). Read it cold to pick the project back up. If a memory entry conflicts with this file, trust this file and update the memory.

---

## Lessons learned today (2026-05-26)

- **Webhook endpoint URLs must be updated when you change the canonical domain.** We pointed the subdomain `farmerbrown.theb2btinkerers.com` at the project on 2026-05-12 and added a 308 redirect from `*.vercel.app/...`. The Stripe webhook URL stayed on the old domain — Stripe **does not follow redirects** in webhook delivery (anti-MITM by design), so every event since the rename failed silently for 14 days. We only noticed when José tried to top up today and the balance didn't move. Lesson: any time you rename a domain, audit every webhook URL configured in external systems (Stripe, OAuth providers, anything that POSTs to you). A 3xx response on a webhook is a silent failure.

- **`customer:` and `customer_email` are mutually exclusive in Stripe Checkout.** If you pass `customer:`, Stripe uses the customer's email for everything (form pre-fill, receipt destination), regardless of who is actually paying. Multiple users with access to the same customer (José + Pedro + John as owners) all paying with their own cards = we need the payer's email, not the customer's. Fix was to drop `customer:` entirely; payments still associate to the internal customer via `metadata.customer_id` in the session.

- **Stripe customer email leaks via Stripe Link even when no email is sent.** Even with the toggle "Successful payments" set OFF (which it was, by default in our account, contrary to what I thought), the customer's email shows up in Stripe Checkout's UI when `customer:` is set. If that email has any preexisting Stripe Link account elsewhere, the payer literally sees *"Iniciando sesión como john.brown@farmerbrown.com"* in the modal. Privacy leak in the UI, not via email. Code-level fix is the only safe approach.

- **`email_confirm: true` in admin API creates a verified user without sending any email.** Useful for provisioning users programmatically when you want them to receive comms only through your own (Resend) channel. Don't use `invite_user_by_email` for this — that one always sends Supabase's invitation.

- **`/portal` shows TOTAL SPENT lifetime, not the current balance.** The "$94.34" figure in the UI is the cumulative sum of call_charges since seed (= what John consumed during the beta), separate from the current balance ($1.00 post-go-live). This was the basis for the historical invoice amount to John.

---

## What is this project

A separate Astro app that bills Farmer Brown (John) for VAPI voice-agent usage on a **prepaid** basis. José pays VAPI directly; the portal lets John top up a balance via Stripe Checkout, and a daily cron pulls completed VAPI calls and decrements the balance at `cost × 1.35`. The 35% margin is opaque to John — he sees a single per-call charge, not the breakdown.

Production URL: <https://farmerbrown.theb2btinkerers.com> (Cloudflare CNAME → Vercel, with SSL by Vercel).
Repo: <https://github.com/jaromeroes/farmerbrown-billing> (private). Local: `~/Developer/theb2btinkerers/clients/farmerbrown-billing/`.

---

## Current state

| Component | Status | Notes |
|---|---|---|
| Code (Astro 4 server-rendered) | ✅ Pushed to `main` | Last commit `3e66966` (robust `Date.parse` for pre-go-live cutoff) |
| Stripe mode | ✅ **LIVE** | `charges_enabled: true`, `payouts_enabled: true`. Old `cs_test_*` history preserved alongside new `cs_live_*`. |
| Stripe webhook (live) | ✅ Configured | URL `https://farmerbrown.theb2btinkerers.com/api/stripe-webhook`, events `checkout.session.completed`, `checkout.session.expired`, `charge.refunded`. Signing secret in Vercel as `STRIPE_WEBHOOK_SECRET`. |
| Vercel env vars | ✅ Switched to live | `pk_live_…`, `sk_live_…`, `whsec_…` (live), redeployed manually after the swap. Local `.env` stays on test keys for dev. |
| Stripe receipts (Settings → Customer emails) | ✅ Verified OFF | "Pagos que se han efectuado correctamente" + "Reembolsos" both OFF. Direct-debit toggles (BACS, ACH, etc.) are ON but unused by us. Defense-in-depth: even if code re-introduces a leak, Stripe won't email John. |
| `customers.stripe_customer_id` | ✅ NULL (vestigial) | The app no longer creates Stripe Customers. Column kept in schema; nothing reads or writes it now. |
| Schema in Supabase | ✅ Unchanged | 8 tables + 1 view + 4 RPCs + RLS + grants. Same migrations as before. |
| `customers.email` | ✅ Real | `john.brown@farmerbrown.com` (was placeholder `john@farmerbrown.example` until today). |
| `customers.alert_emails` | ✅ Updated | `[pedro@farmerbrown.com, j.antonio@farmerbrown.com, jaromero.es@gmail.com]` — **NOT including John**. Operational notifications go to the team, not the client. |
| Ledger | ✅ Reset to $0 at 2026-05-26T20:20:28Z | Single `kind=adjustment` row of −766 cents with memo "Pre-go-live cutoff" and `external_ref='manual:pre-go-live-reset-2026-05-26'`. Calls + topups + call_charges history all preserved. |
| Pre-go-live cutoff | ✅ Constant in CallsTable | `PRE_GOLIVE_CUTOFF_MS = Date.parse('2026-05-26T20:20:28Z')` in `src/components/CallsTable.astro`. Rows older than that get amber tint + "Pre go-live" badge. |
| Auth users | ✅ 4 active | `j.antonio@farmerbrown.com` (José working), `jaromero.es@gmail.com` (José personal), `pedro@farmerbrown.com` (Pedro), `john.brown@farmerbrown.com` (John). All `owner` on the FB customer. Zombie `x@y.com` and dev `tester@theb2btinkerers.com` deleted today. |
| First live top-up | ✅ Successful | José paid $1 with personal card from `j.antonio@farmerbrown.com` session. `cs_live_a1zZY7…`, `pi_3TbRu…`, balance now $1.00. Verified end-to-end (Checkout → webhook → ledger). |
| Vercel daily cron | ✅ Live | `0 6 * * *` (06:00 UTC = 07:00 ESP). Today's manual run was OK; tomorrow's scheduled fire is the first one on live keys. |

**Current balance: $1.00 USD** (from today's live smoke test).

---

## What works (verified end-to-end on the live portal)

The full flow is alive at <https://farmerbrown.theb2btinkerers.com>:

1. User submits email at `/login` → form `fetch POST /api/auth/request-link` → server calls Supabase `admin.generateLink` → branded Resend email (sender `Farmer Brown AI Hub <notifications@farmerbrown.theb2btinkerers.com>`).
2. User clicks **Sign in** in the email → lands on `/auth/verify?token=…&type=magiclink` → server-to-server verify with Supabase → cookie set → redirect to `/portal`.
3. **Add credit** → $1 → Stripe Checkout (live mode).
4. Stripe Checkout pre-fills with the **logged-in user's email** (not the customer's). Each user pays with their own card / email.
5. Stripe sends `checkout.session.completed` to `/api/stripe-webhook` → signature verified with the production `whsec_` (live) → `credit_topup` RPC posts a `+100` ledger entry → balance updates.
6. `/portal/success` polls `/api/topup-status` and shows the new balance.
7. Daily Vercel cron `POST /api/cron/sync-vapi` (or manual with Bearer `$CRON_SECRET`) → fetches calls from VAPI since the watermark → calls `meter_call` RPC for each → ledger entries appended, watermark advanced.
8. `/portal` renders live data: balance, KPI cards, daily-spend sparkline, last 20 calls. **Pre-go-live calls** (started_at < 2026-05-26T20:20:28Z) get an amber tint + "Pre go-live" badge under the Status column.
9. `/portal/system` renders the three Farmer Brown receptionists' description cards.

Notification emails (top-up received, low-balance alert) go to `customers.alert_emails` (pedro, j.antonio, jose Gmail). **John never receives operational notifications** — he only sees his balance and history when he logs in.

---

## Stripe live setup (what's where)

- **Account**: `acct_1TVHNHARM8HBNRSs`, ES, EUR settlement, Company (B2B Tinkers SL).
- **Webhook endpoint (live)**: URL points at the subdomain (`farmerbrown.theb2btinkerers.com/api/stripe-webhook`). Don't ever use the `*.vercel.app` URL for webhooks — that path now 308s.
- **API keys (live)**: `pk_live_…` + `sk_live_…` in Vercel env vars + Apple Passwords. Test keys (`pk_test_…`/`sk_test_…`) exist in their own universe and stay in local `.env` for dev — they never overlap.
- **Customer emails (Settings → Customer emails)**: "Successful payments" OFF, "Reembolsos" OFF. All transactional emails go through Resend.

---

## User management

After today's cleanup (4 active users):

| Email | Role | Notes |
|---|---|---|
| `john.brown@farmerbrown.com` | owner | The customer (John) himself. Created 2026-05-26. |
| `pedro@farmerbrown.com` | owner | Pedro Newman, operates the FB account. Auth user existed since 2026-05-12, linked to customer_users today. |
| `j.antonio@farmerbrown.com` | owner | José's FB-side alias. |
| `jaromero.es@gmail.com` | owner | José's personal Gmail, also in `alert_emails`. |

To onboard a new user without sending Supabase's default invite email:

```bash
set -a; source .env; set +a
# 1) Create auth user — email_confirm: true means no invite email is sent
curl -sS -X POST "$PUBLIC_SUPABASE_URL/auth/v1/admin/users" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email": "newuser@example.com", "email_confirm": true}'

# 2) Link to the customer (use the user_id returned above)
curl -sS -X POST "$PUBLIC_SUPABASE_URL/rest/v1/customer_users" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"customer_id": "00000000-0000-0000-0000-00000000fb01", "user_id": "<paste>", "role": "owner"}'
```

To remove a user: just DELETE on `auth.users/<id>` — the `customer_users` row drops via FK cascade.

---

## Bugs fixed today (don't repeat)

1. **Webhook 308 redirect silently breaking Stripe delivery**. Stripe was sending events to `farmerbrown-billing.vercel.app/api/stripe-webhook`; Vercel returned 308 → Stripe marked deliveries as failed. Fix: update the URL in Stripe Dashboard to the canonical subdomain. **Always audit external webhook URLs after a domain rename.**
2. **Stripe Checkout pre-filling with `customer.email` regardless of payer** (commit `f784281`). Dropped the `customer:` association in `createTopupCheckoutSession`, pass `customer_email: session.email` (the logged-in user) instead. `ensureStripeCustomer` removed (no callers left). `customers.stripe_customer_id` stays in schema as a vestige.
3. **`PRE_GOLIVE_CUTOFF` string comparison was fragile** (commit `3e66966`). String compare of ISO timestamps happens to work for `Z` vs `+00:00`, but it's not robust — switched to `Date.parse()` → numeric comparison.

---

## Future ideas (parking lot — not scheduled)

- **Always-on call-watcher agent.** Separate service that streams calls as they finish, reads transcript + summary, fires alerts (low-quality call, escalation keyword, customer-name match). Distinct from the billing portal — likely a new project that consumes the same `calls` table or hits VAPI directly.

- **Stripe Issuing + USD balance to pay VAPI directly from Stripe balance.** Currently: John pays USD → Stripe converts USD→EUR (2% fee) → settles to IBAN EUR → José pays VAPI in USD from a regular card (another FX hit). With Issuing: enable Issuing in Dashboard, enable USD as a settlement currency, emit a virtual USD card bound to the Stripe balance, set that as VAPI's payment method. Net effect: cero FX overhead between John's payment and VAPI's invoice; José's margin accumulates in Stripe USD balance and only converts to EUR when he wants to extract it via manual payout. **See the Issuing setup notes below.** Eligible to enable once a few weeks of live revenue have flowed.

- **Remove `customers.stripe_customer_id` column entirely** — currently kept as a vestige. After confirming a few live cycles work fine, drop the column with a migration.

- **Make `PRE_GOLIVE_CUTOFF_MS` configurable** instead of a constant in the component. Maybe a row in a `system_settings` table, or an env var. Low priority — only matters if we re-do this kind of cutoff for another customer.

---

## Stripe Issuing — setup notes (when ready)

These are scratch notes for the future Issuing setup, kept here so we don't lose the thread. Not yet executed.

1. **Enable Issuing**: in Dashboard, sidebar → Productos → Issuing (or Settings → Issuing). Click "Get started". Stripe may ask for additional KYC: business activity justification, expected card use, monthly spend estimate. For ES + B2B Tinkers SL this should be a same-day approval most of the time.

2. **Enable USD as a settlement currency**: Settings → Payments → Currencies → "Add settlement currency" → USD. Stripe will then split balances by currency (EUR balance + USD balance). John's USD payments stay in the USD bucket, no conversion until you ask for it.

3. **Set payouts to manual**: Settings → Payouts → from "Automatic" to "Manual". Otherwise Stripe will keep moving funds to your IBAN on schedule and you lose the accumulated-margin pool.

4. **Emit a virtual card**: Issuing → Cards → Create card. Cardholder: B2B Tinkers SL (or your name as representative). Type: Virtual. Currency: USD. Optionally set spending controls (monthly cap, MCC restrictions). Reveal the card details (number, exp, CVC) and save them in Apple Passwords.

5. **Swap method in VAPI**: VAPI Dashboard → Billing → Payment methods → Add card → paste the Issuing card details → set as default. Confirm a small charge succeeds before removing the personal card.

6. **Validate end-to-end**: trigger a small VAPI charge → confirm the USD balance in Stripe goes down by exactly that amount → confirm VAPI's billing shows the charge as paid. Done.

Notes:
- Issuing in EU is GA since 2023. ES is on the supported list.
- Card issuance is free / nominal. Per-transaction fee is tiny (~0.1%) — irrelevant vs the FX savings.
- Stripe Issuing cards are real Visa/MC, accepted by any merchant. VAPI uses Stripe for billing so the card will work cleanly.
- The USD balance in Stripe doesn't auto-convert. You convert manually when you want to extract margin to the IBAN (Stripe charges ~2% FX on that step, same as today — but only on the amount you choose to extract, not the gross).

---

## Still pending (next session backlog, in priority order)

1. **José: invoice John for $94.34** (≈ €87 at recent BCE rates) from B2B Tinkers SL. This is the cumulative call_charge total from the beta period (Apr 28 → May 22 2026, with 35% margin). Once paid, that closes the "pre go-live" account. Out-of-system task.
2. **Stripe Issuing + USD balance** — see the section above. No rush; do it once a few live top-ups have flowed and you want to start optimizing FX.
3. **Confirm tomorrow's 06:00 UTC daily cron fires on live mode** — today's manual run was OK; the scheduler-fired one hasn't run yet on live keys. Check Vercel logs around 07:00 ESP.
4. **(Cost optimization, separate workstream)** — negotiate VAPI cost reductions with John. Option list from 2026-05-09: Grace → gpt-4o-mini, Cartesia voice, prompt compaction, etc. Not blocking the portal.

---

## How to operate the live portal

### Generate a magic-link to log in (admin API, bypasses Resend)

```bash
cd ~/Developer/theb2btinkerers/clients/farmerbrown-billing
set -a; source .env; set +a
python3 - <<'PY'
import os, json, urllib.request
URL = os.environ['PUBLIC_SUPABASE_URL']
SR  = os.environ['SUPABASE_SERVICE_ROLE_KEY']
EMAIL = 'j.antonio@farmerbrown.com'  # or jaromero.es@gmail.com, pedro@farmerbrown.com, john.brown@farmerbrown.com
req = urllib.request.Request(
    f'{URL}/auth/v1/admin/generate_link',
    data=json.dumps({
        'type': 'magiclink',
        'email': EMAIL,
        'options': {'redirect_to': 'https://farmerbrown.theb2btinkerers.com/login'},
    }).encode(),
    method='POST',
    headers={'apikey': SR, 'Authorization': f'Bearer {SR}',
             'Content-Type':'application/json','User-Agent':'curl/8.0'}
)
with urllib.request.urlopen(req) as r:
    print(json.loads(r.read())['action_link'])
PY
```

### Manually trigger the production cron

```bash
set -a; source .env; set +a
curl -sS -X POST 'https://farmerbrown.theb2btinkerers.com/api/cron/sync-vapi' \
  -H "Authorization: Bearer $CRON_SECRET" -H 'Content-Type: application/json' | jq '.'
```

### Read balance / ledger / etc. via REST (service role)

```bash
set -a; source .env; set +a
# Current balance:
curl -sS -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  "$PUBLIC_SUPABASE_URL/rest/v1/customer_balances?select=*" | jq '.'

# Last 10 ledger entries:
curl -sS -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  "$PUBLIC_SUPABASE_URL/rest/v1/ledger_entries?select=created_at,kind,amount_cents,external_ref,memo&order=created_at.desc&limit=10" | jq '.'
```

### Local development (unchanged from before)

```bash
set -a; source .env; set +a
npm run dev                # http://localhost:4321 (test mode)
npm run stripe:listen      # forwards Stripe test webhooks to /api/stripe-webhook locally
```

**Important**: local `.env` uses test keys (`pk_test_*`/`sk_test_*`) and the local `stripe listen` webhook secret. Production uses live keys via Vercel env vars. They never overlap.

---

## Useful URLs

- Production portal: <https://farmerbrown.theb2btinkerers.com>
- Supabase Studio: <https://supabase.com/dashboard/project/vaytlurnlyfzixsxxnlw>
- Supabase Auth URL config: <https://supabase.com/dashboard/project/vaytlurnlyfzixsxxnlw/auth/url-configuration>
- GitHub repo: <https://github.com/jaromeroes/farmerbrown-billing>
- Vercel project: <https://vercel.com/accounts-6862s-projects/farmerbrown-billing>
- Stripe Dashboard: <https://dashboard.stripe.com> (toggle Live mode in the top-left)
