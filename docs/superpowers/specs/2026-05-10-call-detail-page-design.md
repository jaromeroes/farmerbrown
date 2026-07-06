# Call detail page — design

**Status:** approved 2026-05-10
**Author:** José + Claude (brainstorming session)
**Companion plan:** to be created via `writing-plans` skill after this spec is approved.

## Context

The portal at `/portal` shows a paginated list of calls but no way to drill into one. Today John can see *that* a call happened, what it cost, and how long it took — but not *what* was said. Spec #1 (already shipped, commit `d5bb25e`) added filters, pagination and period metrics; this spec covers the next decomposed piece from the original brainstorming session: **the detail view for a single call**.

Why now: it's the highest-value of the four follow-up specs because it's what most differentiates the portal as a "real product" rather than a billing summary. The infrastructure is already in place — every call's full VAPI payload is persisted to `calls.vapi_raw` (jsonb) at sync time, so this spec is mostly UI work and field curation.

**Hard constraint** — same as Spec #1: nothing in the customer-facing UI can mention or link to VAPI. The audio recording lives at `storage.vapi.ai/...` and would leak the brand if exposed. Decision (this spec): **no audio in v1**. Transcript and AI summary already cover the high-value information; audio is a follow-up if and when John asks for it.

## Out of scope

- Audio recording playback (deferred — see "Open follow-ups" below).
- Mapping `vapi_assistant_id` to a human-readable assistant name.
- Tabbed views, chat bubbles, or any non-stack layout.
- A dedicated `/api/calls/[id].json` endpoint — the page is server-rendered top-to-bottom, no client-side fetching.
- Transcript editing, summary editing, or any write operation. Read-only.

## Architecture

**Route:** `src/pages/portal/calls/[id].astro` (new). Server-rendered (`output: 'server'`, `prerender: false`). RLS on `calls` is the single security boundary — the page uses the cookie-scoped Supabase client like the rest of the portal; if John tries to load a call that isn't his, the row simply isn't returned and the page renders a 404.

**Query string:** `?preset=&from=&to=&page=` — passed through from `/portal` so the page can reconstruct the "Back" link and the Older/Newer scope. Reuses `parseCallsQuery` from `src/lib/filters.ts` to do the parsing; defaults applied if anything is missing or garbage (mirrors the `/portal` behaviour).

**Layout:** single column, reusing `src/layouts/Portal.astro`. Maximum width inherits the existing `.container` (880px). Stack of `.card` blocks identical in style to `BalanceCard` / `MetricsCards`.

## Components

```
src/pages/portal/calls/[id].astro          (new — page route)
src/components/CallDetailHeader.astro       (new — metadata card)
src/components/CallTranscript.astro         (new — transcript card with parsing)
src/lib/callDetail.ts                       (new — vapi_raw curation helper)
src/components/CallsTable.astro             (modified — rows become clickable links)
```

`Summary` is a thin enough render that it lives inline in `[id].astro` rather than as its own component. If it grows (formatting, multilingual, etc.) it can be extracted later.

## Page anatomy (top to bottom)

1. **Top bar** — `<a href="...">← Back to portal</a>` rendered above the first card. The href is built with `buildHref('/portal', q)` from `src/lib/filters.ts` so the user lands back on the same filter and page they came from.

2. **Header card** (`CallDetailHeader.astro`) — fields, in order:
   - **Caller**: `vapi_raw.customer.number` (E.164). Bold.
   - **Destination**: `vapi_raw.destination.number` — the Farmer Brown number that received the call.
   - **Started**: `started_at` formatted via `formatTime` from `src/lib/format.ts` (en-US, "May 9, 2026, 8:21 PM").
   - **Duration**: `duration_seconds` via `formatDuration`.
   - **Status**: humanised `ended_reason` — reuses the same `formatEndedReason` map currently inline in `CallsTable.astro`. Extract that map into `src/lib/callDetail.ts` (or a small `src/lib/endedReason.ts`) so both components share one source of truth.
   - **Charge**: `charge_cents` via `formatMoney`, plus the `currency` from session.
   - **Forwarded to**: `vapi_raw.forwardedPhoneNumber` — rendered only when `ended_reason` indicates a transfer (e.g. `assistant-forwarded-call`, `assistant-ended-call-with-hangup-task`). When absent, the field is omitted entirely (no "—" placeholder; less noise).
   - **Outcome**: `vapi_raw.analysis.successEvaluation`. Render rules:
     - boolean `true` → `Successful` (green)
     - boolean `false` → `Failed` (red)
     - string (e.g. `"pass"`, `"fail"`, a free-form score) → titlecased as-is in muted colour
     - missing or `null` → omit the field entirely (don't render a row)

   Layout: a `<dl>` with `<dt>`/`<dd>` pairs in a two-column grid on desktop, single column on mobile. Reuses existing `.card`, `.small`, `.text-muted` classes; minimal scoped CSS for the grid.

3. **Summary card** — `<h2>Summary</h2>` followed by `vapi_raw.analysis.summary` rendered as a single `<p>` (the field is plain text from VAPI's analysis pass, ~360 chars in the smoke-test sample). When missing or empty, render a single muted line: *"No summary available for this call."*.

4. **Transcript card** (`CallTranscript.astro`) — `<h2>Transcript</h2>` plus parsed turns. The raw field is a string with format `"AI: …\nUser: …\nAI: …"` (newline-separated turns, label-prefixed). The component:
   - Splits on lines that start with a known speaker prefix (`AI:`, `User:`).
   - Translates the prefix: `AI` → `Agent`, `User` → `Caller`.
   - Renders each turn as `<p><strong>{Label}:</strong> {text}</p>`.
   - Handles continuation lines (text without a prefix that follows a labelled line) by appending to the previous turn.
   - On empty/missing transcript, renders a single muted line: *"Transcript not available."*

5. **Bottom navigation** — two anchor buttons side-by-side:
   - `← Newer call` — links to the next chronologically-newer call (`started_at >` current) **within the same `from/to` range**. Disabled (`<span aria-disabled>`) when there isn't one.
   - `Older call →` — same idea, `started_at <` current. Disabled when there isn't one.

   Labels are intentionally `Newer / Older` rather than `Prev / Next` to remove the ambiguity of "next in a DESC-sorted list".

   Each button preserves the current `preset/from/to/page` query string. The `page` value isn't recomputed — if jumping older crosses a page boundary, John's "Back to portal" still goes to the page he came from. That's a deliberate simplification; if it ever feels wrong, recomputing the destination page is a small follow-up.

## Data flow

Server frontmatter, in order:

1. `getCustomerSession(supabase)` — auth gate; redirect to `/login` if absent (same pattern as `/portal`).
2. `parseCallsQuery(Astro.url.searchParams)` — reuses Spec #1 helper. Used for the Back link and to scope Older/Newer.
3. Fetch the focal call:
   ```ts
   supabase.from('calls')
     .select('id, customer_id, started_at, ended_at, duration_seconds, ended_reason, charge_cents, vapi_raw')
     .eq('id', params.id)
     .maybeSingle();
   ```
   If `null` (RLS-hidden, missing, or not the user's): `return new Response('Not found', { status: 404 })`.
4. Curate via `pickCallDetail(call)` — pure function in `src/lib/callDetail.ts` that pulls only the safe fields from `vapi_raw` and returns a typed `CallDetailView`. Does **not** include any of: `cost`, `costBreakdown`, `costs`, `orgId`, `phoneCallProvider`, `phoneCallProviderId`, `monitor.*`, `assistantActivations`, `nodes`, `recordingUrl`, `stereoRecordingUrl`, anything starting with the literal substring `vapi`. The function is the *only* place where `vapi_raw` is read.
5. Two small queries for Older/Newer scoped by the active filter:
   ```ts
   // Older (started_at < current, within range)
   supabase.from('calls')
     .select('id')
     .eq('customer_id', session.customerId)
     .lt('started_at', call.started_at)
     .gte('started_at', q.fromIso)
     .lt('started_at', q.toIso)
     .order('started_at', { ascending: false })
     .limit(1)
     .maybeSingle();

   // Newer (started_at > current, within range)
   supabase.from('calls')
     .select('id')
     .eq('customer_id', session.customerId)
     .gt('started_at', call.started_at)
     .gte('started_at', q.fromIso)
     .lt('started_at', q.toIso)
     .order('started_at', { ascending: true })
     .limit(1)
     .maybeSingle();
   ```
6. Render.

No new RPC. No changes to schema or migrations.

## Curation contract — `pickCallDetail`

```ts
// src/lib/callDetail.ts
export interface CallDetailView {
  callerNumber: string | null;
  destinationNumber: string | null;
  forwardedTo: string | null;       // null when not a transfer
  summary: string | null;
  transcriptRaw: string | null;     // raw VAPI string; CallTranscript parses
  outcome:
    | { kind: 'bool'; value: boolean }
    | { kind: 'label'; value: string }
    | { kind: 'none' };
}

export function pickCallDetail(vapiRaw: unknown): CallDetailView;
```

Implementation rules:
- Treat `vapiRaw` as `unknown` and walk it defensively (`typeof === 'object'`, `=== 'string'`, etc.). Any unexpected shape → fall back to `null` / `{ kind: 'none' }` rather than throw.
- Only the fields listed in the interface are read. Anything else in `vapi_raw` is ignored. Adding a new field is a deliberate, reviewed change — not an accident of `JSON.stringify`.
- Unit-testable as a pure function; we don't need to wire up Vitest for v1, but the function is shaped so it can be tested in isolation if/when the project grows tests.

## Edge cases handled

| Case | Behaviour |
|---|---|
| Call ID not found / RLS-hidden | 404 response |
| Call older than `vapi_raw` analysis era (no `analysis` key) | summary → "No summary available", outcome → omitted |
| `analysis.summary` empty string | "No summary available" |
| `transcript` empty / null / unparseable | "Transcript not available" |
| `successEvaluation` is a non-boolean, non-string value (number, object) | Outcome row omitted |
| `forwardedPhoneNumber` present but `ended_reason` doesn't indicate a transfer | Field omitted; transfer check drives display |
| No older / no newer call in range | Corresponding button rendered as `<span aria-disabled>` with same visual style as disabled `Pagination` buttons |
| Filter query params missing or garbage | `parseCallsQuery` falls back to defaults (Last 30 days, page 1); same as `/portal` |
| Transcript continuation lines (text without `AI:` / `User:` prefix) | Appended to the most recent labelled turn |

## Click-target affordance on `CallsTable`

`CallsTable.astro` is updated so each `<tr>` is a link target. Two viable implementations; the spec picks the second:

1. Wrap the row in `<a>` — invalid HTML inside `<tr>`.
2. **Picked:** Add a click handler attribute on the `<tr>` that navigates via location, *plus* progressively enhance with a real `<a>` inside the first cell so keyboard navigation and "open in new tab" still work. Visually, `cursor: pointer` on the row and a `:hover` background tint reusing `--bg`.

The link `href` is `/portal/calls/<id>?preset=&from=&to=&page=` built with the same `buildHref` helper (need a small extension to allow appending an `id` segment, or just constructed inline since this is the only caller).

## Risks and gotchas

1. **`vapi_raw` shape drift.** VAPI may add or rename fields over time. Mitigation: `pickCallDetail` reads only declared paths and returns typed nulls; missing keys never throw. If VAPI renames `analysis.successEvaluation` to something else, the field silently disappears from the UI — acceptable until John complains.
2. **Transcript turn-detection is regex-y.** A user saying "AI: tell me more" mid-utterance could fool the line splitter. Mitigation: only treat a line as a turn boundary when the prefix is *at start of line* and the next character is exactly `:` followed by space. Anything else is continuation. Worth noting in the parser; revisit if false positives show up.
3. **Older/Newer counts double the query load** on the page (focal call + 2 small index lookups). All hit the existing `(customer_id, started_at desc)` index; cost is negligible at FB volume but call out in the plan.
4. **Click-row navigation interactions.** `target=_blank` on inner cell links would conflict with row-level click handler. Resolution: don't put any other anchors inside the row; the row itself is the only navigation target for now.
5. **Brand leak through dev tools.** The `<audio>` decision is the obvious leak vector — explicitly excluded by "no recording in v1". Less obvious: never `JSON.stringify(call)` to the page (would leak `vapi_raw` wholesale). The page should only ever interpolate fields from `CallDetailView`.

## Verification (smoke test plan, executed after implementation)

With the existing 50-call smoke-test dataset:

1. From `/portal` (any preset), click a row → land on `/portal/calls/<id>?preset=…`. Expect: header, summary, transcript visible.
2. Click `← Back to portal` → return to the same filter + page.
3. Click `Older call →` repeatedly → walk through calls in time order; eventually disabled when at the oldest call in the range.
4. Click `← Newer call` repeatedly → mirror behaviour.
5. Switch filter to a range that contains exactly one call → both Older and Newer disabled.
6. Hit `/portal/calls/00000000-0000-0000-0000-000000000000` (random UUID) → 404.
7. Inspect DOM and Network tab in DevTools — confirm zero references to `vapi.ai`, `storage.vapi.ai`, `costBreakdown`, etc.
8. Try a call where `analysis` is missing (none exists today; simulate by editing one row's `vapi_raw` in dev) → page renders without crashing, summary and outcome omitted gracefully.

## Open follow-ups (out of this spec)

- **Audio recording.** Three implementation paths discussed during brainstorming (proxy on demand, snapshot to Supabase Storage, skip). Decision was skip-for-v1. If/when John asks: prefer the proxy-on-demand approach unless retention longer than 14 days becomes a requirement.
- **Assistant identification.** Today the page doesn't tell John which of his ~19 assistants took the call. Adding a config table or alias mapping is its own small spec.
- **Spec #3 (more columns in the table) and Spec #4 (KPI charts)** — still on the parking lot, not blocked by this spec.
