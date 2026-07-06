/**
 * /auth/callback
 *
 * POST with ?logout=1: log out (used by the "Sign out" button in the
 *      portal layout). The GET handler that did PKCE code exchange is
 *      unreachable in the new server-side magic-link flow and was removed.
 */

import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '@lib/supabase';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, url, redirect }) => {
  const isLogout = url.searchParams.get('logout') === '1';
  if (!isLogout) {
    return new Response('not found', { status: 404 });
  }

  const supabase = createSupabaseServerClient({ request, cookies });
  await supabase.auth.signOut();
  return redirect('/login', 307);
};
