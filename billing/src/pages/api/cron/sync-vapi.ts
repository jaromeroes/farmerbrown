/**
 * Hourly metering cron — pulls completed VAPI calls and posts charges.
 *
 * Vercel cron hits GET /api/cron/sync-vapi with `Authorization: Bearer <CRON_SECRET>`.
 *
 * Per customer:
 *   1. Read sync_state.last_vapi_call_created_at as the watermark.
 *   2. Page through /call sorted ASC by createdAt > watermark.
 *   3. Filter to billable calls in this customer's allowlist.
 *   4. Call meter_call() RPC for each — atomic insert call + debit.
 *      Idempotent on vapi_call_id, so re-runs are free retries.
 *   5. Advance the watermark only on a clean run.
 *   6. Read balance; if it just crossed below threshold AND no alert in the
 *      last 24h, send a low-balance email.
 *
 * Watermark advances only on success → a failed run is automatically retried
 * by the next scheduled invocation, with no duplicates.
 */

import type { APIRoute } from 'astro';
import { createSupabaseAdminClient } from '@lib/supabase';
import {
  createVapiClient,
  callBelongsToCustomer,
  isCallBillable,
} from '@lib/vapi';
import { meterCall, getBalanceCents } from '@lib/ledger';
import { sendLowBalanceAlert } from '@lib/email';

export const prerender = false;

interface CustomerRow {
  id: string;
  email: string;
  display_name: string;
  currency: string;
  margin_bps: number;
  low_balance_threshold_cents: number;
  alert_emails: string[];
  vapi_assistant_ids: string[];
  vapi_squad_ids: string[];
  vapi_phone_number_ids: string[];
}

interface SyncStateRow {
  customer_id: string;
  last_vapi_call_created_at: string | null;
}

interface PerCustomerResult {
  customer_id: string;
  customer_name: string;
  pages_fetched: number;
  calls_seen: number;
  calls_metered: number;
  calls_skipped_idempotent: number;
  watermark_before: string | null;
  watermark_after: string | null;
  balance_cents_after: number | null;
  low_balance_alert_sent: boolean;
  error?: string;
}

export const GET: APIRoute = async ({ request }) => {
  // ─── Auth ────────────────────────────────────────────────────────────────
  const auth = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${import.meta.env.CRON_SECRET ?? ''}`;
  if (!import.meta.env.CRON_SECRET) {
    return json({ error: 'CRON_SECRET not configured' }, 500);
  }
  if (auth !== expected) {
    return json({ error: 'unauthorized' }, 401);
  }

  const vapiKey = import.meta.env.VAPI_KEY;
  if (!vapiKey) {
    return json({ error: 'VAPI_KEY not configured' }, 500);
  }

  const admin = createSupabaseAdminClient();
  const vapi = createVapiClient(vapiKey);

  // ─── Per-customer loop ───────────────────────────────────────────────────
  const { data: customers, error: customersErr } = await admin
    .from('customers')
    .select(
      'id, email, display_name, currency, margin_bps, low_balance_threshold_cents, alert_emails, vapi_assistant_ids, vapi_squad_ids, vapi_phone_number_ids'
    );

  if (customersErr) {
    return json({ error: `failed to load customers: ${customersErr.message}` }, 500);
  }

  const results: PerCustomerResult[] = [];

  for (const customer of (customers ?? []) as CustomerRow[]) {
    const result = await syncOneCustomer(admin, vapi, customer).catch((err): PerCustomerResult => ({
      customer_id: customer.id,
      customer_name: customer.display_name,
      pages_fetched: 0,
      calls_seen: 0,
      calls_metered: 0,
      calls_skipped_idempotent: 0,
      watermark_before: null,
      watermark_after: null,
      balance_cents_after: null,
      low_balance_alert_sent: false,
      error: err instanceof Error ? err.message : String(err),
    }));
    results.push(result);
  }

  const ok = results.every((r) => !r.error);
  return json({ ok, results }, ok ? 200 : 207);
};

// Allow manual POST runs from a script using the same auth.
export const POST = GET;

// ─── Implementation ────────────────────────────────────────────────────────

async function syncOneCustomer(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  vapi: ReturnType<typeof createVapiClient>,
  customer: CustomerRow
): Promise<PerCustomerResult> {
  const allowlist = {
    assistantIds: customer.vapi_assistant_ids ?? [],
    squadIds: customer.vapi_squad_ids ?? [],
    phoneNumberIds: customer.vapi_phone_number_ids ?? [],
  };

  // Read watermark — bootstrap with a far-past date if absent (which the seed
  // sets to go-live; this fallback is just defensive).
  const { data: stateRow } = await admin
    .from('sync_state')
    .select('customer_id, last_vapi_call_created_at')
    .eq('customer_id', customer.id)
    .maybeSingle();

  const watermarkBefore =
    (stateRow as SyncStateRow | null)?.last_vapi_call_created_at ??
    '2026-05-08T00:00:00Z';

  let pagesFetched = 0;
  let callsSeen = 0;
  let callsMetered = 0;
  let callsSkippedIdempotent = 0;
  let maxCreatedAt: string = watermarkBefore;

  for await (const page of vapi.listCallsPaged({ createdAtGt: watermarkBefore, limit: 100 })) {
    pagesFetched++;
    callsSeen += page.length;

    for (const call of page) {
      // Track max createdAt for watermark advancement (only persisted on success).
      if (call.createdAt && call.createdAt > maxCreatedAt) {
        maxCreatedAt = call.createdAt;
      }

      if (!isCallBillable(call)) continue;
      if (!callBelongsToCustomer(call, allowlist)) continue;

      const res = await meterCall(admin, {
        customerId: customer.id,
        call,
        marginBps: customer.margin_bps,
        currency: customer.currency,
      });

      if (res.posted) callsMetered++;
      else callsSkippedIdempotent++;
    }
  }

  // Advance watermark + persist run status. Read previous total, write new
  // total in the same upsert. The cron runs once per hour per customer, so
  // we don't need atomic increment semantics — last write wins.
  const nowIso = new Date().toISOString();
  const newWatermark = maxCreatedAt;
  const previousTotal = await getCallsProcessedTotal(admin, customer.id);

  const { error: stateErr } = await admin
    .from('sync_state')
    .upsert(
      {
        customer_id: customer.id,
        last_vapi_call_created_at: newWatermark,
        last_run_at: nowIso,
        last_run_status: 'ok',
        last_run_error: null,
        calls_processed_total: previousTotal + callsMetered,
      },
      { onConflict: 'customer_id' }
    );
  if (stateErr) throw new Error(`sync_state upsert failed: ${stateErr.message}`);

  // Low-balance alert. If balance is below threshold, try to send — the
  // helper handles the 24h cooldown internally so this branch fires both on
  // the initial crossing and on subsequent cron runs once the cooldown ends.
  const balanceAfter = await getBalanceCents(admin, customer.id);
  let alertSent = false;
  if (balanceAfter < customer.low_balance_threshold_cents) {
    alertSent = await maybeSendLowBalanceAlert(admin, customer, balanceAfter);
  }

  return {
    customer_id: customer.id,
    customer_name: customer.display_name,
    pages_fetched: pagesFetched,
    calls_seen: callsSeen,
    calls_metered: callsMetered,
    calls_skipped_idempotent: callsSkippedIdempotent,
    watermark_before: watermarkBefore,
    watermark_after: newWatermark,
    balance_cents_after: balanceAfter,
    low_balance_alert_sent: alertSent,
  };
}

async function getCallsProcessedTotal(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  customerId: string
): Promise<number> {
  const { data } = await admin
    .from('sync_state')
    .select('calls_processed_total')
    .eq('customer_id', customerId)
    .maybeSingle();
  return Number((data as { calls_processed_total?: number } | null)?.calls_processed_total ?? 0);
}

const LOW_BALANCE_COOLDOWN_HOURS = 24;

async function maybeSendLowBalanceAlert(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  customer: CustomerRow,
  balanceCents: number
): Promise<boolean> {
  // Did we already alert in the last 24h?
  const cooldownStart = new Date(Date.now() - LOW_BALANCE_COOLDOWN_HOURS * 3600 * 1000).toISOString();
  const { data: recent } = await admin
    .from('low_balance_alerts')
    .select('id')
    .eq('customer_id', customer.id)
    .gte('sent_at', cooldownStart)
    .limit(1);

  if (recent && recent.length > 0) return false;

  // Send.
  const topupUrl = `${import.meta.env.PUBLIC_SITE_URL ?? ''}/portal/topup`;
  await sendLowBalanceAlert({
    to: customer.alert_emails,
    customerName: customer.display_name,
    balanceCents,
    thresholdCents: customer.low_balance_threshold_cents,
    currency: customer.currency,
    topupUrl,
  });

  // Record the send (so the cooldown takes effect).
  await admin.from('low_balance_alerts').insert({
    customer_id: customer.id,
    balance_cents_at_send: balanceCents,
  });

  return true;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
