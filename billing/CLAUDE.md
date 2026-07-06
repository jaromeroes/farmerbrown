# Farmer Brown Billing — AI assistant context

## ⚠️ READ FIRST WHEN RESUMING

Always start by reading [`docs/where-we-left-off.md`](docs/where-we-left-off.md). It is the
session-resumption checkpoint and reflects the current state, blockers, and next steps. The
rest of this CLAUDE.md is reference material; the where-we-left-off file is what's *current*.

## Overview

Prepaid billing portal for Farmer Brown (a single client today, multi-tenant
schema for tomorrow). Hourly cron pulls completed VAPI calls, applies a 25%
margin, and decrements the customer's balance in Supabase. The customer tops
up via Stripe Checkout. José invoices from B2B Tinkers SL.

## Why this project exists

VAPI bills José's account directly. Without this portal he eats every cost +
loses time tracking what John consumes. With this portal John tops up a
prepaid balance with his card, every VAPI call costs him `(vapi_cost × 1.25)`,
and José books the 25% margin transparently. No invoicing back-and-forth.

The 25% margin is intentionally **opaque** to John — he only sees a single
per-call charge, not the breakdown. Source: José, 2026-05-08.

## Stack

- **Framework:** Astro 4 (`output: 'server'`) on Vercel
- **Database:** Supabase Postgres + Auth (magic-link)
- **Payments:** Stripe Checkout (`mode: 'payment'`, no subscription) + Stripe Customer Portal
- **Email:** Resend
- **Voice (source of charges):** VAPI — same API key as `farmerbrown` repo

## Environment

All secrets in `.env` (gitignored). See `.env.example` for the full list. In
production the same keys live in Vercel project settings.

| Var | Purpose | Where used |
|---|---|---|
| `PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_ANON_KEY` | Supabase client (browser-safe) | Magic-link login, RLS-scoped reads |
| `SUPABASE_SERVICE_ROLE_KEY` | Bypasses RLS — server-only | Cron, webhook, checkout endpoints (the only places that mutate balance) |
| `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` | Stripe SDK | Checkout sessions, Stripe Customer Portal |
| `STRIPE_WEBHOOK_SECRET` | Verify webhook signatures | `/api/stripe-webhook` |
| `VAPI_KEY` | VAPI API auth | Cron pulls `/call` |
| `RESEND_API_KEY` | Transactional email | Low-balance alerts, top-up receipts |
| `CRON_SECRET` | Bearer token for `/api/cron/sync-vapi` | Vercel cron header |

## Data model (single source of truth)

Balance is **derived**, not stored. Every read goes through the
`customer_balances` view: `SUM(ledger_entries.amount_cents) per customer`.
Storing a denormalized balance column is forbidden — the only way to drift is
to write money in two places.

Key tables (full DDL in `supabase/migrations/20260508_000000_init.sql`):

- `customers` — one row per billable client (today: just John)
- `calls` — immutable per-call ledger; `vapi_call_id` UNIQUE = idempotency
- `ledger_entries` — append-only money movements; `external_ref` UNIQUE = idempotency
- `topups` — Stripe Checkout sessions
- `sync_state` — per-customer cron checkpoint
- `stripe_events` — processed Stripe event IDs (defense-in-depth)
- `low_balance_alerts` — alert log with 24h cooldown
- `customer_balances` view — `SUM(ledger_entries.amount_cents)`

## Money invariants

1. **Integer cents only.** No floats anywhere in the money path. Convert at
   boundaries: `Math.round(call.cost * 100)`.
2. **Single margin function.** `applyMargin(cents, bps)` lives in
   `src/lib/pricing.ts` and uses `Math.floor` so we never round in the
   customer's favor by accident.
3. **Idempotency keys are required.** `calls.vapi_call_id` and
   `ledger_entries.external_ref` are UNIQUE. Re-running the cron or replaying
   a Stripe webhook is always a no-op for already-seen events.
4. **Margin is snapshotted onto each call row.** Changing
   `customers.margin_bps` affects future calls only; historical charges stay
   put.
5. **Watermark advances only on success.** `sync_state.last_vapi_call_created_at`
   is moved at the end of a clean cron run. A failed run leaves the watermark
   alone so the next hour's cron picks up where the last one stopped.

## Conventions

- Filenames: kebab-case for routes / SQL, camelCase for TS modules where
  natural.
- Currency: USD end-to-end. VAPI bills José in USD; Stripe charges John in
  USD; balance and ledger are stored in USD cents. The only USD→EUR
  conversion happens outside the system, when Stripe pays out to José's
  EUR IBAN (Stripe takes a 2% FX fee there). No app-side conversion
  anywhere.
- Project communication between José and Claude: Spanish. **Customer-facing
  UI + transactional emails: English** (John is US-based). Internal tool
  names, variable names, code comments, commit messages: English.
- Git commits: English, imperative, conventional commits where applicable.

## What lives where

```
src/lib/        — Framework-free core (pricing, ledger, vapi, stripe, email)
src/pages/api/  — Server endpoints (cron, webhook, checkout, topup-status)
src/pages/      — Astro pages (login, portal, portal/topup, portal/success)
supabase/       — Schema migrations + local dev config
scripts/        — Dev-only utilities (Stripe listen, VAPI call simulator)
```

The framework-free `lib/` is the testable boundary. Cron, webhook, and the
portal pages all import the same `ledger.ts` / `pricing.ts` so the margin and
balance math has exactly one implementation.

## Deployment

```bash
# Local
cp .env.example .env  # fill values
npm install
supabase start         # local Postgres
supabase db push       # apply migrations
npm run dev            # Astro on http://localhost:4321

# Stripe webhook forwarding (separate terminal)
npm run stripe:listen

# Production
vercel deploy --prod
```

The Vercel cron runs `/api/cron/sync-vapi` hourly per `vercel.json`.

## Linked projects

- [`../farmerbrown/`](../farmerbrown/) — the voice-agent project that produces
  the VAPI calls this portal bills for. The VAPI assistant / squad / phone-
  number IDs to bill John for live in `farmerbrown/CLAUDE.md` and are seeded
  into `customers.vapi_*_ids` arrays.
