/**
 * GET /api/topup-status?session_id=cs_test_...
 *
 * The /portal/success page polls this endpoint after the Stripe redirect to
 * detect the moment the webhook posts the credit. Returns the topup status,
 * the current balance, and the amount credited (if any).
 *
 * RLS-scoped read so a user can only check their own topups. The session_id
 * is the Stripe Checkout Session id (also stored on the topups row).
 */

import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '@lib/supabase';
import { requireCustomerOr401 } from '@lib/auth';
import { getBalanceCents } from '@lib/ledger';

export const prerender = false;

export const GET: APIRoute = async ({ request, cookies, url }) => {
  const sessionId = url.searchParams.get('session_id');
  if (!sessionId) return json({ error: 'missing session_id' }, 400);

  const supabase = createSupabaseServerClient({ request, cookies });

  let session;
  try {
    session = await requireCustomerOr401(supabase);
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

  const { data: topup, error } = await supabase
    .from('topups')
    .select('id, status, amount_cents, currency')
    .eq('stripe_checkout_session_id', sessionId)
    .eq('customer_id', session.customerId)
    .maybeSingle();

  if (error) return json({ error: error.message }, 500);
  if (!topup) return json({ error: 'topup not found' }, 404);

  const balanceCents = await getBalanceCents(supabase, session.customerId);

  return json({
    status: topup.status,
    amount_cents: topup.amount_cents,
    currency: topup.currency,
    balance_cents: balanceCents,
  });
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
