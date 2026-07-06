/**
 * Thin VAPI HTTP client. Ported from the farmerbrown agent repo
 * (`scripts/create-br-direct-dial-proxy.js:42-56`) with TypeScript types and
 * pagination helpers added.
 *
 * Server-only — relies on `VAPI_KEY` from process.env. Never imported from a
 * page that ships JS to the browser.
 */

const VAPI_BASE = 'https://api.vapi.ai';

export interface VapiCall {
  id: string;
  cost?: number;                    // USD float (e.g. 0.4123)
  costBreakdown?: Record<string, unknown>;
  costs?: unknown[];
  startedAt?: string;
  endedAt?: string;
  createdAt?: string;
  duration?: number;                // seconds (when present)
  endedReason?: string;
  assistantId?: string | null;
  squadId?: string | null;
  phoneNumberId?: string | null;
  customer?: { number?: string };
  // Catch-all so we can persist the full payload without losing fields.
  [key: string]: unknown;
}

export interface VapiClient {
  request: <T = unknown>(method: string, path: string, body?: unknown) => Promise<T>;
  listCallsPaged: (params: ListCallsParams) => AsyncGenerator<VapiCall[], void, unknown>;
}

export interface ListCallsParams {
  /** ISO timestamp; only return calls with createdAt strictly after this */
  createdAtGt?: string;
  /** Page size; VAPI default is 100, max ~1000 */
  limit?: number;
}

export function createVapiClient(apiKey: string): VapiClient {
  if (!apiKey) {
    throw new Error('createVapiClient: VAPI_KEY is required');
  }

  async function request<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${VAPI_BASE}${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { _raw: text };
    }
    if (!res.ok) {
      const snippet = JSON.stringify(data).slice(0, 600);
      throw new Error(`VAPI ${method} ${path} (${res.status}): ${snippet}`);
    }
    return data as T;
  }

  /**
   * Async-iterate every call with createdAt > watermark, page by page.
   *
   * VAPI rejects sortField / sortOrder query params and returns calls in
   * DESCENDING createdAt by default. To paginate without losing rows we walk
   * BACKWARDS through history: each page is bounded above by the oldest
   * createdAt of the previous page (`createdAtLt`) and below by the original
   * watermark (`createdAtGt`). We stop when a page comes back smaller than
   * `limit`, meaning we've reached the bottom of the window.
   *
   * The cron is responsible for computing the new watermark as
   * MAX(createdAt) across all pages, since pages now arrive newest-first.
   */
  async function* listCallsPaged(params: ListCallsParams): AsyncGenerator<VapiCall[], void, unknown> {
    const limit = params.limit ?? 100;
    const lowerBound = params.createdAtGt;
    let upperBound: string | undefined;

    while (true) {
      const qs = new URLSearchParams();
      qs.set('limit', String(limit));
      if (lowerBound) qs.set('createdAtGt', lowerBound);
      if (upperBound) qs.set('createdAtLt', upperBound);

      const page = await request<VapiCall[]>('GET', `/call?${qs.toString()}`);
      if (!Array.isArray(page) || page.length === 0) return;

      yield page;

      // VAPI returns DESC by default, so the LAST element is the oldest.
      // To get the next (older) page, set createdAtLt to that oldest value.
      const oldest = page[page.length - 1];
      const oldestCreatedAt = oldest?.createdAt;
      if (!oldestCreatedAt) return;

      if (page.length < limit) return; // reached the bottom of the window
      upperBound = oldestCreatedAt;
    }
  }

  return { request, listCallsPaged };
}

/**
 * Decide whether a call belongs to a particular customer's allowlist.
 * The cron filters every fetched call through this before metering.
 */
export function callBelongsToCustomer(
  call: VapiCall,
  allowlist: {
    assistantIds: string[];
    squadIds: string[];
    phoneNumberIds: string[];
  }
): boolean {
  if (call.assistantId && allowlist.assistantIds.includes(call.assistantId)) return true;
  if (call.squadId && allowlist.squadIds.includes(call.squadId)) return true;
  if (call.phoneNumberId && allowlist.phoneNumberIds.includes(call.phoneNumberId)) return true;
  return false;
}

/**
 * A call is billable when:
 *   • it has finished (endedAt set)
 *   • cost is a non-negative number
 * Failed calls (endedReason: 'call.start.error-*') usually have cost: 0; we
 * still record them with charge=0 to maintain a complete history.
 */
export function isCallBillable(call: VapiCall): boolean {
  if (!call.endedAt) return false;
  if (typeof call.cost !== 'number' || !Number.isFinite(call.cost) || call.cost < 0) return false;
  return true;
}
