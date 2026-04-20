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
- **API Key:** `7ce0a320-9cbf-4d1c-9c5a-d00dfcace63c`
- **Org ID:** `198209e2-169f-46ac-af2e-1e409ca93de3`

## Call Center Architecture
Full architecture documented in `docs/call-center-architecture.md`.
- 9 phone numbers total: 3 per site (EN Sales / EN Service / ES combined)
- Central receptionist agent routes to specialist agents or live agents
- Cross-sell present on all calls except Home & Auto
- Fallback: agent confusion → always transfer to live agent

## Agents

### Receptionist — Central Router
One receptionist per phone line (9 total across 3 sites × 3 lines). Each line = its own Squad. See `docs/call-center-architecture.md`.

**Status:** V1 deployed for farmerbrown.com EN Sales only. Other lines pending.

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
| BR Live Agent Proxy | `180a9367-df40-4e46-91c8-a28b13901e53` | `BR Live Agent Handoff v1.0` | +18779600221 |

Deploy script: [scripts/create-live-agent-proxies.js](scripts/create-live-agent-proxies.js)

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

#### Pending receptionists (same pattern, different first message + menu)
- Emma / Olivia / Grace EN Service variants — service branch: COI flow + payment/claim transfers
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
- **Version:** v2.3
- **Config:** `agents/rachel-home-auto/`
- **Deploy scripts:** `scripts/create-rachel.js`, `scripts/update-rachel.js`
- **Website:** https://farmerbrown.com/ (primary) — also reachable from contractorsliability.com and buildersrisk.net via their receptionists
- **Role:** Short-flow intake. Qualifies Home / Auto / Both, collects name + phone + email (+ property address if Home/Both), then books directly on Angie's Calendly during the call. Transfers to live agent only as fallback.
- **Tools:** `check_availability_angie`, `book_appointment_angie`, `transfer_to_live_agent_farmer_brown` (fallback only). Cross-site transfer limitation applies — see `docs/squads-and-handoffs.md` §6.
- **Not yet built:** `send_home_auto_application` (SMS/email sender, pending backend). Rachel still says "I'll send you an application" verbally — will wire the real tool when the endpoint ships.
- **Squad integration:** ✅ wired into all 3 sales squads (Emma/Olivia/Grace) and Test Squad. When a caller picks Home & Auto, the receptionist hands off to Rachel.

### Wendy — Workers' Compensation (cross-site)
- **Assistant ID:** `bc789a3e-9e2b-4c60-9778-9e33d0cd826d`
- **Version:** v1.0
- **Config:** `agents/wendy-workers-comp/`
- **Deploy scripts:** `scripts/create-wendy.js`, `scripts/update-wendy.js`
- **Role:** Collect WC quote data + flash $1465 quote for the ~90% no-payroll path + book an appointment via Calendly round-robin. With-payroll callers skip the flash quote and go straight to appointment (manual underwriting).
- **Flow:** 6 demographics → payroll branch (no payroll → subs-with-COI question; yes payroll → 7-question sub-flow including embedded GL/CA/umbrella cross-sell if contract) → quote decision → Calendly round-robin booking → standard appointment close.
- **Heuristic:** Per client: ~90% of WC policies sold are no-payroll / no-owner-included → $1465 flat. Any other case (payroll, owner included) → appointment-only, no flash quote.
- **Tools:** `check_availability`, `book_appointment` (both round-robin), `transfer_to_live_agent_farmer_brown` (fallback only). Cross-site transfer limitation applies — see `docs/squads-and-handoffs.md` §6.
- **Not yet built:** `submit_wc_form` (pending backend endpoint). WC intake data lives in the call transcript only.
- **Squad integration:** ✅ wired into all 3 sales squads (Emma/Olivia/Grace) and Test Squad. When a caller picks Workers' Comp, the receptionist hands off to Wendy.

### Sarah — Builders Risk (original, ARCHIVED — replaced by GL above)
- **Assistant ID:** `1364ed31-51fa-41a4-8831-491b2ee3ef77` (now used by Sarah GL)
- **Version:** v1.4 (final)
- **Config:** `agents/sarah-builders-risk/` (preserved for reference)
- **Deploy script:** `scripts/create-assistant.js`

### Jennifer — Builders Risk (active builders risk agent)
- **Assistant ID:** `273d2d5a-27e0-40aa-b817-76a51d1c302d`
- **Version:** v2.2
- **Config:** `agents/jennifer-builders-risk/`
- **Deploy script:** `scripts/create-jennifer.js`
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
| `transfer_to_live_agent_builders_risk` | `7eb304a7-ee98-4076-be2f-2d1c5fd6645e` | transferCall | SIP transfer to +18779600221 (BuildersRisk.Net live-agent line) |

**Deleted tools:** `log_lead_to_sheet` and `log_lead_to_sheet_v2` (Google Sheets — replaced by submit_quote API)

## APIs

### Calendly (scheduling)
- **Base URL:** `https://farmerbrown-bi.calforce.pro/api`
- **API Key:** `agent_api_key=3a8c4681-8dbe-4cdb-a8fb-20477cfdef88` (query param)
- **Docs:** `apis/calendly-api.md`
- **Endpoints:** timezones, available_times, book_event

### Builders Risk (quote submission)
- **URL:** `https://farmerbrown-bi.calforce.pro/api/builders_risk_submissions/update_by_email`
- **Method:** PATCH (upsert by email)
- **Auth:** `agent_api_key=3a8c4681-8dbe-4cdb-a8fb-20477cfdef88` (query param)
- **Docs:** `apis/builders-risk-api.md`
- **Premium formula:** `(coverage × constructionRate × deductibleMod × 1.15) × 1.30`

### General Liability (quote submission) — PENDING backend
- **URL:** `https://farmerbrown-bi.calforce.pro/api/gl_submissions/update_by_email`
- **Method:** PATCH (upsert by email)
- **Auth:** `agent_api_key=3a8c4681-8dbe-4cdb-a8fb-20477cfdef88` (query param)
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
