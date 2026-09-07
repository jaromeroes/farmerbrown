/**
 * POST /api/voice-lab/picks — the customer sends their voice shortlist.
 *
 * Body: { labels: string[], comment?: string }
 *
 * Labels are the neutral `FB-NN` identifiers from the Voice Lab catalogue.
 * They are validated against the generated catalogue, so nothing reaches the
 * email that didn't come off the gallery. The label → vendor mapping is NOT
 * in this app — it lives in voice-agents/docs/voice-lab-registry.json, which
 * is where we resolve the picks when we wire them onto the agents.
 *
 * Nothing is persisted: this is a notification, not a record. If we ever need
 * pick history, it belongs in a table, not in a mailbox.
 */

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { createSupabaseServerClient } from '@lib/supabase';
import { requireCustomerOr401 } from '@lib/auth';
import { rateLimit } from '@lib/rateLimit';
import { sendVoicePicks } from '@lib/email';
import { VOICE_SAMPLES } from '@lib/voiceCatalog';

export const prerender = false;

const MAX_COMMENT = 2000;

const bodySchema = z.object({
  labels: z.array(z.string().max(16)).min(1).max(VOICE_SAMPLES.length),
  comment: z.string().max(MAX_COMMENT).optional().default(''),
});

const CATALOG = new Map(VOICE_SAMPLES.map((v) => [v.label, v]));

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'invalid JSON' }, 400);
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return json({ error: 'invalid picks', details: parsed.error.issues }, 400);
  }

  const supabase = createSupabaseServerClient({ request, cookies });
  let session;
  try {
    session = await requireCustomerOr401(supabase);
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

  // Sending is cheap but it fans out to a mailbox — one submission a minute is
  // plenty for a human clicking a button.
  const limit = rateLimit({
    key: `voice-picks:${session.userId}:${clientAddress ?? 'unknown'}`,
    max: 4,
    windowMs: 60_000,
  });
  if (!limit.allowed) {
    return json({ error: 'too many submissions, try again in a moment' }, 429, {
      'Retry-After': String(Math.ceil(limit.retryAfterMs / 1000)),
    });
  }

  // Only labels that exist in the catalogue survive. An unknown label means a
  // stale tab after a rebuild, or someone poking the endpoint — either way we
  // don't want it in the email.
  const picks = [...new Set(parsed.data.labels)]
    .filter((label) => CATALOG.has(label))
    .sort()
    .map((label) => {
      const v = CATALOG.get(label)!;
      return { label, note: [v.gender ?? 'unlabelled', v.accent, v.tone].filter(Boolean).join(' · ') };
    });

  if (picks.length === 0) {
    return json({ error: 'no recognised voices in the selection' }, 400);
  }

  const to = (import.meta.env.OPERATIONS_EMAIL ?? '')
    .split(',')
    .map((s: string) => s.trim())
    .filter(Boolean);

  if (to.length === 0) {
    console.error('[voice-lab] OPERATIONS_EMAIL is not set — picks not delivered');
    return json({ error: 'notifications are not configured' }, 500);
  }

  try {
    await sendVoicePicks({
      to,
      customerName: session.customerDisplayName,
      senderEmail: session.email,
      picks,
      comment: parsed.data.comment.trim(),
    });
  } catch (err) {
    console.error('[voice-lab] send failed:', err);
    return json({ error: 'could not send the selection' }, 502);
  }

  return json({ ok: true, sent: picks.length });
};

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}
