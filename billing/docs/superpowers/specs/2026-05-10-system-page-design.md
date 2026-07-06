# System page (Spec #5) — design

**Status:** approved 2026-05-10
**Compact spec — three cards on a new `/portal/system` page describing the live agents, one per website.**

## Context

User wants a customer-facing page where John sees the architecture he's
paying for — without exposing VAPI internals. Three websites, three
inbound numbers, three Receptionist assistants. The page is pitched as
"this is what you have running 24/7".

## Files

| Path | Purpose | Action |
|---|---|---|
| `src/lib/sites.ts` | Extended with `SystemSite` data; `SITES_BY_NUMBER` derived from it | **Modify** (extend, no breaking) |
| `src/components/SiteCard.astro` | One card per site | **Create** |
| `src/pages/portal/system.astro` | New page route at `/portal/system`, auth-gated, renders three `<SiteCard>` | **Create** |
| `src/layouts/Portal.astro` | Add "System" link in the header next to customer name | **Modify** |

No new schema, no migration, no env var. Pure static content + auth gate.

## `SystemSite` shape and data

In `src/lib/sites.ts`, alongside the existing `SiteInfo` and `resolveSite`:

```ts
export interface SystemSite {
  code: 'BR' | 'GL' | 'FB';
  websiteName: string;      // "Builders Risk" (legible)
  websiteDomain: string;    // "buildersrisk.net"
  phoneNumber: string;      // "+18882934492" (E.164, used as the lookup key)
  phoneDisplay: string;     // "+1 888-293-4492" (formatted for humans)
  agentName: string;        // "Grace"
  description: string;      // 1-2 sentences. Customer-facing copy.
}

export const SYSTEM_SITES: readonly SystemSite[] = [
  {
    code: 'BR',
    websiteName: 'Builders Risk',
    websiteDomain: 'buildersrisk.net',
    phoneNumber: '+18882934492',
    phoneDisplay: '+1 888-293-4492',
    agentName: 'Grace',
    description: 'Receptionist for builders-risk insurance inquiries — takes inbound calls 24/7 and forwards to a licensed agent when the caller needs a quote.',
  },
  {
    code: 'GL',
    websiteName: "Contractor's Liability",
    websiteDomain: 'contractorsliability.com',
    phoneNumber: '+18884356365',
    phoneDisplay: '+1 888-435-6365',
    agentName: 'Olivia',
    description: 'Receptionist for contractor general-liability quotes — fields product questions, captures contact info, and books follow-up calls.',
  },
  {
    code: 'FB',
    websiteName: 'Farmer Brown',
    websiteDomain: 'farmerbrown.com',
    phoneNumber: '+18884962029',
    phoneDisplay: '+1 888-496-2029',
    agentName: 'Emma',
    description: 'General Farmer Brown line — answers caller questions and routes to the right product team.',
  },
];
```

The existing `SITES_BY_NUMBER` const (used by `resolveSite`) is rewritten as
a **derived** object so we can't drift:

```ts
export const SITES_BY_NUMBER: Record<string, SiteInfo> = Object.fromEntries(
  SYSTEM_SITES.map((s) => [
    s.phoneNumber,
    { code: s.code, website: s.websiteDomain },
  ]),
);
```

`SiteInfo`, `resolveSite`, and existing consumers (`CallsTable`,
`CallDetailHeader`) keep working unchanged.

The description copy above is a first pass — José can edit it later in the
TS file in 30 seconds.

## SiteCard component

```astro
---
import type { SystemSite } from '@lib/sites';

interface Props { site: SystemSite }
const { site } = Astro.props;
---

<div class="card site-card">
  <div class="header">
    <span class="code">{site.code}</span>
    <h3>{site.websiteName}</h3>
    <a href={`https://${site.websiteDomain}`} target="_blank" rel="noopener">{site.websiteDomain}</a>
  </div>

  <dl class="meta">
    <dt>Phone</dt>
    <dd class="mono">{site.phoneDisplay}</dd>
    <dt>Agent</dt>
    <dd>{site.agentName}</dd>
  </dl>

  <p class="description text-muted small">{site.description}</p>
</div>
```

Scoped styles for the `.code` chip (small uppercase pill, `var(--accent)`
background, white text) plus a small `.meta` two-column grid like
`CallDetailHeader`.

## Page route — `src/pages/portal/system.astro`

```astro
---
import Portal from '@layouts/Portal.astro';
import SiteCard from '@components/SiteCard.astro';
import { createSupabaseServerClient } from '@lib/supabase';
import { getCustomerSession } from '@lib/auth';
import { SYSTEM_SITES } from '@lib/sites';

export const prerender = false;

const supabase = createSupabaseServerClient({
  request: Astro.request,
  cookies: Astro.cookies,
});
const session = await getCustomerSession(supabase);
if (!session) {
  return Astro.redirect('/login', 307);
}
---

<Portal title="System" customerName={session.customerDisplayName}>
  <div class="card intro">
    <h2>Your live agents</h2>
    <p class="text-muted">
      Three AI receptionists handle inbound calls across your three websites,
      24/7. Each call is recorded and metered, and shows up on your billing
      page within a day.
    </p>
  </div>

  <div class="cards">
    {SYSTEM_SITES.map((site) => <SiteCard site={site} />)}
  </div>
</Portal>

<style>
  .intro { background: var(--card); }
  .cards { display: grid; gap: 1rem; }
  @media (min-width: 720px) {
    .cards { grid-template-columns: 1fr 1fr 1fr; }
  }
</style>
```

## Portal layout — header link

In `src/layouts/Portal.astro`, the existing header has:

```astro
<header class="site">
  <h1>Farmer Brown — Billing</h1>
  <div class="right">
    {customerName && <span>{customerName}</span>}
    {showLogout && (
      <form method="POST" action="/auth/callback?logout=1">
        <button type="submit" class="linklike">Sign out</button>
      </form>
    )}
  </div>
</header>
```

Add two text links in the right side, before the customer name:

```astro
<div class="right">
  <a href="/portal">Billing</a>
  <a href="/portal/system">System</a>
  {customerName && <span>{customerName}</span>}
  ...
</div>
```

This gives John navigation between the two main portal pages from any
authenticated screen. Login page doesn't use this layout, so the links
don't appear before sign-in.

## Edge cases

| Case | Behaviour |
|---|---|
| Unauthenticated → `/portal/system` | Redirect to `/login` (same pattern as `/portal`). |
| `SYSTEM_SITES` is empty (shouldn't happen) | Page renders intro + empty cards grid. Acceptable but improbable. |
| `websiteDomain` typo / dead link | Card still renders; the `<a target=_blank>` opens whatever the browser does for an unreachable URL. Not the system's responsibility. |

## Verification

After implementation:

1. Logged-in `/portal/system` shows three cards (BR, GL, FB) with phone, agent, description.
2. Header has new "Billing" / "System" links visible from both `/portal` and `/portal/system`.
3. Clicking "Billing" returns to `/portal` with default filter (Last 30 days).
4. Unauthenticated visit to `/portal/system` → redirect to `/login`.
5. Domain links open in new tab.
6. DevTools → no `vapi.ai` references anywhere on the page.
7. `npm run check` clean (0 errors, 3 hints baseline).

## Out of scope

- Editing the descriptions in-app. José edits `sites.ts` and commits.
- Showing live status / health of each agent (would need VAPI API calls).
- Per-agent stats (calls handled, success rate). Could be a Spec #6 if useful.
- Showing the squad/assistant uuids — internal info, not customer-facing.
