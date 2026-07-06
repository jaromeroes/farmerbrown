# Cleanup tech-stack leakage (Spec #6) — design

**Status:** approved 2026-05-11
**Eliminate every Supabase / VAPI / Astro / Vercel reference from customer-facing surfaces. Stripe stays — it adds trust, not leak.**

## Context

A leakage audit ran on `main` after the production deploy unblocking
session (commit `d869bbc`). It surfaced three customer-visible places
where the underlying infrastructure leaks:

1. **Magic-link email** (highest impact — sits in the customer's inbox):
   sender name `Supabase Auth`, footer `powered by Supabase ⚡`, sign-in
   button URL `https://vaytlurnlyfzixsxxnlw.supabase.co/auth/v1/verify?...`.
2. **`/login` page HTML** served from production: a `<script>` block
   imports `@supabase/ssr` and inlines `PUBLIC_SUPABASE_URL` +
   `PUBLIC_SUPABASE_ANON_KEY` into the document. Visible to anyone who
   opens DevTools. The anon key is safe by Supabase design (RLS-protected),
   but the *fact* that we use Supabase is fully exposed.
3. **Production hostname** `farmerbrown-billing.vercel.app` reveals Vercel
   as the host.

Stripe references (`Powered by Stripe` on Checkout, "Secure payment
processed by Stripe" copy in `TopupForm`) are deliberately kept — Stripe is
a recognised payment brand whose presence increases customer trust.

Internal field names like `vapi_assistant_id`, `vapi_squad_id`, `vapi_raw`
do **not** leak to the browser today; the curation boundary in
`src/lib/callDetail.ts` is doing its job. No change needed there.

## Goal & scope

**Goal:** zero customer-visible reference to the infrastructure stack
(Supabase, VAPI, Astro, Vercel) in either the browser HTML/JS the customer
sees or the emails they receive.

**In scope:**

- Custom subdomain `farmerbrown.theb2btinkerers.com` for the portal (kills
  `vercel.app` from the URL bar and email links).
- Resend account + DNS verification of the subdomain (also closes the
  long-standing "Resend signup" backlog item).
- Server-side magic-link auth flow: the browser stops importing
  `@supabase/ssr` and stops talking to `*.supabase.co`.
- Magic-link email sent **by us via Resend** with our own template (sender
  is `Farmer Brown AI Hub`, no "powered by"), button URL points at
  `farmerbrown.theb2btinkerers.com/auth/verify?token=…`.
- Server endpoint `/auth/verify` that exchanges the token with Supabase
  server-to-server and reissues the resulting auth cookies under our own
  domain.

**Out of scope (separate work or unaffected):**

- Other Supabase email templates (`Confirm signup`, `Password recovery`) —
  we don't trigger them today (admin API creates users directly, no
  passwords).
- Cron `/api/cron/sync-vapi`, the Stripe webhook, or any other API endpoint
  the customer never sees.
- Templates of `sendLowBalanceAlert` / `sendTopupReceipt` — already
  branded "Farmer Brown AI Hub", no leak.
- Replacing `customer.email` placeholder with John's real address — backlog
  item, separate workstream.
- Existing `src/lib/callDetail.ts` curation of `vapi_raw` fields — already
  clean, audit verified.
- Backwards-compatibility for the old browser-side flow — no fallback flag,
  no LEGACY_AUTH escape hatch. The smoke test catches regressions; if it
  breaks in production, we roll back the deploy.

## Architecture

### Today (leaks)

```
Browser /login form
  → @supabase/ssr.signInWithOtp({email})       ← SDK in browser, anon key inlined
  → Supabase sends email (its own SMTP)        ← sender "Supabase Auth", branded footer
  → User clicks button → supabase.co/.../verify ← supabase.co exposed in URL
  → Supabase 302 → /login#access_token         ← hash carries tokens client-side
  → Browser parses hash, calls setSession()    ← another SDK browser call
  → /portal
```

### After (no leak)

```
Browser /login form
  → fetch POST /api/auth/request-link {email}        ← own endpoint, no SDK
  → Server calls Supabase admin generateLink()       ← server-to-server, invisible
  → Server extracts token + sends email via Resend   ← own template, FB sender
  → Email "Sign in" button → farmerbrown.theb2btinkerers.com/auth/verify?token=XXX
  → Browser GET /auth/verify
  → Server fetches Supabase verify endpoint          ← server-to-server (with anon key)
  → Server parses access_token + refresh_token from Location 302 hash fragment
  → Server calls supabase.auth.setSession() via SSR client (writes sb-…-auth-token cookie)
  → 302 → /portal with active session
```

The browser only ever talks to `farmerbrown.theb2btinkerers.com`. The
`*.supabase.co` host appears nowhere in HTML, JS bundle, network requests,
or email content.

## Files

| Path | Purpose | Action |
|---|---|---|
| `src/pages/api/auth/request-link.ts` | POST endpoint: validate email, call Supabase `admin.generateLink`, extract token, send email via Resend | **Create** |
| `src/pages/auth/verify.ts` | GET endpoint: server-side verify with Supabase, parse 302 hash, set session cookies, redirect | **Create** |
| `src/lib/rateLimit.ts` | Tiny in-memory per-IP rate limiter shared by `request-link` (and any future endpoint that needs it) | **Create** |
| `src/lib/email.ts` | Add `sendMagicLink({to, verifyUrl})` + branded HTML template | **Modify** |
| `src/pages/login.astro` | Remove `@supabase/ssr` browser import, remove hash handler, switch form submit to fetch `/api/auth/request-link`, render `?error=...` server-side | **Modify** |
| `src/pages/index.astro` | Remove the `?code=` PKCE branch (no longer reachable) | **Modify** |
| `src/pages/auth/callback.ts` | Remove `GET` handler (PKCE exchange unreachable in the new flow); keep `POST ?logout=1` so the portal layout's sign-out button keeps working | **Modify** |
| `.env.example` | Update `PUBLIC_SITE_URL` and `EMAIL_FROM` to the new subdomain | **Modify** |

Configuration changes outside the repo (operative, José executes with
guidance):

- **Cloudflare DNS:** one CNAME `farmerbrown.theb2btinkerers.com` → `cname.vercel-dns.com`.
- **Vercel:** add the subdomain in Settings → Domains, update
  `PUBLIC_SITE_URL` env to `https://farmerbrown.theb2btinkerers.com`,
  redeploy. SSL provisioning is automatic (~1 minute).
- **Resend:** sign up (free tier covers our volume), verify domain
  `farmerbrown.theb2btinkerers.com` with the 3 DNS records they emit
  (DKIM, SPF, return-path), generate API key.
- **Vercel env:** add `RESEND_API_KEY` (production only).
- **Supabase Auth:** Authentication → URL Configuration → set Site URL to
  `https://farmerbrown.theb2btinkerers.com`, add `https://farmerbrown.theb2btinkerers.com/**`
  to Redirect URLs allowlist (without this, admin-generated links silently
  rewrite redirect_to back to the old default).

## Components

### `POST /api/auth/request-link`

```ts
// Body
interface RequestLinkBody { email: string }

// Response (always — no email enumeration)
interface RequestLinkResponse { ok: true }
```

Behaviour:

1. Parse + validate email shape (zod schema, basic shape).
2. Per-IP rate-limit: 5 requests / 60 s, in-memory `Map<ip, timestamps[]>`.
   Returns `429` past the limit. Lives in `src/lib/rateLimit.ts` (new),
   small enough to share with future endpoints.
3. Call `supabaseAdmin.auth.admin.generateLink({ type: 'magiclink', email,
   options: { redirectTo: 'https://farmerbrown.theb2btinkerers.com/portal' } })`.
   The `redirectTo` is a placeholder — we don't use the URL Supabase returns,
   we extract just the token.
4. If Supabase returns an error (user not in `customer_users` results in a
   silent "no link" from generateLink — there's no error, just no email
   sent), still respond `200 { ok: true }` to prevent enumeration.
5. Parse the returned `action_link` URL. For `type: 'magiclink'` the shape
   is `<SUPABASE_URL>/auth/v1/verify?token=<hashed>&type=magiclink&redirect_to=<...>`.
   We forward the token verbatim including `type=magiclink` — Supabase's
   verify endpoint expects the *hashed* token, not a plaintext OTP, so we
   never decode or re-hash it.
6. Build the verify URL on our domain: `${import.meta.env.PUBLIC_SITE_URL}/auth/verify?token=${token}` (use
   `new URL(...)` to avoid stringly-typed concatenation bugs).
7. Call `sendMagicLink({ to: email, verifyUrl })`.
8. Return `200 { ok: true }`.

Errors are logged server-side (`console.error`) but never bubbled to the
client — same enumeration concern.

### `GET /auth/verify`

```ts
// Query
?token=<from email>
```

Behaviour:

1. Read `token` from query. If missing/empty, redirect to
   `/login?error=invalid-link`.
2. Call `fetch('https://<supabase-host>/auth/v1/verify?token=...&type=magiclink&redirect_to=https://farmerbrown.theb2btinkerers.com/portal',
   { headers: { apikey: ANON_KEY }, redirect: 'manual' })`. We do **not**
   follow the 302 — we capture it.
3. Inspect the response. Supabase's GoTrue verify endpoint runs in
   **implicit flow** by default: a successful verify returns a `302` with
   `Location: <redirect_to>#access_token=…&refresh_token=…&expires_in=…&token_type=bearer&type=magiclink`.
   The tokens live in the URL fragment of the `Location` header — there
   are **no `Set-Cookie` headers** to capture (that was the original
   plan; it doesn't work, the browser would normally read the fragment
   client-side). On the server we own the redirect, so we read the
   fragment ourselves.
4. Parse the `Location` header:
   - Extract everything after the first `#` and parse as
     `URLSearchParams` (the fragment uses query-style encoding).
   - Read `access_token` and `refresh_token`. If either is missing →
     log + redirect to `/login?error=invalid-link`.
   - Anything else (non-302 response, no Location, parse failure) → same
     error redirect.
5. Establish the session server-side with the SSR client wired to
   `Astro.cookies` (the same factory `createSupabaseServerClient` already
   used by every authenticated page):

   ```ts
   const supabase = createSupabaseServerClient({ request, cookies });
   const { error } = await supabase.auth.setSession({
     access_token,
     refresh_token,
   });
   ```

   `setSession()` writes the standard `sb-<ref>-auth-token` cookie via
   the SSR client's cookie adapter, which means `getCustomerSession`
   (which reads via `supabase.auth.getUser()`) will recognise it on the
   next request. No manual cookie naming, no `Domain`/`SameSite`
   gymnastics — same machinery as today's cookies, just established by
   us instead of the browser SDK.
6. Issue a `302` to `/portal`. The browser receives the cookie and the
   redirect in one response, exactly as today.

This is the load-bearing piece of the spec. The earlier "capture
Supabase Set-Cookie and reissue" approach was wrong — GoTrue's verify
endpoint doesn't emit cookies in implicit flow. Switching to "parse the
fragment + setSession" reuses the proven cookie path the rest of the app
already depends on.

### `sendMagicLink` helper (in `src/lib/email.ts`)

```ts
export async function sendMagicLink(args: {
  to: string;
  verifyUrl: string;
}): Promise<void>;
```

HTML template, plain and branded:

```
Hi,

Click the button below to sign in to your Farmer Brown AI Hub portal.

[ Sign in ]   ← <a> styled as a button, href = verifyUrl

This link expires in 1 hour. If you didn't request it, you can ignore
this email.

—
Farmer Brown AI Hub
```

No "powered by", no third-party logos, no Stripe/VAPI/Supabase mention.
Subject: `Sign in to Farmer Brown AI Hub`.

### `src/pages/login.astro` changes

- Remove the `<script>` import of `@supabase/ssr` and its anon-key
  serialisation entirely.
- Remove the implicit-flow hash handler block (lines ~83-111 today) — no
  hash will arrive any more, the cookie is set by `/auth/verify` before
  the redirect to `/portal`.
- Replace the form submit handler with a small inline script:
  ```ts
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
  ```
- Net result: the rendered HTML has zero references to `supabase`,
  `@supabase`, or `sb_publishable_…`. Verifiable with `grep` against
  view-source in production.

### `src/pages/index.astro` changes

- Remove the `if (code) { ... }` PKCE branch and the `code` extraction.
  Magic-links no longer arrive with `?code=` — they always go through
  `/auth/verify`, which sets the cookie before redirecting to `/portal`,
  so by the time `index.astro` runs the session is already established.
- Keep the rest (server-side session check → `/portal` or `/login`).

### `src/pages/auth/callback.ts` changes

The file exists today with two handlers: `GET` (PKCE `?code=` exchange,
unreachable in the new flow) and `POST ?logout=1` (used by the "Cerrar
sesión" button in the portal layout).

- Delete the `GET` handler. With magic-links going through `/auth/verify`,
  no `?code=` ever lands on `/auth/callback` again. Leaving it would be
  dead code that still compiles and could confuse a future reader.
- Keep the `POST ?logout=1` handler verbatim. This is what the portal
  layout's sign-out button posts to (`<form action="/auth/callback?logout=1"
  method="post">`). Changing the sign-out path is out of scope.

### `?error=...` surfacing on `/login`

`login.astro` today doesn't render `Astro.url.searchParams.get('error')`.
Add a small server-side block at the top of the frontmatter:

```ts
const error = Astro.url.searchParams.get('error');
const errorMessage = error === 'invalid-link'
  ? 'That sign-in link is invalid or expired. Request a new one.'
  : null;
```

…and a conditional `<p class="msg err">{errorMessage}</p>` near the form.
This covers the only two redirects to `/login?error=…` we issue
(`/auth/verify` invalid-link, `/auth/callback?logout=1` already redirects
without an error). Other error codes fall through silently.

## Trade-offs

**Pros:**

- Closes the highest-impact leak (the email) and the structural one (the
  HTML).
- Brings the magic-link email under our template control, same level of
  ownership as `sendLowBalanceAlert` and `sendTopupReceipt`.
- Closes the long-pending "Resend signup + DNS" backlog item in the same
  workstream.
- The new endpoints are small, well-bounded, and testable independently of
  Supabase (the verify endpoint can be unit-tested by mocking the
  `fetch` to Supabase).

**Cons:**

- More custom code (~200 LOC across new endpoints + email helper).
- Cookie-reissue is silent-fragile: if Supabase changes its cookie naming
  scheme in a future release we won't notice until login breaks. Mitigated
  by the smoke test (catches it on every deploy).
- Magic-link delivery now depends on Resend being up. Free-tier SLA is
  best-effort. If Resend is down, no one can log in. Acceptable risk for
  this customer volume; revisit if multi-tenant.
- We pay ~5 hours of work for a problem the customer would probably
  never notice unless they actively opened DevTools or hovered the email
  button. Justified by the user's explicit ask, not by ROI on its own.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Supabase cookie naming changes silently | Smoke test on every deploy + log unparseable Set-Cookie at `/auth/verify` |
| DNS propagation delays | Sequence the rollout: 1) DNS, 2) wait for resolve, 3) Vercel domain, 4) Supabase URL config. Each step verified before the next. |
| Vercel SSL provisioning lag (~60s) | Don't deploy with the new domain wired into env until SSL is green |
| Rate-limit map memory growth on a long-lived serverless function | Each entry auto-expires; max ~thousands of entries; serverless restart wipes anyway |
| In-memory rate-limit is per-instance: with N concurrent Vercel instances, the effective limit is `5 × N` per minute | Acceptable for our volume — if we ever need real distributed rate-limiting, swap for Vercel KV. Noting as known limitation, not a blocker. |
| User reports "I'm not getting emails" after rollout | Resend dashboard shows delivery logs, including bounces |

## Test plan

Manual — there is no test framework set up in this repo today; matching
the team's current practice.

1. **DNS + Vercel:** `curl -I https://farmerbrown.theb2btinkerers.com/`
   returns 200 (or 302 to `/login`), valid SSL, no certificate warning.
2. **Resend:** dummy test send via Resend API directly (no auth flow yet)
   to `j.antonio@farmerbrown.com` — confirms domain verified, sender
   visible as `Farmer Brown AI Hub <notifications@farmerbrown.theb2btinkerers.com>`.
3. **Auth flow end-to-end on production:**
   - Open `https://farmerbrown.theb2btinkerers.com/login`.
   - Submit `j.antonio@farmerbrown.com`.
   - Inbox: email arrives, sender `Farmer Brown AI Hub`, **does not
     mention Supabase anywhere**, button URL begins with
     `farmerbrown.theb2btinkerers.com/auth/verify?token=…`.
   - Click button → lands on `/portal` with session active, balance card
     and recent calls visible.
4. **HTML/JS leak verification:** in production, view-source on `/login`
   and grep for `supabase`, `@supabase`, `sb_publishable`, `vapi`.
   Expected: 0 matches in any of them.
5. **Network tab:** during the full login flow, no request goes to
   `*.supabase.co` from the browser.
6. **Rate-limit:** 6 quick POSTs to `/api/auth/request-link` from same IP.
   The 6th returns `429`.
7. **Negative case:** manually GET
   `/auth/verify?token=obviously-invalid` → redirected to
   `/login?error=invalid-link`, no crash, no leaked stack info.

## Rollout order

1. Land code on a preview branch (`feature/cleanup-leakage`).
2. Configure Resend account + DNS verification of `farmerbrown.theb2btinkerers.com`.
3. Add Cloudflare DNS for the subdomain.
4. Add Vercel custom domain + `RESEND_API_KEY` env + updated `PUBLIC_SITE_URL`.
5. Update Supabase Auth Site URL + Redirect URLs allowlist.
6. Promote preview deploy to production.
7. Run the manual test plan above.
8. Update `docs/where-we-left-off.md` with the new portal URL and the
   closed Resend item.

If any test fails, roll back via Vercel's instant rollback to the previous
deploy and investigate.
