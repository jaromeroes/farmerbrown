# Farmer Brown — monorepo

Two self-contained projects live here. Start any work session from the relevant
folder's `docs/where-we-left-off.md`.

## `voice-agents/` — VAPI voice agents
The AI voice-agent system (VAPI): agent configs (`agents/`), deploy scripts
(`scripts/`, plain Node + native `fetch`, no deps), APIs and docs. This is
config + tooling, **not a deployed app**.
- Detail: [`voice-agents/CLAUDE.md`](voice-agents/CLAUDE.md)
- Resume from: [`voice-agents/docs/where-we-left-off.md`](voice-agents/docs/where-we-left-off.md)

## `billing/` — prepaid billing portal (DEPLOYED)
Astro app on Vercel that meters VAPI usage (`cost × 1.35`) and bills the
customer via Stripe; Supabase ledger; Resend email.
- Detail: [`billing/CLAUDE.md`](billing/CLAUDE.md)
- Resume from: [`billing/docs/where-we-left-off.md`](billing/docs/where-we-left-off.md)
- Production: <https://farmerbrown.theb2btinkerers.com>

## Cross-cutting

- **Shared credential:** both use the same `VAPI_KEY`. Each folder has its own
  `.env` (gitignored) + `.env.example`.
- **The BR lead-email notifier lives in `billing/`** (`src/pages/api/vapi-lead-email.ts`)
  but belongs to the voice-agent system — a VAPI webhook on the BR number
  `+18882934492` triggers it to email the filled quote form + transcript. Spec:
  `voice-agents/docs/jennifer-lead-email-notifications.md`.
- **Deploy:** Vercel builds **only** `billing/` — the Vercel project's
  **Root Directory = `billing/`**. Pushing `main` auto-deploys the portal.
- **External comms:** never name the underlying voice platform to anyone outside
  the team (including Pablo / Calforce); quote costs `× 1.25`. See memory
  `external-comms-rules`.

## History note
`billing/` was imported via `git subtree add --squash` (2026-07-06) from the
standalone `farmerbrown-billing` repo — brought in as a single commit (squashed)
because that repo's git history contained a Stripe **test** key that GitHub's
push protection blocks. **The full billing history is preserved in the original
`farmerbrown-billing` repo**, which stays as the history archive. Backup tag of
the voice-agents repo before the restructure: `backup/pre-monorepo-2026-07-06`.
