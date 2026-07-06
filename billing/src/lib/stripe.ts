/**
 * Stripe SDK wrapper. Server-only.
 *
 * One module that owns the SDK instance + the helper that turns a topup into a
 * Checkout Session. The webhook handler imports the same instance for
 * signature verification.
 */

import Stripe from 'stripe';

const STRIPE_SECRET_KEY = import.meta.env.STRIPE_SECRET_KEY;

if (!STRIPE_SECRET_KEY) {
  throw new Error('Missing env: STRIPE_SECRET_KEY');
}

// Pin API version so unrelated Stripe upgrades don't change behaviour silently.
export const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2025-02-24.acacia',
  typescript: true,
});

export interface CreateTopupCheckoutInput {
  customerId: string;
  topupId: string;
  amountCents: number;
  currency: string;             // 'usd'
  // Email of the user who is paying (logged-in session), NOT the customer's
  // contact email. Stripe pre-fills the form with this and sends the receipt
  // here. Passing the customer's email would leak top-up activity to John.
  payerEmail: string;
  successUrl: string;
  cancelUrl: string;
}

/**
 * Create a one-shot Checkout Session for a top-up. Metadata includes our
 * internal customer_id and topup_id so the webhook can resolve the database
 * row regardless of whether Stripe stripped the ID along the way.
 */
export async function createTopupCheckoutSession(
  input: CreateTopupCheckoutInput
): Promise<Stripe.Checkout.Session> {
  return stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: input.payerEmail,
    line_items: [
      {
        price_data: {
          currency: input.currency,
          unit_amount: input.amountCents,
          product_data: {
            name: 'Voice agent credit',
            description: `Top-up of ${formatMoney(input.amountCents, input.currency)}`,
          },
        },
        quantity: 1,
      },
    ],
    success_url: `${input.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: input.cancelUrl,
    metadata: {
      customer_id: input.customerId,
      topup_id: input.topupId,
    },
    payment_intent_data: {
      metadata: {
        customer_id: input.customerId,
        topup_id: input.topupId,
      },
    },
  });
}

function formatMoney(cents: number, currency: string): string {
  const amount = (cents / 100).toFixed(2);
  return `${amount} ${currency.toUpperCase()}`;
}
