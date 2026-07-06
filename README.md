# Farmer Brown Billing

Prepaid billing portal for the Farmer Brown voice-agent system. Customer tops
up a balance via Stripe; an hourly cron pulls VAPI call costs, applies a 25%
margin, and decrements the balance.

## Quick start

```bash
cp .env.example .env       # fill all values
npm install
supabase start             # local Postgres + Auth
supabase db push           # apply migrations
npm run dev                # http://localhost:4321
```

In a second terminal, forward Stripe webhooks to localhost:

```bash
npm run stripe:listen      # uses Stripe CLI; copy the printed webhook secret
                           # into STRIPE_WEBHOOK_SECRET in .env
```

## Useful commands

| Command | Purpose |
|---|---|
| `npm run dev` | Local Astro dev server |
| `npm run check` | Type-check Astro + TS |
| `npm run build` | Production build |
| `npm run supabase:push` | Apply migrations to remote Supabase |
| `npm run stripe:listen` | Forward Stripe webhooks to local dev server |

## Project layout

See [CLAUDE.md](./CLAUDE.md) for the architecture overview and conventions.
