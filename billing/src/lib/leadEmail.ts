/**
 * Builders Risk lead-email builder.
 *
 * Pure, dependency-free, env-free module so it can be unit-tested with plain
 * `node`. Given a VAPI call object (the full `/call/{id}` shape), it:
 *   1. decides whether the call reached Jennifer (the BR specialist) AND
 *      captured data — signalled by the presence of a `submit_quote` tool call
 *      with at least an email / name / phone;
 *   2. reconstructs the "filled form" by merging the `builders_risk_submission`
 *      arguments across every `submit_quote` checkpoint (CP1→CP4, additive —
 *      latest non-empty value wins);
 *   3. renders an HTML + plain-text email: a labelled form table + the full
 *      transcript + call metadata.
 *
 * The field dictionary mirrors `farmerbrown/docs/jennifer-data-fields-for-pablo.md`.
 * Any captured field NOT in the dictionary is surfaced under "Other captured
 * fields" so data is never silently dropped (the exact failure mode that doc
 * was written to prevent).
 *
 * Source of the form is the tool-call arguments, NOT the transcript — that's
 * the faithful record of what the agent actually submitted.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

/** Loose VAPI call shape — we only read a handful of fields, defensively. */
export interface VapiCallLike {
  id?: string;
  startedAt?: string;
  endedAt?: string;
  createdAt?: string;
  duration?: number;
  endedReason?: string;
  cost?: number;
  recordingUrl?: string;
  transcript?: string;
  summary?: string;
  customer?: { number?: string };
  messages?: unknown[];
  analysis?: { summary?: string; structuredData?: Record<string, unknown> | null };
  artifact?: {
    transcript?: string;
    recordingUrl?: string;
    messages?: unknown[];
  };
  [key: string]: unknown;
}

export interface BrLead {
  callId: string;
  callTime: string | null; // ISO
  durationSec: number | null;
  endedReason: string | null;
  recordingUrl: string | null;
  summary: string | null;
  callerNumber: string | null;
  /** Upsert email captured by submit_quote (the lead's email). */
  email: string | null;
  /** Annual premium if a quote was actually given (CP4). */
  premium: number | null;
  /** Merged builders_risk_submission across all checkpoints. */
  fields: Record<string, unknown>;
  transcript: string;
}

// ─── Field dictionary ────────────────────────────────────────────────────────

type FormatKind = 'text' | 'yesno' | 'money' | 'bool';

interface FieldDef {
  key: string;
  label: string;
  group: string;
  format?: FormatKind;
}

const GROUP_ORDER = [
  'Contact',
  'Project',
  'Building',
  'Renovation',
  'Risk flags',
  'Outcome',
] as const;

// Order within each group follows the conversational order in
// jennifer-data-fields-for-pablo.md §2/§6.
const FIELDS: FieldDef[] = [
  // Contact
  { key: 'first_name', label: 'First name', group: 'Contact' },
  { key: 'last_name', label: 'Last name', group: 'Contact' },
  { key: 'phone', label: 'Phone', group: 'Contact' },
  { key: 'company_name', label: 'Company name', group: 'Contact' },
  { key: 'sms_consent', label: 'SMS consent', group: 'Contact', format: 'bool' },

  // Project
  { key: 'project_type', label: 'Project type', group: 'Project' },
  { key: 'building_coverage', label: 'Building coverage', group: 'Project', format: 'money' },
  { key: 'total_building_coverage', label: 'Total coverage (all structures)', group: 'Project', format: 'money' },
  { key: 'square_footage', label: 'Square footage', group: 'Project' },
  { key: 'coverage_date', label: 'Requested effective date', group: 'Project' },
  { key: 'project_start_date', label: 'Projected start date', group: 'Project' },
  { key: 'project_length_months', label: 'Project length (months)', group: 'Project' },
  { key: 'deductible', label: 'Deductible', group: 'Project' },
  { key: 'occupied_during_term', label: 'Occupied during term', group: 'Project', format: 'bool' },

  // Building
  { key: 'building_street', label: 'Project street', group: 'Building' },
  { key: 'building_city', label: 'Project city', group: 'Building' },
  { key: 'building_state', label: 'Project state', group: 'Building' },
  { key: 'building_zip', label: 'Project ZIP', group: 'Building' },
  { key: 'mailing_street', label: 'Mailing street', group: 'Building' },
  { key: 'mailing_city', label: 'Mailing city', group: 'Building' },
  { key: 'mailing_state', label: 'Mailing state', group: 'Building' },
  { key: 'mailing_zip', label: 'Mailing ZIP', group: 'Building' },
  { key: 'form_of_business', label: 'Form of business', group: 'Building' },
  { key: 'user_type', label: 'Owner / Builder / Both', group: 'Building' },
  { key: 'has_basement', label: 'Basement', group: 'Building', format: 'yesno' },
  { key: 'number_of_stories', label: 'Stories', group: 'Building' },
  { key: 'building_type', label: 'Building type', group: 'Building' },
  { key: 'construction_type', label: 'Construction type', group: 'Building' },
  { key: 'is_model_home', label: 'Model home', group: 'Building', format: 'bool' },
  { key: 'is_modular', label: 'Modular', group: 'Building', format: 'bool' },
  { key: 'has_solar', label: 'Solar install', group: 'Building', format: 'bool' },
  { key: 'multiple_structures', label: 'Multiple structures', group: 'Building', format: 'bool' },
  { key: 'previous_damage_perils', label: 'Previous damage (any peril)', group: 'Building', format: 'bool' },

  // Renovation
  { key: 'existing_structure_value', label: 'Existing structure value', group: 'Renovation', format: 'money' },
  { key: 'renovation_value', label: 'Renovation investment', group: 'Renovation', format: 'money' },
  { key: 'existing_structure_weatherproof', label: 'Existing structure weather-proofed', group: 'Renovation', format: 'yesno' },
  { key: 'existing_structure_age_years', label: 'Existing structure age (years)', group: 'Renovation' },
  { key: 'existing_structure_condition', label: 'Existing structure condition', group: 'Renovation' },
  { key: 'existing_structure_description', label: 'Existing structure description', group: 'Renovation' },
  { key: 'moving_load_bearing_walls', label: 'Moving load-bearing walls', group: 'Renovation', format: 'yesno' },
  { key: 'work_description', label: 'Work description', group: 'Renovation' },

  // Risk flags
  { key: 'claims_in_past_2_years', label: 'Claims in past 2 years', group: 'Risk flags', format: 'yesno' },
  { key: 'near_coast', label: 'Within 25mi of coast', group: 'Risk flags', format: 'yesno' },
  { key: 'project_already_started', label: 'Construction already started', group: 'Risk flags', format: 'yesno' },
  { key: 'high_risk_fire_zone', label: 'High-risk fire zone', group: 'Risk flags', format: 'yesno' },
  { key: 'is_high_risk', label: 'High risk (any flag)', group: 'Risk flags', format: 'bool' },

  // Outcome
  { key: 'annual_premium', label: 'Annual premium quoted', group: 'Outcome', format: 'money' },
  { key: 'hard_to_place_details', label: 'Hard-to-place details', group: 'Outcome' },
  { key: 'appointment_id', label: 'Appointment ID', group: 'Outcome' },
  { key: 'scheduled_time', label: 'Scheduled time', group: 'Outcome' },
];

const KNOWN_KEYS = new Set(FIELDS.map((f) => f.key));

// ─── Extraction ──────────────────────────────────────────────────────────────

function getMessages(call: VapiCallLike): unknown[] {
  const a = call.artifact?.messages;
  if (Array.isArray(a) && a.length) return a;
  if (Array.isArray(call.messages)) return call.messages;
  return [];
}

/** Pull every parsed `submit_quote` argument object out of a message list. */
export function extractSubmitQuoteArgs(messages: unknown[]): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  for (const m of messages) {
    if (!m || typeof m !== 'object') continue;
    const msg = m as Record<string, unknown>;
    const toolCalls =
      (msg.toolCalls as unknown[]) ?? (msg.tool_calls as unknown[]) ?? [];
    if (!Array.isArray(toolCalls)) continue;
    for (const tc of toolCalls) {
      if (!tc || typeof tc !== 'object') continue;
      const fn = (tc as Record<string, unknown>).function as
        | Record<string, unknown>
        | undefined;
      const name = (fn?.name ?? (tc as Record<string, unknown>).name) as
        | string
        | undefined;
      if (name !== 'submit_quote') continue;
      const rawArgs = (fn?.arguments ?? (tc as Record<string, unknown>).arguments) as
        | string
        | Record<string, unknown>
        | undefined;
      const parsed = parseArgs(rawArgs);
      if (parsed) out.push(parsed);
    }
  }
  return out;
}

function parseArgs(
  raw: string | Record<string, unknown> | undefined
): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (!s) return null;
    try {
      const v = JSON.parse(s);
      return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
  return null;
}

function isEmpty(v: unknown): boolean {
  return v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
}

/** Merge submit_quote arg objects: latest non-empty value wins per key. */
function mergeArgs(argsList: Array<Record<string, unknown>>): {
  email: string | null;
  fields: Record<string, unknown>;
} {
  let email: string | null = null;
  const fields: Record<string, unknown> = {};
  for (const args of argsList) {
    const topEmail = args.email;
    if (typeof topEmail === 'string' && topEmail.trim()) email = topEmail.trim();

    const sub = args.builders_risk_submission;
    const bag =
      sub && typeof sub === 'object'
        ? (sub as Record<string, unknown>)
        : // Defensive: if the LLM ever sends a flat bag, treat args (minus
          // control keys) as the field bag.
          stripControlKeys(args);
    for (const [k, v] of Object.entries(bag)) {
      if (!isEmpty(v)) fields[k] = v;
    }
  }
  // Email may also live inside the submission bag.
  if (!email && typeof fields.email === 'string') email = (fields.email as string).trim();
  return { email, fields };
}

function stripControlKeys(args: Record<string, unknown>): Record<string, unknown> {
  const { email: _e, builders_risk_submission: _b, ...rest } = args;
  void _e;
  void _b;
  return rest;
}

export function extractLead(call: VapiCallLike): BrLead {
  const messages = getMessages(call);
  const argsList = extractSubmitQuoteArgs(messages);
  const { email, fields } = mergeArgs(argsList);

  const transcript = call.artifact?.transcript ?? call.transcript ?? '';
  const summary = call.analysis?.summary ?? call.summary ?? null;
  const recordingUrl = call.recordingUrl ?? call.artifact?.recordingUrl ?? null;
  const callTime = call.startedAt ?? call.createdAt ?? null;

  let durationSec: number | null = null;
  if (call.startedAt && call.endedAt) {
    const d = (Date.parse(call.endedAt) - Date.parse(call.startedAt)) / 1000;
    if (Number.isFinite(d) && d >= 0) durationSec = Math.round(d);
  } else if (typeof call.duration === 'number') {
    durationSec = Math.round(call.duration);
  }

  const premium = toNumber(fields.annual_premium);

  return {
    callId: call.id ?? '',
    callTime,
    durationSec,
    endedReason: call.endedReason ?? null,
    recordingUrl,
    summary,
    callerNumber: call.customer?.number ?? null,
    email,
    premium,
    fields,
    transcript: typeof transcript === 'string' ? transcript : '',
  };
}

/** Every tool-call function name in a message list, in chronological order. */
export function extractToolCallNames(messages: unknown[]): string[] {
  const out: string[] = [];
  for (const m of messages) {
    if (!m || typeof m !== 'object') continue;
    const msg = m as Record<string, unknown>;
    const toolCalls =
      (msg.toolCalls as unknown[]) ?? (msg.tool_calls as unknown[]) ?? [];
    if (!Array.isArray(toolCalls)) continue;
    for (const tc of toolCalls) {
      if (!tc || typeof tc !== 'object') continue;
      const fn = (tc as Record<string, unknown>).function as Record<string, unknown> | undefined;
      const name = (fn?.name ?? (tc as Record<string, unknown>).name) as string | undefined;
      if (typeof name === 'string' && name) out.push(name);
    }
  }
  return out;
}

// Known transfer tools → the human-readable team the caller was routed to.
// Any unknown `transfer_to_*` still classifies as a transfer (label derived).
const TRANSFER_LABELS: Record<string, string> = {
  transfer_to_spanish_team: 'Spanish team',
  transfer_to_service_team: 'service team',
  transfer_to_existing_quote_team: 'existing-quote team',
  transfer_to_specific_person: 'a specific person (direct dial)',
  transfer_to_live_agent_builders_risk: 'live agent',
  transfer_to_live_agent_farmer_brown: 'live agent',
  transfer_to_live_agent_contractors_liability: 'live agent',
  transfer_to_home_auto_team: 'Home & Auto team',
};

/** Turn a `transfer_to_x_y` tool name into a readable label. */
function transferLabel(toolName: string): string {
  if (TRANSFER_LABELS[toolName]) return TRANSFER_LABELS[toolName];
  return toolName.replace(/^transfer_to_/, '').replace(/_/g, ' ').trim() || 'a live agent';
}

/**
 * The LAST `transfer_to_*` tool call in the message list, if any. Last, not
 * first, so the *final* routing wins (a caller can bounce through more than one).
 */
function detectTransfer(messages: unknown[]): { toolName: string; label: string } | null {
  const transfers = extractToolCallNames(messages).filter((n) => n.startsWith('transfer_to_'));
  if (transfers.length === 0) return null;
  const toolName = transfers[transfers.length - 1];
  return { toolName, label: transferLabel(toolName) };
}

/** A user/customer message (or transcript line) with real words — bracketed
 * markers like `[hung up]` don't count as the caller actually speaking. */
function isRealCallerText(s: unknown): boolean {
  if (typeof s !== 'string') return false;
  const t = s.trim();
  return Boolean(t) && !/^\[.*\]$/.test(t);
}

/** Did the human caller actually say anything? Distinguishes a real (if
 * incomplete) conversation from a silent misdial / instant hang-up. */
export function hasCustomerSpeech(call: VapiCallLike): boolean {
  for (const m of getMessages(call)) {
    if (!m || typeof m !== 'object') continue;
    const msg = m as Record<string, unknown>;
    const role = String(msg.role ?? '').toLowerCase();
    if (role !== 'user' && role !== 'customer') continue;
    if (isRealCallerText(msg.message ?? msg.content ?? msg.transcript)) return true;
  }
  const t = call.artifact?.transcript ?? call.transcript ?? '';
  if (typeof t === 'string') {
    for (const line of t.split('\n')) {
      const mm = line.match(/^\s*(?:user|customer)\s*:\s*(.+)$/i);
      if (mm && isRealCallerText(mm[1])) return true;
    }
  }
  return false;
}

/**
 * Every finished BR call classified by outcome:
 *   • `lead`     — reached Jennifer AND captured data (rich form email)
 *   • `transfer` — routed to a human team (Spanish / service / etc.)
 *   • `other`    — the caller spoke but no lead and no transfer
 *   • `empty`    — silent misdial / instant hang-up (the noise floor: skipped)
 *
 * `lead` is checked first: a real lead also fires a live-agent transfer at the
 * end (Jennifer's post-quote FAST TRANSFER), and must render as a lead, not a
 * "routed to live agent" outcome.
 */
export type CallOutcome =
  | { kind: 'lead' }
  | { kind: 'transfer'; toolName: string; label: string }
  | { kind: 'other' }
  | { kind: 'empty' };

export function classifyCall(call: VapiCallLike): CallOutcome {
  if (reachedJenniferWithData(call)) return { kind: 'lead' };
  const transfer = detectTransfer(getMessages(call));
  if (transfer) return { kind: 'transfer', toolName: transfer.toolName, label: transfer.label };
  if (hasCustomerSpeech(call)) return { kind: 'other' };
  return { kind: 'empty' };
}

/**
 * "Reached Jennifer with data": a submit_quote tool call happened AND at least
 * one identifying field (email / name / phone) was captured. Pure-triage
 * hang-ups on Grace never call submit_quote, so they're filtered out.
 */
export function reachedJenniferWithData(call: VapiCallLike): boolean {
  const messages = getMessages(call);
  const argsList = extractSubmitQuoteArgs(messages);
  if (argsList.length === 0) return false;
  const { email, fields } = mergeArgs(argsList);
  return Boolean(
    (email && email.length) ||
      fields.first_name ||
      fields.last_name ||
      fields.phone
  );
}

// ─── Formatting helpers ──────────────────────────────────────────────────────

function toNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v.replace(/[$,\s]/g, ''));
    if (Number.isFinite(n) && v.trim() !== '') return n;
  }
  return null;
}

/**
 * Lossless stringify for display. Plain String() collapses objects/arrays to
 * "[object Object]" / lossy comma-joins — which would silently drop the very
 * data this module promises to surface (the "Other captured fields" guarantee).
 */
function display(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

function fmtMoney(v: unknown): string {
  const n = toNumber(v);
  if (n === null) return display(v);
  return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function fmtYesNo(v: unknown): string {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  const s = String(v).trim().toLowerCase();
  if (['yes', 'true', 'y', '1'].includes(s)) return 'Yes';
  if (['no', 'false', 'n', '0'].includes(s)) return 'No';
  return display(v);
}

function fmtBool(v: unknown): string {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return fmtYesNo(v);
}

function fmtValue(def: FieldDef | undefined, v: unknown): string {
  if (!def || !def.format || def.format === 'text') return display(v);
  if (def.format === 'money') return fmtMoney(v);
  if (def.format === 'yesno') return fmtYesNo(v);
  if (def.format === 'bool') return fmtBool(v);
  return String(v);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtDuration(sec: number | null): string {
  if (sec === null) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  // US Central with the CST/CDT label (Farmer Brown's business timezone).
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    }).format(new Date(t));
  } catch {
    return new Date(t).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
  }
}

// ─── Subject ─────────────────────────────────────────────────────────────────

export function leadSubject(lead: BrLead): string {
  const name =
    [lead.fields.first_name, lead.fields.last_name]
      .filter((x) => typeof x === 'string' && x)
      .join(' ') || 'Unknown caller';
  const parts: string[] = [name];
  if (lead.fields.project_type) parts.push(String(lead.fields.project_type));
  if (lead.fields.building_coverage) parts.push(fmtMoney(lead.fields.building_coverage));

  let outcome = '';
  if (lead.premium !== null) outcome = `quote ${fmtMoney(lead.premium)}`;
  else if (!isEmpty(lead.fields.hard_to_place_details)) outcome = 'hard-to-place';
  else if (!isEmpty(lead.fields.appointment_id)) outcome = 'appointment booked';
  else outcome = 'no quote';
  parts.push(outcome);

  return `New Builders Risk lead — ${parts.join(' · ')}`;
}

// ─── Render: HTML body (inner; the email lib wraps it with the brand header) ──

export function renderLeadBodyHtml(lead: BrLead): string {
  const rows: string[] = [];

  // Premium / outcome banner.
  if (lead.premium !== null) {
    rows.push(`
      <p style="margin:0 0 1.25rem;padding:0.75rem 1rem;background:#ecfdf5;
                border:1px solid #a7f3d0;border-radius:8px;font-size:1.05rem;">
        <strong>Annual premium quoted:</strong> ${escapeHtml(fmtMoney(lead.premium))}
      </p>`);
  } else if (!isEmpty(lead.fields.hard_to_place_details)) {
    rows.push(`
      <p style="margin:0 0 1.25rem;padding:0.75rem 1rem;background:#fffbeb;
                border:1px solid #fde68a;border-radius:8px;">
        <strong>Hard-to-place</strong> — not quoted on the call.
      </p>`);
  }

  // Call metadata.
  const metaItems = [
    ['Caller', lead.callerNumber],
    ['Email', lead.email],
    ['When', fmtTime(lead.callTime)],
    ['Duration', fmtDuration(lead.durationSec)],
    ['Ended', lead.endedReason],
  ].filter(([, v]) => v) as [string, string][];
  rows.push(metaTable(metaItems));

  if (lead.summary) {
    rows.push(`
      <h3 style="margin:1.5rem 0 0.5rem;font-size:1rem;">Call summary</h3>
      <p style="margin:0 0 1rem;color:#374151;">${escapeHtml(lead.summary)}</p>`);
  }

  // The filled form, grouped.
  rows.push(`<h3 style="margin:1.5rem 0 0.5rem;font-size:1rem;">Quote form</h3>`);
  for (const group of GROUP_ORDER) {
    const defs = FIELDS.filter((f) => f.group === group);
    const present = defs.filter((d) => !isEmpty(lead.fields[d.key]));
    if (present.length === 0) continue;
    rows.push(`<p style="margin:1rem 0 0.25rem;font-weight:600;color:#111;">${group}</p>`);
    rows.push(
      fieldTable(
        present.map((d) => [d.label, fmtValue(d, lead.fields[d.key])] as [string, string])
      )
    );
  }

  // Any captured fields not in the dictionary — never drop silently.
  const otherKeys = Object.keys(lead.fields).filter(
    (k) => !KNOWN_KEYS.has(k) && !isEmpty(lead.fields[k]) && k !== 'email'
  );
  if (otherKeys.length) {
    rows.push(`<p style="margin:1rem 0 0.25rem;font-weight:600;color:#111;">Other captured fields</p>`);
    rows.push(
      fieldTable(otherKeys.map((k) => [k, display(lead.fields[k])] as [string, string]))
    );
  }

  // NOTE: the call recording is deliberately NEVER rendered — its URL host
  // would reveal the underlying voice platform. No recording link, ever.

  // Full transcript.
  rows.push(`<h3 style="margin:1.5rem 0 0.5rem;font-size:1rem;">Full transcript</h3>`);
  rows.push(`
    <pre style="white-space:pre-wrap;word-break:break-word;background:#f9fafb;
                border:1px solid #e5e7eb;border-radius:8px;padding:1rem;
                font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
                font-size:0.8125rem;line-height:1.5;color:#111;">${escapeHtml(
                  lead.transcript || '(no transcript)'
                )}</pre>`);

  return rows.join('\n');
}

function metaTable(items: [string, string][]): string {
  return tableHtml(items, '#6b7280');
}
function fieldTable(items: [string, string][]): string {
  return tableHtml(items, '#374151');
}
function tableHtml(items: [string, string][], labelColor: string): string {
  const trs = items
    .map(
      ([k, v]) => `
      <tr>
        <td style="padding:0.25rem 1rem 0.25rem 0;color:${labelColor};
                   vertical-align:top;white-space:nowrap;">${escapeHtml(k)}</td>
        <td style="padding:0.25rem 0;color:#111;vertical-align:top;">${escapeHtml(v)}</td>
      </tr>`
    )
    .join('');
  return `<table style="border-collapse:collapse;font-size:0.9rem;">${trs}</table>`;
}

// ─── Render: plain text ──────────────────────────────────────────────────────

export function renderLeadText(lead: BrLead): string {
  const lines: string[] = [];
  const name =
    [lead.fields.first_name, lead.fields.last_name].filter(Boolean).join(' ') ||
    'Unknown caller';
  lines.push(`NEW BUILDERS RISK LEAD — ${name}`);
  if (lead.premium !== null) lines.push(`Annual premium quoted: ${fmtMoney(lead.premium)}`);
  lines.push('');
  if (lead.callerNumber) lines.push(`Caller: ${lead.callerNumber}`);
  if (lead.email) lines.push(`Email: ${lead.email}`);
  lines.push(`When: ${fmtTime(lead.callTime)}`);
  lines.push(`Duration: ${fmtDuration(lead.durationSec)}`);
  if (lead.endedReason) lines.push(`Ended: ${lead.endedReason}`);
  if (lead.summary) {
    lines.push('', 'CALL SUMMARY', lead.summary);
  }
  lines.push('', 'QUOTE FORM');
  for (const group of GROUP_ORDER) {
    const defs = FIELDS.filter((f) => f.group === group);
    const present = defs.filter((d) => !isEmpty(lead.fields[d.key]));
    if (!present.length) continue;
    lines.push(`  [${group}]`);
    for (const d of present) {
      lines.push(`    ${d.label}: ${fmtValue(d, lead.fields[d.key])}`);
    }
  }
  const otherKeys = Object.keys(lead.fields).filter(
    (k) => !KNOWN_KEYS.has(k) && !isEmpty(lead.fields[k]) && k !== 'email'
  );
  if (otherKeys.length) {
    lines.push('  [Other captured fields]');
    for (const k of otherKeys) lines.push(`    ${k}: ${display(lead.fields[k])}`);
  }
  // Recording deliberately never included (would reveal the voice platform).
  lines.push('', 'FULL TRANSCRIPT', lead.transcript || '(no transcript)');
  return lines.join('\n');
}

// ─── Render: non-lead "call outcome" email ───────────────────────────────────
// Lighter than the lead form: no quote form (there is none), just the outcome
// banner + metadata + summary + full transcript. Same external-comms discipline
// as the lead email — the recording is NEVER rendered and the voice platform is
// never named.

/** Scannable subject line for a non-lead call. */
export function outcomeSubject(lead: BrLead, outcome: CallOutcome): string {
  if (outcome.kind === 'transfer') return `BR call — routed to ${outcome.label}`;
  return `BR call — no lead (ended: ${lead.endedReason ?? 'unknown'})`;
}

function outcomeBanner(outcome: CallOutcome): string {
  if (outcome.kind === 'transfer') {
    const spanish = outcome.toolName === 'transfer_to_spanish_team';
    const bg = spanish ? '#ecfdf5' : '#eff6ff';
    const border = spanish ? '#a7f3d0' : '#bfdbfe';
    const icon = spanish ? '✅' : '➡️';
    return `
      <p style="margin:0 0 1.25rem;padding:0.75rem 1rem;background:${bg};
                border:1px solid ${border};border-radius:8px;font-size:1.05rem;">
        ${icon} <strong>Caller routed to the ${escapeHtml(outcome.label)}.</strong>
      </p>`;
  }
  return `
    <p style="margin:0 0 1.25rem;padding:0.75rem 1rem;background:#f9fafb;
              border:1px solid #e5e7eb;border-radius:8px;">
      <strong>No quote captured and no transfer</strong> — the caller reached the
      line and spoke, but did not complete an intake.
    </p>`;
}

export function renderOutcomeBodyHtml(lead: BrLead, outcome: CallOutcome): string {
  const rows: string[] = [outcomeBanner(outcome)];

  const metaItems = [
    ['Caller', lead.callerNumber],
    ['When', fmtTime(lead.callTime)],
    ['Duration', fmtDuration(lead.durationSec)],
    ['Ended', lead.endedReason],
  ].filter(([, v]) => v) as [string, string][];
  rows.push(metaTable(metaItems));

  if (lead.summary) {
    rows.push(`
      <h3 style="margin:1.5rem 0 0.5rem;font-size:1rem;">Call summary</h3>
      <p style="margin:0 0 1rem;color:#374151;">${escapeHtml(lead.summary)}</p>`);
  }

  // NOTE: recording deliberately NEVER rendered — its URL host reveals the
  // voice platform. No recording link, ever.

  rows.push(`<h3 style="margin:1.5rem 0 0.5rem;font-size:1rem;">Full transcript</h3>`);
  rows.push(`
    <pre style="white-space:pre-wrap;word-break:break-word;background:#f9fafb;
                border:1px solid #e5e7eb;border-radius:8px;padding:1rem;
                font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
                font-size:0.8125rem;line-height:1.5;color:#111;">${escapeHtml(
                  lead.transcript || '(no transcript)'
                )}</pre>`);

  return rows.join('\n');
}

export function renderOutcomeText(lead: BrLead, outcome: CallOutcome): string {
  const lines: string[] = [];
  if (outcome.kind === 'transfer') {
    lines.push(`BR CALL — ROUTED TO ${outcome.label.toUpperCase()}`);
  } else {
    lines.push('BR CALL — NO LEAD, NO TRANSFER');
  }
  lines.push('');
  if (lead.callerNumber) lines.push(`Caller: ${lead.callerNumber}`);
  lines.push(`When: ${fmtTime(lead.callTime)}`);
  lines.push(`Duration: ${fmtDuration(lead.durationSec)}`);
  if (lead.endedReason) lines.push(`Ended: ${lead.endedReason}`);
  if (lead.summary) lines.push('', 'CALL SUMMARY', lead.summary);
  // Recording deliberately never included (would reveal the voice platform).
  lines.push('', 'FULL TRANSCRIPT', lead.transcript || '(no transcript)');
  return lines.join('\n');
}
