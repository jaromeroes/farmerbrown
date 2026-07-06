# Cleanup tech-stack leakage — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate every Supabase / VAPI / Astro / Vercel reference from customer-facing surfaces (browser HTML/JS + magic-link email), by moving the magic-link flow server-side, sending the email through Resend with our own template, and serving the portal from a custom subdomain `farmerbrown.theb2btinkerers.com`.

**Architecture:** The browser stops importing `@supabase/ssr` and stops talking to `*.supabase.co`. New endpoints `POST /api/auth/request-link` (generates the link via Supabase admin API server-side, sends email via Resend) and `GET /auth/verify` (server-to-server fetches Supabase verify, parses the access/refresh tokens out of the 302 hash fragment, calls `supabase.auth.setSession()` via the SSR client to write the standard cookies). The form on `/login` becomes a small `fetch` to the new POST endpoint; no SDK, no anon key in HTML.

**Tech Stack:** Astro 4 (`output: 'server'`) on Vercel, Supabase Auth (admin + SSR clients, no browser SDK after this), Resend for transactional email, Cloudflare DNS for the subdomain. No test framework — manual smoke tests + `npm run check` for type safety + `npx tsx -e` for any pure helper that needs verification.

**Spec:** [`docs/superpowers/specs/2026-05-11-cleanup-tech-stack-leakage-design.md`](../specs/2026-05-11-cleanup-tech-stack-leakage-design.md) — read it first if anything in this plan is ambiguous.

---

## File Structure

| Path | Purpose | Action |
|---|---|---|
| `src/lib/rateLimit.ts` | Per-IP in-memory rate limiter (Map-based, sliding window) reusable across endpoints | **Create** |
| `src/pages/api/auth/request-link.ts` | POST endpoint: validate email, rate-limit, call `admin.generateLink`, extract token, send via Resend | **Create** |
| `src/pages/auth/verify.ts` | GET endpoint: server-to-server verify, parse Location hash, `setSession()`, redirect to `/portal` | **Create** |
| `src/lib/email.ts` | Add `sendMagicLink({to, verifyUrl})` + branded HTML template | **Modify** |
| `src/pages/login.astro` | Remove `@supabase/ssr` browser import, replace form handler with fetch, render `?error=` server-side, drop hash handler | **Modify** |
| `src/pages/index.astro` | Drop the `?code=` PKCE branch (unreachable) | **Modify** |
| `src/pages/auth/callback.ts` | Drop `GET` handler (PKCE unreachable); keep `POST ?logout=1` for the portal layout's sign-out button | **Modify** |
| `.env.example` | Update `PUBLIC_SITE_URL` and `EMAIL_FROM` to the new subdomain | **Modify** |
| `docs/where-we-left-off.md` | Note Spec #6 shipped, new portal URL, Resend live, leakage closed | **Modify** (last task) |

No schema changes, no new RPCs, no new migrations.

**Configuration changes outside the repo** (Tasks 1–3 below — José executes in dashboards, I provide the exact steps and verify from the terminal).

---

## Task 1: DNS + Vercel custom domain

**Files:** none (Cloudflare DNS + Vercel dashboard)

**Why first:** every other piece needs this URL to exist. Until the subdomain resolves and Vercel serves SSL on it, we can't update Supabase Auth allowlist or test the auth flow against the right host.

- [ ] **Step 1: Add Cloudflare DNS record**

  In Cloudflare → `theb2btinkerers.com` zone → DNS → Add record:
  - Type: `CNAME`
  - Name: `farmerbrown`
  - Target: `cname.vercel-dns.com`
  - Proxy status: **DNS only** (grey cloud, NOT orange — orange breaks Vercel's SSL provisioning)
  - TTL: Auto

- [ ] **Step 2: Wait for resolution + verify**

  ```bash
  dig +short CNAME farmerbrown.theb2btinkerers.com
  ```
  Expected: `cname.vercel-dns.com.` (may take 1–3 minutes; Cloudflare TTL is fast)

- [ ] **Step 3: Add the domain in Vercel**

  Vercel dashboard → `farmerbrown-billing` project → Settings → Domains → Add → `farmerbrown.theb2btinkerers.com` → Add. Vercel detects the CNAME and starts SSL provisioning.

- [ ] **Step 4: Verify SSL**

  ```bash
  curl -I https://farmerbrown.theb2btinkerers.com/
  ```
  Expected (after ~60s): `HTTP/2 200` (or `307` to `/login`), no SSL warning. If it errors with `SSL_ERROR_HANDSHAKE_FAILED`, wait another 60s — provisioning isn't instant.

- [ ] **Step 5: Update `PUBLIC_SITE_URL` in Vercel**

  Settings → Environment Variables → edit `PUBLIC_SITE_URL` → new value `https://farmerbrown.theb2btinkerers.com` → Save. Apply to Production environment.

- [ ] **Step 6: Trigger redeploy**

  Deployments → on the current Production deploy → menu `…` → Redeploy → confirm without "Use existing Build Cache". Wait for green.

- [ ] **Step 7: Smoke-check the live URL**

  ```bash
  curl -sS -o /dev/null -w 'HTTP %{http_code} → %{url_effective}\n' -L 'https://farmerbrown.theb2btinkerers.com/'
  ```
  Expected: `HTTP 200 → https://farmerbrown.theb2btinkerers.com/login`

- [ ] **Step 8: No commit**

  This task is config-only. Move on.

---

## Task 2: Supabase Auth allowlist update

**Files:** none (Supabase dashboard)

**Why now:** without the new URL in the allowlist, `admin.generateLink` will silently rewrite `redirect_to` back to whatever Site URL is set (lesson learned 2026-05-11 in the production smoke session).

- [ ] **Step 1: Update Site URL**

  <https://supabase.com/dashboard/project/vaytlurnlyfzixsxxnlw/auth/url-configuration>
  → **Site URL** → change to `https://farmerbrown.theb2btinkerers.com` → Save.

- [ ] **Step 2: Add Redirect URL pattern**

  Same page → **Redirect URLs** → Add → `https://farmerbrown.theb2btinkerers.com/**` → Save. (The `**` allows any path under the subdomain.)

- [ ] **Step 3: Verify by issuing an admin link**

  ```bash
  set -a; source .env; set +a; python3 - <<'PY'
  import os, json, urllib.request
  URL = os.environ['PUBLIC_SUPABASE_URL']; SR = os.environ['SUPABASE_SERVICE_ROLE_KEY']
  body = json.dumps({'type':'magiclink','email':'j.antonio@farmerbrown.com',
                     'options':{'redirect_to':'https://farmerbrown.theb2btinkerers.com/portal'}}).encode()
  req = urllib.request.Request(f'{URL}/auth/v1/admin/generate_link', data=body, method='POST',
                               headers={'apikey':SR,'Authorization':f'Bearer {SR}','Content-Type':'application/json','User-Agent':'curl/8.0'})
  print(json.loads(urllib.request.urlopen(req).read())['action_link'])
  PY
  ```
  Expected: the printed `action_link` ends in `&redirect_to=https://farmerbrown.theb2btinkerers.com/portal`. If it ends with `localhost` or anything else, the allowlist isn't applied yet — wait 30s and retry.

- [ ] **Step 4: No commit.** Move on.

---

## Task 3: Resend signup + DNS verification + API key

**Files:** none (Resend dashboard + Cloudflare DNS)

**Why now:** the email helper and the `request-link` endpoint depend on a working Resend setup. Verifying the domain takes a few minutes (Cloudflare propagation is fast but not instant).

- [ ] **Step 1: Sign up at <https://resend.com>**

  Use `jaromero.es@gmail.com`. Free tier covers 3,000 emails/month — more than enough.

- [ ] **Step 2: Add the sending domain**

  Resend dashboard → Domains → Add Domain → `farmerbrown.theb2btinkerers.com` → Region: `EU (Ireland)` (closer to José's user, lower latency to Vercel).

- [ ] **Step 3: Copy the DNS records**

  Resend shows 3 records to add: SPF (TXT), DKIM (TXT or CNAME depending on plan), and a return-path (MX). Note them down.

- [ ] **Step 4: Add the records in Cloudflare**

  In the same Cloudflare zone (`theb2btinkerers.com`), add each record exactly as shown by Resend. **Important:** the record names will be relative to the apex (`farmerbrown` or `resend._domainkey.farmerbrown`, not the FQDN). Proxy status: **DNS only** for all three.

- [ ] **Step 5: Verify in Resend**

  Resend → Domains → farmerbrown.theb2btinkerers.com → Verify. Status flips to "Verified" within 1–2 minutes if Cloudflare propagation is done.

- [ ] **Step 6: Generate an API key**

  Resend → API Keys → Create → Name: `farmerbrown-billing-prod` → Permission: `Sending access` → Domain: `farmerbrown.theb2btinkerers.com` → Create. Copy the `re_…` key.

- [ ] **Step 7: Add `RESEND_API_KEY` to Vercel env**

  Vercel → Settings → Environment Variables → Add New → Key `RESEND_API_KEY`, Value `<the re_… you just copied>`, Environments: **Production** only. Save.

- [ ] **Step 8: Smoke-test Resend with a manual send**

  Locally:
  ```bash
  set -a; source .env; set +a
  RESEND_API_KEY=<paste>  EMAIL_FROM='Farmer Brown AI Hub <notifications@farmerbrown.theb2btinkerers.com>' \
  npx tsx -e "
    import { Resend } from 'resend';
    const r = new Resend(process.env.RESEND_API_KEY);
    r.emails.send({
      from: process.env.EMAIL_FROM,
      to: 'j.antonio@farmerbrown.com',
      subject: 'Resend smoke test',
      html: '<p>If you see this, Resend + DNS verification is working.</p>',
    }).then(console.log).catch(console.error);
  "
  ```
  Expected: console prints `{ data: { id: '...' }, error: null }`. Inbox: email arrives, sender shows as "Farmer Brown AI Hub <notifications@farmerbrown.theb2btinkerers.com>", no Resend branding.

- [ ] **Step 9: No commit.** The API key never goes into the repo.

---

## Task 4: Add `rateLimit.ts` helper

**Files:**
- Create: `src/lib/rateLimit.ts`

**Why this size:** simple sliding-window per-IP limiter. Map keyed by IP, value is array of recent timestamps. On each call, prune timestamps older than the window, count what's left, allow or deny.

- [ ] **Step 1: Create the file**

  ```typescript
  /**
   * Per-IP in-memory rate limiter. Sliding window.
   *
   * In-memory means per-Vercel-instance: with N concurrent serverless
   * instances the effective limit is N × `max`. Acceptable for the
   * volumes we serve; swap for Vercel KV if we ever multi-tenant.
   */

  interface Bucket {
    timestamps: number[];
  }

  const buckets = new Map<string, Bucket>();

  export interface RateLimitResult {
    allowed: boolean;
    /** Milliseconds until the next request would be allowed. 0 if `allowed` is true. */
    retryAfterMs: number;
  }

  export function rateLimit(args: {
    key: string;
    max: number;
    windowMs: number;
    now?: number;
  }): RateLimitResult {
    const { key, max, windowMs } = args;
    const now = args.now ?? Date.now();
    const cutoff = now - windowMs;

    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { timestamps: [] };
      buckets.set(key, bucket);
    }
    bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);

    if (bucket.timestamps.length >= max) {
      const earliest = bucket.timestamps[0];
      return { allowed: false, retryAfterMs: Math.max(0, (earliest + windowMs) - now) };
    }
    bucket.timestamps.push(now);
    return { allowed: true, retryAfterMs: 0 };
  }
  ```

- [ ] **Step 2: Verify pure logic with `npx tsx`**

  ```bash
  npx tsx -e "
  import { rateLimit } from './src/lib/rateLimit.ts';
  // 3 allowed
  for (let i = 0; i < 3; i++) console.log('req', i+1, rateLimit({key:'x', max:3, windowMs:1000, now: 1000+i*100}));
  // 4th denied
  console.log('req 4', rateLimit({key:'x', max:3, windowMs:1000, now: 1300}));
  // After window, allowed again
  console.log('req later', rateLimit({key:'x', max:3, windowMs:1000, now: 3000}));
  "
  ```
  Expected: first 3 print `allowed: true`, 4th prints `allowed: false` with non-zero `retryAfterMs`, last prints `allowed: true` again.

- [ ] **Step 3: Type-check**

  ```bash
  npm run check 2>&1 | tail -5
  ```
  Expected: `0 errors`.

- [ ] **Step 4: Commit**

  ```bash
  git add src/lib/rateLimit.ts
  git commit -m "Add per-IP rate-limit helper for auth endpoints

  Sliding-window limiter, in-memory, per-Vercel-instance. Keyed by IP
  string. Used by the upcoming /api/auth/request-link endpoint to
  defend against magic-link spam.

  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
  ```

---

## Task 5: Add `sendMagicLink` to `src/lib/email.ts`

**Files:**
- Modify: `src/lib/email.ts`

- [ ] **Step 1: Add the helper at the bottom of the file**

  ```typescript
  export async function sendMagicLink(args: {
    to: string;
    verifyUrl: string;
  }): Promise<void> {
    const html = `
      <p>Hi,</p>
      <p>Click the button below to sign in to your Farmer Brown AI Hub portal.</p>
      <p style="margin: 1.5rem 0;">
        <a href="${args.verifyUrl}"
           style="background:#2563eb;color:#fff;padding:0.625rem 1.25rem;
                  border-radius:6px;text-decoration:none;font-weight:500;
                  display:inline-block;font-family:-apple-system,sans-serif;">
          Sign in
        </a>
      </p>
      <p style="color:#6b6b6b;font-size:0.875rem;">
        This link expires in 1 hour. If you didn't request it, you can ignore this email.
      </p>
      <p>—<br/>Farmer Brown AI Hub</p>
    `;
    await send([args.to], 'Sign in to Farmer Brown AI Hub', html);
  }
  ```

- [ ] **Step 2: Type-check**

  ```bash
  npm run check 2>&1 | tail -5
  ```
  Expected: `0 errors`.

- [ ] **Step 3: Commit**

  ```bash
  git add src/lib/email.ts
  git commit -m "Add sendMagicLink helper with branded template

  No mention of Supabase, VAPI or any other infra. Subject line and
  sender match the existing low-balance and topup-receipt emails.

  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
  ```

---

## Task 6: Create `POST /api/auth/request-link`

**Files:**
- Create: `src/pages/api/auth/request-link.ts`

**Reference (read first):** the spec section "POST /api/auth/request-link" in [`docs/superpowers/specs/2026-05-11-cleanup-tech-stack-leakage-design.md`](../specs/2026-05-11-cleanup-tech-stack-leakage-design.md).

- [ ] **Step 1: Create the file**

  ```typescript
  /**
   * POST /api/auth/request-link
   *
   * Server-side magic-link request. Replaces the browser-side
   * `signInWithOtp` so the customer never sees @supabase/ssr in HTML.
   *
   * Always returns 200 { ok: true } regardless of whether the email
   * exists (no enumeration). Errors are logged server-side.
   */

  import type { APIRoute } from 'astro';
  import { z } from 'zod';
  import { createSupabaseAdminClient } from '@lib/supabase';
  import { sendMagicLink } from '@lib/email';
  import { rateLimit } from '@lib/rateLimit';

  export const prerender = false;

  const Body = z.object({
    email: z.string().email().max(254),
  });

  function clientIp(request: Request): string {
    return (
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown'
    );
  }

  export const POST: APIRoute = async ({ request }) => {
    // Rate-limit before parsing — a flood of garbage bodies should still bounce.
    const ip = clientIp(request);
    const rl = rateLimit({ key: ip, max: 5, windowMs: 60_000 });
    if (!rl.allowed) {
      return new Response(JSON.stringify({ error: 'too_many_requests' }), {
        status: 429,
        headers: {
          'content-type': 'application/json',
          'retry-after': String(Math.ceil(rl.retryAfterMs / 1000)),
        },
      });
    }

    let body: unknown;
    try { body = await request.json(); } catch { body = null; }
    const parsed = Body.safeParse(body);
    if (!parsed.success) {
      // Treat invalid input as silent success — same shape as success path,
      // so a probing client can't tell whether their email syntax was wrong
      // or the address simply doesn't exist.
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    const { email } = parsed.data;

    const supabase = createSupabaseAdminClient();
    const siteUrl = import.meta.env.PUBLIC_SITE_URL;

    try {
      const { data, error } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email,
        options: { redirectTo: `${siteUrl}/portal` },
      });
      if (error) {
        // Most common case: email isn't in customer_users. Stay silent.
        console.warn('[request-link] generateLink error', error.message);
      } else if (data?.properties?.action_link) {
        const action = new URL(data.properties.action_link);
        const token = action.searchParams.get('token');
        if (token) {
          const verifyUrl = `${siteUrl}/auth/verify?token=${encodeURIComponent(token)}&type=magiclink`;
          await sendMagicLink({ to: email, verifyUrl });
        } else {
          console.error('[request-link] action_link missing token query param');
        }
      }
    } catch (e) {
      console.error('[request-link] unexpected error', e);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  ```

- [ ] **Step 2: Type-check**

  ```bash
  npm run check 2>&1 | tail -10
  ```
  Expected: `0 errors`.

- [ ] **Step 3: Local smoke test**

  **Important:** before this step, make sure your local `.env` has the new `RESEND_API_KEY` from Task 3 Step 6 — otherwise `email.ts`'s `send()` helper logs `"RESEND_API_KEY not set — skipping send"` and the curl returns 200 anyway, masking that no email was sent.

  Terminal A:
  ```bash
  set -a; source .env; set +a; npm run dev
  ```
  Terminal B:
  ```bash
  curl -sS -X POST 'http://localhost:4321/api/auth/request-link' \
    -H 'content-type: application/json' \
    -d '{"email":"j.antonio@farmerbrown.com"}' \
    -w '\nHTTP %{http_code}\n'
  ```
  Expected: `{"ok":true}` and HTTP 200.

  Hammer it 6 times to verify the rate-limit:
  ```bash
  for i in 1 2 3 4 5 6; do
    curl -sS -o /dev/null -w "req $i: HTTP %{http_code}\n" \
      -X POST 'http://localhost:4321/api/auth/request-link' \
      -H 'content-type: application/json' -d '{"email":"x@y.com"}'
  done
  ```
  Expected: first 5 → 200, 6th → 429.

  Verify the email actually arrived in your inbox (sender Farmer Brown AI Hub, button URL points to `localhost:4321/auth/verify?...` because `PUBLIC_SITE_URL` is local).

- [ ] **Step 4: Commit**

  ```bash
  git add src/pages/api/auth/request-link.ts
  git commit -m "Add POST /api/auth/request-link

  Server-side magic-link request. Silent on missing emails (no
  enumeration), rate-limited to 5/min/IP, sends via Resend with
  the branded sendMagicLink template. Replaces the browser-side
  @supabase/ssr signInWithOtp call.

  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
  ```

---

## Task 7: Create `GET /auth/verify`

**Files:**
- Create: `src/pages/auth/verify.ts`

**Reference (read first):** the spec section "GET /auth/verify" — pay special attention to the implicit-flow hash-fragment parsing, which is the load-bearing piece.

- [ ] **Step 1: Create the file**

  ```typescript
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

    if (res.status !== 302) {
      console.warn('[auth/verify] unexpected status from Supabase verify', res.status);
      return redirect(ERROR_REDIRECT, 307);
    }
    const location = res.headers.get('location');
    if (!location) {
      console.warn('[auth/verify] no Location header on Supabase 302');
      return redirect(ERROR_REDIRECT, 307);
    }

    // Parse the fragment after the first '#'. URLSearchParams understands
    // the access_token=...&refresh_token=... shape directly.
    const hashIndex = location.indexOf('#');
    if (hashIndex < 0) {
      // No fragment means Supabase gave us an error redirect (e.g. invalid token)
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
  ```

- [ ] **Step 2: Type-check**

  ```bash
  npm run check 2>&1 | tail -10
  ```
  Expected: `0 errors`.

- [ ] **Step 3: Local end-to-end smoke test**

  Make sure the dev server is still running. Then:
  ```bash
  curl -sS -X POST 'http://localhost:4321/api/auth/request-link' \
    -H 'content-type: application/json' \
    -d '{"email":"j.antonio@farmerbrown.com"}'
  ```
  Open the email that arrives, click the **Sign in** button. The button URL should look like `http://localhost:4321/auth/verify?token=...&type=magiclink`. Expected: lands on `/portal` with a working session (balance card visible, calls table populated).

  Negative test:
  ```bash
  curl -sS -o /dev/null -w 'HTTP %{http_code} → %{redirect_url}\n' -L \
    'http://localhost:4321/auth/verify?token=garbage'
  ```
  Expected: ends at `http://localhost:4321/login?error=invalid-link`.

- [ ] **Step 4: Commit**

  ```bash
  git add src/pages/auth/verify.ts
  git commit -m "Add GET /auth/verify

  Server-to-server magic-link verifier. Parses Supabase's implicit-flow
  hash fragment, calls setSession() through the SSR client (which writes
  the standard auth cookie via Astro.cookies). Redirects to /portal on
  success or /login?error=invalid-link on any failure.

  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
  ```

---

## Task 8: Refactor `/login.astro`

**Files:**
- Modify: `src/pages/login.astro`

**Goal of this task:** the rendered HTML must contain zero references to `supabase`, `@supabase`, `sb_publishable`, or any anon key. Verifiable with `view-source`.

- [ ] **Step 1: Read the current file once**

  Open `src/pages/login.astro` and refresh your mental model. The frontmatter (lines 1-20) and the entire `<script>` block (lines 72-139) need substantial changes; the HTML form and styles can stay.

- [ ] **Step 2: Replace frontmatter to surface `?error=`**

  Replace lines 1-20 (everything between the two `---`) with:

  ```typescript
  /**
   * Magic-link login. Submits the email to /api/auth/request-link
   * (server-side); never imports the Supabase SDK in the browser.
   * The "Sign in" button in the email goes to /auth/verify, which
   * establishes the session server-side before redirecting to /portal.
   */
  import { createSupabaseServerClient } from '@lib/supabase';
  import { getCustomerSession } from '@lib/auth';

  export const prerender = false;

  const supabase = createSupabaseServerClient({
    request: Astro.request,
    cookies: Astro.cookies,
  });
  if (await getCustomerSession(supabase)) {
    return Astro.redirect('/portal', 307);
  }

  const error = Astro.url.searchParams.get('error');
  const errorMessage =
    error === 'invalid-link' ? 'That sign-in link is invalid or expired. Request a new one.' :
    null;
  ```

- [ ] **Step 3: Add the error display in the HTML**

  After the existing `<p id="msg" class="msg" …></p>` (around line 69), add:

  ```html
  {errorMessage && <p class="msg err" style="display: block;">{errorMessage}</p>}
  ```

- [ ] **Step 4: Replace the entire `<script>` block**

  Replace lines 72-139 (the whole `<script>…</script>`) with:

  ```html
  <script>
    const form = document.getElementById('login-form') as HTMLFormElement;
    const submit = document.getElementById('submit') as HTMLButtonElement;
    const msg = document.getElementById('msg') as HTMLElement;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = (document.getElementById('email') as HTMLInputElement).value;
      submit.disabled = true;
      msg.style.display = 'none';

      const r = await fetch('/api/auth/request-link', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (r.status === 429) {
        msg.textContent = 'Too many requests. Try again in a minute.';
        msg.className = 'msg err';
      } else {
        msg.textContent = 'Check your inbox for the sign-in link.';
        msg.className = 'msg ok';
      }
      msg.style.display = 'block';
      submit.disabled = false;
    });
  </script>
  ```

- [ ] **Step 5: Type-check**

  ```bash
  npm run check 2>&1 | tail -10
  ```
  Expected: `0 errors`. The previous warnings about unused `supabase`/`getCustomerSession` in `index.astro` may still show — those are pre-existing and not part of this task.

- [ ] **Step 6: Verify HTML cleanness**

  With dev server running:
  ```bash
  curl -sS http://localhost:4321/login | grep -E 'supabase|sb_publishable|@supabase|vapi' | head -5
  ```
  Expected: **no output** (no matches). If anything matches, find and remove it before continuing.

- [ ] **Step 7: Smoke-test the form locally**

  Open `http://localhost:4321/login` in a browser. Type an email, submit. The page should show "Check your inbox for the sign-in link." The DevTools Network tab should show one POST to `/api/auth/request-link` returning `200 {"ok":true}` — and **zero** requests to anything `*.supabase.co`.

- [ ] **Step 8: Smoke-test the error display**

  Visit `http://localhost:4321/login?error=invalid-link` in the browser. The error message should render at the top of the form.

- [ ] **Step 9: Commit**

  ```bash
  git add src/pages/login.astro
  git commit -m "Refactor /login: server-side flow only, no SDK in browser

  Form posts to /api/auth/request-link instead of using the @supabase/ssr
  browser SDK. The implicit-flow hash handler is gone (server-side
  /auth/verify takes care of session establishment now). Page also
  renders ?error=invalid-link from /auth/verify failures.

  Verified: view-source on /login no longer mentions supabase or the
  anon key.

  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
  ```

---

## Task 9: Cleanup `index.astro` and `auth/callback.ts`

**Files:**
- Modify: `src/pages/index.astro`
- Modify: `src/pages/auth/callback.ts`

- [ ] **Step 1: Drop the `?code=` branch in `index.astro`**

  Delete the `const code = Astro.url.searchParams.get('code')` line **and** the entire `if (code) { ... }` block right after it (currently lines 17-20). Both go — leaving the unused `const code` would still type-check but is dead code. Magic-links no longer arrive with `?code=` — they always go through `/auth/verify`. Update the docstring at the top of the file: remove the "Three branches: 1. Supabase magic-link…" bullet about `?code=`.

  After the change, the frontmatter should just be: docstring → imports → `prerender = false` → server-side session check → redirect to `/portal` or `/login`.

- [ ] **Step 2: Drop the `GET` handler in `auth/callback.ts`**

  Open `src/pages/auth/callback.ts`. Delete the entire `export const GET: APIRoute = …` block (lines 17-31). Keep the `POST` handler verbatim — that's the logout button. Update the docstring: remove the `GET` bullet, keep the `POST with ?logout=1` bullet.

- [ ] **Step 3: Type-check**

  ```bash
  npm run check 2>&1 | tail -10
  ```
  Expected: `0 errors`. Pre-existing hints in `index.astro` (`'supabase' is declared but never read`, etc.) should disappear after this cleanup, since the unused imports go with the deleted code.

- [ ] **Step 4: Smoke-test logout still works**

  In the dev server, log in (using the new flow), navigate to `/portal`, click "Cerrar sesión". Expected: redirect to `/login`, no errors.

- [ ] **Step 5: Commit**

  ```bash
  git add src/pages/index.astro src/pages/auth/callback.ts
  git commit -m "Drop unreachable PKCE code paths

  index.astro no longer needs to handle ?code= forwarding; magic-links
  go through /auth/verify in the new flow. auth/callback.ts loses its
  GET handler for the same reason but keeps the POST ?logout=1 handler
  used by the portal layout's sign-out button.

  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
  ```

---

## Task 10: Update `.env.example`

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Update `PUBLIC_SITE_URL` and `EMAIL_FROM` defaults**

  Open `.env.example`. Find the `PUBLIC_SITE_URL` line and change its example value to `https://farmerbrown.theb2btinkerers.com`. Find the `EMAIL_FROM` line and change it to `Farmer Brown AI Hub <notifications@farmerbrown.theb2btinkerers.com>`. Leave the actual `.env` (gitignored) alone — for local dev, `PUBLIC_SITE_URL=http://localhost:4321` stays correct.

- [ ] **Step 2: Commit**

  ```bash
  git add .env.example
  git commit -m "Update .env.example to the new subdomain

  Production URL and sender now live on farmerbrown.theb2btinkerers.com
  (custom subdomain replaces farmerbrown-billing.vercel.app). Local
  .env stays on localhost for dev.

  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
  ```

---

## Task 11: Production rollout & smoke test

**Files:** none (push + verify on production)

- [ ] **Step 1: Push all the commits**

  ```bash
  git push origin main
  ```
  Vercel auto-deploys from `main`.

- [ ] **Step 2: Wait for green deploy**

  Watch the Vercel Deployments tab. The new deploy (will include all the commits from Tasks 4-10) should land in 1-2 minutes. Wait for "Ready".

- [ ] **Step 3: Smoke-check production endpoints**

  ```bash
  curl -sS -o /dev/null -w 'HTTP %{http_code} → %{url_effective}\n' -L 'https://farmerbrown.theb2btinkerers.com/'
  curl -sS -o /dev/null -w '/login HTTP %{http_code}\n' 'https://farmerbrown.theb2btinkerers.com/login'
  curl -sS -o /dev/null -w '/auth/verify (no token) HTTP %{http_code}\n' 'https://farmerbrown.theb2btinkerers.com/auth/verify'
  ```
  Expected: `/` → 200 to `/login`, `/login` → 200, `/auth/verify` → 307 (redirects to `/login?error=invalid-link`).

- [ ] **Step 4: Verify HTML leakage on production**

  ```bash
  curl -sS https://farmerbrown.theb2btinkerers.com/login | grep -E 'supabase|sb_publishable|@supabase|vapi' | head -5
  ```
  Expected: **no output**. If anything matches, stop, investigate, and fix before continuing.

- [ ] **Step 5: Full auth flow end-to-end on production**

  Open `https://farmerbrown.theb2btinkerers.com/login` in a browser. Submit `j.antonio@farmerbrown.com`. Expected: "Check your inbox" message.

  Open the email that arrives. Verify all of:
  - **Sender:** `Farmer Brown AI Hub <notifications@farmerbrown.theb2btinkerers.com>`. **Not** "Supabase Auth".
  - **Subject:** `Sign in to Farmer Brown AI Hub`.
  - **Body:** no mention of "Supabase", "powered by", or any other infra. Just the greeting, button, and signature.
  - **Button URL** (hover over the button): begins with `https://farmerbrown.theb2btinkerers.com/auth/verify?token=…`. **Not** `vaytlurnlyfzixsxxnlw.supabase.co`.

  Click the button. Expected: lands on `/portal` with active session, balance and calls table visible.

- [ ] **Step 6: Negative path on production**

  ```bash
  curl -sS -o /dev/null -w 'HTTP %{http_code} → %{redirect_url}\n' -L \
    'https://farmerbrown.theb2btinkerers.com/auth/verify?token=garbage-token'
  ```
  Expected: ends at `https://farmerbrown.theb2btinkerers.com/login?error=invalid-link`.

- [ ] **Step 7: Logout still works**

  From `/portal`, click "Cerrar sesión". Expected: lands on `/login`, no errors.

- [ ] **Step 8: No commit.** This task is verification.

  If any of Steps 3-7 fail: do NOT proceed to Task 12. Either fix forward (small bug → another commit + Steps 1-2 again) or roll back via Vercel's instant rollback (Deployments → previous deploy → menu → Promote to Production), then debug.

---

## Task 12: Update `where-we-left-off.md` & memory

**Files:**
- Modify: `docs/where-we-left-off.md`

- [ ] **Step 1: Update the resumption checkpoint**

  Open `docs/where-we-left-off.md`. Make these specific changes:
  - **Header line:** bump "Last touched" date and add a sentence about Spec #6 shipping (custom subdomain + Resend live + zero-leak auth flow).
  - **Current state table:** mark `Resend account` as ✅, update the project URL to `farmerbrown.theb2btinkerers.com`, mention `RESEND_API_KEY` is now set.
  - **Still pending list:** remove "Resend signup + DNS verification" (item 2 → done). Renumber.
  - **Useful URLs:** update the production portal URL.

- [ ] **Step 2: Commit**

  ```bash
  git add docs/where-we-left-off.md
  git commit -m "Spec #6 shipped: cleanup tech-stack leakage

  Custom subdomain farmerbrown.theb2btinkerers.com live on Vercel.
  Resend account verified, magic-link emails branded as Farmer Brown
  Billing. Browser side of /login no longer imports @supabase/ssr.
  Auth flow runs through /api/auth/request-link + /auth/verify
  server-side. Smoke-tested end-to-end on production.

  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
  git push origin main
  ```

- [ ] **Step 3: Done.** Brag rights at the next dev sync.
