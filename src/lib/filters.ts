/**
 * Parse and serialize the `/portal` query string used by the calls history.
 *
 * The portal is server-rendered: filter changes happen via plain
 * <form method="get"> submissions and pagination via <a href> links. All the
 * state lives in the URL — no JS framework, no browser store. This module
 * is the single boundary between the URL and the typed `CallsQuery` object
 * the page consumes.
 *
 * Conventions:
 *  • Presets ("Last 7 / 30 / 90 days") use a rolling window anchored to
 *    `now`, so the dashboard doesn't visibly jump every UTC midnight.
 *  • Custom range uses calendar-day UTC: `from` is treated as
 *    YYYY-MM-DDT00:00:00Z and `to` is exclusive at (toDate+1d)T00:00:00Z.
 *  • The URL is user-mutable: every kind of garbage falls back to the
 *    default (Last 30 days, page 1) silently. No 4xx for malformed params.
 *  • Range is hard-capped at 365 days so the `count(*)` PostgREST does
 *    behind `count: 'exact'` stays cheap.
 */

export const PRESETS = ['7d', '30d', '90d', 'custom'] as const;
export type Preset = (typeof PRESETS)[number];

export const DEFAULT_PRESET: Preset = '30d';
export const PAGE_SIZE = 50;
export const MAX_RANGE_DAYS = 365;

const PRESET_DAYS: Record<Exclude<Preset, 'custom'>, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

const MS_PER_DAY = 86_400_000;

export interface CallsQuery {
  /** ISO timestamptz, inclusive lower bound. */
  fromIso: string;
  /** ISO timestamptz, exclusive upper bound. */
  toIso: string;
  /** YYYY-MM-DD for round-tripping into <input type="date">. */
  fromDate: string;
  toDate: string;
  preset: Preset;
  /** 1-based page number. */
  page: number;
  /** Pre-computed (page-1)*PAGE_SIZE for `.range(offset, offset+limit-1)`. */
  offset: number;
  limit: typeof PAGE_SIZE;
  /** True if the user-requested range was wider than MAX_RANGE_DAYS and we shrank it. */
  rangeCapped: boolean;
}

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidYmd(s: string | null | undefined): s is string {
  if (!s || !YMD_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function ymdToUtcMidnight(ymd: string): Date {
  return new Date(`${ymd}T00:00:00Z`);
}

function dateToYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isPreset(s: string | null): s is Preset {
  return s !== null && (PRESETS as readonly string[]).includes(s);
}

function parsePositiveInt(raw: string | null, fallback: number): number {
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.floor(n);
}

/**
 * Build a `CallsQuery` from an Astro/URL `searchParams`. Always succeeds:
 * unrecognized values fall back to the defaults silently.
 */
export function parseCallsQuery(searchParams: URLSearchParams): CallsQuery {
  const presetRaw = searchParams.get('preset');
  const fromRaw = searchParams.get('from');
  const toRaw = searchParams.get('to');
  const pageRaw = searchParams.get('page');

  const fromValid = isValidYmd(fromRaw);
  const toValid = isValidYmd(toRaw);

  // Decide which mode we're in:
  //  - Explicit `preset=custom` and both dates valid → custom
  //  - Explicit preset = 7d/30d/90d → rolling preset (dates ignored)
  //  - No/invalid preset but both dates valid → custom
  //  - Otherwise → default rolling preset
  let mode: Preset;
  if (presetRaw === 'custom' && fromValid && toValid) {
    mode = 'custom';
  } else if (isPreset(presetRaw) && presetRaw !== 'custom') {
    mode = presetRaw;
  } else if (fromValid && toValid) {
    mode = 'custom';
  } else {
    mode = DEFAULT_PRESET;
  }

  let fromIso: string;
  let toIso: string;
  let fromDate: string;
  let toDate: string;
  let rangeCapped = false;

  if (mode === 'custom') {
    let fromYmd = fromRaw as string;
    let toYmd = toRaw as string;

    // Silent swap if the user inverted the inputs.
    if (fromYmd > toYmd) {
      const tmp = fromYmd;
      fromYmd = toYmd;
      toYmd = tmp;
    }

    const fromMid = ymdToUtcMidnight(fromYmd);
    const toMid = ymdToUtcMidnight(toYmd);
    // `to` is exclusive at next-day UTC midnight so the whole `toDate` is included.
    let toExclusive = new Date(toMid.getTime() + MS_PER_DAY);

    // Cap to MAX_RANGE_DAYS counting from `from` forward (preserve the start
    // of the range the user picked; trim the tail).
    const spanMs = toExclusive.getTime() - fromMid.getTime();
    const capMs = MAX_RANGE_DAYS * MS_PER_DAY;
    if (spanMs > capMs) {
      toExclusive = new Date(fromMid.getTime() + capMs);
      rangeCapped = true;
      toYmd = dateToYmd(new Date(toExclusive.getTime() - MS_PER_DAY));
    }

    fromIso = fromMid.toISOString();
    toIso = toExclusive.toISOString();
    fromDate = fromYmd;
    toDate = toYmd;
  } else {
    const days = PRESET_DAYS[mode];
    const now = new Date();
    const from = new Date(now.getTime() - days * MS_PER_DAY);
    fromIso = from.toISOString();
    toIso = now.toISOString();
    fromDate = dateToYmd(from);
    toDate = dateToYmd(now);
  }

  const page = parsePositiveInt(pageRaw, 1);

  return {
    fromIso,
    toIso,
    fromDate,
    toDate,
    preset: mode,
    page,
    offset: (page - 1) * PAGE_SIZE,
    limit: PAGE_SIZE,
    rangeCapped,
  };
}

/**
 * Build a URL preserving the relevant filter params. Defaults are omitted
 * to keep URLs clean (e.g. `?preset=30d` and `?page=1` become bare paths).
 */
export function buildHref(
  base: string,
  q: { preset?: Preset; fromDate?: string; toDate?: string; page?: number }
): string {
  const params = new URLSearchParams();

  if (q.preset && q.preset !== DEFAULT_PRESET) {
    params.set('preset', q.preset);
  }
  if (q.preset === 'custom') {
    if (q.fromDate) params.set('from', q.fromDate);
    if (q.toDate) params.set('to', q.toDate);
  }
  if (q.page && q.page > 1) {
    params.set('page', String(q.page));
  }

  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}
