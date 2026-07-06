/**
 * Aggregate calls by UTC day for chart rendering.
 *
 * Generates the complete day series from `fromIso` to `toIso` (where `toIso`
 * is exclusive, matching the convention used elsewhere in the portal).
 * Days with no calls get `totalCents: 0` so the chart has no gaps.
 *
 * Calls with `started_at === null` are skipped silently — they don't belong
 * to any day. Same for charges of 0 (we still keep them as 0-height bars).
 */

export interface DayPoint {
  /** YYYY-MM-DD in UTC. */
  day: string;
  totalCents: number;
}

const MS_PER_DAY = 86_400_000;

function ymdUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function aggregateByDay(
  calls: { started_at: string | null; charge_cents: number }[],
  fromIso: string,
  toIso: string,
): DayPoint[] {
  const fromMs = Date.parse(fromIso);
  const toMs   = Date.parse(toIso);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs <= fromMs) return [];

  // Synthesize the complete UTC-day series.
  const startDayMs = Date.UTC(
    new Date(fromMs).getUTCFullYear(),
    new Date(fromMs).getUTCMonth(),
    new Date(fromMs).getUTCDate(),
  );
  // Last *included* day = floor((toMs - 1ms) / day). We want days where any
  // moment falls inside [fromIso, toIso).
  const lastIncludedDayMs = Date.UTC(
    new Date(toMs - 1).getUTCFullYear(),
    new Date(toMs - 1).getUTCMonth(),
    new Date(toMs - 1).getUTCDate(),
  );

  const totals = new Map<string, number>();
  for (let dayMs = startDayMs; dayMs <= lastIncludedDayMs; dayMs += MS_PER_DAY) {
    totals.set(ymdUtc(new Date(dayMs)), 0);
  }

  for (const call of calls) {
    if (!call.started_at) continue;
    const t = Date.parse(call.started_at);
    if (!Number.isFinite(t)) continue;
    if (t < fromMs || t >= toMs) continue;
    const ymd = ymdUtc(new Date(t));
    if (totals.has(ymd)) {
      totals.set(ymd, (totals.get(ymd) ?? 0) + call.charge_cents);
    }
  }

  return Array.from(totals.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, totalCents]) => ({ day, totalCents }));
}
