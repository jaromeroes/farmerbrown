# Table detail columns — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show caller phone (formatted) under the Date cell and an `from <Website> · <Agent>` line under the Status cell of the calls table — and surface the same Agent line on the call detail page header — without breaking the column layout fixed in Spec #2.

**Architecture:** A new pure module `src/lib/assistants.ts` holds a hardcoded `vapi_id → { name, website }` mapping plus a `resolveAgent(assistantId, squadId)` helper. `src/lib/format.ts` gains a small `formatPhone(e164)` helper for US-friendly formatting. The portal query is extended to pull three more columns from `calls` directly (`vapi_assistant_id`, `vapi_squad_id`, `customer_phone`) — no jsonpath, no new RPC, no schema changes. The two consuming components (`CallsTable.astro` and `CallDetailHeader.astro`) render optional subtitles when data is available; everything is omitted gracefully when not.

**Tech Stack:** Astro 4 (`output: 'server'`) on Vercel, TypeScript strict, no test framework — pure helpers (`resolveAgent`, `formatPhone`) get inline ad-hoc tests via `npx tsx -e` (the pattern from Specs #1 and #2). UI changes get a manual smoke test in the dev server.

**Spec:** [`docs/superpowers/specs/2026-05-10-table-detail-columns-design.md`](../specs/2026-05-10-table-detail-columns-design.md) — read it first if anything in this plan is ambiguous. The spec listed "jsonpath vs `customer_phone` column" as an open decision (Risk #4); **this plan picks the column** because it's already populated by the cron, it's a one-token change to the existing `select()`, and there's no benefit to going through the jsonb path operator for a value that has its own column.

---

## File Structure

| Path | Purpose | Action |
|---|---|---|
| `src/lib/assistants.ts` | `AGENTS_BY_ID` mapping + `resolveAgent` helper + `AgentInfo` type | **Create** |
| `src/lib/format.ts` | `formatPhone(e164)` added next to existing money/duration helpers | **Modify** |
| `src/pages/portal/index.astro` | Extend `.select()` to bring `vapi_assistant_id`, `vapi_squad_id`, `customer_phone` | **Modify** |
| `src/components/CallsTable.astro` | `Call` interface gains 3 fields; Date and Status cells render optional subtitles; scoped `.subtitle` CSS | **Modify** |
| `src/components/CallDetailHeader.astro` | New `vapiAssistantId`/`vapiSquadId` props; new optional "Agent" row using `resolveAgent` | **Modify** |
| `src/pages/portal/calls/[id].astro` | Pass `vapi_assistant_id` and `vapi_squad_id` to the header | **Modify** |
| `docs/where-we-left-off.md` | One paragraph summarising the feature once it's working | **Modify** (last task) |

No schema changes. No new env vars. No new migrations.

---

## Task 1 — `src/lib/assistants.ts`

**Goal:** A self-contained mapping module with a single pure helper. The mapping starts empty (TODO placeholders) — José provides the real UUIDs from the VAPI dashboard before rollout. The helper is testable with ad-hoc `tsx` and never throws.

**Files:**
- Create: `src/lib/assistants.ts`

- [ ] **Step 1.1: Write the failing ad-hoc test**

```bash
cat > /tmp/test-assistants.ts <<'TS'
import { resolveAgent, AGENTS_BY_ID } from '/Users/jose/Developer/theb2btinkerers/clients/farmerbrown-billing/src/lib/assistants.ts';

function ok(label: string, actual: unknown, expected: unknown) {
  const passed = JSON.stringify(actual) === JSON.stringify(expected);
  console.log((passed ? 'PASS' : 'FAIL') + ' ' + label);
  if (!passed) {
    console.log('  expected:', JSON.stringify(expected));
    console.log('  got:     ', JSON.stringify(actual));
  }
}

// Inject test fixtures so the test doesn't depend on real UUIDs being filled in.
(AGENTS_BY_ID as Record<string, unknown>)['fixture-asst-grace']  = { name: 'Grace',  website: 'Builders Risk' };
(AGENTS_BY_ID as Record<string, unknown>)['fixture-squad-br']    = { name: 'Builders Risk', website: 'Builders Risk' };

ok('both null',
   resolveAgent(null, null),
   null);

ok('only assistant id, mapped',
   resolveAgent('fixture-asst-grace', null),
   { name: 'Grace', website: 'Builders Risk' });

ok('only squad id, mapped',
   resolveAgent(null, 'fixture-squad-br'),
   { name: 'Builders Risk', website: 'Builders Risk' });

ok('both ids, both mapped → assistant wins (more granular)',
   resolveAgent('fixture-asst-grace', 'fixture-squad-br'),
   { name: 'Grace', website: 'Builders Risk' });

ok('both ids, only squad mapped',
   resolveAgent('unknown-id', 'fixture-squad-br'),
   { name: 'Builders Risk', website: 'Builders Risk' });

ok('both ids, neither mapped',
   resolveAgent('unknown-1', 'unknown-2'),
   null);

console.log('Done.');
TS

npx --yes tsx /tmp/test-assistants.ts
```

Expected: `Cannot find module …` (file doesn't exist yet).

- [ ] **Step 1.2: Create `src/lib/assistants.ts`**

```ts
/**
 * VAPI ID → human-readable agent + website mapping.
 *
 * Hardcoded because Farmer Brown only has three websites today (Builders
 * Risk, Contractor's Liability, Farmer Brown). Pulling these names from
 * VAPI live would require a migration plus a per-id sub-call from the cron
 * for marginal value. If the catalogue grows past ~20 mappings or goes
 * multi-tenant, migrate to a Supabase table.
 *
 * Both assistant ids and squad ids share the same map. For a squad-only
 * call where there's no granular assistant, set `name === website` so the
 * renderer dedupes the subtitle into "from <Website>".
 *
 * To roll this out: open the VAPI dashboard, find each assistant/squad's
 * UUID, and fill it in below. Until the real UUIDs are in, `resolveAgent`
 * returns null for every call — the UI just doesn't render the subtitle,
 * which is the same as today's behaviour.
 */

export interface AgentInfo {
  name: string;
  website: string;
}

export const AGENTS_BY_ID: Record<string, AgentInfo> = {
  // Receptionists (assistants):
  // 'TODO-uuid-grace':  { name: 'Grace',  website: 'Builders Risk' },
  // 'TODO-uuid-olivia': { name: 'Olivia', website: "Contractor's Liability" },
  // 'TODO-uuid-emma':   { name: 'Emma',   website: 'Farmer Brown' },
  //
  // Squads (overall flows): when a call goes through a squad and the
  // granular assistant isn't extractable, the squad entry should carry
  // `name === website` to render as "from <Website>" without redundancy.
  // 'TODO-uuid-squad-br': { name: 'Builders Risk', website: 'Builders Risk' },
};

/**
 * Pick the best label for a call: prefer the specific assistant (more
 * granular), fall back to the squad. Returns null when neither side has
 * a known mapping — caller renders no subtitle.
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

- [ ] **Step 1.3: Re-run the test**

```bash
npx --yes tsx /tmp/test-assistants.ts
```

Expected: every assertion `PASS`.

- [ ] **Step 1.4: Cleanup + TypeScript check**

```bash
rm /tmp/test-assistants.ts
npm run check
```

Expected: `0 errors, 0 warnings, 3 hints` (the 3 pre-existing hints from before this work).

- [ ] **Step 1.5: Commit**

```bash
git add src/lib/assistants.ts
git commit -m "Add assistants mapping and resolveAgent helper

Hardcoded TS mapping of VAPI assistant/squad IDs to { name, website }.
Three Receptionist entries (Grace/Builders Risk, Olivia/Contractor's
Liability, Emma/Farmer Brown) start as TODO placeholders — real UUIDs
to be filled in from the VAPI dashboard before rollout. resolveAgent
prefers the granular assistant id over the squad id and returns null
for unmapped or null inputs.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2 — `formatPhone` in `src/lib/format.ts`

**Goal:** Add a tiny pure helper that renders `+1` numbers as `+1 555-555-0123` and passes everything else through unchanged. Lives next to the existing `formatMoney` / `formatDuration` helpers.

**Files:**
- Modify: `src/lib/format.ts`

- [ ] **Step 2.1: Write the failing ad-hoc test**

```bash
cat > /tmp/test-formatPhone.ts <<'TS'
import { formatPhone } from '/Users/jose/Developer/theb2btinkerers/clients/farmerbrown-billing/src/lib/format.ts';

function ok(label: string, actual: unknown, expected: unknown) {
  const passed = JSON.stringify(actual) === JSON.stringify(expected);
  console.log((passed ? 'PASS' : 'FAIL') + ' ' + label);
  if (!passed) {
    console.log('  expected:', JSON.stringify(expected));
    console.log('  got:     ', JSON.stringify(actual));
  }
}

ok('null → null',           formatPhone(null),               null);
ok('US +1 formatted',       formatPhone('+15555550123'),     '+1 555-555-0123');
ok('US +1 with diff area',  formatPhone('+18339024483'),     '+1 833-902-4483');
ok('UK +44 raw',            formatPhone('+447712345678'),    '+447712345678');
ok('Spain +34 raw',         formatPhone('+34655112233'),     '+34655112233');
ok('garbage raw',           formatPhone('+1 abc'),           '+1 abc');
ok('empty string raw',      formatPhone(''),                 '');

console.log('Done.');
TS

npx --yes tsx /tmp/test-formatPhone.ts
```

Expected: `formatPhone is not a function` or similar (the export doesn't exist yet).

- [ ] **Step 2.2: Add `formatPhone` to `src/lib/format.ts`**

Append at the end of the file (after `formatDurationLong`):

```ts
/**
 * Render an E.164 phone number for display. VAPI gives us +1 for every
 * call today (US-only customer base); we format those US-style and pass
 * everything else through unchanged. Null comes through untouched.
 *
 * Examples:
 *   '+15555550123' → '+1 555-555-0123'
 *   '+447712345678' → '+447712345678'  (raw)
 *   null → null
 */
export function formatPhone(e164: string | null): string | null {
  if (e164 === null) return null;
  const us = e164.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  if (us) return `+1 ${us[1]}-${us[2]}-${us[3]}`;
  return e164;
}
```

- [ ] **Step 2.3: Re-run the test**

```bash
npx --yes tsx /tmp/test-formatPhone.ts
```

Expected: every assertion `PASS`.

- [ ] **Step 2.4: Cleanup + TypeScript check**

```bash
rm /tmp/test-formatPhone.ts
npm run check
```

Expected: `0 errors, 0 warnings, 3 hints`.

- [ ] **Step 2.5: Commit**

```bash
git add src/lib/format.ts
git commit -m "Add formatPhone helper for US-friendly E.164 rendering

Renders +1 + 10-digit numbers as '+1 555-555-0123'; non-+1 numbers
pass through as raw E.164. Null and unparseable strings come back
untouched. Used by the calls table to render the caller subtitle.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3 — Extend `/portal` query

**Goal:** Pull three more columns from `calls` (no jsonpath, no `vapi_raw` blob) so the table component has what it needs. Single-line change.

**Files:**
- Modify: `src/pages/portal/index.astro`

- [ ] **Step 3.1: Update the `.select()` for the page-of-calls query**

In `src/pages/portal/index.astro`, find the existing call list select:

```ts
const { data: calls, count } = await supabase
  .from('calls')
  .select(
    `id, started_at, duration_seconds, charge_cents, ended_reason, ${SUMMARY_PREVIEW_SELECT}`,
    { count: 'exact' }
  )
```

Replace the column list (the part inside the backticks before the count option) with:

```ts
  .select(
    `id, started_at, duration_seconds, charge_cents, ended_reason, customer_phone, vapi_assistant_id, vapi_squad_id, ${SUMMARY_PREVIEW_SELECT}`,
    { count: 'exact' }
  )
```

`customer_phone`, `vapi_assistant_id`, `vapi_squad_id` are real columns on
`calls` (see `supabase/migrations/20260508_000000_init.sql`); no path
operators needed.

- [ ] **Step 3.2: TypeScript check**

```bash
npm run check
```

Expected: `0 errors, 0 warnings, 3 hints`.

- [ ] **Step 3.3: Commit**

```bash
git add src/pages/portal/index.astro
git commit -m "Pull caller phone + assistant/squad ids into /portal query

Adds three columns to the calls page select so CallsTable can render
the new caller and agent subtitles. customer_phone is already
populated by the cron from vapi_raw.customer.number; the assistant
and squad ids are stored as their own columns. No jsonpath needed.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4 — Subtitles in `CallsTable`

**Goal:** Render the caller phone under Date and the `from <Website> · <Agent>` line under Status. Subtitles only appear when data is present and the agent is mapped. Layout columns from Spec #2 stay intact.

**Files:**
- Modify: `src/components/CallsTable.astro`

- [ ] **Step 4.1: Update imports + `Call` interface**

At the top of the frontmatter, add to the existing imports:

```ts
import { formatTime, formatDuration, formatMoney, formatPhone } from '@lib/format';
import { resolveAgent, type AgentInfo } from '@lib/assistants';
```

Update the `Call` interface to declare the three new fields:

```ts
interface Call {
  id: string;
  started_at: string | null;
  duration_seconds: number | null;
  charge_cents: number;
  ended_reason: string | null;
  summary: string | null;
  customer_phone: string | null;
  vapi_assistant_id: string | null;
  vapi_squad_id: string | null;
}
```

- [ ] **Step 4.2: Add an `agentSubtitle` helper above the rendered template**

Inside the frontmatter, before the closing `---`, add:

```ts
function agentSubtitle(agent: AgentInfo | null): string | null {
  if (!agent) return null;
  if (agent.name === agent.website) return `from ${agent.website}`;
  return `from ${agent.website} · ${agent.name}`;
}
```

- [ ] **Step 4.3: Update Date and Status cells to render the subtitles**

Inside the existing `calls.map((c) => { … })` block, after the existing `const href = …;` line and the `ariaLabel` block, add the per-row computed strings:

```ts
const phoneLabel = formatPhone(c.customer_phone);
const agentLabel = agentSubtitle(resolveAgent(c.vapi_assistant_id, c.vapi_squad_id));
```

Then replace the Date cell:

```astro
<td class="small"><a class="cell" href={href} aria-label={ariaLabel} title="View call details">{formatTime(c.started_at)}</a></td>
```

with:

```astro
<td class="small"><a class="cell" href={href} aria-label={ariaLabel} title="View call details">
  <div>{formatTime(c.started_at)}</div>
  {phoneLabel && <div class="subtitle mono">{phoneLabel}</div>}
</a></td>
```

And replace the Status cell:

```astro
<td class="small text-muted"><a class="cell" href={href} aria-hidden="true" tabindex="-1" title="View call details">{formatEndedReason(c.ended_reason)}</a></td>
```

with:

```astro
<td class="small text-muted"><a class="cell" href={href} aria-hidden="true" tabindex="-1" title="View call details">
  <div>{formatEndedReason(c.ended_reason)}</div>
  {agentLabel && <div class="subtitle">{agentLabel}</div>}
</a></td>
```

Leave Duration, Summary and Charge cells untouched.

- [ ] **Step 4.4: Add `.subtitle` CSS at the end of the scoped `<style>` block**

Inside the existing `<style>` block (before the closing `</style>`), append:

```css
  /* Two-line cells under Date and Status: timestamp / status on the first
     line, caller phone / agent label on the second in muted small. The
     ellipsis truncates if the agent label is too long for the column. */
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

- [ ] **Step 4.5: TypeScript check**

```bash
npm run check
```

Expected: `0 errors, 0 warnings, 3 hints`.

- [ ] **Step 4.6: Commit**

```bash
git add src/components/CallsTable.astro
git commit -m "Show caller phone and agent/website subtitles in CallsTable

Date cell gains a second line with the formatted caller phone (when
present). Status cell gains 'from <Website> · <Agent>' (when the
assistant/squad id maps via src/lib/assistants.ts; squad-only entries
where name === website dedupe to 'from <Website>'). Subtitles use
muted small styling with ellipsis truncation, so layout from Spec #2
stays stable.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5 — Agent row in `CallDetailHeader`

**Goal:** Mirror the agent label on `/portal/calls/[id]`. Header gains two optional props (`vapiAssistantId`, `vapiSquadId`) and a new conditional row.

**Files:**
- Modify: `src/components/CallDetailHeader.astro`

- [ ] **Step 5.1: Add `resolveAgent` import + new props**

At the top of the frontmatter, alongside existing imports, add:

```ts
import { resolveAgent } from '@lib/assistants';
```

Update the `Props` interface — append the two new optional fields:

```ts
interface Props {
  startedAt:       string | null;
  durationSeconds: number | null;
  endedReason:     string | null;
  chargeCents:     number;
  currency:        string;
  detail:          CallDetailView;
  vapiAssistantId: string | null;
  vapiSquadId:     string | null;
}
```

Update the destructure:

```ts
const {
  startedAt, durationSeconds, endedReason, chargeCents, currency, detail,
  vapiAssistantId, vapiSquadId,
} = Astro.props;
```

- [ ] **Step 5.2: Compute the agent label in the frontmatter**

After the existing helper definitions (`outcomeLabel`, `outcomeClass`), add:

```ts
const agent = resolveAgent(vapiAssistantId, vapiSquadId);
const agentLabel = agent
  ? (agent.name === agent.website ? agent.website : `${agent.website} · ${agent.name}`)
  : null;
```

- [ ] **Step 5.3: Render the new Agent row**

Inside the existing `<dl class="header-grid">`, between the Status block and the Forwarded-to block, add:

```astro
{agentLabel && (
  <>
    <dt>Agent</dt>
    <dd>{agentLabel}</dd>
  </>
)}
```

The full ordering becomes: Caller → Destination → Started → Duration → Status → **Agent** → Forwarded to → Outcome → Charge.

- [ ] **Step 5.4: TypeScript check**

```bash
npm run check
```

Expected: `0 errors, 0 warnings, 3 hints`.

- [ ] **Step 5.5: Commit**

```bash
git add src/components/CallDetailHeader.astro
git commit -m "Add Agent row to CallDetailHeader

New optional row between Status and Forwarded-to that shows the
agent + website label resolved from the call's vapi_assistant_id /
vapi_squad_id. Omitted when neither id is mapped in
src/lib/assistants.ts. Same formatting as the table subtitle:
'<Website>' for squad entries where name === website,
'<Website> · <Agent>' otherwise.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6 — Wire the page to pass the ids

**Goal:** Pass the focal call's `vapi_assistant_id` and `vapi_squad_id` to the header. The fields are already on the row (the focal-call select is `*`-equivalent) — we just need to forward them.

**Files:**
- Modify: `src/pages/portal/calls/[id].astro`

- [ ] **Step 6.1: Update the focal-call `.select()` (sanity check)**

The current select is:

```ts
.select('id, started_at, duration_seconds, ended_reason, charge_cents, vapi_raw')
```

Update to add the two id columns:

```ts
.select('id, started_at, duration_seconds, ended_reason, charge_cents, vapi_raw, vapi_assistant_id, vapi_squad_id')
```

- [ ] **Step 6.2: Pass the ids to `CallDetailHeader`**

The current invocation is:

```astro
<CallDetailHeader
  startedAt={call.started_at}
  durationSeconds={call.duration_seconds}
  endedReason={call.ended_reason}
  chargeCents={call.charge_cents}
  currency={session.currency}
  detail={detail}
/>
```

Update to:

```astro
<CallDetailHeader
  startedAt={call.started_at}
  durationSeconds={call.duration_seconds}
  endedReason={call.ended_reason}
  chargeCents={call.charge_cents}
  currency={session.currency}
  detail={detail}
  vapiAssistantId={call.vapi_assistant_id}
  vapiSquadId={call.vapi_squad_id}
/>
```

- [ ] **Step 6.3: TypeScript check**

```bash
npm run check
```

Expected: `0 errors, 0 warnings, 3 hints`.

- [ ] **Step 6.4: Commit**

```bash
git add src/pages/portal/calls/[id].astro
git commit -m "Pass assistant/squad ids from page to CallDetailHeader

Focal-call select already returned vapi_raw; explicitly include
vapi_assistant_id and vapi_squad_id so CallDetailHeader can resolve
the agent label without re-reading vapi_raw. Same security model:
RLS scopes the focal fetch to the customer's own rows.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7 — Smoke test + doc

**Goal:** Validate end-to-end with a real magic-link session, then capture the feature in `where-we-left-off.md`.

**Files:** none modified during the smoke test; `docs/where-we-left-off.md` modified at the end.

- [ ] **Step 7.1: Start the dev server**

```bash
set -a; source .env; set +a
npm run dev
```

Server should print `Local http://localhost:4321/`.

- [ ] **Step 7.2: Generate a magic link**

```bash
set -a; source .env; set +a
python3 - <<'PY'
import os, json, urllib.request
URL = os.environ['PUBLIC_SUPABASE_URL']
SR  = os.environ['SUPABASE_SERVICE_ROLE_KEY']
req = urllib.request.Request(
    f'{URL}/auth/v1/admin/generate_link',
    data=json.dumps({'type':'magiclink','email':'tester@theb2btinkerers.com'}).encode(),
    method='POST',
    headers={'apikey': SR, 'Authorization': f'Bearer {SR}',
             'Content-Type':'application/json','User-Agent':'curl/8.0'}
)
with urllib.request.urlopen(req) as r:
    print(json.loads(r.read())['action_link'])
PY
```

Open the URL.

- [ ] **Step 7.3: Walk through the verification cases**

Tick each manually:

- [ ] On `/portal`, every row with a `customer_phone` in BD shows the formatted phone (e.g. `+1 555-555-0123`) under the timestamp in muted small.
- [ ] Rows whose `customer_phone` is null (legacy or web calls) show the timestamp alone — no `—` placeholder, no broken empty space.
- [ ] If `AGENTS_BY_ID` is still empty (rollout pre-UUIDs), no Status subtitle renders anywhere — the table looks identical to today's UI under that cell. *Confirm by visual diff.*
- [ ] Once `AGENTS_BY_ID` has at least one entry whose UUID matches at least one row's `vapi_assistant_id` or `vapi_squad_id`, that row renders `from <Website>` or `from <Website> · <Agent>` under the status. (If José hasn't filled in the real UUIDs yet, do this with a temporary `console.log(call.vapi_assistant_id)` in the page during dev to find a known id, drop a fixture entry into the mapping, and verify rendering — then back out the fixture.)
- [ ] Click into a row whose agent is mapped → the detail page shows an "Agent" row in the header with the same label.
- [ ] Click into a row whose agent is not mapped → no "Agent" row.
- [ ] DevTools → Network: zero requests to `*.vapi.ai`.
- [ ] DevTools → Elements (Cmd-F "vapi"): zero matches in the rendered DOM.
- [ ] Visual check: the Date column still single-lines the timestamp (Spec #2 layout fix preserved); the row is now slightly taller (~1.5x) because of the two-line cells, but no horizontal overflow. (Risk #3 from the spec.)
- [ ] `npm run check` final run: 0 errors.

- [ ] **Step 7.4: Stop the dev server**

`Ctrl-C` in the dev-server terminal.

- [ ] **Step 7.5: Update `docs/where-we-left-off.md`**

Add a short section under the existing "Call detail page (2026-05-10, Spec #2)" section, sibling to it, summarising what shipped:

- File added: `src/lib/assistants.ts` (mapping module).
- Files modified: `src/lib/format.ts` (`formatPhone`), `src/pages/portal/index.astro`, `src/components/CallsTable.astro`, `src/components/CallDetailHeader.astro`, `src/pages/portal/calls/[id].astro`.
- `AGENTS_BY_ID` ships with TODO placeholders — note this and that José needs to drop in the real UUIDs from the VAPI dashboard for the subtitles to appear in production.
- Move the bullet for Spec #3 from the "Specs queued" list to the "shipped" lineage so the queue accurately reflects what's left (#4 and #5).

- [ ] **Step 7.6: Final commit**

```bash
git add docs/where-we-left-off.md
git commit -m "Document Spec #3 (table detail columns) in where-we-left-off

Records the new mapping module + the formatter additions, and notes
that AGENTS_BY_ID needs real UUIDs before the subtitles appear in
production. Moves Spec #3 out of the queue and into the shipped log.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Done criteria

- All 7 tasks committed on the feature branch.
- `npm run check` final exits clean (0 errors, 3 pre-existing hints).
- Manual smoke test walks the verification list without surprises.
- `assistants.ts` mapping is documented in `where-we-left-off.md` with the "fill in real UUIDs" reminder.
- VAPI brand still doesn't appear in any customer-facing string, request, or DOM node.

## Rollback note

Every task is its own commit and they don't touch the schema. If anything blocks shipping, `git revert` of the relevant commits returns the portal to its post-Spec-#2 state cleanly.
