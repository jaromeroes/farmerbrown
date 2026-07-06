# Farmer Brown — Call Center Architecture
**Version:** v4.0
**Last updated:** 2026-04-27
**Status:** Target architecture — 3 phone numbers (one per site) with unified per-site receptionists that triage Sales / Service / Spanish at the entry point. Migration from v3.6 (9-number / 6-receptionist model) is pending; v3.6 is still what runs in production today.

> **Implementation note:** this document describes the intended product design. For the current state of what is actually deployed in VAPI (squad IDs, assistant IDs, handoff wiring, deploy scripts), see [`squads-and-handoffs.md`](squads-and-handoffs.md).

> **Migration note (v3.6 → v4.0):** the production deployment as of 2026-04-27 still uses the v3.6 architecture — 9 phone lines (3 per site × EN Sales / EN Service / ES) and 6 receptionists (Emma / Olivia / Grace × Sales + Service). The v4.0 collapse to 3 numbers / 3 receptionists requires (a) decommissioning the EN Service receptionists and folding their flows into a single per-site agent that triages at the entry point, (b) building bilingual triage so the Spanish branch is a sub-flow inside each per-site agent rather than a dedicated number, and (c) re-pointing toll-free numbers in Twilio. This document describes the v4.0 target; the migration steps are tracked separately.

---

## Phone Numbers — 3 total (one per site)

| Site | Toll-Free | Status |
|------|-----------|--------|
| contractorsliability.com | `+1 (888) 435-6365` | Already in VAPI; remains as-is, will host the new unified CL receptionist |
| buildersrisk.net | `+1 (888) 293-4492` | Already in VAPI; remains as-is, will host the new unified BR receptionist |
| farmerbrown.com | `+1 (888) 496-2029` | **New** — repurposed from the legacy "Farmerbrown Builders Risk" toll-free in the master Twilio account (was dormant: 1 call in 90 days, no public listings). Needs to be re-pointed from TwiML Bin to `https://api.vapi.ai/twilio/inbound_call` and renamed to "Toll-Free – FB AI Agent" before going live. |

Optional QA / test number: `+1 (702) 710-8075` (LasVegas Test Phone) currently attached to the Test Dispatcher Squad — keep as a dedicated test gateway separate from the 3 production numbers, or release if not needed.

Language is no longer determined by the inbound number — every site number triages language at the entry point (see "Entry-point triage" below).

---

## Entry-point triage (every site)

Every call lands on the per-site receptionist for that toll-free. The agent's first action is a single triage question that classifies the call into one of three paths: **Sales**, **Service**, or **Spanish**.

**Opening question (English):**
> "Thank you for calling [site name]. Are you looking for a new quote, do you need help with an existing policy, or would you prefer to continue in Spanish?"

| Caller answer | Routes to |
|---------------|-----------|
| New quote / pricing / "I'm shopping" | SALES branch (see below) |
| Existing policy / payment / claim / certificate / change | SERVICE branch (see below) |
| Spanish / "español" | Spanish sub-flow — agent switches to Spanish and re-asks "¿Llama por ventas o por servicio?", then continues into the Sales or Service branch in Spanish |

**Implementation note for Spanish:** the Spanish branch is a sub-flow inside the same per-site receptionist (bilingual agent), not a separate number or a separate receptionist. After the language switch, the same Sales / Service flow content runs translated, and routes to Spanish-capable specialists (Valeria for GL ES, future Spanish equivalents for the other product lines).

**Fallback rule (applies to ALL agents at ALL times):**
If the agent is confused, gets stuck, or cannot handle the request:
> "I'm sorry, I'm having a little trouble with that. Let me connect you with one of our agents right away — one moment please."
→ Transfer to live agent immediately.

**Silence-timeout rule (applies to ALL agents at ALL times, all branches, all conversation steps):**
If the caller goes silent for ~7 seconds at any point in the conversation, the agent proactively offers a live agent rather than waiting indefinitely:
> "Are you still there? Would you like me to connect you with a live agent?"
- If the caller responds and wants to continue with the AI: resume the flow where it stopped.
- If the caller asks for a live agent, doesn't respond again, or sounds frustrated: transfer immediately.
- The 7-second threshold is the target; tune in implementation based on VAPI's silence-detection capabilities.

---

## Receptionist Agent (one per site)

Each site has a single unified receptionist that owns the entry-point triage and the routing into Sales / Service / Spanish flows. The Sales and Service flow content (described in the sections below) is unchanged from v3.6 — what changes is that a single agent now handles all three channels for its site instead of three separate agents per site.

| Site | Receptionist (working name) | Toll-free |
|------|------------------------------|-----------|
| contractorsliability.com | Olivia (unified) | +1 (888) 435-6365 |
| buildersrisk.net | Grace (unified) | +1 (888) 293-4492 |
| farmerbrown.com | Emma (unified) | +1 (888) 496-2029 |

The names Emma / Olivia / Grace are reused from v3.6 to preserve brand familiarity, but each one becomes a single agent (rather than a Sales variant + a Service variant).

---

## SALES Branch

**First question — ALL sites, after the Sales path is selected at triage:**
"Are you looking for a new quote, or do you already have a policy with us?"

| Answer | Action |
|--------|--------|
| Existing policy / existing quote | Transfer to live agent immediately (high priority — "winners") |
| New quote | Continue to coverage question below |

---

### buildersrisk.net — new quote
"Are you calling about Builder's Risk insurance, or something else?"

| Answer | Routes to |
|--------|-----------|
| Builder's Risk | Jennifer ✅ (ext. 227) |
| Something else | Show alternate menu below |

Alternate menu (if "something else"):
1. General Liability → Sarah EN / Valeria ES ✅ (ext. 229)
2. Workers' Compensation → Wendy ✅ (ext. 228)
3. Commercial Auto → Nora ✅ (ext. 221)
4. Home and Auto → Rachel ✅ (Home & Auto flow — see below)

### contractorsliability.com & farmerbrown.com — new quote
"What type of coverage are you looking for?"

1. General Liability → Sarah EN / Valeria ES ✅ (ext. 229)
2. Workers' Compensation → Wendy ✅ (ext. 228)
3. Commercial Auto → Nora ✅ (ext. 221)
4. Builder's Risk → Jennifer ✅ (ext. 227)
5. Home and Auto → Rachel ✅ (Home & Auto flow — see below)

---

## General Liability (Sarah / Valeria) — Buy Now Close
> **Applies to General Liability quotes only** (Contractors Liability product). Does NOT apply to Builder's Risk (Jennifer), Workers' Comp (Wendy), Commercial Auto (Nora), or Home & Auto (Rachel).

After Sarah (EN) or Valeria (ES) delivers the GL premium quote in-call, ask the buy-now question before going into cross-sell or close:

> "Would you like to purchase this policy now and get your policy started with your certificate of insurance right away?"

| Caller answer | Action |
|---|---|
| **Yes** | "Perfect — let me set up an appointment with one of our pros and we will get right on it." → [Calendly API — round-robin] → book appointment with the **`BUY NOW`** priority flag set, so the team knows to call back immediately. Confirm date/time → **Appointment closing** (see global rule below). Skip standard cross-sell; the buy-now appointment supersedes it. |
| **No** | Continue with the standard cross-sell + close. |

**`BUY NOW` flag implementation:** the Calendly booking API call should include a tag, custom field, or note that the assignee can see at a glance — for example, "BUY NOW — caller wants to bind GL policy + COI immediately, callback ASAP". Exact mechanism depends on the Calendly event-type configuration (custom question, default note, or post-booking webhook to a CRM). To be confirmed during implementation.

> **Evolution note (2026-05-19):** John has signaled that the GL post-quote flow will evolve from the Buy Now single-question close into a fuller **Binding Info Stage** with ~22 underwriting/operational questions handed off to a separate specialist (Rebecca). See the next section. The Buy Now Close described above is the current production behaviour; the Binding Info Stage will replace it on GL once Rebecca-GL is built. **Open with John:** whether the "BUY NOW" priority flag on Calendly survives in the Rebecca era (every Rebecca-completed lead is by definition high-intent) or becomes redundant.

---

## Binding Info Stage (post-quote, optional) — Rebecca per product

> **Status (2026-05-19):** New L4 layer being introduced. One specialist per product line (Rebecca-GL first, Rebecca-BR next per John). **Not built yet** — discovery captured in [`binding-stage-discovery.md`](binding-stage-discovery.md); 7 open items pending with John before v1.0 deploy.

After a Specialist (L3) delivers a quote, the Specialist asks a **gate question**:

> *"Would you like to answer a few additional questions to qualify for this price along with monthly payment options?"*

| Caller answer | Action |
|---|---|
| **Yes** | Hand off to the product's Rebecca (squad destination). The Specialist's role ends here. |
| **No** | Specialist closes cordially with a callback offer ("be on the lookout for more quotes in your email, or call [existing-quote line] anytime"). |

**Rebecca-GL (and future Rebecca-BR, Rebecca-CA, etc.)** is a data-collection-only L4 agent that:
1. Collects ~22 binding-info questions (operational exposure, legal/business history, effective date, payment preference).
2. Submits the payload to a new backend endpoint (`submit_binding_info_form` — pending Tyler).
3. Books an appointment with a **service rep** (separate Calendly pool from H&A's Angie/Andrés and from the GL Buy Now appointments — new event-type UUID pending).
4. Speaks John's verbatim closing line: *"Thank you for answering our questions. We will be firming up pricing right away with underwriting and will be emailing you an application to sign within the hour along with your financing options. Please set up an appointment below with one of our service representatives…"*

**Why one Rebecca per product line (not one shared multi-product Rebecca):**
- Token efficiency. VAPI reloads the system prompt every turn; a 22-question Rebecca-GL is far lighter than a multi-line prompt with all 5 products' branches.
- Repo consistency with the Specialist pattern (Jennifer/Sarah/Nora/Wendy/Rachel are each separate agents).
- Independent versioning — John will iterate on binding questions per product without risking regressions in other products.

**Second invocation path — CS forward.** Per John (2026-05-19), CS humans need to be able to forward a caller into Rebecca directly (e.g., a caller who already received a quote in a previous session and is calling back to bind). The implementation requires a public DID assigned to a "Rebecca-GL Sales" squad with only Rebecca + a fallback, so CS can transfer the call there. **Open with John:** whether this is a Twilio forward, a SIP transfer, or a publicly-dialable number.

**Cross-sell on Rebecca: NO** (assumption pending John confirmation). The caller has been on the line long enough by this point and is moving to bind, not to compare.

---

## Home & Auto Flow
> No cross-sell on this flow.

"Are you looking for Home, Auto, or Home and Auto?"  
→ Caller answers  
→ "Perfect! I'll send you an application to fill out. I'd also like to set up an appointment with one of our agents — let me pull up available times for you."  
→ [Calendly API] → book appointment → confirm date/time  
→ **Appointment closing** (see global rule below)

---

## Workers' Compensation Flow
> Cross-sell is embedded in the contract branch (Step 3.7). Standard cross-sell closing is NOT repeated at end.

**Step 1 — Demographics (6 fields, one at a time):**
1. Full name
2. Business name
3. Phone number (confirm `{{customer.number}}` if caller is on it)
4. Email (slow readback, letter by letter)
5. Business address
6. Annual revenue

**Step 2 — Payroll branch (decision point):**
"Do you have any employees that you have on payroll?"
- **No →** "Do you require certificates of insurance from all of your subcontractors, naming you as an additional insured?"
  - No  → Warn verbatim: "Please understand that any subcontractor that does not provide you with a certificate of insurance will be treated as payroll on your workers' compensation." → jump to Step 4.
  - Yes → jump to Step 4.
- **Yes →** continue to Step 3.

**Step 3 — Payroll sub-flow (with-payroll callers only, 7 questions):**
1. "Please describe the work they will be performing — landscaping, plumbing, roofing, etc."
2. "Please tell me the annual payroll."
3. "What's your federal ID, or SSN if you're a sole proprietor?"
4. "Do you want to include yourself, the owner, for workers' comp?"
5. "Do you currently have workers' compensation?"
6. "When do you need coverage by? Right away, a date, or not sure."
7. "Is this for a contract?"
   - **Yes →** *embedded cross-sell*: "Do you also need GL, commercial auto, or commercial umbrella for the contract?" — log the list silently; do NOT transfer, do NOT try to quote those products. The licensed agent follows up in the appointment.
   - **No  →** continue.

**Step 4 — Quote heuristic:**
- **No-payroll path** (Step 2 = No) → flash quote: "Based on your information, your annual workers' compensation premium would be around $1465." (Covers ~90% of small WC policies.)
- **With-payroll path** (Step 2 = Yes) → NO flash quote. Say: "Based on what you've told me, this one's a bit more complex — let me set you up with one of our pros to finalize the pricing."

**Step 5 — Close:**
"Would you like to set up an appointment with one of our pros?"
→ [Calendly API — round-robin] → book appointment → confirm date/time
→ **Appointment closing** (see global rule below)

---

## SERVICE Branch

**First question — ALL sites, after the Service path is selected at triage (closed menu, with explicit live-agent escape):**
"May I help you with certificates of insurance, payments, claims — or you can say 'live agent' anytime."

(The opening greeting "Thank you for calling [site], this is [name]" already happened at triage; the Service branch picks up directly with this menu. **Order matters:** COI is mentioned first because it is the only AI-handled intent — the others all transfer. The explicit "live agent anytime" prompt gives callers an immediate escape hatch.)

The menu is deliberately closed to the 3 AI-handleable intents. If the caller names something outside the menu (cancel, renewal, add vehicle, update address, billing change, etc.), the receptionist acknowledges that it's a valid service request and transfers to a live agent with a specific opener — **not** the confusion fallback, because this is valid intent, just not one the AI can serve.

| Caller intent | Action |
|---|---|
| Certificate of Insurance (COI, cert, additional insured) | AI-handled flow (see below) |
| Payment (pay bill, card expired, autopay) | Transfer to live agent with Payment opener |
| Claim (accident, loss, damage, file a claim) | Transfer to live agent with Claim opener |
| Live agent (caller says "live agent" at any point in the menu) | Transfer to live agent immediately, no menu repeat |
| Other service (cancel, renewal, change coverage, etc.) | Transfer to live agent with "that's not something I can help with directly" opener |
| Sales lead on Service line (new quote, product name) | Transfer to live agent with "sounds like sales" opener |
| Confusion / no progress after 2 attempts | Rule 5 fallback → transfer to live agent |

### Certificate of Insurance (COI) — Conversational Flow

> "I'd be happy to help you with a certificate of insurance. I just need to gather a few details — it'll only take a minute."

**Step 1 — Identify the policyholder**  
"Is the phone number you're calling from the one we have on file for your account?"
- YES: "Perfect, and can you confirm the name of your business?"
- NO: "No problem — what's the name of your business and the phone number we have on file?"

**Step 2 — Additional insured details**  
"I'll need the name and address of the additional insured — that's the person or company that needs to be listed on the certificate. Go ahead whenever you're ready, and if you need a moment to look it up, just let me know."

Collect in order: company or person name → street address → city → state → ZIP

Read back slowly:  
"Let me read that back to you. The additional insured is [name], located at [street address], [city], [state], [zip]. Does that look correct?"  
→ If confirmed: continue  
→ If corrected: fix the specific field, read back again before continuing

**Step 3 — Endorsements**  
"Does the certificate require any special endorsements? I'll go through the most common ones — just say yes, no, or not sure for each."

Ask one by one:
1. "Waiver of subrogation?"
2. "Primary and non-contributory?"
3. "Products and completed operations?"

Confirm at the end:  
"Got it — let me confirm the endorsements: [list confirmed ones, or 'no special endorsements needed']. Is that correct?"  
→ If not sure on any: "No problem — I'll flag it for our team and they'll follow up with you."

**Step 4 — Additional insured contact**  
"Do you have a phone number or email for the additional insured so we can send the certificate directly to them?"

**Step 5 — Turn-around & expedited service**  
"Looks like I have all of your information and our usual turn-around time is 24 hours. Do you need expedited service to get it within 1 hour?"

- **No (24 hours is fine):**  
  "Perfect — we'll have your certificate ready within 24 hours and send it directly to you."  
  → continue to Step 6

- **Yes (expedited):**  
  "OK, we're on it. For expedited service, we simply ask that you give us a review within the hour. Do you agree?"
  - **No:** fall back to 24-hour turn-around → continue to Step 6
  - **Yes:** "Thank you — I'll send you a text with a review link right now."  
    → Send SMS with review link  
    → Send urgent internal alert (see COI Urgent Alert below)  
    → continue to Step 6

**Step 6 — Cross-sell Home & Auto (COI-specific)**  
> COI-only variant of the cross-sell. Does NOT hand off to Rachel — closes the call with an SMS application link. Always asked at end of COI regardless of urgency choice.

"Finally, would you like a quote for your auto, home insurance, or both? Our average client saves over $1,300 a year."

- **No:** close politely ("Thanks for calling — have a great day.").
- **Yes:** "Perfect — I'll send you a text with a quick application. Once we get it back, we'll get right to work!"  
  → Send SMS with Home & Auto application link

### COI Urgent — Internal Alert
When caller opts into expedited service (Step 5 = Yes + review agreed), immediately notify the team with:
- Policyholder name + phone number on file
- Additional insured: name / address / city / state / zip
- Endorsements requested
- Additional insured contact (phone / email if provided)

**Proposed trigger (to decide):**
- Option A: SMS to agent team group number — simplest, no integration needed
- Option B: Email to ops inbox — easy to log and track
- Option C: Slack message to #urgent-coi channel — fastest for internal teams
- Option D: Hawksoft task creation — keeps everything in the CRM
- **Recommendation: B + C** — email (paper trail) + Slack ping (immediate visibility)

---

## Appointment Closing (all agents)
> Use immediately after confirming any appointment, regardless of product or agent.

"So we're all set for your appointment! One of our pros will give you a call — please have your current policy or any other pertinent information handy if possible. We really appreciate the opportunity to compete for your business, and we look forward to speaking with you!"

**Spanish version (Valeria):**  
"¡Perfecto, ya está todo listo para su cita! Uno de nuestros agentes le llamará — por favor tenga a la mano su póliza actual o cualquier información relevante si le es posible. Agradecemos mucho la oportunidad de trabajar con usted, ¡hasta pronto!"

---

## Cross-sell
> Present at the end of ALL calls EXCEPT Home and Auto.

"Before you go — we're a full-service broker representing companies like Progressive and GEICO. We work in all 50 states and our average customer saves over $1,300 a year."

---

## Agent Inventory

> **Note:** Receptionists collapse from 6 (v3.6: Sales + Service variant per site) to 3 (v4.0: one unified per site) once the migration is executed. The table below shows the v4.0 target. The 6 v3.6 receptionists currently in production are listed as "to be merged" — see `squads-and-handoffs.md` for IDs.

| Agent | Language | Status | Extension |
|-------|----------|--------|-----------|
| Emma — Receptionist (farmerbrown.com — unified) | EN + ES (bilingual) | 🔄 to build (merges Emma Sales v1.9 + Emma Service v1.0) | — |
| Olivia — Receptionist (contractorsliability.com — unified) | EN + ES (bilingual) | 🔄 to build (merges Olivia Sales v1.7 + Olivia Service v1.0) | — |
| Grace — Receptionist (buildersrisk.net — unified) | EN + ES (bilingual) | 🔄 to build (merges Grace Sales v1.7 + Grace Service v1.0) | — |
| Test Dispatcher (test-only L1 multiplexer) | EN | ✅ active v1.0 — keep for QA | — |
| Jennifer — Builder's Risk | EN | ✅ active v2.3 | 227 |
| Sarah — General Liability | EN | ✅ active v1.1 | 229 |
| Valeria — General Liability | ES | ✅ active v1.0 (will be wired into the Spanish branch of all 3 unified receptionists) | 229 |
| Nora — Commercial Auto | EN | ✅ active v1.0 | 221 |
| Rachel — Home & Auto (intake) | EN | ✅ active v2.3 — books Angie on Calendly in-call | 223 |
| Wendy — Workers' Compensation | EN | ✅ active v1.0 — flash $1465 for no-payroll path + Calendly round-robin booking | 228 |
| Rebecca — GL Binding Info (L4 post-quote) | EN | 🔵 planning v0.1 — 22-Q underwriting collection + service-rep appointment. See [`binding-stage-discovery.md`](binding-stage-discovery.md). | — |

**Squad deployment status (target v4.0):** 3 production unified squads (one per site) + 1 test squad. The current production has 8 squads (3 sales + 3 service + 2 test) and will be consolidated as part of the migration. See [`squads-and-handoffs.md`](squads-and-handoffs.md) for IDs and member wiring.

**Spanish note:** Spanish becomes a sub-flow inside each unified receptionist (bilingual agent), not a separate set of agents. Specialists called from the Spanish branch must have Spanish equivalents — Sarah (EN) → Valeria (ES) is the existing pattern; the other specialists (Jennifer, Nora, Rachel, Wendy) still need ES variants built.

---

## Voice

Two distinct ElevenLabs voices distinguish role tiers — so a caller being handed off from a receptionist to a specialist audibly hears they are now with a different person (not just a different name).

| Tier | Agents | ElevenLabs voice ID |
|------|--------|---------------------|
| L2 — Receptionists | Emma, Olivia, Grace | `WlKo88ukhZlZ4fjsOQFI` |
| L3 — Specialists + Live Agent Proxies | Jennifer, Sarah, Nora, Rachel, Wendy + FB/CL/BR Live Agent Handoff | `Ne7VRnu9eE7lobTDr8Pw` |
| L4 — Binding Info specialists (planned) | Rebecca-GL (+ future Rebecca-BR / Rebecca-CA / etc.) | `Ne7VRnu9eE7lobTDr8Pw` (same as L3 for v1; consider distinct voice once Rebecca series grows) |
| ES — Spanish specialist | Valeria | `bYkIyYTEAnSXau3SD2ED` |

Distinctive voices per individual agent (separate voice for Emma vs Olivia vs Grace, etc.) remain a known TODO — useful for dashboards and QA review but not critical for caller experience since the L2/L3 split already signals a change of role.

Voice designer: open `index.html` from the repo root to preview new ElevenLabs voices and grab their voice IDs.

---

## Pending Integrations

| Integration | Notes |
|-------------|-------|
| Hawksoft | Final destination for all leads |
| Calendly | Appointment booking for Home & Auto + GL Buy Now (with `BUY NOW` priority flag) |
| Calendly — service rep round-robin (NEW) | For Rebecca-GL binding appointments. Separate event-type UUID from H&A and Buy Now pools. Pending event-type UUID from John. |
| `submit_binding_info_form` endpoint (NEW) | For Rebecca's 22-field underwriting/operational payload. Tyler. Suggested shape in `agents/rebecca-general-liability-binding/tools.md`. |
| COI submit endpoint | Send captured COI data to **certificates@farmerbrown.com** (pending — coordinate with Tyler) |
| COI urgent alert | SMS / email / Slack to ops team (to decide) |
| Review SMS trigger | Sent when COI is flagged as urgent |
| Home & Auto application link | Sent via SMS/email after booking |
| Email sequences | Lead follow-up after each quote type (to define per product) |

## Pending Content

| Item | Notes |
|------|-------|
| Spanish translations | After English implementation is complete |
| COI urgent alert method | Client to decide: SMS / email / Slack / Hawksoft |
| Email sequence copy | To define per product (GL, BR, Auto, etc.) |
