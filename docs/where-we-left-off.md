# Where we left off — Farmer Brown
**Last touched:** 2026-04-28
**Author of this checkpoint:** José + Claude

This is a session-resumption checkpoint: enough context to pick the project back up cold without re-reading the full conversation history. If you are returning after time away, read this file first, then dive into the linked artifacts.

---

## Snapshot — what is in flight

Three concurrent workstreams were active when this checkpoint was written. All three touch the same Farmer Brown VAPI / Twilio call-center stack:

1. **Twilio account audit** — DELIVERED. Client report at [`docs/twilio-audit-report.md`](twilio-audit-report.md). Awaiting client (John) answers to 6 open questions before any number deletions.
2. **Architecture v4.0 pivot** — DOC DELIVERED. Markdown ([`docs/call-center-architecture.md`](call-center-architecture.md)) and HTML ([`docs/architecture.html`](architecture.html)) describe the new 3-number, unified-receptionist-per-site model. Migration from v3.6 production is in progress per workstream #3.
3. **Builders Risk full-production launch (this week)** — Phase 1 complete. Grace BR Unified deployed to VAPI, new BR Unified Squad created, Test Dispatcher rewired for QA. Phase 2 (testing) and Phase 3 (cut-over) pending.

---

## Workstream 3 — BR launch — current state

**Goal:** ship buildersrisk.net under the v4.0 architecture (1 unified bilingual-deferred receptionist on 1 toll-free) by end of week 2026-05-02.

**Scope agreed with José for v1:**
- English only (Spanish branch deferred to a v1.1 of Grace Unified)
- Sales / Service triage in a single agent
- All 4 client-feedback items incorporated (silence timeout ~7s, GL Buy-Now close on Sarah only, COI submit destination = certificates@farmerbrown.com pending Tyler, service menu reorder COI/Payment/Claim + "live agent anytime")
- Backend pending pattern accepted for v1 (agent says "I'll send you a text" but no real send) — same pattern Rachel uses today

### Phase 1 — DONE (2026-04-27)

**New VAPI assistant**
- **Grace BR Unified v1.0** — Assistant ID `52bda5c2-65c0-4604-b988-f56b9f1d98f3`
- Config: L2 voice (`WlKo88ukhZlZ4fjsOQFI`), Deepgram nova-3 with extended keyterm list, gpt-4o, no tools (squad destinations only), recording on
- Prompt files: [`agents/receptionist-buildersrisk-unified/system-prompt.md`](../agents/receptionist-buildersrisk-unified/system-prompt.md), [`first-message.md`](../agents/receptionist-buildersrisk-unified/first-message.md), [`tools.md`](../agents/receptionist-buildersrisk-unified/tools.md)
- Deploy script: [`scripts/create-receptionist-br-unified.js`](../scripts/create-receptionist-br-unified.js)
- Prompt structure: Step 0 triage (Sales / Service / Spanish-fallback) → Sales branch S1-S4 (existing-quote winner detection + BR-default question + alt menu + specialist routing) OR Service branch T1 (closed-menu COI/Payment/Claim/"live agent") + COI 6-step inline flow T2-T7
- Rules: 14 total (added Rule 13 silence-timeout, Rule 14 Spanish fallback on top of the inherited 12)

**New VAPI squad**
- **Builders Risk — Unified EN Squad** — Squad ID `a3269fa7-6229-4bed-817a-c4684878a600`
- 7 members: Grace Unified + Jennifer + Sarah + Wendy + Nora + Rachel + BR Live Agent Proxy
- Grace has 6 `assistantDestinations` wired (5 specialists + BR proxy)
- Deploy script: [`scripts/create-squad-br-unified.js`](../scripts/create-squad-br-unified.js)
- **NO phone number attached** — `+18882934492` (the BR public toll-free) still points to the legacy `Builders Risk — Sales EN Squad` (`ab53f568-82bf-439f-8fda-d04070864632`) until Phase 3 cut-over

**Test Dispatcher updated**
- Squad ID `2ae25a8b-6ff0-49db-abfc-197b751f533a` (`Test Squad — Sales EN (all sites)`) was patched
- The dispatcher's "Builders Risk" route now points to Grace Unified (was Grace Sales v1.7)
- Legacy Grace Sales v1.7 was REMOVED from the test squad membership but is STILL alive in the production BR Sales Squad — it remains reachable to real callers via `+18882934492` until cut-over
- Patch script: [`scripts/update-squad-test-add-br-unified.js`](../scripts/update-squad-test-add-br-unified.js)
- Net effect: calling `+17027108075` (LasVegas test) and saying "Builders Risk" at the dispatcher now lands on Grace Unified for QA

### Phase 2 — PENDING (planned for tomorrow / mid-week)

QA via `+17027108075`. After dispatcher routes to "Builders Risk", test each path:

| Test | Caller says (after Grace's first message) | Expected behavior |
|---|---|---|
| Sales — BR default | "I want a new builders risk quote" | Confirm BR at S2 → handoff to Jennifer |
| Sales — alt menu GL (also tests Buy-Now) | "new quote" → "something else" → "general liability" | Handoff to Sarah; Sarah delivers premium and runs the buy-now close |
| Sales — alt menu WC | "new quote" → "something else" → "workers comp" | Handoff to Wendy |
| Sales — alt menu CA | "new quote" → "something else" → "commercial auto" | Handoff to Nora |
| Sales — alt menu H&A | "new quote" → "something else" → "home and auto" | Handoff to Rachel |
| Sales — winner | "I already got a quote from you" | Direct transfer to BR Live Agent Proxy with winner script |
| Service — COI happy path | "existing policy" → "certificate" → walk all 6 steps | COI flow completes inline; Step 6 SMS promise verbal only (no real send); Step 7 cross-sell asked |
| Service — COI expedited path | At Step 6 say "yes I need it in 1 hour", then "yes" to review | Same; review SMS promise verbal only |
| Service — Payment | "existing policy" → "I want to pay my bill" | Transfer to BR Live Agent Proxy with payment opener |
| Service — Claim | "existing policy" → "I had an accident" | Transfer to BR Live Agent Proxy with claim opener |
| Service — explicit live agent | "live agent" at any service prompt | Immediate transfer with explicit-request opener (no menu repeat) |
| Service — other | "I need to cancel my policy" | Transfer with other-service opener (NOT confusion fallback) |
| Cross-branch — sales-on-service | "existing policy" → "actually I want a new quote" | Pivot internally to Sales S2; no transfer |
| Silence timeout | Stay silent ~7 seconds at any prompt | Should hear "Are you still there? Would you like a live agent?"; if silent again → transfer |
| Spanish fallback | "¿Hablan español?" | Apology + transfer to BR Live Agent Proxy (no Spanish triage) |
| Confusion fallback | Mumble nonsense twice | Transfer with confusion line after 2nd unclear attempt (NOT 1st) |

Iterate the system prompt as issues surface. Update via a new `scripts/update-receptionist-br-unified.js` (write it when the first prompt fix is needed).

### Phase 3 — PENDING (target Thu 2026-05-01 or Fri 2026-05-02)

Cut-over checklist:
1. Re-attach toll-free `+18882934492` from `Builders Risk — Sales EN Squad` (`ab53f568-...`) to `Builders Risk — Unified EN Squad` (`a3269fa7-...`). VAPI dashboard or via API.
2. Monitor first 2-4 hours of real calls actively.
3. Decommission the legacy BR Sales Squad and the BR Service Squad (`64e52ce6-64e7-4ea9-9cc3-6ae4478fba65`) once confidence is established (don't delete the assistants — only the squads).
4. Update [`docs/squads-and-handoffs.md`](squads-and-handoffs.md) and `CLAUDE.md` to reflect the new wiring.
5. Update the architecture doc status note from "v4.0 target / v3.6 in production" to "v4.0 active on BR; CL + FB still on v3.6".

---

## Open backend dependencies (Tyler)

Logged in [`docs/client-notes-pending.md`](client-notes-pending.md). For BR launch, none of these block v1 — Grace says the promises in future tense per Rule 12. When endpoints ship, attach via `toolIds` and add silent tool-call instructions to the prompt at the matching steps.

| Endpoint | Where it fires in Grace Unified |
|---|---|
| `submit_coi_form` → `certificates@farmerbrown.com` | At end of COI flow (after Step T7) |
| `send_review_sms` | Step T6, expedited path, after caller agrees to review |
| `send_home_auto_application_sms` | Step T7, when caller says yes to cross-sell |
| `send_urgent_coi_alert` | Step T6, expedited path, after caller agrees |
| `submit_wc_form`, `submit_commercial_auto_form` | Inside Wendy / Nora respectively (not Grace) |

GL Buy-Now Calendly flag (`BUY NOW` priority tag): also pending Calendly event-type configuration. Lives inside Sarah's flow, not Grace's.

---

## Open client (John) decisions

Carried over from the audit and the architecture pivot. None of these block BR launch.

1. Twilio audit: 6 questions at the end of [`docs/twilio-audit-report.md`](twilio-audit-report.md) — including who owns the video answering numbers, whether dormant FB product lines are still marketed, the Spanish-mobile forward on "TEST DO NOT EDIT", marketing collateral check before any release, and whether subaccounts exist.
2. Twilio audit, anomaly: `+18889692944` appeared in Google as a FB number but is NOT in the master Twilio account — possibly in another account, in VAPI directly, or stale data. To be confirmed with John.
3. Twilio audit, opaque label: what does "USB" mean as the friendly name of `+18662450034`? Not a standard insurance acronym.
4. Twilio audit, biggest savings opportunity: recording-storage cleanup (~$304/mo of the ~$410/mo bill) — 2.4M minutes archived. Decide retention policy before purging or migrating to S3.
5. Architecture: confirm the per-site receptionist names stay as Emma / Olivia / Grace (kept by default for brand familiarity).

---

## Pre-existing production state (NOT touched in Phase 1)

The following remained live during Phase 1 and continue to serve real callers:
- `+18882934492` (BR toll-free) → `Builders Risk — Sales EN Squad` (`ab53f568-...`) → legacy Grace Sales v1.7 → specialists. Will be re-pointed at Phase 3.
- `+18884356365` (CL toll-free) → `Contractors Liability — Sales EN Squad` → Olivia Sales v1.7. NOT being migrated this week.
- All 3 Service receptionists (Emma / Olivia / Grace Service v1.0+) still live on their respective service squads. NOT being migrated this week.
- All 5 specialists (Jennifer / Sarah / Wendy / Nora / Rachel) and the 3 Live Agent Proxies (FB / CL / BR) untouched.

---

## How to resume

If you are picking this up tomorrow or next week:

1. Read this file (you are here).
2. Open [`docs/call-center-architecture.md`](call-center-architecture.md) for the v4.0 design and the 4 client-feedback items.
3. Open [`agents/receptionist-buildersrisk-unified/system-prompt.md`](../agents/receptionist-buildersrisk-unified/system-prompt.md) to see what Grace Unified actually says.
4. Call `+17027108075`, say "Builders Risk" at the dispatcher, and run through the Phase 2 test matrix above.
5. If a prompt change is needed, write `scripts/update-receptionist-br-unified.js` (mirror `scripts/update-receptionist-br-sales.js` — PATCH on the assistant ID, replace name + firstMessage + model.systemPrompt + transcriber).
6. When ready for Phase 3 cut-over, re-attach `+18882934492` to the new squad in the VAPI dashboard (or write a script for the Twilio number → VAPI squad reattachment if you prefer reproducible scripts).

If you are picking this up after a longer break, also re-read `docs/twilio-audit-report.md` — the audit is a separate workstream that John may have replied to in the meantime.
