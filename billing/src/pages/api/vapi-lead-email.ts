/**
 * Builders Risk lead-email notifier.
 *
 *   POST /api/vapi-lead-email
 *     VAPI server webhook. Subscribed via `server.url` on the BR phone
 *     number(s). Acts on `end-of-call-report`. Auth: `X-Vapi-Secret` header
 *     must equal CRON_SECRET (the value we set as the number's server.secret).
 *
 *   GET /api/vapi-lead-email   (Authorization: Bearer <CRON_SECRET>)
 *     Manual / catch-up / re-send. Same core as the webhook.
 *       ?callId=<id>          process one call
 *       ?sinceHours=N         catch-up over recent BR-squad calls (default 48)
 *       &dryRun=true          report what would send, send nothing
 *       &maxCalls=N           cap GETs during catch-up (default 60)
 *     ?ping=1 (no auth)       health check
 *
 * Only calls that reached Jennifer AND captured data (a `submit_quote` tool
 * call) produce an email. Idempotent via Resend key `br-lead-<callId>`.
 */

import type { APIRoute } from 'astro';
import { createVapiClient, type VapiCall } from '@lib/vapi';
import {
  extractLead,
  reachedJenniferWithData,
  renderLeadBodyHtml,
  renderLeadText,
  leadSubject,
  type VapiCallLike,
} from '@lib/leadEmail';
import { sendLeadSummary } from '@lib/email';
import { timingSafeEqual } from 'node:crypto';

export const prerender = false;

// BR Unified squad — every BR receptionist/specialist call carries this squadId.
const BR_SQUAD_ID = 'a3269fa7-6229-4bed-817a-c4684878a600';

// Resend honors an idempotency key for 24h — keep the catch-up default inside
// that window so a re-run can't out-live the dedupe and duplicate the webhook.
const IDEMPOTENCY_WINDOW_HOURS = 24;

// Who gets the COMPLETE lead (end of call): José + the client's sales inbox.
const COMPLETE_RECIPIENTS = ['jaromero.es@gmail.com', 'leads@farmerbrown.com'];
// Who gets the mid-call "[In progress]" heads-up: internal only. Sending
// incomplete mid-call notices to the client's inbox reads as noise — keep it to
// José. (To also send partials to leads@, add it here.)
const PARTIAL_RECIPIENTS = ['jaromero.es@gmail.com'];

function dedupe(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const a of list) {
    const v = a.trim();
    const k = v.toLowerCase();
    if (v && !seen.has(k)) {
      seen.add(k);
      out.push(v);
    }
  }
  return out;
}

/** Complete-lead recipients. Hard-coded base (bulletproof against a missing/
 * stale Vercel env) + any extras from LEAD_NOTIFICATION_EMAILS, deduped. */
function recipients(): string[] {
  const env = import.meta.env.LEAD_NOTIFICATION_EMAILS as string | undefined;
  const extra = env ? env.split(',').map((s) => s.trim()).filter(Boolean) : [];
  return dedupe([...COMPLETE_RECIPIENTS, ...extra]);
}

/** Mid-call partial recipients (internal only). */
function partialRecipients(): string[] {
  return dedupe(PARTIAL_RECIPIENTS);
}

/** Constant-time secret compare (length-guarded). */
function verifySecret(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Short stable token for a recipient set, folded into the idempotency key so a
 * different audience is treated as a distinct send (adding a 2nd recipient must
 * actually deliver, not get deduped against the José-only send). */
function recipientsToken(to: string[]): string {
  const norm = [...to].map((s) => s.trim().toLowerCase()).sort().join(',');
  let h = 5381;
  for (let i = 0; i < norm.length; i++) h = ((h << 5) + h + norm.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

interface ProcessResult {
  callId: string;
  status: 'sent' | 'would-send' | 'skipped';
  reason?: string;
  subject?: string;
  email?: string | null;
  premium?: number | null;
  to?: string[];
}

async function processCallObject(
  call: VapiCallLike,
  opts: { dryRun: boolean; toOverride?: string[] }
): Promise<ProcessResult> {
  const callId = call.id ?? '';
  if (!reachedJenniferWithData(call)) {
    return { callId, status: 'skipped', reason: 'no submit_quote data (did not reach Jennifer)' };
  }
  const lead = extractLead(call);
  const subject = leadSubject(lead);
  const to = opts.toOverride?.length ? opts.toOverride : recipients();

  if (opts.dryRun) {
    return { callId, status: 'would-send', subject, email: lead.email, premium: lead.premium, to };
  }

  await sendLeadSummary({
    to,
    subject,
    bodyHtml: renderLeadBodyHtml(lead),
    text: renderLeadText(lead),
    // Recipient set folded into the key so a NEW audience (e.g. adding John's
    // team) is a distinct send, not deduped against the José-only one.
    idempotencyKey: `br-lead-${callId}-${recipientsToken(to)}`,
  });

  return { callId, status: 'sent', subject, email: lead.email, premium: lead.premium, to };
}

/** Messages from an informational server message (conversation-update etc.). */
function messagesFromInformational(message: Record<string, unknown>): unknown[] {
  if (Array.isArray(message.messages)) return message.messages as unknown[];
  if (Array.isArray(message.messagesOpenAIFormatted))
    return message.messagesOpenAIFormatted as unknown[];
  const tc =
    (message.toolCalls as unknown[]) ??
    (message.toolCallList as unknown[]) ??
    (message.tool_calls as unknown[]);
  return Array.isArray(tc) ? [{ role: 'tool_calls', toolCalls: tc }] : [];
}

/**
 * Partial / "new lead in progress" send, fired DURING the call from an
 * informational `conversation-update` the moment Jennifer first submits contact
 * data. To avoid re-firing on every turn, we only act when submit_quote appears
 * in the TAIL of the running message list (i.e. it was just called); Resend's
 * idempotency key then collapses the ~1-per-checkpoint hits into ONE partial
 * email per call per audience. The end-of-call-report sends the complete lead.
 */
async function processPartial(
  callId: string,
  message: Record<string, unknown>,
  opts: { toOverride?: string[] }
): Promise<ProcessResult> {
  const messages = messagesFromInformational(message);
  if (messages.length === 0) {
    return { callId, status: 'skipped', reason: 'no messages in update' };
  }
  // Gate: submit_quote must be recent (in the last few messages), else this is
  // just a later turn and we'd needlessly re-hit Resend.
  const tail: VapiCallLike = { id: callId, artifact: { messages: messages.slice(-4) } };
  if (!reachedJenniferWithData(tail)) {
    return { callId, status: 'skipped', reason: 'no recent submit_quote contact data' };
  }
  // Build the lead from the FULL list (richer than the tail).
  const lead = extractLead({ id: callId, artifact: { messages } });
  const to = opts.toOverride?.length ? opts.toOverride : partialRecipients();
  const subject = `[In progress] ${leadSubject(lead)}`;
  const banner =
    '<p style="margin:0 0 1.25rem;padding:0.75rem 1rem;background:#eff6ff;' +
    'border:1px solid #bfdbfe;border-radius:8px;">⏳ <strong>Partial lead — call still in progress.</strong> ' +
    'A complete summary will follow when the call ends.</p>';

  await sendLeadSummary({
    to,
    subject,
    bodyHtml: banner + renderLeadBodyHtml(lead),
    text: `PARTIAL LEAD — call still in progress.\n\n${renderLeadText(lead)}`,
    idempotencyKey: `br-lead-partial-${callId}-${recipientsToken(to)}`,
  });

  return { callId, status: 'sent', subject, email: lead.email, premium: lead.premium, to };
}

/** Parse a `?to=a@x,b@y` override (test only; auth-gated by the caller). */
function parseToOverride(url: URL): string[] | undefined {
  const raw = url.searchParams.get('to');
  if (!raw) return undefined;
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return list.length ? list : undefined;
}

// ─── POST: VAPI webhook ──────────────────────────────────────────────────────

export const POST: APIRoute = async ({ request, url }) => {
  // Fail CLOSED: never accept an unauthenticated webhook (a missing secret must
  // reject, not skip the check).
  const secret = import.meta.env.CRON_SECRET;
  if (!secret) return json({ error: 'CRON_SECRET not configured' }, 500);
  if (!verifySecret(request.headers.get('x-vapi-secret') ?? '', secret)) {
    return json({ error: 'unauthorized' }, 401);
  }
  const toOverride = parseToOverride(url);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: 'invalid json' }, 400);
  }

  const message = (body.message ?? body) as Record<string, unknown>;
  const type = message.type as string | undefined;

  // Partial / "lead in progress" — fired DURING the call. conversation-update
  // is informational (non-blocking), so a 200 is always safe here.
  if (type === 'conversation-update') {
    const reportCall = (message.call ?? {}) as Record<string, unknown>;
    const callId = (reportCall.id as string) ?? (message.callId as string) ?? '';
    if (!callId) return json({ ok: true, ignored: 'conversation-update without call id' }, 200);
    try {
      const result = await processPartial(callId, message, { toOverride });
      return json({ ok: true, partial: result }, 200);
    } catch (err) {
      return json({ ok: true, partialError: err instanceof Error ? err.message : String(err) }, 200);
    }
  }

  if (type !== 'end-of-call-report') {
    // Other informational messages we don't act on — ack so VAPI stops.
    return json({ ok: true, ignored: type ?? 'unknown' }, 200);
  }

  // Build a call-like object straight from the report (it carries artifact +
  // analysis + call). Fall back to a fresh GET if the artifact is missing.
  const reportCall = (message.call ?? {}) as Record<string, unknown>;
  const callId = (reportCall.id as string) ?? (message.callId as string) ?? '';
  if (!callId) return json({ error: 'no call id in report' }, 400);

  let callLike: VapiCallLike = {
    ...reportCall,
    id: callId,
    endedReason:
      (message.endedReason as string) ?? (reportCall.endedReason as string),
    artifact: message.artifact as VapiCallLike['artifact'],
    analysis: message.analysis as VapiCallLike['analysis'],
    recordingUrl:
      (message.recordingUrl as string) ??
      (reportCall.recordingUrl as string) ??
      ((message.artifact as Record<string, unknown>)?.recordingUrl as string),
  };

  if (!callLike.artifact?.messages?.length) {
    try {
      const vapiKey = import.meta.env.VAPI_KEY;
      if (vapiKey) {
        const vapi = createVapiClient(vapiKey);
        callLike = (await vapi.request<VapiCall>('GET', `/call/${callId}`)) as unknown as VapiCallLike;
      }
    } catch {
      // Use whatever the report gave us.
    }
  }

  try {
    const result = await processCallObject(callLike, { dryRun: false, toOverride });
    return json({ ok: true, result }, 200);
  } catch (err) {
    // 500 → VAPI may retry; the Resend idempotency key prevents duplicates.
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
};

// ─── GET: manual / catch-up / health ─────────────────────────────────────────

export const GET: APIRoute = async ({ request, url }) => {
  if (url.searchParams.get('ping')) {
    return json({ ok: true, service: 'vapi-lead-email', build: 'h8-monorepo' }, 200);
  }

  const secret = import.meta.env.CRON_SECRET;
  if (!secret) return json({ error: 'CRON_SECRET not configured' }, 500);
  const auth = request.headers.get('authorization') ?? '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!verifySecret(bearer, secret)) return json({ error: 'unauthorized' }, 401);

  const vapiKey = import.meta.env.VAPI_KEY;
  if (!vapiKey) return json({ error: 'VAPI_KEY not configured' }, 500);
  const vapi = createVapiClient(vapiKey);

  const dryRun = url.searchParams.get('dryRun') === 'true';
  const toOverride = parseToOverride(url);
  const callId = url.searchParams.get('callId');

  // Single call.
  if (callId) {
    try {
      const call = (await vapi.request<VapiCall>('GET', `/call/${callId}`)) as unknown as VapiCallLike;
      const result = await processCallObject(call, { dryRun, toOverride });
      return json({ ok: true, dryRun, result }, 200);
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : String(err) }, 500);
    }
  }

  // Catch-up over recent BR-squad calls.
  const sinceHours =
    Number(url.searchParams.get('sinceHours') ?? String(IDEMPOTENCY_WINDOW_HOURS)) ||
    IDEMPOTENCY_WINDOW_HOURS;
  const maxCalls = Number(url.searchParams.get('maxCalls') ?? '60') || 60;
  const sinceIso = new Date(Date.now() - sinceHours * 3600 * 1000).toISOString();

  const results: ProcessResult[] = [];
  let examined = 0;
  let gets = 0;
  try {
    for await (const page of vapi.listCallsPaged({ createdAtGt: sinceIso, limit: 100 })) {
      for (const c of page) {
        examined++;
        if (c.squadId !== BR_SQUAD_ID) continue;
        if (!c.endedAt) continue; // only finished calls
        if (gets >= maxCalls) break;
        gets++;
        const full = (await vapi.request<VapiCall>('GET', `/call/${c.id}`)) as unknown as VapiCallLike;
        results.push(await processCallObject(full, { dryRun, toOverride }));
      }
      if (gets >= maxCalls) break;
    }
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : String(err), partial: results },
      500
    );
  }

  const sent = results.filter((r) => r.status === 'sent').length;
  const wouldSend = results.filter((r) => r.status === 'would-send').length;
  const truncated = gets >= maxCalls;
  const warnings: string[] = [];
  if (truncated) {
    warnings.push(
      `Hit maxCalls=${maxCalls}: only the ${maxCalls} NEWEST BR calls in the window were processed; older ones were skipped. Narrow sinceHours or raise maxCalls.`
    );
  }
  if (!dryRun && sinceHours > IDEMPOTENCY_WINDOW_HOURS) {
    warnings.push(
      `sinceHours=${sinceHours} exceeds the ${IDEMPOTENCY_WINDOW_HOURS}h idempotency window; calls already emailed by the webhook over ${IDEMPOTENCY_WINDOW_HOURS}h ago may be re-sent (duplicate).`
    );
  }
  return json(
    { ok: true, dryRun, sinceHours, examined, brCallsChecked: gets, truncated, sent, wouldSend, warnings, results },
    200
  );
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
