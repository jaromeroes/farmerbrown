/**
 * Supabase clients.
 *
 * Three flavors:
 *   • Browser client (anon key) — for Astro client-side code if we ever need
 *     it. Today the portal is server-rendered so this is rarely used.
 *   • SSR server client (anon key + cookies) — for Astro endpoints that read
 *     the logged-in user's session. Subject to RLS, which is the point.
 *   • Admin client (service-role key) — bypasses RLS. ONLY for cron, webhook,
 *     and checkout endpoints that must mutate balance state. Never imported
 *     from a route that hands data to the browser.
 *
 * The strict separation between SSR and admin clients is the security boundary
 * for the whole app: clients can never write to ledger_entries or topups.
 */

// Polyfill WebSocket for @supabase/realtime-js. Node 20 doesn't expose a
// global WebSocket; the realtime client throws at construction time when
// it can't find one. Node 22 fixes this natively, but @astrojs/vercel v7
// caps us at Node 20 on Vercel. Must run before any @supabase/* import.
import WebSocket from 'ws';
if (typeof globalThis.WebSocket === 'undefined') {
  (globalThis as unknown as { WebSocket: typeof WebSocket }).WebSocket = WebSocket;
}

import { createClient as createBaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { createServerClient, parseCookieHeader } from '@supabase/ssr';
import type { CookieOptions } from '@supabase/ssr';
import type { AstroCookies } from 'astro';

const PUBLIC_SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL;
const PUBLIC_SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

if (!PUBLIC_SUPABASE_URL) {
  throw new Error('Missing env: PUBLIC_SUPABASE_URL');
}
if (!PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('Missing env: PUBLIC_SUPABASE_ANON_KEY');
}

/**
 * Server client scoped to an Astro request — reads/writes the auth cookie.
 * Use in pages and API routes that should respect RLS.
 */
export function createSupabaseServerClient(args: {
  request: Request;
  cookies: AstroCookies;
}): SupabaseClient {
  const cookieHeader = args.request.headers.get('cookie') ?? '';

  return createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return parseCookieHeader(cookieHeader).map(({ name, value }) => ({
          name,
          value: value ?? '',
        }));
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
        for (const { name, value, options } of cookiesToSet) {
          args.cookies.set(name, value, options);
        }
      },
    },
  });
}

/**
 * Admin client — service-role key, bypasses RLS, no auth cookies.
 * ONLY for: /api/cron/sync-vapi, /api/stripe-webhook, /api/checkout (server logic).
 *
 * Throws if SUPABASE_SERVICE_ROLE_KEY is not set, so we never accidentally
 * fall back to the anon client in the cron / webhook hot path.
 */
export function createSupabaseAdminClient(): SupabaseClient {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing env: SUPABASE_SERVICE_ROLE_KEY (required for server-only mutations)');
  }
  return createBaseClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
