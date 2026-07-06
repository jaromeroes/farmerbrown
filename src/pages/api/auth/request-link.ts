/**
 * POST /api/auth/request-link
 *
 * Server-side magic-link request. Replaces the browser-side
 * `signInWithOtp` so the customer never sees @supabase/ssr in HTML.
 *
 * Always returns 200 { ok: true } regardless of whether the email
 * exists (no enumeration). Errors are logged server-side.
 */

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@lib/supabase';
import { sendMagicLink } from '@lib/email';
import { rateLimit } from '@lib/rateLimit';

export const prerender = false;

const Body = z.object({
  email: z.string().email().max(254),
});

function clientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

export const POST: APIRoute = async ({ request }) => {
  const ip = clientIp(request);
  const rl = rateLimit({ key: ip, max: 5, windowMs: 60_000 });
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: 'too_many_requests' }), {
      status: 429,
      headers: {
        'content-type': 'application/json',
        'retry-after': String(Math.ceil(rl.retryAfterMs / 1000)),
      },
    });
  }

  let body: unknown;
  try { body = await request.json(); } catch { body = null; }
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    // Treat invalid input as silent success — same shape as success path,
    // so a probing client can't tell whether their email syntax was wrong
    // or the address simply doesn't exist.
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }
  const { email } = parsed.data;

  const supabase = createSupabaseAdminClient();
  const siteUrl = import.meta.env.PUBLIC_SITE_URL;

  try {
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: `${siteUrl}/portal` },
    });
    if (error) {
      // Most common case: email isn't in customer_users. Stay silent.
      console.warn('[request-link] generateLink error', error.message);
    } else if (data?.properties?.action_link) {
      const action = new URL(data.properties.action_link);
      const token = action.searchParams.get('token');
      if (token) {
        const verifyUrl = `${siteUrl}/auth/verify?token=${encodeURIComponent(token)}&type=magiclink`;
        await sendMagicLink({ to: email, verifyUrl });
      } else {
        console.error('[request-link] action_link missing token query param');
      }
    }
  } catch (e) {
    console.error('[request-link] unexpected error', e);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};
