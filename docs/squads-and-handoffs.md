# Squads & Handoffs — Implementation Reference
**Version:** 1.2
**Last updated:** 2026-04-20
**Status:** English Sales (3 sites) + English Service (3 sites) deployed. Spanish variants pending.

This document describes how the multi-agent call center is wired together in VAPI. It is the authoritative reference for the squad architecture, the deployed assistants, the transfer tools, and the conventions for adding new agents or lines.

For the product-level architecture (call flows, routing logic, first questions per line), see [`call-center-architecture.md`](call-center-architecture.md).

---

## 1. The 3-level hierarchy

Every call follows the same mental model: caller enters at **Level 1**, moves to **Level 2** when the product is known, and ends at **Level 3** where quote data is collected or the agent closes.

| Level | Role | Deployed agents |
|-------|------|-----------------|
| **L1** | Entry point — routes by site or by tester choice | Test Dispatcher (test only) |
| **L2** | Receptionist — asks "new vs existing quote", then routes by product | Emma (FB), Olivia (CL), Grace (BR) |
| **L3** | Specialist — collects data for one specific product | Jennifer (BR), Sarah (GL), Nora (CA), Rachel (H&A intake) |
| **L3ᴴ** | Human agent — closes the deal | SIP transfer to live line |

**Rule:** L1 only routes to L2, and L2 only routes to L3 (or to human). Specialists are terminal — they never route sideways.

During the test flow, L1 is the Test Dispatcher. In production, L1 does not exist — each phone number goes straight into the appropriate L2 agent.

---

## 2. Handoff mechanism

VAPI has native assistant-to-assistant handoff via **Squads**. A squad is a collection of assistants that can transfer a call between themselves without hanging up. The caller hears the handoff message, then seamlessly continues with the next agent on the same call.

### How VAPI wires it up

When an assistant is a member of a squad with `assistantDestinations[]`, VAPI automatically injects a handoff capability into that assistant's runtime — the LLM sees an implicit "transfer to X" tool for each destination. The `description` field tells the LLM when to call it. The `message` field is what the current agent says aloud before the handoff.

**You do NOT need to define handoff tools in the assistant's `toolIds`.** The only thing the assistant explicitly declares in its tools is the SIP transfer to a human (e.g. `transfer_to_live_agent_farmer_brown`).

⚠️ **But the PROMPT must still spell out the handoff mechanics.** If the assistant has any explicit `transferCall`-type tool (like `transfer_to_live_agent_*`) **and** squad destinations at the same time, the LLM will almost always pick the explicit named tool by default — even when the routing should go to a specialist. The prompt must therefore say, for each specialist hand-off script, `→ Call transferCall with destination: "<exact assistant name>"` and explicitly forbid `transfer_to_live_agent_*` on that path. See `agents/receptionist-farmerbrown-sales/system-prompt.md` Rule 9 for the pattern. (This was discovered the hard way on 2026-04-17 — 36 consecutive test calls all routed to live agent instead of the specialists before the fix landed in v1.5 / v1.3 / v1.3 of the three receptionists.)

### Minimum squad member shape

```json
{
  "assistantId": "<uuid>",
  "assistantDestinations": [
    {
      "type": "assistant",
      "assistantName": "<exact VAPI name of target assistant>",
      "message": "Spoken line before the handoff — natural, human.",
      "description": "When the LLM should trigger this handoff."
    }
  ]
}
```

**Important:** `assistantName` must match the target's `name` field in VAPI **exactly**, character-for-character (including version suffix). If you rename an assistant, every squad that references it must be updated. Use `scripts/update-squads-add-nora.js` as a template.

### Terminal members (L3 specialists)

Specialists do not need `assistantDestinations` inside a squad — they are endpoints. They appear as plain `{ "assistantId": "<uuid>" }` entries.

---

## 3. Deployed squads

All four squads below are live in the Farmer Brown org (`198209e2-169f-46ac-af2e-1e409ca93de3`).

### 3.1 Farmer Brown — Sales EN Squad
- **Squad ID:** `5cf7afbf-cee7-45cd-8fa1-9ff2989d8e28`
- **Line:** farmerbrown.com English Sales (phone TBD — attach in VAPI dashboard)
- **Members (7):**
  - Emma (L2 receptionist) → Jennifer, Sarah, Nora, Rachel, Wendy, FB Live Agent Proxy
  - Jennifer (L3, terminal)
  - Sarah (L3, terminal)
  - Nora (L3, terminal)
  - Rachel (L3, terminal)
  - Wendy (L3, terminal)
  - FB Live Agent Proxy (L3ᴴ proxy, terminal — silent SIP transfer to +18889730016)

### 3.2 Contractors Liability — Sales EN Squad
- **Squad ID:** `3b29fd00-f58a-4282-9cb3-c26c393a7858`
- **Line:** contractorsliability.com English Sales
- **Members (7):**
  - Olivia (L2 receptionist) → Jennifer, Sarah, Nora, Rachel, Wendy, CL Live Agent Proxy
  - Jennifer, Sarah, Nora, Rachel, Wendy (L3, terminal)
  - CL Live Agent Proxy (L3ᴴ proxy — silent SIP transfer to +18889730016)

### 3.3 Builders Risk — Sales EN Squad
- **Squad ID:** `ab53f568-82bf-439f-8fda-d04070864632`
- **Line:** buildersrisk.net English Sales
- **Members (7):**
  - Grace (L2 receptionist) → Jennifer, Sarah, Nora, Rachel, Wendy, BR Live Agent Proxy
  - Jennifer, Sarah, Nora, Rachel, Wendy (L3, terminal)
  - BR Live Agent Proxy (L3ᴴ proxy — silent SIP transfer to +18779600221)
- **Special:** Grace has a **two-step menu** — on "new quote" she asks "Builder's Risk or something else?" because BR is the default on this line. Only if "something else" does she read the alternate product menu (GL, Commercial Auto, Home & Auto, Workers' Comp). The `assistantDestinations` descriptions reflect this.

### 3.4 Test Squad — Sales EN (all sites)
- **Squad ID:** `2ae25a8b-6ff0-49db-abfc-197b751f533a`
- **Phone number attached:** `+18884356365` — bound to the `squadId` (NOT the assistantId — assistantDestinations only fire when the call enters via the Squad)
- **Purpose:** single-number entry point so we don't have to juggle 9 phone numbers during development. Dispatcher asks which site to test and routes accordingly. From L2 onwards, the flow is identical to production.
- **Members (12):**
  - Test Dispatcher (L1) → Emma, Olivia, Grace
  - Emma (L2) → Jennifer, Sarah, Nora, Rachel, Wendy, FB Proxy
  - Olivia (L2) → Jennifer, Sarah, Nora, Rachel, Wendy, CL Proxy
  - Grace (L2) → Jennifer, Sarah, Nora, Rachel, Wendy, BR Proxy (Grace-specific descriptions)
  - Jennifer, Sarah, Nora, Rachel, Wendy (L3, terminal)
  - FB / CL / BR Live Agent Proxies (L3ᴴ, terminal)

**Shared deploy scripts (Sales — all 4 squads):**
- `scripts/create-receptionist-{fb,cl,br}-sales.js`, `scripts/update-receptionist-{fb,cl,br}-sales.js`
- `scripts/create-squad-{fb,cl,br}-sales.js`, `scripts/create-squad-test.js`, `scripts/create-dispatcher.js`
- `scripts/update-squads-add-nora.js` → `update-squads-add-rachel.js` → `update-squads-add-live-agent-proxy.js` → `update-squads-add-wendy.js` (latest state)

### 3.5 Farmer Brown — Service EN Squad
- **Squad ID:** `05d75043-5f37-4d46-8225-9a95d1cbb7c3`
- **Line:** farmerbrown.com English Service
- **Members (2):**
  - Emma Service (L2) → assistantDestinations: [FB Live Agent Handoff v1.0]
  - FB Live Agent Proxy (L3ᴴ, terminal)

### 3.6 Contractors Liability — Service EN Squad
- **Squad ID:** `f80194e9-3989-4b18-b058-161b37ba5e22`
- **Line:** contractorsliability.com English Service
- **Members (2):**
  - Olivia Service (L2) → assistantDestinations: [CL Live Agent Handoff v1.0]
  - CL Live Agent Proxy (L3ᴴ, terminal)

### 3.7 Builders Risk — Service EN Squad
- **Squad ID:** `64e52ce6-64e7-4ea9-9cc3-6ae4478fba65`
- **Line:** buildersrisk.net English Service
- **Members (2):**
  - Grace Service (L2) → assistantDestinations: [BR Live Agent Handoff v1.0]
  - BR Live Agent Proxy (L3ᴴ, terminal)

### 3.8 Test Squad — Service EN (all sites)
- **Squad ID:** `d989f711-a436-421d-a3c8-ce06b570ad40`
- **Phone number attached:** to be provisioned by client (attach to this `squadId`, not to any `assistantId`)
- **Purpose:** parallel to the Sales Test Squad — single-number entry point for testing all three Service flows.
- **Members (7):**
  - Test Dispatcher Service (L1) → Emma Service, Olivia Service, Grace Service
  - Emma Service (L2) → FB Live Agent Proxy
  - Olivia Service (L2) → CL Live Agent Proxy
  - Grace Service (L2) → BR Live Agent Proxy
  - FB / CL / BR Live Agent Proxies (L3ᴴ, terminal)

**Deploy scripts (Service — all 4 squads):**
- `scripts/create-receptionist-{fb,cl,br}-service.js`
- `scripts/create-dispatcher-service.js`
- `scripts/create-squad-{fb,cl,br}-service.js`, `scripts/create-squad-test-service.js`

**Service squad design note:** Unlike the Sales squads (7 members each — L2 receptionist + 5 specialists + live-agent proxy), Service squads have only 2 members. No L3 specialists exist for Service because the COI flow runs inline inside the receptionist. Payment and Claim are direct transfers to the live-agent proxy. See [`call-center-architecture.md`](call-center-architecture.md) §SERVICE Branch for the product-level rationale, and [`superpowers/specs/2026-04-20-service-receptionists-en-design.md`](superpowers/specs/2026-04-20-service-receptionists-en-design.md) §D1 for the architectural decision.

---

## 4. Deployed assistants

All assistants use OpenAI GPT-4o, ElevenLabs voice. Receptionists use Deepgram nova-3, specialists are mixed (nova-2 / nova-3 — being migrated).

### Receptionists (L2)

**Sales:**

| Agent | Site | Assistant ID | VAPI Name | Voice |
|-------|------|--------------|-----------|-------|
| Emma | farmerbrown.com | `71c72af4-b87a-43cb-8f0a-661c3febe8ea` | `Emma — FB Receptionist EN Sales v1.9` | `WlKo88ukhZlZ4fjsOQFI` |
| Olivia | contractorsliability.com | `b5f88994-e045-4996-9f2c-056516e9cf01` | `Olivia — CL Receptionist EN Sales v1.7` | `WlKo88ukhZlZ4fjsOQFI` |
| Grace | buildersrisk.net | `fa2897bb-00ee-4680-af00-0e31abeed228` | `Grace — BR Receptionist EN Sales v1.7` | `WlKo88ukhZlZ4fjsOQFI` |

**Service:**

| Agent | Site | Assistant ID | VAPI Name | Voice |
|-------|------|--------------|-----------|-------|
| Emma Service | farmerbrown.com | `a1720268-a855-410e-bb7f-687910995dba` | `Emma — FB Receptionist EN Service v1.0` | `WlKo88ukhZlZ4fjsOQFI` |
| Olivia Service | contractorsliability.com | `e4597689-cf8c-4801-96af-302bdbc0eb2a` | `Olivia — CL Receptionist EN Service v1.0` | `WlKo88ukhZlZ4fjsOQFI` |
| Grace Service | buildersrisk.net | `9f4ae2af-1286-41e6-894c-c09fd3d7d6c3` | `Grace — BR Receptionist EN Service v1.0` | `WlKo88ukhZlZ4fjsOQFI` |

All six L2 receptionists share the single L2-tier voice, distinct from the L3-tier voice used by specialists (`Ne7VRnu9eE7lobTDr8Pw`) — so callers audibly hear the tier change on handoff. Distinctive voices per individual agent (one-per-assistant) remain a TODO. The L2/L3 voices currently in production actually sound near-identical — see user feedback memory; replacing them is deferred.

**Naming convention:** same first names in Sales and Service (Emma → Emma, Olivia → Olivia, Grace → Grace) so the caller recognizes "the same person" across lines. VAPI `name` uniqueness is preserved via the `Sales` / `Service` suffix in the version string.

### Specialists (L3)

| Agent | Product | Assistant ID | VAPI Name |
|-------|---------|--------------|-----------|
| Jennifer | Builder's Risk | `273d2d5a-27e0-40aa-b817-76a51d1c302d` | `Jennifer — Builders Risk v2.3` |
| Sarah | General Liability | `1364ed31-51fa-41a4-8831-491b2ee3ef77` | `Sarah — GL Quote Agent v1.1` |
| Nora | Commercial Auto | `d1055f89-7175-4a51-8f03-a3332d1764ff` | `Nora — Commercial Auto v1.0` |
| Rachel | Home & Auto (intake) | `b4957315-f53f-4296-9ca6-58748f4a4041` | `Rachel — FB Home & Auto Intake v2.3` |
| Wendy | Workers' Compensation | `bc789a3e-9e2b-4c60-9778-9e33d0cd826d` | `Wendy — Workers' Comp v1.0` |
| Valeria | GL (Spanish) | `18902649-ea31-4782-a653-601a0c07a5e3` | (not yet in any squad) |

### Live Agent Proxies (L3ᴴ — silent SIP transfer assistants, one per site)

| Proxy | Site | Assistant ID | VAPI Name | SIP destination |
|-------|------|--------------|-----------|-----------------|
| FB | farmerbrown.com | `fb1e7022-e4ee-42d1-b1db-0977a4e05aad` | `FB Live Agent Handoff v1.0` | +18889730016 |
| CL | contractorsliability.com | `f06c2ad0-1a21-491d-916d-cbbf09e1118e` | `CL Live Agent Handoff v1.0` | +18889730016 |
| BR | buildersrisk.net | `180a9367-df40-4e46-91c8-a28b13901e53` | `BR Live Agent Handoff v1.0` | +18779600221 |

These proxies exist to work around a VAPI LLM bias: when a receptionist has both `assistantDestinations` (squad handoffs) AND an explicit `transferCall` tool at the same time, the LLM almost always picks the named tool, even when routing should go to a specialist. By moving live-agent escalation into the squad as another `type: "assistant"` destination, every route uses the same implicit `transferCall` and the LLM chooses purely by name/description. See [memory: feedback_vapi_squad_tool_disambiguation](../../.claude/projects/-Users-jose-Developer-farmerbrown/memory/feedback_vapi_squad_tool_disambiguation.md) for the full incident notes.

### Dispatchers (L1, test-only)

| Agent | Scope | Assistant ID | VAPI Name |
|-------|-------|--------------|-----------|
| Test Dispatcher | Sales | `753657c6-3ed4-487c-8c39-1f65fa4f8287` | `Test Dispatcher v1.0` |
| Test Dispatcher Service | Service | `e8a656cf-3017-4b3b-9dd7-78d8e85186ad` | `Test Dispatcher Service v1.0` |

---

## 5. Transfer tools (SIP to human agent)

Each site has its own transfer tool pointing to its dedicated human-agent SIP number. The receptionist of each site carries exactly one of these tools. Specialists share the tools with whichever site they're deployed to first (see [Known limitation](#6-known-limitation--cross-site-specialists) below).

| Tool Name | Tool ID | Site | SIP Destination |
|-----------|---------|------|-----------------|
| `transfer_to_live_agent_farmer_brown` | `75d7c8f3-646e-4b44-9629-2baa2a2d81dd` | farmerbrown.com | +1 (888) 973-0016 |
| `transfer_to_live_agent_contractors_liability` | `05bc12e6-ee8a-44cf-8abd-816244480509` | contractorsliability.com | +1 (888) 973-0016 |
| `transfer_to_live_agent_builders_risk` | `7eb304a7-ee98-4076-be2f-2d1c5fd6645e` | buildersrisk.net | +1 (877) 960-0221 |

### When a receptionist calls the transfer tool

- Existing-quote caller ("winner") → fast-track to human agent to close
- Existing policyholder calling the sales line by mistake
- Product that has no L3 AI specialist yet: (none — all 5 products now have a specialist)
- Caller asks for a person explicitly
- Fallback: confusion, heavy background noise, conversation not progressing after 2 tries

### When an L3 specialist calls the transfer tool

- After collecting all data (Nora always ends this way — no quote engine)
- Caller frustration / confusion fallback
- Jennifer and Sarah also have this tool for the same reasons, plus at the end of their own flows when no carrier match / manual underwriting needed

---

## 6. Known limitation — cross-site specialists

Specialists (Jennifer, Sarah, Nora, Rachel, Wendy) are shared across all three sites' squads but each one carries a **single hard-coded transfer tool**. Today that tool points to the Farmer Brown number, because that's the number used when the specialists were first configured.

**Impact:** if Jennifer is handling a call that originated on buildersrisk.net and needs to transfer to a human, she'll send them to the Farmer Brown human agent line, not the Builders Risk one. Same for Sarah, Nora, Rachel, and Wendy on any site other than FB.

**Solutions to explore (not yet implemented):**

- **A) Separate specialist deployments per site** — create `Jennifer-FB`, `Jennifer-CL`, `Jennifer-BR` as three distinct assistants with three distinct transfer tools. Costs: 3x assistants to maintain, any prompt change has to be pushed to 3 places.
- **B) VAPI squad-level tool overrides** — if VAPI supports overriding tool destinations per squad member, a single Jennifer could carry different transfer tools depending on which squad she's invoked from. Needs research / experimentation.
- **C) Accept it** — if human-agent transfers from specialists are rare, the wrong-number risk may be tolerable short term.

For V1 we've chosen (C) with an explicit flag in `agents/nora-commercial-auto/tools.md`.

---

## 7. How to add a new receptionist / squad

A new site + line combination (e.g. contractorsliability.com **Service** in English) follows this recipe:

1. **Create the agent folder** `agents/receptionist-<site>-<line>/` with `system-prompt.md`, `first-message.md`, `tools.md`.
2. **If the site has a new transfer number**, create a new `transfer_to_live_agent_<site>_<line>` tool in VAPI (POST to `/tool`; see `scripts/update-squads-add-nora.js` and existing tools docs for JSON shape).
3. **Write a `scripts/create-receptionist-<site>-<line>.js`** following the pattern of `create-receptionist-fb-sales.js`. Keep the VAPI `name` under 40 characters.
4. **Deploy the assistant** → capture the returned assistant ID.
5. **Write a `scripts/create-squad-<site>-<line>.js`** with the receptionist as the first member (with `assistantDestinations`) and the relevant L3 specialists as plain members.
6. **Deploy the squad** → capture the returned squad ID.
7. **Update `CLAUDE.md`** and this document with the new IDs.
8. **Attach the phone number** to the new squad in the VAPI dashboard.

For prompt-only edits, a `scripts/update-receptionist-<site>-<line>.js` using PATCH is the lighter-weight pattern (see `update-receptionist-fb-sales.js`).

---

## 8. How to add a new specialist

A new L3 product agent (e.g. Rachel for Home & Auto, or a Workers' Comp agent) follows:

1. **Create the agent folder** `agents/<name>-<product>/` with full config.
2. **Create a `submit_<product>_form` VAPI tool** if the backend endpoint exists. If not, document the pending status in `tools.md` and transfer to human agent at end of flow (Nora pattern).
3. **Write and run a `scripts/create-<name>.js`**.
4. **For each receptionist squad** where this product is now supported:
   - Update the receptionist's `system-prompt.md` — change the routing table row from "transfer to live agent" to "handoff to <Name>".
   - Redeploy the receptionist with its `update-*.js` script.
   - PATCH the squad to add the new specialist as a member and add an entry in the receptionist's `assistantDestinations`. See `scripts/update-squads-add-nora.js` for the pattern.
5. **Test** via the Test Dispatcher before attaching any real phone number.

---

## 9. Testing

Attach any VAPI-provisioned phone number to the Test Squad (`2ae25a8b-6ff0-49db-abfc-197b751f533a`) and call it. The Test Dispatcher greets you, asks which site you want to test, and hands you off to the matching receptionist. The rest of the flow is identical to production — same assistants, same handoffs, same specialists.

For unit-level testing of a single agent in isolation, call the assistant directly from the VAPI dashboard using its Assistant ID.

---

## 10. What's not built yet

- **Spanish variants:** all 3 sites. Pattern: single number that first asks "¿Ventas o servicio?", then mirrors the English flow in Spanish.
- **COI backend endpoints (pending Tyler):** `send_review_sms`, `send_home_auto_application_sms`, `send_urgent_coi_alert`, `submit_coi_form`. Until delivered, Service v1.0 speaks the promises verbally without tool calls — see Rule 12 in the Service receptionists' system prompts. Priority: urgent-alert endpoint first (otherwise expedited COI requests only live in transcripts). Tracked in `docs/client-notes-pending.md`.
- **`submit_wc_form` for Wendy:** not wired — WC intake data (demographics + payroll sub-flow + contract cross-sell list) lives in the call transcript only. When backend endpoint ships, add silent checkpoints at the end of Step 1, Step 3, and before Step 5.
- **Rachel's application sender:** `send_home_auto_application` (SMS / email) pending backend. Rachel still says "I'll send you an application" verbally during Step 4 — when the tool ships, wire a silent call at the top of that step.
- **`submit_commercial_auto_form` backend endpoint:** Nora's data only lives in the call transcript today.
- **`submit_home_quote` for Rachel's short flow:** not wired — contact data lives in the call transcript only.
- **Post-call SMS trigger:** Nora tells callers about the VIN / driver's license SMS, but nothing is actually sent.
- **Distinctive voices per individual agent:** L2/L3 tier split is deployed (receptionists on `WlKo88ukhZlZ4fjsOQFI`, specialists on `Ne7VRnu9eE7lobTDr8Pw`), but within each tier the agents still share one voice. One-voice-per-agent is a further TODO.
- **Cross-site specialist transfer routing:** see section 6. Rachel carries the Farmer Brown transfer tool regardless of which squad the call came from.

---

## 11. Useful VAPI API references

- `POST /assistant` — create
- `PATCH /assistant/{id}` — update
- `GET /assistant/{id}` — verify current state (useful before editing a squad that references it by name)
- `POST /squad` — create
- `PATCH /squad/{id}` — update members (send the full `members[]` array; it's a replace, not a merge)
- `GET /squad/{id}` — verify current state
- `POST /tool` — create a tool (e.g. new site's transfer)
- `PATCH /tool/{id}` — update a tool (renames, destination changes)

Authentication: `Authorization: Bearer <VAPI_KEY>` (see `CLAUDE.md` for the current key).
