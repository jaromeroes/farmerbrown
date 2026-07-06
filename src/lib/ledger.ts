/**
 * Ledger helpers — the only place that posts to ledger_entries.
 *
 * Both the cron and the Stripe webhook write money via this module. Anything
 * that touches balance must go through here so the idempotency and
 * accounting invariants are guaranteed in a single place.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { VapiCall } from './vapi';
import { applyMargin, vapiCostToCents } from './pricing';

export interface MeterCallInput {
  customerId: string;
  call: VapiCall;
  marginBps: number;
  currency: string;
}

export interface MeterCallResult {
  posted: boolean;             // false if the call was already metered (idempotency hit)
  vapiCallId: string;
  vapiCostCents: number;
  chargeCents: number;
}

/**
 * Atomically insert a call + a debit ledger_entry via the meter_call() RPC.
 * Idempotent on call.id — re-running with the same call yields posted=false
 * and writes nothing.
 */
export async function meterCall(
  admin: SupabaseClient,
  input: MeterCallInput
): Promise<MeterCallResult> {
  const { call, customerId, marginBps, currency } = input;

  if (!call.id) {
    throw new Error('meterCall: VAPI call has no id');
  }

  const vapiCostCents = vapiCostToCents(call.cost ?? 0);
  const chargeCents = applyMargin(vapiCostCents, marginBps);

  const durationSeconds = computeDuration(call);

  const { data, error } = await admin.rpc('meter_call', {
    p_customer_id: customerId,
    p_vapi_call_id: call.id,
    p_charge_cents: chargeCents,
    p_vapi_cost_cents: vapiCostCents,
    p_margin_bps: marginBps,
    p_assistant_id: call.assistantId ?? null,
    p_squad_id: call.squadId ?? null,
    p_phone_number_id: call.phoneNumberId ?? null,
    p_customer_phone: call.customer?.number ?? null,
    p_started_at: call.startedAt ?? null,
    p_ended_at: call.endedAt ?? null,
    p_duration_seconds: durationSeconds,
    p_ended_reason: call.endedReason ?? null,
    p_currency: currency,
    p_vapi_raw: call as unknown as object,
  });

  if (error) {
    throw new Error(`meterCall RPC failed for ${call.id}: ${error.message}`);
  }

  return {
    posted: data === true,
    vapiCallId: call.id,
    vapiCostCents,
    chargeCents,
  };
}

/**
 * Credit a top-up. Atomic: marks topup as paid + posts a positive ledger entry.
 * Idempotent on Stripe event id — replaying the same event is a no-op.
 */
export async function creditTopup(
  admin: SupabaseClient,
  input: {
    topupId: string;
    stripeEventId: string;
    stripePaymentIntentId: string | null;
    amountCents: number;
    currency: string;
  }
): Promise<{ credited: boolean }> {
  const { data, error } = await admin.rpc('credit_topup', {
    p_topup_id: input.topupId,
    p_stripe_event_id: input.stripeEventId,
    p_stripe_payment_intent_id: input.stripePaymentIntentId,
    p_amount_cents: input.amountCents,
    p_currency: input.currency,
  });

  if (error) {
    throw new Error(`creditTopup RPC failed for ${input.topupId}: ${error.message}`);
  }
  return { credited: data === true };
}

/** Read current balance via the customer_balances view. */
export async function getBalanceCents(
  client: SupabaseClient,
  customerId: string
): Promise<number> {
  const { data, error } = await client
    .from('customer_balances')
    .select('balance_cents')
    .eq('customer_id', customerId)
    .single();

  if (error) {
    throw new Error(`getBalanceCents failed: ${error.message}`);
  }
  return Number(data?.balance_cents ?? 0);
}

function computeDuration(call: VapiCall): number | null {
  if (typeof call.duration === 'number' && Number.isFinite(call.duration)) {
    return Math.round(call.duration);
  }
  if (call.startedAt && call.endedAt) {
    const start = Date.parse(call.startedAt);
    const end = Date.parse(call.endedAt);
    if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
      return Math.round((end - start) / 1000);
    }
  }
  return null;
}
