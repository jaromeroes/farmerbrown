/**
 * POST /api/stripe-webhook — Stripe-driven balance credits.
 *
 * Stripe-verified events of interest:
 *   • checkout.session.completed → primary credit path
 *   • checkout.session.expired   → mark topup as expired, no ledger entry
 *   • charge.refunded            → negative ledger entry of kind='refund'
 *
 * Idempotency: stripe_events.id PRIMARY KEY guards against replays. The
 * ledger_entries.external_ref UNIQUE constraint ('stripe:<event.id>') is the
 * defense-in-depth backup.
 */

import type { APIRoute } from 'astro';
import type Stripe from 'stripe';
import { stripe } from '@lib/stripe';
import { createSupabaseAdminClient } from '@lib/supabase';
import { creditTopup, getBalanceCents } from '@lib/ledger';
import { sendTopupReceipt } from '@lib/email';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const sig = request.headers.get('stripe-signature') ?? '';
  const webhookSecret = import.meta.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return text('STRIPE_WEBHOOK_SECRET not configured', 500);
  }

  // Stripe signature verification REQUIRES the raw request body — JSON.parse
  // would mutate whitespace and break verification. Read text() before
  // anything else touches the body.
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return text(`signature verification failed: ${msg}`, 400);
  }

  const admin = createSupabaseAdminClient();

  // Insert event record; if id collides, this is a replay → ack and exit.
  const { data: inserted, error: insertErr } = await admin
    .from('stripe_events')
    .insert({ id: event.id, type: event.type, payload: event as unknown as object })
    .select('id')
    .maybeSingle();
  if (insertErr) {
    // Unique violation → already processed → 200 to stop retries.
    if ((insertErr as { code?: string }).code === '23505') {
      return text('replay (already processed)', 200);
    }
    return text(`stripe_events insert failed: ${insertErr.message}`, 500);
  }
  if (!inserted) {
    return text('replay (already processed)', 200);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(admin, event);
        break;
      case 'checkout.session.expired':
        await handleCheckoutExpired(admin, event);
        break;
      case 'charge.refunded':
        await handleChargeRefunded(admin, event);
        break;
      // Other events are ignored — we don't subscribe to anything else.
      default:
        break;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // We've already recorded the event row. Returning 500 makes Stripe retry,
    // and on retry the duplicate insert above short-circuits — we'd never
    // re-run the handler. So we MUST delete the event row when the handler
    // fails so Stripe's retry actually re-executes us.
    await admin.from('stripe_events').delete().eq('id', event.id);
    return text(`handler failed: ${msg}`, 500);
  }

  return text('ok', 200);
};

async function handleCheckoutCompleted(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  event: Stripe.Event
) {
  const session = event.data.object as Stripe.Checkout.Session;
  const meta = session.metadata ?? {};
  const customerId = meta.customer_id;
  const topupId = meta.topup_id;

  if (!customerId || !topupId) {
    throw new Error(`checkout.session.completed missing metadata: ${JSON.stringify(meta)}`);
  }

  const amount = session.amount_total ?? 0;
  if (amount <= 0) {
    throw new Error(`checkout.session.completed amount_total is non-positive: ${amount}`);
  }
  const currency = (session.currency ?? 'usd').toLowerCase();
  const paymentIntent = typeof session.payment_intent === 'string' ? session.payment_intent : null;

  const { credited } = await creditTopup(admin, {
    topupId,
    stripeEventId: event.id,
    stripePaymentIntentId: paymentIntent,
    amountCents: amount,
    currency,
  });

  if (!credited) {
    // Already credited (race or double-delivery) — done.
    return;
  }

  // Receipt email.
  const { data: customer } = await admin
    .from('customers')
    .select('display_name, alert_emails, currency')
    .eq('id', customerId)
    .single();

  const balance = await getBalanceCents(admin, customerId);

  await sendTopupReceipt({
    to: customer?.alert_emails ?? [],
    customerName: customer?.display_name ?? 'Customer',
    amountCents: amount,
    newBalanceCents: balance,
    currency: (customer?.currency ?? currency).toLowerCase(),
    receiptUrl: null,
  });
}

async function handleCheckoutExpired(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  event: Stripe.Event
) {
  const session = event.data.object as Stripe.Checkout.Session;
  await admin
    .from('topups')
    .update({ status: 'expired' })
    .eq('stripe_checkout_session_id', session.id)
    .eq('status', 'pending');
}

async function handleChargeRefunded(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  event: Stripe.Event
) {
  const charge = event.data.object as Stripe.Charge;
  const paymentIntent = typeof charge.payment_intent === 'string' ? charge.payment_intent : null;
  if (!paymentIntent) return; // can't link without it

  const { data: topup } = await admin
    .from('topups')
    .select('id, customer_id, currency')
    .eq('stripe_payment_intent_id', paymentIntent)
    .maybeSingle();
  if (!topup) return; // not one of ours

  const refundedAmount = charge.amount_refunded;
  if (!refundedAmount || refundedAmount <= 0) return;

  // Negative ledger entry. Use external_ref keyed on event id for idempotency.
  await admin.from('ledger_entries').insert({
    customer_id: topup.customer_id,
    kind: 'refund',
    amount_cents: -refundedAmount,
    currency: topup.currency,
    topup_id: topup.id,
    external_ref: `stripe:${event.id}`,
    memo: `Refund for charge ${charge.id}`,
  });

  // If fully refunded, mark the topup.
  if (charge.refunded) {
    await admin.from('topups').update({ status: 'refunded' }).eq('id', topup.id);
  }
}

function text(body: string, status = 200): Response {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain' } });
}
