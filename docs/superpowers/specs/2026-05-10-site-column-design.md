# Site column (Spec #3.5) — design

**Status:** approved 2026-05-10 (compact spec — pivots from Spec #3's UUID-based mapping to a destination-number-based mapping after the user provided phone numbers, not VAPI phone-number-ids)
**Author:** José + Claude
**Companion plan:** to be created via `writing-plans` skill after this spec is approved.

## Context

Farmer Brown owns three inbound numbers, one per website. The user wants the calls table to show, on every row, **which site the call came in to** — visible immediately, without waiting on the assistant-mapping rollout (Spec #3 needs UUIDs that aren't filled in yet).

Modeling the mapping by `vapi_phone_number_id` (UUID) was the original idea, but the user provided the real phone numbers in E.164. Reading `destination.number` from `vapi_raw` is just as cheap (same jsonpath trick already used for `summary`), and it's the field the user actually thinks in.

## Out of scope

- Storing the destination number as a dedicated column. `vapi_raw.destination.number` is reliable and already in BD.
- Showing the caller's *origin region* — that's a different feature (geolocation by area code) and not asked for.
- Any change to Spec #3's `assistants.ts` or `formatAgentLabel`. The agent subtitle keeps working as-is; this spec adds an orthogonal piece of data.

## The mapping — `src/lib/sites.ts`

```ts
export interface SiteInfo {
  code: 'BR' | 'GL' | 'FB';
  website: string;
}

/**
 * Inbound destination numbers → site label.
 *
 * Three numbers, one per website. Hardcoded because the universe is
 * tiny and stable (numbers don't churn). Caller is responsible for
 * the lookup; null/unmapped → null (UI omits the site cell).
 *
 * Numbers are stored in E.164 form, exactly as VAPI persists them in
 * `vapi_raw.destination.number`.
 */
export const SITES_BY_NUMBER: Record<string, SiteInfo> = {
  '+18882934492': { code: 'BR', website: 'buildersrisk.net' },
  '+18884356365': { code: 'GL', website: 'contractorsliability.com' },
  '+18884962029': { code: 'FB', website: 'farmerbrown.com' },
};

export function resolveSite(destinationNumber: string | null): SiteInfo | null {
  if (!destinationNumber) return null;
  return SITES_BY_NUMBER[destinationNumber] ?? null;
}
```

## Data flow

`src/lib/callDetail.ts` already exports `SUMMARY_PREVIEW_SELECT` (jsonpath fragment for the summary). Add a sibling export:

```ts
/** PostgREST `select` fragment that lifts only the destination number out
 *  of `vapi_raw` for list-page previews — same pattern as SUMMARY_PREVIEW_SELECT. */
export const DESTINATION_PREVIEW_SELECT = 'destination:vapi_raw->destination->>number';
```

The `/portal` query is extended with this fragment. The `Call` interface in `CallsTable.astro` gains one nullable field (`destination: string | null`). `resolveSite(c.destination)` is called per row to derive the site.

The detail page (`/portal/calls/[id]`) already has `detail.destinationNumber` from `pickCallDetail` — that's reused as-is, no extra query work.

## Visual

**`/portal` table** — new column **between Status and Summary**:

| ... | Status | **Site** | Summary | Charge |
|---|---|---|---|---|

- Width fixed at `4rem` so it doesn't compete for the Summary cell.
- Cell renders the `code` (`BR` / `GL` / `FB`) in mono small.
- `title` attribute on the anchor shows the full website (e.g. `buildersrisk.net`) on hover.
- Empty when `destination` is null or unmapped — no `—` placeholder.

Updated column-width math (post Spec #2 fix-layout):
```
Date 12rem  Duration 5rem  Status 11rem  Site 4rem  Summary (rest)  Charge 6.5rem
= 38.5rem fixed → Summary gets ≈ 13.5rem in the 880px container.
```

**`/portal/calls/[id]` (CallDetailHeader)** — new optional row "Site" between Status and Agent. Renders the `website` (full string, e.g. `buildersrisk.net`). Omitted when null.

## Files

| Path | Action |
|---|---|
| `src/lib/sites.ts` | **Create** — mapping + `resolveSite` |
| `src/lib/callDetail.ts` | **Modify** — add `DESTINATION_PREVIEW_SELECT` export |
| `src/pages/portal/index.astro` | **Modify** — extend `.select()` with the new fragment |
| `src/components/CallsTable.astro` | **Modify** — `Call` adds `destination`; new `<th>Site</th>` + `<td>` cell; CSS for the new column width |
| `src/components/CallDetailHeader.astro` | **Modify** — new optional `Site` row; reuse `detail.destinationNumber` (already present from Spec #2) |
| `src/pages/portal/calls/[id].astro` | **No change** — `detail.destinationNumber` already flows through |

No schema changes. No migrations. No new env vars.

## Edge cases

| Case | Behaviour |
|---|---|
| `destination` null in vapi_raw (legacy / web call) | Site cell empty, no row in detail header |
| `destination` non-null but not in `SITES_BY_NUMBER` | Same as above; `console.warn` server-side noting "unmapped destination" so it's visible in dev logs |
| `destination` in different formatting (rare — VAPI normalises to E.164) | Lookup miss → unmapped path |
| Long site code | Won't happen (always 2 chars), no truncation needed |

## Verification

After implementation, with the existing 50-call smoke-test dataset:

1. `/portal` shows a `Site` column with `BR` rendered for the smoke-test rows (whose `destination.number` is `+18339024483` — wait, the smoke test was different test data; the value will be the actual destination on those calls). Hover over the cell → tooltip shows the website.
2. Calls without a `destination.number` → empty Site cell, no broken `—`.
3. `/portal/calls/<id>` shows a "Site" row in the header for mapped calls; absent for unmapped.
4. DevTools → still zero references to `*.vapi.ai`.
5. `npm run check` clean (0 errors, 3 hints baseline).

## Note on existing smoke-test data

The 50 calls already in BD predate this mapping. Their `destination.number` is `+18339024483` (Twilio's default forwarding number, per `vapi_raw.forwardedPhoneNumber` in the sample). That number is **not** one of the three production numbers. So during smoke test the Site column will be empty for all existing test rows — that's expected. New calls landing on the three real numbers will populate.
