# Daily spend sparkline (Spec #4) — design

**Status:** approved 2026-05-10
**Compact spec — single SVG sparkline above MetricsCards on `/portal`.**

## Context

User asked for "KPIs / charts" on the portal as Spec #4. Picked the
minimum-viable shape: one sparkline of daily spend over the active filter
window. No JS framework, no charting library, no interactivity. Aim is
~80% of the visual value at 20% of the complexity.

## Architecture

JS-side aggregation. No new migration, no new RPC. The page runs an extra
small `select` against `calls` for `started_at, charge_cents` filtered to
the active range, then a pure helper buckets the rows by UTC day and
synthesises a complete day series (zero-filling gaps). Component renders
inline SVG `<rect>` bars.

## Files

| Path | Purpose | Action |
|---|---|---|
| `src/lib/charts.ts` | `aggregateByDay` pure helper + `DayPoint` type | **Create** |
| `src/components/SpendSparkline.astro` | SVG bar chart card | **Create** |
| `src/pages/portal/index.astro` | extra calls query, pass aggregated data to new component, render above MetricsCards | **Modify** |

## `aggregateByDay`

```ts
export interface DayPoint {
  day: string;        // YYYY-MM-DD (UTC)
  totalCents: number;
}

export function aggregateByDay(
  calls: { started_at: string | null; charge_cents: number }[],
  fromIso: string,
  toIso: string,
): DayPoint[];
```

Rules:
- Generates the complete UTC-day series from `floor(fromIso → date)` to
  `floor(toIso → date)` inclusive of from, exclusive of to (toIso is
  exclusive in `parseCallsQuery`'s convention).
- Each call's `started_at` truncated to UTC day; sums `charge_cents`.
- Returns days with zero calls as `totalCents: 0`.
- Calls with `started_at === null` are skipped silently.
- Returns `[]` if the range produces zero days (shouldn't happen — `parseCallsQuery` always produces from < to).

## Component

```astro
interface Props {
  data: DayPoint[];
  currency: string;
}
```

Renders a `.card` with:
- `<h2>Daily spend</h2>`
- If `data.length === 0` → `<p class="text-muted small">No data for this range.</p>`
- Else inline SVG with one `<rect>` per day. Width 800 viewBox, height 80,
  `preserveAspectRatio="none"` so it stretches to the card width. Each bar
  filled with `var(--accent)`. Bar height proportional to
  `totalCents / max(totalCents, 1)`. Tiny 2px gap between bars.
- A muted small caption below the SVG showing range total + average per day
  (matches the existing `MetricsCards` aesthetic).

`role="img"` and `aria-label="Daily spend over the selected range"` on the SVG.

## Page wiring

In `src/pages/portal/index.astro`, after the `customer_period_stats` RPC
call and before the page-of-calls query, add:

```ts
const { data: chartCalls } = await supabase
  .from('calls')
  .select('started_at, charge_cents')
  .eq('customer_id', session.customerId)
  .gte('started_at', q.fromIso)
  .lt('started_at', q.toIso)
  .order('started_at', { ascending: true });

const dailySpend = aggregateByDay(chartCalls ?? [], q.fromIso, q.toIso);
```

Render `<SpendSparkline>` between `FilterBar` and `MetricsCards`.

## Performance note

`chartCalls` selects only two scalar columns and is bounded by the filter
range (capped at 365 days by `parseCallsQuery`). Worst case at FB scale
(50 calls in 50 days during smoke test) → 50 rows. At a hypothetical
365-day range with 100 calls/day → 36500 rows, ~600KB on the wire. Still
fine for a server-side aggregation. Revisit if usage grows past that.

## Edge cases

| Case | Behaviour |
|---|---|
| Empty range / no calls | "No data for this range." Empty state. |
| All calls totalCents = 0 (e.g. free trial) | Bars at zero height; show empty state instead. |
| Single day | One wide bar full-height. |
| Range > 90 days | Many thin bars; visually compressed but readable. |
| Calls with `started_at === null` | Skipped silently in aggregation. |

## Verification

- `/portal` shows the sparkline card above MetricsCards.
- `?preset=7d` → 7 bars.
- `?preset=30d` → 30 bars (default landing).
- `?from=...&to=...` custom range → bars match selected window.
- Empty range → "No data" message instead of zero-bar SVG.
- DevTools network: only one new `from(calls).select(...)` request relative to today.
- `npm run check` clean (0 errors, 3 hints baseline).
