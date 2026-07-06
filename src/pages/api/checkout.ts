/**
 * POST /api/checkout — start a top-up.
 *
 * Body: { amount_cents: number }  // 100..500_00 cents (i.e. $1..$5000)
 *
 * Flow:
 *   1. Auth via Supabase session (RLS-scoped read of customers row).
 *   2. Validate amount is in the accepted range.
 *   3. Insert topups row with status='pending'.
 *   4. Create Stripe Checkout Session with metadata { customer_id, topup_id }.
 *      Session pre-fills with the LOGGED-IN user's email (the payer), not the
 *      customer's email — Stripe sends receipts to that address.
 *   5. Patch topups row with the session id.
 *   6. Return { url } so the browser can redirect.
 */

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@lib/supabase';
import { requireCustomerOr401 } from '@lib/auth';
import { createTopupCheckoutSession } from '@lib/stripe';

export const prerender = false;

const MIN_TOPUP_CENTS = 100;        // $1 — protect against accidental tiny topups
const MAX_TOPUP_CENTS = 500_000;    // $5000 — cap for sanity, raise if a customer asks

const bodySchema = z.object({
  amount_cents: z.number().int().min(MIN_TOPUP_CENTS).max(MAX_TOPUP_CENTS),
});

export const POST: APIRoute = async ({ request, cookies }) => {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'invalid JSON' }, 400);
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return json({ error: 'invalid amount', details: parsed.error.issues }, 400);
  }
  const amountCents = parsed.data.amount_cents;

  const supabase = createSupabaseServerClient({ request, cookies });
  let session;
  try {
    session = await requireCustomerOr401(supabase);
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

  const admin = createSupabaseAdminClient();

  // Read minimal customer row (currency for the line item).
  const { data: customer, error: customerErr } = await admin
    .from('customers')
    .select('id, currency')
    .eq('id', session.customerId)
    .single();
  if (customerErr || !customer) {
    return json({ error: 'customer not found' }, 500);
  }

  // Create the pending topup row first, so the metadata we hand to Stripe
  // points at a real DB row.
  const { data: topup, error: topupErr } = await admin
    .from('topups')
    .insert({
      customer_id: customer.id,
      amount_cents: amountCents,
      currency: customer.currency.toLowerCase(),
      status: 'pending',
    })
    .select('id')
    .single();
  if (topupErr || !topup) {
    return json({ error: `failed to create topup: ${topupErr?.message}` }, 500);
  }

  const siteUrl = import.meta.env.PUBLIC_SITE_URL ?? '';
  const checkoutSession = await createTopupCheckoutSession({
    customerId: customer.id,
    topupId: topup.id,
    amountCents,
    currency: customer.currency.toLowerCase(),
    payerEmail: session.email,
    successUrl: `${siteUrl}/portal/success`,
    cancelUrl: `${siteUrl}/portal/topup`,
  });

  // Persist session id so the success page + reconciliation can find the row.
  await admin
    .from('topups')
    .update({ stripe_checkout_session_id: checkoutSession.id })
    .eq('id', topup.id);

  if (!checkoutSession.url) {
    return json({ error: 'Stripe did not return a checkout URL' }, 500);
  }
  return json({ url: checkoutSession.url, topup_id: topup.id }, 200);
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
