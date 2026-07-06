/**
 * Display formatters shared by the portal UI.
 *
 * Money is stored as integer cents end-to-end. Durations come from VAPI in
 * whole seconds. These helpers convert to human-readable strings without
 * locale surprises (en-US for dates so the UI matches the rest of the
 * customer-facing copy, which is English).
 */

export function formatMoney(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function formatTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Per-call duration: "1m 23s" / "45s" / "—". */
export function formatDuration(secs: number | null): string {
  if (!secs || secs <= 0) return '—';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

/** Aggregate talk time across many calls: "5h 30m" / "45m" / "0m". */
export function formatDurationLong(secs: number): string {
  if (!Number.isFinite(secs) || secs <= 0) return '0m';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

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
