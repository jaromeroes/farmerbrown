# Farmer Brown — AI Voice Agents

## Overview
Internal tools hub for Farmer Brown Insurance. We build and manage VAPI voice agents that collect insurance quotes (builders risk, general liability) and schedule appointments via phone calls.

## Tech Stack
- **Voice Platform:** VAPI (https://api.vapi.ai)
- **LLM:** OpenAI GPT-4o (via VAPI)
- **Voice:** ElevenLabs (11Labs)
- **Transcriber:** Deepgram (nova-2, English)
- **Frontend:** Vanilla HTML/JS (voice designer tool)
- **Scripts:** Node.js (no dependencies, uses native fetch)

## VAPI Credentials
- **API Key:** `$VAPI_KEY` env var (see `.env.example`). Rotate via VAPI dashboard; never commit the value.
- **Org ID:** `198209e2-169f-46ac-af2e-1e409ca93de3`

## Calforce backend credentials
- **Agent API Key:** `$CALFORCE_AGENT_KEY` env var (see `.env.example`). Used as `agent_api_key` query param for `farmerbrown-bi.calforce.pro/api/*` endpoints.

## Local setup
1. `cp .env.example .env` and fill in `VAPI_KEY` + `CALFORCE_AGENT_KEY`.
2. `export $(grep -v '^#' .env | xargs)` (or source it via your shell profile).
3. Run any `scripts/*.js` — they read from `process.env.VAPI_KEY` / `process.env.CALFORCE_AGENT_KEY` and exit early if missing.

## Call Center Architecture
Full architecture documented in `docs/call-center-architecture.md`.
- 9 phone numbers total: 3 per site (EN Sales / EN Service / ES combined)
- Central receptionist agent routes to specialist agents or live agents
- Cross-sell present on all calls except Home & Auto
- Fallback: agent confusion → always transfer to live agent

## Agents

### Receptionist — Central Router
One receptionist per phone line (9 total across 3 sites × 3 lines). Each line = its own Squad. See `docs/call-center-architecture.md`.

**Status:** EN Sales (3 sites) + EN Service (3 sites) deployed. Spanish variants pending.

#### Emma — Farmer Brown Receptionist (EN Sales) ✅ active
- **Assistant ID:** `71c72af4-b87a-43cb-8f0a-661c3febe8ea`
- **Squad ID:** `5cf7afbf-cee7-45cd-8fa1-9ff2989d8e28` (Farmer Brown — Sales EN Squad)
- **Version:** v1.9
- **Config:** `agents/receptionist-farmerbrown-sales/`
- **Deploy scripts:** `scripts/create-receptionist-fb-sales.js`, `scripts/update-receptionist-fb-sales.js`, `scripts/create-squad-fb-sales.js`, `scripts/update-squads-add-wendy.js`
- **Line:** farmerbrown.com English Sales
- **Routing:** existing quote → live agent proxy · new quote → {BR→Jennifer · GL→Sarah · CA→Nora · H&A→Rachel · WC→Wendy}
- **Squad members:** Emma + Jennifer + Sarah + Nora + Rachel + Wendy + FB Live Agent Proxy
- **Tools:** none — live-agent escalation is a squad destination, not an explicit tool (v1.8 fix)

#### Olivia — Contractors Liability Receptionist (EN Sales) ✅ active
- **Assistant ID:** `b5f88994-e045-4996-9f2c-056516e9cf01`
- **Squad ID:** `3b29fd00-f58a-4282-9cb3-c26c393a7858` (Contractors Liability — Sales EN Squad)
- **Version:** v1.7
- **Config:** `agents/receptionist-contractorsliability-sales/`
- **Deploy scripts:** `scripts/create-receptionist-cl-sales.js`, `scripts/update-receptionist-cl-sales.js`, `scripts/create-squad-cl-sales.js`, `scripts/update-squads-add-wendy.js`
- **Line:** contractorsliability.com English Sales
- **Flow:** Mirrors Emma with CL branding. Same routing — BR→Jennifer, GL→Sarah, CA→Nora, H&A→Rachel, WC→Wendy
- **Squad members:** Olivia + Jennifer + Sarah + Nora + Rachel + Wendy + CL Live Agent Proxy
- **Tools:** none (v1.6 fix)

#### Grace — Builders Risk Receptionist (EN Sales) ✅ active
- **Assistant ID:** `fa2897bb-00ee-4680-af00-0e31abeed228`
- **Squad ID:** `ab53f568-82bf-439f-8fda-d04070864632` (Builders Risk — Sales EN Squad)
- **Version:** v1.7
- **Config:** `agents/receptionist-buildersrisk-sales/`
- **Deploy scripts:** `scripts/create-receptionist-br-sales.js`, `scripts/update-receptionist-br-sales.js`, `scripts/create-squad-br-sales.js`, `scripts/update-squads-add-wendy.js`
- **Line:** buildersrisk.net English Sales
- **Flow:** Two-step menu optimized for BR — after "new quote", asks "Builder's Risk or something else?" (defaults to Jennifer). Alternate menu (GL→Sarah, CA→Nora, H&A→Rachel, WC→Wendy) only if "something else"
- **Squad members:** Grace + Jennifer + Sarah + Nora + Rachel + Wendy + BR Live Agent Proxy
- **Tools:** none (v1.6 fix)

#### Live Agent Handoff Proxies (3 silent SIP proxies) ✅ active
One proxy per site. Each proxy is a minimal assistant whose only job is to invoke its site's `transfer_to_live_agent_*` tool immediately on connect. Used as the 5th squad destination from each receptionist so the LLM picks by name instead of being biased toward an explicit tool. Architectural fix for the L2→L3 handoff bug (2026-04-18) — see [docs/squads-and-handoffs.md](docs/squads-and-handoffs.md) §12.

| Proxy | Assistant ID | VAPI Name | SIP destination |
|-------|--------------|-----------|-----------------|
| FB Live Agent Proxy | `fb1e7022-e4ee-42d1-b1db-0977a4e05aad` | `FB Live Agent Handoff v1.0` | +18889730016 |
| CL Live Agent Proxy | `f06c2ad0-1a21-491d-916d-cbbf09e1118e` | `CL Live Agent Handoff v1.0` | +18889730016 |
| BR Live Agent Proxy | `180a9367-df40-4e46-91c8-a28b13901e53` | `BR Live Agent Handoff v1.0` | +18775131573 |

Deploy script: [scripts/create-live-agent-proxies.js](scripts/create-live-agent-proxies.js)

#### BR Direct-Dial Proxy (specific-person extension dialing) ✅ active
Silent SIP proxy used by Grace Unified to dial a specific person's PBX extension when the directory entry has `Direct-dial? = yes`. Pattern is identical to the Live Agent Proxies (silent first turn that says "One moment." and invokes its tool), but the underlying tool is `transfer_to_specific_person` (multi-destination, per-extension) rather than `transfer_to_live_agent_*`.

| Proxy | Assistant ID | VAPI Name | Tool |
|-------|--------------|-----------|------|
| BR Direct-Dial Proxy | `32dde873-910d-489f-93fa-3527e52befc1` | `BR Direct-Dial Proxy v1.0` | `transfer_to_specific_person` |

Squad membership: BR Unified Squad (`a3269fa7-…`) only — added 2026-05-08 as 8th member.

Deploy scripts: [scripts/create-tool-transfer-to-specific-person.js](scripts/create-tool-transfer-to-specific-person.js), [scripts/create-br-direct-dial-proxy.js](scripts/create-br-direct-dial-proxy.js), [scripts/update-squad-add-direct-dial-proxy.js](scripts/update-squad-add-direct-dial-proxy.js)

**To wire more directory entries:** add destinations to `transfer_to_specific_person` (re-run its create script — idempotent), then flip the `Direct-dial?` column in Grace's INTERNAL DIRECTORY to `yes`, bump Grace's version, and run `update-receptionist-br-unified.js`. The proxy itself does not need to be touched.

#### BR Routing Proxies — Spanish / Existing-Quote / Service (3 silent SIP proxies) ✅ active

Shipped 2026-05-11 with Grace v1.22. Three new silent SIP proxies, one per category of "live agent" routing that Grace differentiates. Same architectural pattern as the original `BR Live Agent Proxy`: `firstMessage: ''` + `firstMessageMode: 'assistant-speaks-first-with-model-generated-message'` + a system prompt that forces the LLM to say "One moment." and invoke its forwarding tool in the same first turn.

| Proxy | Assistant ID | VAPI Name | Tool | SIP destination |
|-------|--------------|-----------|------|-----------------|
| BR Spanish Proxy | `af9a33a1-0f3d-4723-b021-1a676ba859c3` | `BR Spanish Proxy v1.0` | `transfer_to_spanish_team` | +18332160350 |
| BR Existing-Quote Proxy | `db9b7095-36a4-48a2-8b22-3cc8f80edeec` | `BR Existing-Quote Proxy v1.0` | `transfer_to_existing_quote_team` | +17262038542 |
| BR Service Proxy | `a080eec0-ad05-403c-bcb1-8a61185a268c` | `BR Service Proxy v1.0` | `transfer_to_service_team` | +17262046968 |

Squad membership: BR Unified Squad (`a3269fa7-…`) only — added 2026-05-11. After this addition the squad has 11 members and Grace has 10 `assistantDestinations`. Routing rules live in Grace's Rule 9: **Mechanism E** = Spanish, **Mechanism F** = Existing-Quote, **Mechanism G** = Service. The generic EN live-agent (`BR Live Agent Proxy` → `+18775131573`) survives as **Mechanism B**, narrowed to Sales-branch confusion fallback / explicit live-agent inside Sales / direct-dial `pending` entries.

Deploy scripts: [scripts/create-tool-transfer-to-spanish-team.js](scripts/create-tool-transfer-to-spanish-team.js), [scripts/create-tool-transfer-to-existing-quote-team.js](scripts/create-tool-transfer-to-existing-quote-team.js), [scripts/create-tool-transfer-to-service-team.js](scripts/create-tool-transfer-to-service-team.js), [scripts/create-br-routing-proxies.js](scripts/create-br-routing-proxies.js), [scripts/update-squad-add-routing-proxies.js](scripts/update-squad-add-routing-proxies.js).

#### Test Dispatcher — Single-number multiplexer for testing ✅ active
- **Assistant ID:** `753657c6-3ed4-487c-8c39-1f65fa4f8287`
- **Squad ID:** `2ae25a8b-6ff0-49db-abfc-197b751f533a` (Test Squad — Sales EN (all sites))
- **Version:** v1.0
- **Config:** `agents/test-dispatcher/`
- **Deploy scripts:** `scripts/create-dispatcher.js`, `scripts/create-squad-test.js`
- **Role:** Level 1 router that asks the caller which site to test (FB / CL / BR), then hands off to the matching receptionist. Lets John test all three sales flows from a single number.
- **Hierarchy (3 levels):**
  - Level 1: Test Dispatcher (routes to receptionists only)
  - Level 2: Emma / Olivia / Grace (route to specialists OR to their site-specific live-agent proxy)
  - Level 3: Jennifer / Sarah / Nora / Rachel / Wendy / 3 Live Agent Proxies (terminal)
- **Squad members (12):** Dispatcher + Emma + Olivia + Grace + Jennifer + Sarah + Nora + Rachel + Wendy + FB/CL/BR Live Agent Proxies
- **Phone number attached:** `+18884356365` (Toll Free - Farmer's Brown) — attached to `squadId`, not `assistantId`. Required for assistantDestinations handoffs to work.

#### Emma — Farmer Brown Receptionist (EN Service) ✅ active
- **Assistant ID:** `a1720268-a855-410e-bb7f-687910995dba`
- **Squad ID:** `05d75043-5f37-4d46-8225-9a95d1cbb7c3` (Farmer Brown — Service EN Squad)
- **Version:** v1.1
- **Config:** `agents/receptionist-farmerbrown-service/`
- **Deploy scripts:** `scripts/create-receptionist-fb-service.js`, `scripts/update-receptionist-fb-service.js`, `scripts/create-squad-fb-service.js`
- **Line:** farmerbrown.com English Service
- **Flow:** Triage (Payment / Claim / COI / Sales-misroute) + inline 6-step COI flow (policyholder → additional insured → endorsements → contact → expedited-with-review quid-pro-quo → H&A cross-sell with SMS app). No L3 handoff — COI runs entirely inside Emma Service.
- **Squad members (2):** Emma Service + FB Live Agent Proxy
- **Tools:** none — same pattern as Sales v1.8+; every transfer is a squad destination
- **Pending backends:** `send_review_sms`, `send_home_auto_application_sms`, `send_urgent_coi_alert`, `submit_coi_form` — all deferred to Tyler (see `docs/client-notes-pending.md`). V1 speaks the promises in future tense per Rule 12, without tool calls.

#### Olivia — Contractors Liability Receptionist (EN Service) ✅ active
- **Assistant ID:** `e4597689-cf8c-4801-96af-302bdbc0eb2a`
- **Squad ID:** `f80194e9-3989-4b18-b058-161b37ba5e22` (Contractors Liability — Service EN Squad)
- **Version:** v1.1
- **Config:** `agents/receptionist-contractorsliability-service/`
- **Deploy scripts:** `scripts/create-receptionist-cl-service.js`, `scripts/update-receptionist-cl-service.js`, `scripts/create-squad-cl-service.js`
- **Line:** contractorsliability.com English Service
- **Flow:** Mirrors Emma Service with CL branding.
- **Squad members (2):** Olivia Service + CL Live Agent Proxy
- **Tools:** none

#### Grace — Builders Risk Receptionist (EN Service) ✅ active
- **Assistant ID:** `9f4ae2af-1286-41e6-894c-c09fd3d7d6c3`
- **Squad ID:** `64e52ce6-64e7-4ea9-9cc3-6ae4478fba65` (Builders Risk — Service EN Squad)
- **Version:** v1.1
- **Config:** `agents/receptionist-buildersrisk-service/`
- **Deploy scripts:** `scripts/create-receptionist-br-service.js`, `scripts/update-receptionist-br-service.js`, `scripts/create-squad-br-service.js`
- **Line:** buildersrisk.net English Service
- **Flow:** Mirrors Emma Service with BR branding.
- **Squad members (2):** Grace Service + BR Live Agent Proxy
- **Tools:** none

#### Test Dispatcher Service — Single-number multiplexer for testing ✅ active
- **Assistant ID:** `e8a656cf-3017-4b3b-9dd7-78d8e85186ad`
- **Squad ID:** `d989f711-a436-421d-a3c8-ce06b570ad40` (Test Squad — Service EN (all sites))
- **Version:** v1.0
- **Config:** `agents/test-dispatcher-service/`
- **Deploy scripts:** `scripts/create-dispatcher-service.js`, `scripts/create-squad-test-service.js`
- **Role:** Parallel to the Sales Test Dispatcher — routes test calls to Emma / Olivia / Grace Service.
- **Squad members (7):** Dispatcher Service + Emma Service + Olivia Service + Grace Service + FB/CL/BR Live Agent Proxies
- **Phone number:** to be attached by user (separate number from the Sales test line)

#### Pending receptionists
- ES variants — "¿Ventas o servicio?" + Spanish flow mirroring EN

### Sarah — General Liability (contractorsliability.com)
- **Assistant ID:** `1364ed31-51fa-41a4-8831-491b2ee3ef77` (reused from Sarah BR)
- **Version:** v1.1
- **Config:** `agents/sarah-general-liability/`
- **Deploy script:** `scripts/update-sarah-gl.js`
- **Voice ID:** `Ne7VRnu9eE7lobTDr8Pw` (same as Jennifer, pending new voice)
- **Website:** https://contractorsliability.com/
- **Quote engine:** `POST https://farmerbrown.calforce.pro/api/submit` (ISC + BTIS carriers, real-time pricing)
- **Key features:**
  - Instant quotes from ISC and BTIS carriers via /api/submit
  - Collects contractor business profile (type of work, gross receipts, work mix percentages)
  - Presents best price with payment plan options
  - Falls back to agent review when no carrier matches

### Valeria — General Liability Spanish (contractorsliability.com)
- **Assistant ID:** `18902649-ea31-4782-a653-601a0c07a5e3`
- **Version:** v1.0
- **Config:** `agents/valeria-gl-spanish/`
- **Deploy script:** `scripts/create-valeria.js`
- **Voice ID:** `bYkIyYTEAnSXau3SD2ED` (Colombian Spanish female)
- **Website:** https://contractorsliability.com/
- **Same as Sarah GL but entirely in Spanish** (Latin American)
- **Transcriber:** Deepgram nova-2, language: es
- **Locale:** "es" in API submissions

### Nora — Commercial Auto (cross-site)
- **Assistant ID:** `d1055f89-7175-4a51-8f03-a3332d1764ff`
- **Version:** v1.0
- **Config:** `agents/nora-commercial-auto/`
- **Deploy script:** `scripts/create-nora.js`
- **Voice ID:** `Ne7VRnu9eE7lobTDr8Pw` (placeholder — TODO: distinctive Nora voice)
- **Role:** Data-collection agent for commercial auto quotes. NO quote engine — transfers to licensed agent at the end for pricing + binding.
- **Flow:** 16 data points (name, business, contact, addresses, fleet size, use, radius, mileage, GPS, current insurance, loss history, claims, need-by date) → cross-sell personal → SMS heads-up for VINs/DLs → transfer to live agent
- **Tool:** `transfer_to_live_agent_farmer_brown` (default — cross-site limitation, see tools.md)
- **Not yet built:** `submit_commercial_auto_form` (pending backend endpoint), SMS follow-up trigger
- **Squad integration:** ✅ wired into all 3 sales squads (Emma/Olivia/Grace) and Test Squad. When a caller picks Commercial Auto, the receptionist hands off to Nora.

### Rachel — Home & Auto (cross-site intake)
- **Assistant ID:** `b4957315-f53f-4296-9ca6-58748f4a4041`
- **Version:** v2.4
- **Config:** `agents/rachel-home-auto/`
- **Deploy scripts:** `scripts/create-rachel.js`, `scripts/update-rachel.js` (rewritten 2026-05-08 with the Wendy-pattern auto-discover-squads logic — co-PATCHes all 5 squads referencing Rachel by name in one transaction)
- **Website:** https://farmerbrown.com/ (primary) — also reachable from contractorsliability.com and buildersrisk.net via their receptionists
- **Role:** Short-flow intake. Qualifies Home / Auto / Both, collects name + phone + email (+ property address if Home/Both), then books directly on the Home & Auto team's Calendly during the call. v2.4 (2026-05-08) replaces all caller-facing mentions of "Angie" with neutral wording ("one of our agents", "our team") because both Angie and Andrés handle these calls.
- **Tools (4):** `check_availability_angie`, `book_appointment_angie`, `transfer_to_home_auto_team` (scheduling fallback — NEW v2.4), `transfer_to_live_agent_farmer_brown` (confusion fallback only). Cross-site transfer limitation applies — see `docs/squads-and-handoffs.md` §6.
- **Pending:** `send_home_auto_application` (SMS/email sender, pending backend); round-robin Calendly event_type for Angie + Andrés (`check_availability_angie` / `book_appointment_angie` still pin to Angie's slots until that ships).
- **Squad integration:** ✅ wired into all 3 sales squads (Emma/Olivia/Grace) + BR Unified Squad + Test Squad — 5 squads total. The new `update-rachel.js` co-PATCHes all of them on every version bump.

### Wendy — Workers' Compensation (cross-site)
- **Assistant ID:** `bc789a3e-9e2b-4c60-9778-9e33d0cd826d`
- **Version:** v2.0 (full redesign 2026-05-06 per John's new spec)
- **Config:** `agents/wendy-workers-comp/`
- **Deploy scripts:** `scripts/create-wendy.js`, `scripts/update-wendy.js` (auto-discovers all squads referencing Wendy by name and co-PATCHes them — currently 5: BR Unified, Test, BR Sales EN, CL Sales EN, FB Sales EN)
- **Role:** Collect WC quote data via a 12-question underwriting interview + flash **$1280** quote for the "zero employees you withhold taxes on" path + book an appointment via Calendly round-robin. All other callers (any withholding employees) skip the flash quote and go straight to appointment (manual underwriting).
- **Flow (v2.0):** 5 demographics (name, business, phone, email, address — no annual revenue) → 12 underwriting Qs (entity type → FEIN/SSN → withholding-employees Y/N (KEY) → 1099 sub payments → 1099 sub COI requirement → withholding-employees payroll → work type → owner inclusion → need-by date → contract Y/N → cross-sell list {GL, CA, Umbrella, Pollution, Professional} — always asked) → quote decision → Calendly round-robin booking → standard appointment close.
- **Flash-quote trigger (v2.0):** Q3 = NO (zero employees you withhold taxes on) → **$1280** flat. Any YES → appointment-only. Per John's literal text the rate is purely indexed on withholding-employee count; **owner inclusion is captured but does NOT gate the flash in v2.0** (was a v1.0 condition). If wrong, easy to flip back.
- **Wording rule:** never say "941 employees" — speak as "employees you withhold taxes on" everywhere (per John's clarification).
- **Tools:** `check_availability`, `book_appointment` (both round-robin), `transfer_to_live_agent_farmer_brown` (fallback only). Cross-site transfer limitation applies — see `docs/squads-and-handoffs.md` §6.
- **Not yet built:** `submit_wc_form` (pending backend endpoint). WC intake data lives in the call transcript only. When the tool ships, wire 4 progressive checkpoints: CP1 after demographics, CP2 after Q3 (withholding Y/N), CP3 after Q11 (full payload), CP4 after `book_appointment`.
- **Pending: Spanish PPC routing.** Per John (2026-05-06), Spanish PPC calls should route to a new Spanish team with a new phone number — pending. v2.0 falls back to the EN live-agent line for Spanish callers via Rule 14. When the number arrives, decide between (a) building a Wendy ES Spanish-language assistant, or (b) adding a `transfer_to_spanish_ppc_team` SIP transfer tool.
- **Squad integration:** ✅ wired into all 3 sales squads (Emma/Olivia/Grace) and Test Squad. When a caller picks Workers' Comp, the receptionist hands off to Wendy.

### Sarah — Builders Risk (original, ARCHIVED — replaced by GL above)
- **Assistant ID:** `1364ed31-51fa-41a4-8831-491b2ee3ef77` (now used by Sarah GL)
- **Version:** v1.4 (final)
- **Config:** `agents/sarah-builders-risk/` (preserved for reference)
- **Deploy script:** `scripts/create-assistant.js`

### Jennifer — Builders Risk (active builders risk agent)
- **Assistant ID:** `273d2d5a-27e0-40aa-b817-76a51d1c302d`
- **Version:** v2.8
- **Config:** `agents/jennifer-builders-risk/`
- **Deploy scripts:** `scripts/create-jennifer.js`, `scripts/update-jennifer.js`
- **Required toolIds (4):** `submit_quote`, `check_availability` (round-robin), `book_appointment` (round-robin), `transfer_to_live_agent_builders_risk`. The deploy script enforces these — stripping any breaks the line silently (line answers, no data persists, scheduling branch dies). See changelog entry v2.8.
- **Squad reference:** lives in BR Unified Squad `a3269fa7-6229-4bed-817a-c4684878a600` as `members[0].assistantDestinations[0]` (referenced by `assistantName` string). The `update-jennifer.js` script co-PATCHes this string when the version bumps — never rename Jennifer without it.
- **Improvements over Sarah:**
  - Progressive data capture (8 checkpoints vs 4) — sends data after Q2, Q3, Q4, Q7, Q11, Q15, end of call, and before transfer
  - Silent tool execution — no "give me a moment" or "just a sec" when calling submit_quote
  - Proper `transferCall` tool for live agent handoff (Sarah had it only in the prompt)

## Global VAPI Tools (shared by all agents)

| Tool | ID | Type | Endpoint |
|------|----|------|----------|
| `submit_quote` | `da21631c-4ba2-4b41-9c06-cb7ffc1c8428` | apiRequest | PATCH `https://farmerbrown-bi.calforce.pro/api/builders_risk_submissions/update_by_email` |
| `submit_gl_form` | `5d723598-1699-4ec9-96aa-a9d3e645f424` | apiRequest | POST `https://farmerbrown.calforce.pro/api/submit` |
| `submit_home_quote` | TBD | apiRequest | PATCH `https://farmerbrown-bi.calforce.pro/api/home_submissions/update_by_email` |
| `check_availability` | `dd2504ab-c665-493f-915d-345b0696017f` | apiRequest | GET `https://farmerbrown-bi.calforce.pro/api/calendly/available_times` (round-robin) |
| `book_appointment` | `642280ea-5ea0-4d1e-a7fe-35439016de10` | apiRequest | POST `https://farmerbrown-bi.calforce.pro/api/calendly/book_event` (round-robin) |
| `check_availability_angie` | `253df17f-2b43-4880-ad51-d5a3f2a4e655` | apiRequest | GET same URL + `&event_type_uuid=901112a8-…` (Angie only) |
| `book_appointment_angie` | `35ff8b09-0a1f-4694-adb7-208f2a893434` | apiRequest | POST same URL + `&event_type_uuid=901112a8-…` (Angie only) |
| `transfer_to_live_agent_farmer_brown` | `75d7c8f3-646e-4b44-9629-2baa2a2d81dd` | transferCall | SIP transfer to +18889730016 (Farmer Brown live-agent line) |
| `transfer_to_live_agent_contractors_liability` | `05bc12e6-ee8a-44cf-8abd-816244480509` | transferCall | SIP transfer to +18889730016 (Contractors Liability live-agent line) |
| `transfer_to_live_agent_builders_risk` | `7eb304a7-ee98-4076-be2f-2d1c5fd6645e` | transferCall | SIP transfer to +18775131573 (BuildersRisk.Net live-agent line) |
| `transfer_to_home_auto_team` | `152b99c4-9461-4c3f-831f-fd02af9d3c7f` | transferCall | SIP transfer to +18339024483 (Home & Auto team direct line — Angie + Andrés). Used by Rachel as scheduling fallback. |
| `transfer_to_specific_person` | `b7c4167b-91da-4a96-ae1f-8a3cfb572a57` | transferCall | Multi-destination tool — one destination per directory entry with `Direct-dial? = yes`. 19 destinations as of 2026-05-11 (Pedro Neumann re-added in v1.22). Each is a raw E.164 DID, no PBX/extension. Held by `BR Direct-Dial Proxy v1.0`, not directly by any receptionist. **Requires `function.parameters.destination` (string enum) so the LLM can specify the destination** — without it VAPI silently defaults to destinations[0] (Gustavo). Bug found 2026-05-11. Name→number mapping is embedded in `function.description` so the LLM can pick correctly. Edit the `DESTINATIONS` array in `scripts/create-tool-transfer-to-specific-person.js` and re-run (idempotent) to add/remove. |
| `transfer_to_spanish_team` | `b432ef17-e76f-409f-a755-db140c31aa28` | transferCall | SIP transfer to +18332160350 (dedicated Spanish-speaking team line). Held by `BR Spanish Proxy v1.0`. Used by Grace v1.22+ for Spanish callers. |
| `transfer_to_existing_quote_team` | `a1644cf7-9fae-4ccb-9ae0-bff4b84554ea` | transferCall | SIP transfer to +17262038542 (dedicated existing-quote team — hot leads, 5x more valuable than service). Held by `BR Existing-Quote Proxy v1.0`. Used by Grace v1.22+ for callers following up on a quote we already sent. |
| `transfer_to_service_team` | `a589dc49-f053-459a-9162-9d18b7d37e9e` | transferCall | SIP transfer to +17262046968 (dedicated service team line). Held by `BR Service Proxy v1.0`. Used by Grace v1.22+ for Payment/Claim/Other-service intents and explicit "live agent" inside the Service branch. |

**Deleted tools:** `log_lead_to_sheet` and `log_lead_to_sheet_v2` (Google Sheets — replaced by submit_quote API)

## APIs

### Calendly (scheduling)
- **Base URL:** `https://farmerbrown-bi.calforce.pro/api`
- **API Key:** `agent_api_key=${CALFORCE_AGENT_KEY}` (query param)
- **Docs:** `apis/calendly-api.md`
- **Endpoints:** timezones, available_times, book_event

### Builders Risk (quote submission)
- **URL:** `https://farmerbrown-bi.calforce.pro/api/builders_risk_submissions/update_by_email`
- **Method:** PATCH (upsert by email)
- **Auth:** `agent_api_key=${CALFORCE_AGENT_KEY}` (query param)
- **Docs:** `apis/builders-risk-api.md`
- **Premium formula:** `(coverage × constructionRate × deductibleMod × 1.15) × 1.30`

### General Liability (quote submission) — PENDING backend
- **URL:** `https://farmerbrown-bi.calforce.pro/api/gl_submissions/update_by_email`
- **Method:** PATCH (upsert by email)
- **Auth:** `agent_api_key=${CALFORCE_AGENT_KEY}` (query param)
- **Docs:** `apis/gl-submissions-api.md`
- **No premium formula** — GL requires manual underwriting by licensed agent

## Project Structure
```
agents/
  sarah-builders-risk/     # Original BR agent (archived)
  jennifer-builders-risk/  # Active BR agent (improved)
  sarah-general-liability/ # GL agent for contractorsliability.com
  rachel-home-auto/        # Home & Auto agent for farmerbrown.com
  valeria-gl-spanish/      # GL agent in Spanish for contractorsliability.com
apis/                      # API documentation
docs/                      # Call flows and architecture
  call-center-architecture.md  # Full call center architecture (v3)
scripts/                   # VAPI deployment scripts
index.html                 # Voice designer web tool
```

## Voice
- **L2 receptionist voice (Emma/Olivia/Grace):** `WlKo88ukhZlZ4fjsOQFI` (ElevenLabs)
- **L3 specialist voice (Jennifer/Sarah/Nora/Rachel/Wendy + 3 live-agent proxies):** `Ne7VRnu9eE7lobTDr8Pw` (ElevenLabs)
- **Spanish voice (Valeria):** `bYkIyYTEAnSXau3SD2ED`
- **Voice designer:** Open `index.html` to create/preview new voices

## Conventions
- Agent config lives in `agents/{name}/` with: `system-prompt.md`, `first-message.md`, `tools.md`
- Versions tracked in `agents/{name}/versions/`
- Deploy scripts in `scripts/create-{name}.js`
- Tools are global in VAPI (shared across agents) — reference by ID, not inline
- Language: agents speak English, project communication in Spanish
