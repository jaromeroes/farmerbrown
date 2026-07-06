/**
 * GET /auth/verify
 *
 * Server-side handler of the magic-link click. Replaces the browser-
 * side hash parsing in /login.astro.
 *
 * Flow:
 *   1. fetch(supabase /auth/v1/verify) with redirect:'manual'
 *   2. Supabase responds 302 with Location: <redirect_to>#access_token=...&refresh_token=...
 *      (implicit flow — no Set-Cookie headers, the tokens live in the URL fragment)
 *   3. Parse the fragment, call supabase.auth.setSession() via the SSR
 *      client, which writes the standard sb-...-auth-token cookie that
 *      getCustomerSession already reads.
 *   4. Redirect to /portal with the cookie established.
 */

import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '@lib/supabase';

export const prerender = false;

const ERROR_REDIRECT = '/login?error=invalid-link';

export const GET: APIRoute = async ({ request, cookies, url, redirect }) => {
  const token = url.searchParams.get('token');
  if (!token) return redirect(ERROR_REDIRECT, 307);

  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  const anonKey    = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
  const siteUrl    = import.meta.env.PUBLIC_SITE_URL;

  const verifyUrl = new URL(`${supabaseUrl}/auth/v1/verify`);
  verifyUrl.searchParams.set('token', token);
  verifyUrl.searchParams.set('type', 'magiclink');
  verifyUrl.searchParams.set('redirect_to', `${siteUrl}/portal`);

  let res: Response;
  try {
    res = await fetch(verifyUrl.toString(), {
      headers: { apikey: anonKey },
      redirect: 'manual',
    });
  } catch (e) {
    console.error('[auth/verify] fetch to Supabase failed', e);
    return redirect(ERROR_REDIRECT, 307);
  }

  // Supabase verify returns 303 (See Other) on success; older versions used
  // 302. Accept any 3xx — anything else is a real error.
  if (res.status < 300 || res.status >= 400) {
    console.warn('[auth/verify] unexpected status from Supabase verify', res.status);
    return redirect(ERROR_REDIRECT, 307);
  }
  const location = res.headers.get('location');
  if (!location) {
    console.warn('[auth/verify] no Location header on Supabase 302');
    return redirect(ERROR_REDIRECT, 307);
  }

  const hashIndex = location.indexOf('#');
  if (hashIndex < 0) {
    console.warn('[auth/verify] Supabase redirect had no fragment, location:', location);
    return redirect(ERROR_REDIRECT, 307);
  }
  const fragment = new URLSearchParams(location.slice(hashIndex + 1));
  const accessToken  = fragment.get('access_token');
  const refreshToken = fragment.get('refresh_token');
  if (!accessToken || !refreshToken) {
    console.warn('[auth/verify] fragment missing access_token or refresh_token');
    return redirect(ERROR_REDIRECT, 307);
  }

  const supabase = createSupabaseServerClient({ request, cookies });
  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error) {
    console.error('[auth/verify] setSession failed', error.message);
    return redirect(ERROR_REDIRECT, 307);
  }

  return redirect('/portal', 307);
};
