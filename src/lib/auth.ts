/**
 * Auth helpers for Astro endpoints and pages.
 *
 * Magic-link login restricted to customers we've seeded in `customer_users`.
 * Anyone else trying to log in gets a polite 403; we don't let strangers
 * create auth accounts even with a valid email syntax.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface CustomerSession {
  userId: string;
  email: string;
  customerId: string;
  customerDisplayName: string;
  currency: string;
}

/**
 * Resolve the session + the customer the user belongs to.
 * Returns null if not authenticated or if the auth user has no customer link
 * (which shouldn't happen for legitimate users, but is the safe default).
 */
export async function getCustomerSession(
  supabase: SupabaseClient
): Promise<CustomerSession | null> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user || !user.email) return null;

  // Use the auth-scoped client so RLS limits us to the right customer row.
  const { data, error } = await supabase
    .from('customers')
    .select('id, display_name, currency')
    .limit(1)
    .single();

  if (error || !data) return null;

  return {
    userId: user.id,
    email: user.email,
    customerId: data.id,
    customerDisplayName: data.display_name,
    currency: data.currency,
  };
}

/**
 * For API endpoints: return the session or throw a Response that the route
 * can return directly.
 */
export async function requireCustomerOr401(
  supabase: SupabaseClient
): Promise<CustomerSession> {
  const session = await getCustomerSession(supabase);
  if (!session) {
    throw new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return session;
}
