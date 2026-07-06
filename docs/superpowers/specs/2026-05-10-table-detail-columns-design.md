# Table-detail columns (caller phone + agent / website) — design

**Status:** approved 2026-05-10
**Author:** José + Claude (brainstorming session)
**Companion plan:** to be created via `writing-plans` skill after this spec is approved.

## Context

This is Spec #3 from the original portal decomposition (Specs #1 and #2 are
shipped on `main`). John today sees the calls table with Date, Duration,
Status, Summary, Charge — but two pieces of high-value context are missing:

1. **Who called.** `vapi_raw.customer.number` is in the database for every
   row but never rendered. John can't tell whether a call came from a known
   contact, a recurring caller, or a random number.
2. **Which website / agent took the call.** `calls.vapi_assistant_id` and
   `calls.vapi_squad_id` are stored as opaque VAPI UUIDs. John knows that
   "Grace" answers calls from Builders Risk, "Olivia" from Contractor's
   Liability, and "Emma" from Farmer Brown — but the portal shows none of that
   today, only the UUIDs (which it doesn't surface either, but they're the
   only handle).

Adding both pieces in the table — without breaking the 5-column layout that
Spec #2 just stabilised at `table-layout: fixed` — is the goal of this spec.

The same info also flows into the `CallDetailHeader` on `/portal/calls/[id]`
so the detail page stays consistent with the row.

## Out of scope

- **Cron sync of VAPI assistant/squad names** to a Supabase `assistants`
  table. Was the leading approach during brainstorming; pivoted to a
  hardcoded TS mapping because the universe today is exactly three websites
  (3 mappings — not worth a migration + cron change + per-id sub-call to
  VAPI). If this grows past ~20 mappings or goes multi-tenant, reconsider.
- **Caller name extraction** from the transcript via NLP. The VAPI payload
  doesn't expose `customer.name`; pulling it from speech is a separate spec.
- **Phone formatting for non-US numbers.** All Farmer Brown traffic is +1
  today; we render `+1 555-555-0123` for +1 and the raw E.164 for everything
  else.
- **Editable mapping in the portal UI.** José edits `src/lib/assistants.ts`
  directly and commits. No admin screen.

## Architecture

The whole change lives in the existing portal, with **no new database
tables, no new migrations, no schema changes**. Three new pieces of code,
two existing files extended.

**New files:**
- `src/lib/assistants.ts` — single source of truth for the
  `vapi_id → { name, website }` mapping plus a `resolveAgent` helper that
  picks the best label for a given `(assistantId, squadId)` pair.

**Modified files:**
- `src/lib/format.ts` — add `formatPhone(e164: string | null): string | null`
  with US-friendly rendering for `+1` numbers, raw passthrough otherwise.
- `src/lib/callDetail.ts` — export `CALLER_PREVIEW_SELECT` constant (a
  PostgREST jsonpath fragment) so the list query lifts only `customer.number`
  from `vapi_raw` instead of pulling the whole jsonb. Same pattern as
  `SUMMARY_PREVIEW_SELECT` from Spec #2; keeps the curation boundary in one
  module.
- `src/pages/portal/index.astro` — extend the `.select(...)` on `calls` to
  pull `vapi_assistant_id`, `vapi_squad_id`, and the caller phone via the
  new jsonpath fragment.
- `src/components/CallsTable.astro` — `Call` interface gains 3 nullable
  fields; Date cell renders an optional phone subtitle below the timestamp;
  Status cell renders an optional `from <Website> · <Agent>` subtitle below
  the humanised ended_reason.
- `src/components/CallDetailHeader.astro` — a new conditional row "Agent"
  (rendered only when `resolveAgent` returns non-null) sitting between
  Status and Charge.

## The mapping module — `src/lib/assistants.ts`

```ts
export interface AgentInfo {
  name: string;
  website: string;
}

/**
 * VAPI ID → human-readable agent + website mapping. Hardcoded because
 * Farmer Brown only has three websites today (Builders Risk, Contractor's
 * Liability, Farmer Brown) and pulling this from VAPI live would require
 * a migration + cron change for marginal value. If the catalogue grows
 * past ~20 mappings or goes multi-tenant, migrate to a Supabase table.
 *
 * Both assistant ids and squad ids share the same map. Squads can use
 * `name === website` so the renderer dedupes the subtitle.
 */
export const AGENTS_BY_ID: Record<string, AgentInfo> = {
  // Receptionists (assistants):
  // 'TODO-uuid-grace':  { name: 'Grace',  website: 'Builders Risk' },
  // 'TODO-uuid-olivia': { name: 'Olivia', website: "Contractor's Liability" },
  // 'TODO-uuid-emma':   { name: 'Emma',   website: 'Farmer Brown' },
  // Squads (overall flows): add as needed; pattern { name: '<Website>', website: '<Website>' }
  //                                          to render as "from <Website>" without redundancy.
};

/**
 * Pick the best label for a call: prefer the specific assistant (more
 * granular), fall back to the squad. Returns null when neither side has
 * a known mapping.
 */
export function resolveAgent(
  assistantId: string | null,
  squadId: string | null,
): AgentInfo | null {
  if (assistantId && AGENTS_BY_ID[assistantId]) return AGENTS_BY_ID[assistantId];
  if (squadId && AGENTS_BY_ID[squadId])         return AGENTS_BY_ID[squadId];
  return null;
}
```

The plan will start with empty entries marked `TODO`. José provides the real
UUIDs from the VAPI dashboard before we ship — until they're in, the agent
subtitle simply doesn't render (which is the same as today's behaviour).

## Phone formatter — `src/lib/format.ts`

```ts
/**
 * Render an E.164 phone number for display. Today VAPI gives us +1 for
 * every call (US-only customer base); we format those and pass everything
 * else through unchanged. Returns null untouched.
 */
export function formatPhone(e164: string | null): string | null {
  if (!e164) return null;
  // Strict +1 + 10-digit US format. Anything else falls back to raw.
  const us = e164.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  if (us) return `+1 ${us[1]}-${us[2]}-${us[3]}`;
  return e164;
}
```

## List query — what changes in `/portal`

Today's call select (post-Spec #2):

```ts
.select(
  `id, started_at, duration_seconds, charge_cents, ended_reason, ${SUMMARY_PREVIEW_SELECT}`,
  { count: 'exact' }
)
```

Becomes:

```ts
.select(
  `id, started_at, duration_seconds, charge_cents, ended_reason, vapi_assistant_id, vapi_squad_id, ${CALLER_PREVIEW_SELECT}, ${SUMMARY_PREVIEW_SELECT}`,
  { count: 'exact' }
)
```

`vapi_assistant_id` and `vapi_squad_id` are real columns on `calls`; the
caller phone uses the same `vapi_raw->customer->>number` jsonpath trick the
summary preview already uses. Net: one query, no extra round-trip, no
transferring the whole `vapi_raw` blob.

## CallsTable — Date cell and Status cell

**Date cell** (existing structure preserved; subtitle added below):

```astro
<td class="small"><a class="cell" href={href} aria-label={ariaLabel} title="View call details">
  <div>{formatTime(c.started_at)}</div>
  {phoneLabel && <div class="subtitle mono">{phoneLabel}</div>}
</a></td>
```

Where `phoneLabel = formatPhone(c.caller)`. When null, the subtitle div is
omitted entirely — no `—` placeholder, no empty space.

**Status cell** (same pattern):

```astro
<td class="small text-muted"><a class="cell" href={href} aria-hidden="true" tabindex="-1" title="View call details">
  <div>{formatEndedReason(c.ended_reason)}</div>
  {agentLabel && <div class="subtitle">{agentLabel}</div>}
</a></td>
```

Where `agentLabel` comes from a small inline helper:

```ts
function agentSubtitle(agent: AgentInfo | null): string | null {
  if (!agent) return null;
  if (agent.name === agent.website) return `from ${agent.website}`;
  return `from ${agent.website} · ${agent.name}`;
}
```

Subtitle CSS lives in the component's scoped `<style>` block:

```css
.subtitle {
  display: block;
  font-size: 0.75rem;
  color: var(--muted);
  margin-top: 0.125rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

The `nowrap + ellipsis` combo respects the column width caps already set in
Spec #2 (Date 12rem, Status 11rem). Long phone numbers or long website names
truncate with `…`; the `title` attribute on the parent `<a>` plus the row
hover affordance still drive users to the detail page if they need the full
text.

## CallDetailHeader — new "Agent" row

A new conditional `<dt>/<dd>` pair, rendered only when `resolveAgent`
returns non-null, sits between Status and Charge:

```astro
{agent && (
  <>
    <dt>Agent</dt>
    <dd>{agent.name === agent.website ? agent.website : `${agent.website} · ${agent.name}`}</dd>
  </>
)}
```

The page passes `vapi_assistant_id` and `vapi_squad_id` from its existing
`call` row (the focal-call select already includes these — the page's select
list pulls every column the page renders) into a small wrapper that calls
`resolveAgent` and forwards the result.

Today's `CallDetailHeader.astro` doesn't accept those ids; the spec adds
two new optional props (`vapiAssistantId`, `vapiSquadId`) so the resolution
happens inside the component (keeps the page free of mapping logic).

## Data flow (unchanged for everything else)

1. Auth gate / RLS as today.
2. Portal query: extended `.select()` brings `vapi_assistant_id`,
   `vapi_squad_id`, `caller` (from jsonpath), and the existing fields.
3. Each row is rendered by `CallsTable`, which passes the call object
   through unchanged. Inside the row, `resolveAgent` and `formatPhone` run
   per-row to build the optional subtitle strings.
4. On `/portal/calls/[id]`, the focal-call query already pulls the relevant
   columns (`vapi_raw` and the row id columns); we add the two extra ids to
   the existing `select` list (one extra column read each — negligible) and
   pass them to `CallDetailHeader`.

## Edge cases handled

| Case | Behaviour |
|---|---|
| `customer.number` missing in `vapi_raw` (web calls, non-PSTN) | Phone subtitle omitted entirely under Date. |
| `vapi_assistant_id` and `vapi_squad_id` both null | Agent subtitle omitted. |
| Either id present but not in `AGENTS_BY_ID` | Agent subtitle omitted (no fallback to UUID — opaque to John). |
| Squad mapping where `name === website` | Render `from <Website>` only (no `· Name` redundancy). |
| Long subtitle exceeds the column width | Ellipsis truncation; full text in `title` attribute. |
| +1 phone | Formatted `+1 555-555-0123`. |
| Non-+1 phone | Raw E.164 passthrough. |
| `assistants.ts` still has `TODO` placeholders (pre-rollout) | Resolution returns null, subtitle omits — same as today's UI. Safe to ship before José provides the real UUIDs. |

## Risks / gotchas

1. **`AGENTS_BY_ID` drift.** If José adds an assistant in VAPI without
   updating `assistants.ts`, the row silently shows no agent. Mitigation:
   the omission is the same as today's blank state — users don't see broken
   data, just less data. Document the file's existence in
   `where-we-left-off.md` so it's part of the project mental model.
2. **Squad-only calls have no granular assistant context.** If
   `vapi_assistant_id` is null and only `vapi_squad_id` is present (the
   smoke-test data shows this is common), `resolveAgent` returns the squad
   entry. The squad mapping can be `{ name: '<Website>', website: '<Website>' }`
   to render cleanly as `from <Website>`. Documented in the module's JSDoc.
3. **Subtitle adds visual weight to every row.** The portal table is
   currently scannable in 1-2s. Two-line cells under Date and Status make
   the row roughly 1.5x taller. Acceptable trade-off for the value gained;
   if it ever feels heavy, a follow-up could move agent into the `title`
   tooltip and keep only the phone visible.
4. **`vapi_raw.customer.number` vs `customer_phone` column.** The schema
   has a dedicated `customer_phone` column on `calls` populated by the
   cron; we could read it directly instead of the jsonpath. Spec uses the
   jsonpath for symmetry with the summary preview, but the plan is free to
   pivot to the column read if it's cleaner — same data, slightly cheaper
   query.

## Verification (smoke test plan, after implementation)

With the existing 50-call smoke-test dataset and the real UUIDs in
`assistants.ts`:

1. `/portal` shows two-line Date and Status cells where data is present.
2. A row's caller phone reads `+1 555-555-0123` (formatted), agent reads
   `from Builders Risk · Grace` (or similar).
3. A row whose `vapi_assistant_id` is unmapped shows just the timestamp
   under Date and just the status under Status — no broken/empty subtitles.
4. The detail page for that same row shows "Agent: Builders Risk · Grace"
   in the header.
5. DevTools → Elements / Network → still zero references to `vapi.ai` or
   any VAPI UUID rendered to the customer.
6. `npm run check` clean.

## Open follow-ups (out of this spec)

- If multi-tenant lands, migrate the mapping to a Supabase `assistants`
  table with `customer_id` scope.
- If José wants to edit the mapping without a deploy, add a tiny admin
  page (or just an admin SQL Editor pattern).
- Caller name extraction (NLP from transcript) — separate spec if ever
  prioritised.
