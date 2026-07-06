# Call detail page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a server-rendered detail page at `/portal/calls/[id]` that shows the curated header, AI summary, parsed transcript and Newer/Older navigation for one call, while keeping the VAPI brand entirely off the customer-facing surface.

**Architecture:** New Astro page route at `src/pages/portal/calls/[id].astro` plus three small extractions/components (`callDetail.ts`, `endedReason.ts`, `CallDetailHeader.astro`, `CallTranscript.astro`). All data flow is server-rendered: the page fetches the focal call, computes Older/Newer ids inside the active filter, runs `pickCallDetail` to read only safe fields from `vapi_raw`, and renders. RLS scopes everything; no new RPC, no new migration. `CallsTable.astro` rows become clickable links with the active filter preserved.

**Tech Stack:** Astro 4 (`output: 'server'`) on Vercel, Supabase JS client (`@supabase/ssr`) with RLS, no test framework — this project doesn't run Vitest/Playwright. Pure helpers (`pickCallDetail`, transcript parser) get inline ad-hoc tests via `npx tsx -e` (same pattern used during Spec #1 for `parseCallsQuery`). UI changes get manual smoke tests in the dev server.

**Spec:** [`docs/superpowers/specs/2026-05-10-call-detail-page-design.md`](../specs/2026-05-10-call-detail-page-design.md) — read it first if anything in this plan is ambiguous.

---

## File Structure

| Path | Purpose | Action |
|---|---|---|
| `src/lib/endedReason.ts` | Single source of truth for the VAPI `endedReason → human label` map | **Create** (extract from `CallsTable.astro`) |
| `src/lib/callDetail.ts` | `pickCallDetail(vapiRaw)` curation helper + `CallDetailView` type | **Create** |
| `src/components/CallDetailHeader.astro` | Header card: caller, destination, started, duration, status, charge, forwarded-to, outcome | **Create** |
| `src/components/CallTranscript.astro` | Transcript card: parses `"AI: …\nUser: …"` into labelled `<p>` turns | **Create** |
| `src/pages/portal/calls/[id].astro` | Page route: auth gate, fetch + render, Newer/Older nav | **Create** |
| `src/components/CallsTable.astro` | Rows become clickable `<a>` linking to the new detail page | **Modify** |
| `docs/where-we-left-off.md` | Add a one-paragraph note on the new feature once it's working | **Modify** (last task) |

No schema changes. No new env vars.

---

## Task 1 — Extract `formatEndedReason` to a shared module

**Goal:** Move the VAPI ended-reason humaniser out of `CallsTable.astro` so the new header component can reuse it. Pure refactor — zero functional change.

**Files:**
- Create: `src/lib/endedReason.ts`
- Modify: `src/components/CallsTable.astro` (remove inline function, import instead)

- [ ] **Step 1.1: Create `src/lib/endedReason.ts`**

```ts
/**
 * Translate VAPI's raw ended_reason values into human-readable labels.
 * Anything not in the map falls back to "Other".
 *
 * Source: https://docs.vapi.ai/api-reference/calls/get-call (endedReason enum).
 * Kept in lib (not in the component) so both CallsTable and CallDetailHeader
 * render identical labels for the same code.
 */

const MAP: Record<string, string> = {
  'customer-ended-call':                          'Completed (caller hung up)',
  'assistant-ended-call':                         'Completed',
  'assistant-ended-call-with-hangup-task':        'Completed',
  'assistant-said-end-call-phrase':               'Completed',
  'assistant-forwarded-call':                     'Transferred to human',
  'phone-call-provider-closed-websocket':         'Completed',
  'voicemail':                                    'Voicemail detected',
  'silence-timed-out':                            'Silence (no response)',
  'customer-busy':                                'Caller busy',
  'customer-did-not-answer':                      'No answer',
  'customer-did-not-give-microphone-permission':  'Microphone denied',
  'exceeded-max-duration':                        'Max duration reached',
  'manually-canceled':                            'Cancelled',
  'twilio-failed-to-connect-call':                'Connection failed',
  'pipeline-error-openai-llm-failed':             'Service error',
  'pipeline-error-deepgram-transcriber-failed':   'Service error',
  'pipeline-error-eleven-labs-voice-failed':      'Service error',
};

export function formatEndedReason(reason: string | null): string {
  if (!reason) return '—';
  if (MAP[reason]) return MAP[reason];
  if (reason.startsWith('call.start.error')) return 'Connection failed';
  if (reason.startsWith('pipeline-error'))   return 'Service error';
  return 'Other';
}

/**
 * True when the ended_reason indicates the call was forwarded to a human.
 * Used by the detail header to decide whether to show "Forwarded to: <number>".
 */
export function isForwardedReason(reason: string | null): boolean {
  if (!reason) return false;
  return reason === 'assistant-forwarded-call'
      || reason === 'assistant-ended-call-with-hangup-task';
}
```

- [ ] **Step 1.2: Update `CallsTable.astro` to use the shared helper**

Replace the inline `formatEndedReason` block. The current import line at the top of the frontmatter is:

```ts
import { formatTime, formatDuration, formatMoney } from '@lib/format';
```

Add the `endedReason` import next to it and delete the inline definition (the JSDoc block + the `function formatEndedReason` and its `MAP`). The diff:

```ts
import { formatTime, formatDuration, formatMoney } from '@lib/format';
import { formatEndedReason } from '@lib/endedReason';
```

Delete lines from the JSDoc comment `Translate VAPI's raw ended_reason…` through the closing `}` of `function formatEndedReason`. Leave the rest of the file unchanged.

- [ ] **Step 1.3: TypeScript check**

```bash
npm run check
```

Expected: `0 errors, 0 warnings, 3 hints` (the 3 pre-existing hints from before this work — confirm the count didn't grow).

- [ ] **Step 1.4: Commit**

```bash
git add src/lib/endedReason.ts src/components/CallsTable.astro
git commit -m "Extract formatEndedReason to src/lib/endedReason.ts

Pure refactor — no functional change. Pulled the VAPI ended_reason
humaniser out of CallsTable so the upcoming CallDetailHeader can
import the same map. Also exports isForwardedReason for the header's
'Forwarded to' visibility check.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2 — `pickCallDetail` curation helper

**Goal:** A pure function that reads `vapi_raw` and returns a typed, narrow `CallDetailView`. This is the *only* place in the codebase that touches `vapi_raw`. Defensive against unknown shapes — never throws.

**Files:**
- Create: `src/lib/callDetail.ts`

- [ ] **Step 2.1: Write a failing ad-hoc test**

This project doesn't run a test framework, so we use the same `npx tsx -e` pattern that validated `parseCallsQuery` during Spec #1. Save the test to a temp script — it does NOT live in the repo. Run from the repo root:

```bash
cat > /tmp/test-pickCallDetail.ts <<'TS'
import { pickCallDetail } from './src/lib/callDetail.ts';

function ok(label: string, actual: unknown, expected: unknown) {
  const passed = JSON.stringify(actual) === JSON.stringify(expected);
  console.log((passed ? 'PASS' : 'FAIL') + ' ' + label);
  if (!passed) {
    console.log('  expected:', JSON.stringify(expected));
    console.log('  got:     ', JSON.stringify(actual));
  }
}

// 1. Realistic VAPI payload with all fields present
const full = {
  customer:    { number: '+15555550123' },
  destination: { number: '+18339024483' },
  forwardedPhoneNumber: '+18339024484',
  transcript: 'AI: Hello.\nUser: Hi.',
  analysis: {
    summary: 'Caller asked for a quote and was transferred.',
    successEvaluation: true,
  },
};
ok('full.callerNumber',      pickCallDetail(full).callerNumber,      '+15555550123');
ok('full.destinationNumber', pickCallDetail(full).destinationNumber, '+18339024483');
ok('full.forwardedTo',       pickCallDetail(full).forwardedTo,       '+18339024484');
ok('full.summary',           pickCallDetail(full).summary,           'Caller asked for a quote and was transferred.');
ok('full.transcriptRaw',     pickCallDetail(full).transcriptRaw,     'AI: Hello.\nUser: Hi.');
ok('full.outcome',           pickCallDetail(full).outcome,           { kind: 'bool', value: true });

// 2. Boolean false outcome
const boolFalse = { ...full, analysis: { summary: 's', successEvaluation: false } };
ok('boolFalse.outcome', pickCallDetail(boolFalse).outcome, { kind: 'bool', value: false });

// 3. String outcome
const stringEval = { ...full, analysis: { summary: 's', successEvaluation: 'pass' } };
ok('stringEval.outcome', pickCallDetail(stringEval).outcome, { kind: 'label', value: 'pass' });

// 4. Number outcome — ignore
const numericEval = { ...full, analysis: { summary: 's', successEvaluation: 0.92 } };
ok('numericEval.outcome (ignored)', pickCallDetail(numericEval).outcome, { kind: 'none' });

// 5. Object outcome — ignore
const objectEval = { ...full, analysis: { summary: 's', successEvaluation: { score: 1 } } };
ok('objectEval.outcome (ignored)', pickCallDetail(objectEval).outcome, { kind: 'none' });

// 6. Missing analysis entirely (older calls)
const noAnalysis: any = { ...full };
delete noAnalysis.analysis;
ok('noAnalysis.summary', pickCallDetail(noAnalysis).summary, null);
ok('noAnalysis.outcome', pickCallDetail(noAnalysis).outcome, { kind: 'none' });

// 7. Empty summary string
const emptySummary = { ...full, analysis: { summary: '', successEvaluation: true } };
ok('emptySummary.summary', pickCallDetail(emptySummary).summary, null);

// 8. Missing customer/destination
const minimal: any = { transcript: 'AI: Hi.' };
ok('minimal.callerNumber',      pickCallDetail(minimal).callerNumber,      null);
ok('minimal.destinationNumber', pickCallDetail(minimal).destinationNumber, null);
ok('minimal.forwardedTo',       pickCallDetail(minimal).forwardedTo,       null);
ok('minimal.summary',           pickCallDetail(minimal).summary,           null);
ok('minimal.outcome',           pickCallDetail(minimal).outcome,           { kind: 'none' });

// 9. Total garbage input — must not throw
ok('null input',     pickCallDetail(null).callerNumber,      null);
ok('string input',   pickCallDetail('garbage').callerNumber, null);
ok('number input',   pickCallDetail(42).callerNumber,        null);
ok('array input',    pickCallDetail([1, 2, 3]).callerNumber, null);

// 10. Customer.number wrong type
const wrongType: any = { customer: { number: 12345 } };
ok('wrongType.callerNumber', pickCallDetail(wrongType).callerNumber, null);

console.log('Done.');
TS

npx --yes tsx /tmp/test-pickCallDetail.ts
```

Expected (this run): **FAIL on every assertion** with "Cannot find module" or similar — the file doesn't exist yet.

- [ ] **Step 2.2: Implement `src/lib/callDetail.ts`**

```ts
/**
 * Curation boundary for `calls.vapi_raw`.
 *
 * `vapi_raw` contains the full VAPI payload, including fields that would leak
 * the brand or expose the cost breakdown to the customer (`cost`, `costBreakdown`,
 * `recordingUrl`, `orgId`, etc.). This module is the single place in the
 * codebase that reads `vapi_raw`. The page renders only fields that go through
 * `CallDetailView`. Adding a new field is a deliberate, reviewed change here —
 * not an accident of `JSON.stringify`.
 */

export type CallOutcome =
  | { kind: 'bool';  value: boolean }
  | { kind: 'label'; value: string  }
  | { kind: 'none' };

export interface CallDetailView {
  callerNumber:       string | null;
  destinationNumber:  string | null;
  forwardedTo:        string | null;
  summary:            string | null;
  transcriptRaw:      string | null;
  outcome:            CallOutcome;
}

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function pickString(x: unknown): string | null {
  if (typeof x !== 'string') return null;
  const trimmed = x.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function pickNested(root: unknown, path: readonly string[]): unknown {
  let cursor: unknown = root;
  for (const key of path) {
    if (!isObject(cursor)) return undefined;
    cursor = cursor[key];
  }
  return cursor;
}

function pickOutcome(rawEval: unknown): CallOutcome {
  if (typeof rawEval === 'boolean') return { kind: 'bool', value: rawEval };
  if (typeof rawEval === 'string') {
    const v = rawEval.trim();
    if (v.length === 0) return { kind: 'none' };
    return { kind: 'label', value: v };
  }
  return { kind: 'none' };
}

export function pickCallDetail(vapiRaw: unknown): CallDetailView {
  return {
    callerNumber:      pickString(pickNested(vapiRaw, ['customer', 'number'])),
    destinationNumber: pickString(pickNested(vapiRaw, ['destination', 'number'])),
    forwardedTo:       pickString(pickNested(vapiRaw, ['forwardedPhoneNumber'])),
    summary:           pickString(pickNested(vapiRaw, ['analysis', 'summary'])),
    transcriptRaw:     pickString(pickNested(vapiRaw, ['transcript'])),
    outcome:           pickOutcome(pickNested(vapiRaw, ['analysis', 'successEvaluation'])),
  };
}
```

- [ ] **Step 2.3: Re-run the test, expect all PASS**

```bash
npx --yes tsx /tmp/test-pickCallDetail.ts
```

Expected: every line starts with `PASS`. If anything `FAIL`s, fix the helper, re-run.

- [ ] **Step 2.4: Clean up the temp test file and run TypeScript check**

```bash
rm /tmp/test-pickCallDetail.ts
npm run check
```

Expected: `0 errors, 0 warnings, 3 hints`.

- [ ] **Step 2.5: Commit**

```bash
git add src/lib/callDetail.ts
git commit -m "Add pickCallDetail curation helper for vapi_raw

Single-purpose pure function: reads only the safe subset of fields
from VAPI's raw payload and returns a narrow CallDetailView. Defensive
against unknown shapes — never throws on malformed input. This is the
only module that should ever read vapi_raw.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3 — `CallTranscript.astro` component

**Goal:** Render `vapi_raw.transcript` (a string like `"AI: Hi.\nUser: Hello."`) as labelled paragraphs, with `AI` → `Agent` and `User` → `Caller`. Continuation lines (no prefix) append to the previous turn.

**Files:**
- Create: `src/components/CallTranscript.astro`

- [ ] **Step 3.1: Write a failing ad-hoc test for the parser**

The parser logic lives inside the component as a frontmatter function. To test it cleanly, extract it to `src/lib/transcript.ts` first (one tiny pure function; cleaner than rendering an Astro component to test).

Save the test:

```bash
cat > /tmp/test-transcript.ts <<'TS'
import { parseTranscript } from './src/lib/transcript.ts';

function deepEq(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
function ok(label: string, actual: unknown, expected: unknown) {
  console.log((deepEq(actual, expected) ? 'PASS' : 'FAIL') + ' ' + label);
  if (!deepEq(actual, expected)) {
    console.log('  expected:', JSON.stringify(expected));
    console.log('  got:     ', JSON.stringify(actual));
  }
}

// 1. Simple two-turn conversation
ok('two turns',
  parseTranscript('AI: Hello.\nUser: Hi.'),
  [
    { speaker: 'Agent',  text: 'Hello.' },
    { speaker: 'Caller', text: 'Hi.' },
  ]
);

// 2. Continuation line (no prefix) appends to previous turn
ok('continuation',
  parseTranscript('AI: Hello.\nNice to meet you.\nUser: Hi.'),
  [
    { speaker: 'Agent',  text: 'Hello. Nice to meet you.' },
    { speaker: 'Caller', text: 'Hi.' },
  ]
);

// 3. Multiple continuations
ok('multi-continuation',
  parseTranscript('AI: A.\nB.\nC.\nUser: D.'),
  [
    { speaker: 'Agent',  text: 'A. B. C.' },
    { speaker: 'Caller', text: 'D.' },
  ]
);

// 4. Empty string
ok('empty string', parseTranscript(''), []);

// 5. Null / undefined input
ok('null input',      parseTranscript(null),      []);
ok('undefined input', parseTranscript(undefined), []);

// 6. Caller mentioning "AI:" inside their own utterance — must NOT split
ok('AI: inside caller utterance',
  parseTranscript('AI: How can I help?\nUser: Tell me about AI: chatbots.'),
  [
    { speaker: 'Agent',  text: 'How can I help?' },
    { speaker: 'Caller', text: 'Tell me about AI: chatbots.' },
  ]
);
// Why: "AI:" is a turn boundary only when at the START of a line.

// 7. Trailing newline
ok('trailing newline',
  parseTranscript('AI: Hi.\n'),
  [{ speaker: 'Agent', text: 'Hi.' }]
);

// 8. Continuation before any labelled turn — drop it (defensive)
ok('orphan continuation',
  parseTranscript('Garbage line.\nAI: Hello.'),
  [{ speaker: 'Agent', text: 'Hello.' }]
);

// 9. Unknown speaker prefix — keep verbatim
ok('unknown prefix kept',
  parseTranscript('AI: Hi.\nBot: This is unusual.\nUser: Ok.'),
  [
    { speaker: 'Agent', text: 'Hi.' },
    { speaker: 'Bot',   text: 'This is unusual.' },
    { speaker: 'Caller', text: 'Ok.' },
  ]
);

console.log('Done.');
TS

npx --yes tsx /tmp/test-transcript.ts
```

Expected: `Cannot find module './src/lib/transcript.ts'` — file doesn't exist yet.

- [ ] **Step 3.2: Implement `src/lib/transcript.ts`**

```ts
/**
 * Parse VAPI's `transcript` string into a list of speaker turns.
 *
 * Format observed: lines like "AI: …" or "User: …" newline-separated.
 * Continuation lines (no prefix) belong to the previous turn.
 *
 * Speaker label rewriting (AI → Agent, User → Caller) is done here so the
 * component just renders.
 */

export interface TranscriptTurn {
  speaker: string;
  text: string;
}

const TURN_BOUNDARY = /^([A-Za-z][A-Za-z0-9_-]{0,31}):\s+(.*)$/;

const SPEAKER_RENAME: Record<string, string> = {
  AI:   'Agent',
  User: 'Caller',
};

export function parseTranscript(input: string | null | undefined): TranscriptTurn[] {
  if (typeof input !== 'string' || input.length === 0) return [];

  const turns: TranscriptTurn[] = [];

  for (const rawLine of input.split('\n')) {
    const line = rawLine.trim();
    if (line.length === 0) continue;

    const match = line.match(TURN_BOUNDARY);
    if (match) {
      const rawSpeaker = match[1];
      const text = match[2];
      const speaker = SPEAKER_RENAME[rawSpeaker] ?? rawSpeaker;
      turns.push({ speaker, text });
    } else if (turns.length > 0) {
      // Continuation: append to the most recent turn with a single space.
      const last = turns[turns.length - 1];
      last.text = `${last.text} ${line}`;
    }
    // Else: orphan continuation before any labelled turn — drop silently.
  }

  return turns;
}
```

- [ ] **Step 3.3: Re-run the test, expect all PASS**

```bash
npx --yes tsx /tmp/test-transcript.ts
```

Expected: every line starts with `PASS`.

- [ ] **Step 3.4: Create `src/components/CallTranscript.astro`**

```astro
---
/**
 * CallTranscript — render parsed turns from vapi_raw.transcript.
 *
 * Parsing lives in @lib/transcript so it's testable as a pure function;
 * the component just renders.
 */
import { parseTranscript } from '@lib/transcript';

interface Props {
  /** Raw VAPI transcript string (newline-separated, label-prefixed). */
  transcript: string | null;
}
const { transcript } = Astro.props;
const turns = parseTranscript(transcript);
---

<div class="card">
  <h2>Transcript</h2>
  {turns.length === 0 ? (
    <p class="text-muted small">Transcript not available.</p>
  ) : (
    <div class="turns">
      {turns.map((t) => (
        <p><strong>{t.speaker}:</strong> {t.text}</p>
      ))}
    </div>
  )}
</div>

<style>
  .turns p {
    margin: 0 0 0.5rem;
    line-height: 1.55;
  }
  .turns p:last-child { margin-bottom: 0; }
</style>
```

- [ ] **Step 3.5: Clean up temp test, TypeScript check**

```bash
rm /tmp/test-transcript.ts
npm run check
```

Expected: `0 errors, 0 warnings, 3 hints`.

- [ ] **Step 3.6: Commit**

```bash
git add src/lib/transcript.ts src/components/CallTranscript.astro
git commit -m "Add CallTranscript component + transcript parser

parseTranscript splits VAPI's labelled string into speaker turns,
renames AI→Agent and User→Caller, and folds continuation lines into
the prior turn. The .astro component is a thin renderer; all logic
is in the pure helper for testability.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4 — `CallDetailHeader.astro` component

**Goal:** Render the metadata card at the top of the detail page. Pulls fields from a normalised input (already-curated `CallDetailView` + the `calls` row's own fields). Omits rows that are `null` / not applicable.

**Files:**
- Create: `src/components/CallDetailHeader.astro`

- [ ] **Step 4.1: Implement the component**

```astro
---
/**
 * CallDetailHeader — top metadata card for /portal/calls/[id].
 *
 * Renders a definition list of curated fields. Anything `null` or not
 * applicable is omitted entirely — no "—" placeholders, less noise.
 *
 * Inputs come from the page: row fields (started_at, duration, charge,
 * ended_reason) directly from `calls`, plus the curated `CallDetailView`
 * for everything that lives in `vapi_raw`.
 */
import { formatTime, formatDuration, formatMoney } from '@lib/format';
import { formatEndedReason, isForwardedReason } from '@lib/endedReason';
import type { CallDetailView, CallOutcome } from '@lib/callDetail';

interface Props {
  startedAt:       string | null;
  durationSeconds: number | null;
  endedReason:     string | null;
  chargeCents:     number;
  currency:        string;
  detail:          CallDetailView;
}
const {
  startedAt, durationSeconds, endedReason, chargeCents, currency, detail,
} = Astro.props;

const cur = currency.toUpperCase();
const showForwarded = isForwardedReason(endedReason) && detail.forwardedTo !== null;

function outcomeLabel(o: CallOutcome): string | null {
  if (o.kind === 'bool')  return o.value ? 'Successful' : 'Failed';
  if (o.kind === 'label') {
    return o.value.charAt(0).toUpperCase() + o.value.slice(1);
  }
  return null;
}
function outcomeClass(o: CallOutcome): string {
  if (o.kind === 'bool') return o.value ? 'text-success' : 'text-danger';
  return 'text-muted';
}
const outcome = outcomeLabel(detail.outcome);
---

<div class="card">
  <dl class="header-grid">
    {detail.callerNumber && (
      <>
        <dt>Caller</dt>
        <dd class="mono"><strong>{detail.callerNumber}</strong></dd>
      </>
    )}
    {detail.destinationNumber && (
      <>
        <dt>Destination</dt>
        <dd class="mono">{detail.destinationNumber}</dd>
      </>
    )}
    <dt>Started</dt>
    <dd>{formatTime(startedAt)}</dd>

    <dt>Duration</dt>
    <dd class="mono">{formatDuration(durationSeconds)}</dd>

    <dt>Status</dt>
    <dd>{formatEndedReason(endedReason)}</dd>

    {showForwarded && (
      <>
        <dt>Forwarded to</dt>
        <dd class="mono">{detail.forwardedTo}</dd>
      </>
    )}
    {outcome && (
      <>
        <dt>Outcome</dt>
        <dd class={outcomeClass(detail.outcome)}>{outcome}</dd>
      </>
    )}

    <dt>Charge</dt>
    <dd class="mono"><strong>{formatMoney(chargeCents)} {cur}</strong></dd>
  </dl>
</div>

<style>
  .header-grid {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 0.5rem 1.25rem;
    margin: 0;
  }
  .header-grid dt {
    color: var(--muted);
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    align-self: center;
  }
  .header-grid dd {
    margin: 0;
    align-self: center;
  }
  @media (max-width: 540px) {
    .header-grid { grid-template-columns: 1fr; gap: 0.125rem 0; }
    .header-grid dd { margin-bottom: 0.5rem; }
  }
</style>
```

- [ ] **Step 4.2: TypeScript check**

```bash
npm run check
```

Expected: `0 errors, 0 warnings, 3 hints`.

- [ ] **Step 4.3: Commit**

```bash
git add src/components/CallDetailHeader.astro
git commit -m "Add CallDetailHeader component

Definition-list card for the call detail page. Pulls curated fields
from CallDetailView plus row-level fields from `calls`. Empty/missing
fields are omitted entirely (no '—' placeholders). Outcome colours:
green for true, red for false, muted for free-form labels.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5 — Page route `/portal/calls/[id]`

**Goal:** The page itself. Auth gate, focal call fetch, Older/Newer scoping, render. RLS does the customer-scoping; we never filter by customer_id manually in the WHERE (other than the `eq` for older/newer convenience, which is redundant but explicit).

**Files:**
- Create: `src/pages/portal/calls/[id].astro`

- [ ] **Step 5.1: Implement the page**

```astro
---
/**
 * /portal/calls/[id] — single-call detail page.
 *
 * Layout (top to bottom): Back link → CallDetailHeader → Summary card →
 * CallTranscript → Newer/Older nav. Server-rendered, RLS-scoped, no
 * client-side fetching.
 *
 * Older/Newer scope is constrained to the active filter range so John
 * doesn't accidentally walk out of the period he was browsing.
 */
import Portal from '@layouts/Portal.astro';
import CallDetailHeader from '@components/CallDetailHeader.astro';
import CallTranscript from '@components/CallTranscript.astro';
import { createSupabaseServerClient } from '@lib/supabase';
import { getCustomerSession } from '@lib/auth';
import { parseCallsQuery, buildHref } from '@lib/filters';
import { pickCallDetail } from '@lib/callDetail';

export const prerender = false;

const supabase = createSupabaseServerClient({
  request: Astro.request,
  cookies: Astro.cookies,
});
const session = await getCustomerSession(supabase);
if (!session) {
  return Astro.redirect('/login', 307);
}

const callId = Astro.params.id;
if (typeof callId !== 'string' || callId.length === 0) {
  return new Response('Not found', { status: 404 });
}

const q = parseCallsQuery(Astro.url.searchParams);

// Focal call. RLS hides rows that don't belong to this customer.
const { data: call } = await supabase
  .from('calls')
  .select('id, started_at, ended_at, duration_seconds, ended_reason, charge_cents, vapi_raw')
  .eq('id', callId)
  .maybeSingle();

if (!call) {
  return new Response('Not found', { status: 404 });
}

const detail = pickCallDetail(call.vapi_raw);

// Older = newer in DESC table order, but older in time. We label by time
// to avoid the "next in DESC list" ambiguity, so:
//   Older button → call with started_at LESS THAN current
//   Newer button → call with started_at GREATER THAN current
// Both scoped to the active filter range so John stays inside what he was
// looking at.
const [{ data: older }, { data: newer }] = await Promise.all([
  supabase
    .from('calls')
    .select('id')
    .eq('customer_id', session.customerId)
    .lt('started_at', call.started_at as string)
    .gte('started_at', q.fromIso)
    .lt('started_at', q.toIso)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle(),
  supabase
    .from('calls')
    .select('id')
    .eq('customer_id', session.customerId)
    .gt('started_at', call.started_at as string)
    .gte('started_at', q.fromIso)
    .lt('started_at', q.toIso)
    .order('started_at', { ascending: true })
    .limit(1)
    .maybeSingle(),
]);

const backHref = buildHref('/portal', q);

function detailHref(id: string): string {
  // Detail-page URLs preserve the active filter so Back + Newer/Older keep context.
  return buildHref(`/portal/calls/${id}`, q);
}
const olderHref = older?.id ? detailHref(older.id) : null;
const newerHref = newer?.id ? detailHref(newer.id) : null;
---

<Portal title="Call detail" customerName={session.customerDisplayName}>
  <div class="topbar">
    <a href={backHref}>← Back to portal</a>
  </div>

  <CallDetailHeader
    startedAt={call.started_at}
    durationSeconds={call.duration_seconds}
    endedReason={call.ended_reason}
    chargeCents={call.charge_cents}
    currency={session.currency}
    detail={detail}
  />

  <div class="card">
    <h2>Summary</h2>
    {detail.summary ? (
      <p>{detail.summary}</p>
    ) : (
      <p class="text-muted small">No summary available for this call.</p>
    )}
  </div>

  <CallTranscript transcript={detail.transcriptRaw} />

  <nav class="bottom-nav" aria-label="Call navigation">
    {newerHref ? (
      <a class="btn secondary" href={newerHref} rel="prev">← Newer call</a>
    ) : (
      <span class="btn secondary disabled" aria-disabled="true">← Newer call</span>
    )}
    {olderHref ? (
      <a class="btn secondary" href={olderHref} rel="next">Older call →</a>
    ) : (
      <span class="btn secondary disabled" aria-disabled="true">Older call →</span>
    )}
  </nav>
</Portal>

<style>
  .topbar {
    margin-bottom: 1rem;
  }
  .topbar a {
    font-size: 0.875rem;
  }
  .bottom-nav {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    margin: 0.5rem 0 1.5rem;
  }
  .btn.disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  }
</style>
```

- [ ] **Step 5.2: TypeScript check**

```bash
npm run check
```

Expected: `0 errors, 0 warnings, 3 hints`.

- [ ] **Step 5.3: Commit**

```bash
git add src/pages/portal/calls/[id].astro
git commit -m "Add /portal/calls/[id] page route

Server-rendered detail page: Back link → header → summary → transcript
→ Newer/Older navigation. RLS scopes the focal-call query; the
older/newer queries explicitly stay inside the active filter range so
John doesn't walk out of the period he was browsing.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6 — Make `CallsTable` rows clickable

**Goal:** Each row in the calls table on `/portal` becomes a link to the new detail page, preserving the active filter. Hover state hints the affordance.

**Files:**
- Modify: `src/components/CallsTable.astro`

- [ ] **Step 6.1: Update CallsTable to accept the active query and render anchored rows**

> **Note — deliberate divergence from spec.** The spec's "Click-target affordance" section picked a `<tr>` click-handler + first-cell `<a>` hybrid, and even flagged "click-handler/anchor conflict" as Risk #4. The plan instead wraps the *contents* of each cell in its own `<a>`. Same UX (whole row reads as one link, keyboard nav and middle-click work), no JS, valid HTML, no risk-#4 conflict. Cleaner, so we go this way.

The simplest approach that keeps full progressive enhancement (keyboard, middle-click new tab, no JS): wrap the *contents* of each cell in `<a>`s with `display: block`. That keeps the `<tr>`/`<td>` structure valid and gives every cell its own click target, all pointing to the same detail href. CSS makes them look like one row.

Update `src/components/CallsTable.astro`. The current Props interface already has `calls` and `currency`. Add an optional `query: CallsQuery` prop.

Frontmatter top — add to the existing imports:

```ts
import { buildHref, type CallsQuery } from '@lib/filters';
```

Update `Props`:

```ts
interface Props {
  calls: Call[];
  currency: string;
  /** Active filter, used to build detail-page links that preserve context. */
  query: CallsQuery;
}
const { calls, currency, query } = Astro.props;
```

Replace the existing `{calls.map((c) => ( <tr> … </tr> ))}` with the linked version:

```astro
{calls.map((c) => {
  const href = buildHref(`/portal/calls/${c.id}`, query);
  return (
    <tr class="clickable">
      <td class="small"><a class="cell" href={href}>{formatTime(c.started_at)}</a></td>
      <td class="small mono"><a class="cell" href={href}>{formatDuration(c.duration_seconds)}</a></td>
      <td class="small text-muted"><a class="cell" href={href}>{formatEndedReason(c.ended_reason)}</a></td>
      <td class="small mono align-right"><a class="cell align-right" href={href}>
        {formatMoney(c.charge_cents)} {currency.toUpperCase()}
      </a></td>
    </tr>
  );
})}
```

Add a scoped `<style>` block at the bottom:

```astro
<style>
  tr.clickable:hover { background: var(--bg); }
  a.cell {
    display: block;
    color: inherit;
    text-decoration: none;
    padding: 0;
  }
  a.cell:hover { text-decoration: none; }
  .align-right { text-align: right; }
</style>
```

(Drop the inline `style="text-align: right;"` on the existing `<th>` and last `<td>` and use the class instead, or leave them — both work. Smaller diff: leave the `<th>` inline, use the class only on the `<a>` cells.)

- [ ] **Step 6.2: Update `/portal` to pass `query` to `CallsTable`**

In `src/pages/portal/index.astro`, the existing call to `<CallsTable>` is:

```astro
  <CallsTable
    calls={(calls ?? []) as any}
    currency={session.currency}
  />
```

Add the `query` prop:

```astro
  <CallsTable
    calls={(calls ?? []) as any}
    currency={session.currency}
    query={q}
  />
```

- [ ] **Step 6.3: TypeScript check**

```bash
npm run check
```

Expected: `0 errors, 0 warnings, 3 hints`.

- [ ] **Step 6.4: Commit**

```bash
git add src/components/CallsTable.astro src/pages/portal/index.astro
git commit -m "Make CallsTable rows link to /portal/calls/[id]

Each cell wraps its content in an <a> sharing the same href, so the
whole row reads as a single click target while keeping valid HTML
(<a> inside <tr> would not be valid). Hover tints the row using the
existing --bg variable.

Active filter (preset + from/to + page) is preserved in the URL so
the detail page's Back / Newer / Older links return to the same view.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7 — Smoke test in browser

**Goal:** Manually validate the spec's verification list (no automation; the project doesn't have e2e infra). End with confidence the page works for John as designed.

**Files:** none modified.

- [ ] **Step 7.1: Start the dev server**

```bash
set -a; source .env; set +a
npm run dev
```

Server should print `Local http://localhost:4321/`. Leave it running in this terminal.

- [ ] **Step 7.2: Generate a magic link in another terminal**

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

Open the URL it prints in the browser. You land on `/portal`.

- [ ] **Step 7.3: Walk through the verification cases**

Tick each manually:

- [ ] On `/portal` (any preset), click any row → land on `/portal/calls/<id>?preset=…`. Header, Summary and Transcript visible.
- [ ] Click `← Back to portal` → return to the same filter + page.
- [ ] Click `Older call →` repeatedly → walks through calls in time order (newest to oldest within range). Eventually disabled at the oldest call.
- [ ] Click `← Newer call` repeatedly → mirror behaviour to newest.
- [ ] Set `?preset=7d` then drill in — Older/Newer stay inside that 7-day window.
- [ ] Open DevTools → Network tab → reload the detail page → confirm **zero requests to any `*.vapi.ai` host**.
- [ ] DevTools → Elements → search for "vapi" (Cmd-F in the source panel) → confirm **zero matches**.
- [ ] Visit `/portal/calls/00000000-0000-0000-0000-000000000000` → 404 page.
- [ ] Visit `/portal/calls/<a real id>?from=2024-01-01&to=2024-12-31` → page renders with Older/Newer disabled (no calls in that range that aren't this one). The filter is silently capped at 365 days by `parseCallsQuery`; that's expected.
- [ ] Pick a call where `analysis` is missing or absent — find one with `select id from calls where vapi_raw->>'analysis' is null limit 1` (if any exist; smoke-test data may not have any). Visit → page renders, Summary says "No summary available", Outcome row absent.

- [ ] **Step 7.4: Stop the dev server**

`Ctrl-C` in the dev-server terminal.

- [ ] **Step 7.5: Update `docs/where-we-left-off.md`**

Add a paragraph under the existing "Portal refactor (2026-05-10)" section (or as a sibling section if that one feels full) summarising the new feature: route, components added, no migration needed, smoke-test status. Keep it short — this file is the resumption checkpoint, not changelog.

- [ ] **Step 7.6: Final commit**

```bash
git add docs/where-we-left-off.md
git commit -m "Document call detail page in where-we-left-off

Adds a short note under the portal-refactor section so future cold
starts know the detail route exists, where the components live, and
that no migration was needed for this feature.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Done criteria

- All 7 tasks committed.
- `npm run check` exits clean (3 pre-existing hints, 0 errors).
- Manual smoke test completed without finding `vapi.ai` in Network or DOM.
- The Older/Newer navigation respects the active filter range.
- A call without `analysis` renders the page without crashing.

## Rollback note

If something blocks shipping, every task is its own commit and they don't touch the existing `/portal` schema or migrations. `git revert` of the relevant commits restores the previous portal cleanly.
