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

/**
 * PostgREST `select` fragment that lifts only the AI summary out of `vapi_raw`,
 * without transferring the whole jsonb blob. Use it in the `.select(...)` of
 * any list query where the row needs a short preview but not the full payload.
 *
 * Why it lives here: keeps every `vapi_raw` path read in one module. The list
 * query consuming this fragment is doing the same kind of curation that
 * `pickCallDetail` does for the detail page — just at the SQL boundary.
 */
export const SUMMARY_PREVIEW_SELECT = 'summary:vapi_raw->analysis->>summary';

export function pickCallDetail(vapiRaw: unknown): CallDetailView {
  return {
    callerNumber:      pickString(pickNested(vapiRaw, ['customer', 'number'])),
    forwardedTo:       pickString(pickNested(vapiRaw, ['forwardedPhoneNumber'])),
    summary:           pickString(pickNested(vapiRaw, ['analysis', 'summary'])),
    transcriptRaw:     pickString(pickNested(vapiRaw, ['transcript'])),
    outcome:           pickOutcome(pickNested(vapiRaw, ['analysis', 'successEvaluation'])),
  };
}
