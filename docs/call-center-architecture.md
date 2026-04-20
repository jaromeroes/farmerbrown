# Farmer Brown — Call Center Architecture
**Version:** v3.6
**Last updated:** 2026-04-20
**Status:** English Sales + English Service both deployed across all 3 sites. Spanish variants pending.

> **Implementation note:** this document describes the intended product design. For the current state of what is actually deployed in VAPI (squad IDs, assistant IDs, handoff wiring, deploy scripts), see [`squads-and-handoffs.md`](squads-and-handoffs.md).

---

## Phone Numbers — 9 total (3 per site)

| Site | EN Sales | EN Service | ES (Sales + Service) |
|------|----------|------------|----------------------|
| buildersrisk.net | ✅ | ✅ | ✅ |
| contractorsliability.com | ✅ | ✅ | ✅ |
| farmerbrown.com | ✅ | ✅ | ✅ |

Language is determined by the inbound number — no language detection needed.  
Spanish line is a single number: first question is "¿Llama por ventas o por servicio?"  
After that, the Spanish flow mirrors English exactly, fully translated.

---

## Receptionist Agent (to be named — one per site, 3 variants)

| Inbound line | First action |
|--------------|--------------|
| English Sales | "Are you looking for a new quote, or do you already have a policy with us?" → if new: continue to coverage question → if existing: transfer to live agent |
| English Service | "Thank you for calling [site], this is [name] — are you calling about a payment, a claim, or a certificate of insurance?" → closed-menu triage (see SERVICE Branch) |
| Spanish | "¿Llama por ventas o por servicio?" → then mirrors English |

**Fallback rule (applies to ALL agents at ALL times):**  
If the agent is confused, gets stuck, or cannot handle the request:  
> "I'm sorry, I'm having a little trouble with that. Let me connect you with one of our agents right away — one moment please."  
→ Transfer to live agent immediately.

---

## SALES Branch

**First question — ALL sites, ALL sales lines:**  
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

**First question — ALL sites, ALL service lines (closed menu):**
"Thank you for calling [site], this is [name] — are you calling about a payment, a claim, or a certificate of insurance?"

The menu is deliberately closed to the 3 AI-handleable intents. If the caller names something outside the menu (cancel, renewal, add vehicle, update address, billing change, etc.), the receptionist acknowledges that it's a valid service request and transfers to a live agent with a specific opener — **not** the confusion fallback, because this is valid intent, just not one the AI can serve.

| Caller intent | Action |
|---|---|
| Payment (pay bill, card expired, autopay) | Transfer to live agent with Payment opener |
| Claim (accident, loss, damage, file a claim) | Transfer to live agent with Claim opener |
| Certificate of Insurance (COI, cert, additional insured) | AI-handled flow (see below) |
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

| Agent | Language | Status | Extension |
|-------|----------|--------|-----------|
| Emma — Receptionist (farmerbrown.com Sales) | EN | ✅ active v1.9 | — |
| Olivia — Receptionist (contractorsliability.com Sales) | EN | ✅ active v1.7 | — |
| Grace — Receptionist (buildersrisk.net Sales) | EN | ✅ active v1.7 | — |
| Emma — Receptionist (farmerbrown.com Service) | EN | ✅ active v1.0 | — |
| Olivia — Receptionist (contractorsliability.com Service) | EN | ✅ active v1.0 | — |
| Grace — Receptionist (buildersrisk.net Service) | EN | ✅ active v1.0 | — |
| Receptionists — Spanish variants (all sites) | ES | ❌ to build | — |
| Test Dispatcher — Sales (test-only L1 multiplexer) | EN | ✅ active v1.0 | — |
| Test Dispatcher Service (test-only L1 multiplexer) | EN | ✅ active v1.0 | — |
| Jennifer — Builder's Risk | EN | ✅ active v2.3 | 227 |
| Sarah — General Liability | EN | ✅ active v1.1 | 229 |
| Valeria — General Liability | ES | ✅ active v1.0 (not yet in any squad) | 229 |
| Nora — Commercial Auto | EN | ✅ active v1.0 (wired into all 3 sales squads) | 221 |
| Rachel — Home & Auto (intake) | EN | ✅ active v2.3 — books Angie on Calendly in-call | 223 |
| Wendy — Workers' Compensation | EN | ✅ active v1.0 — flash $1465 for no-payroll path + Calendly round-robin booking | 228 |

**Squad deployment status:** 3 production sales squads + 3 production service squads + 2 test squads (1 Sales, 1 Service). See [`squads-and-handoffs.md`](squads-and-handoffs.md) for IDs and member wiring.

**Spanish note:** All agents need Spanish equivalents. Implementation order: English first, Spanish second. Sarah (EN) → Valeria (ES) is the existing pattern to follow.

---

## Voice

Two distinct ElevenLabs voices distinguish role tiers — so a caller being handed off from a receptionist to a specialist audibly hears they are now with a different person (not just a different name).

| Tier | Agents | ElevenLabs voice ID |
|------|--------|---------------------|
| L2 — Receptionists | Emma, Olivia, Grace | `WlKo88ukhZlZ4fjsOQFI` |
| L3 — Specialists + Live Agent Proxies | Jennifer, Sarah, Nora, Rachel, Wendy + FB/CL/BR Live Agent Handoff | `Ne7VRnu9eE7lobTDr8Pw` |
| ES — Spanish specialist | Valeria | `bYkIyYTEAnSXau3SD2ED` |

Distinctive voices per individual agent (separate voice for Emma vs Olivia vs Grace, etc.) remain a known TODO — useful for dashboards and QA review but not critical for caller experience since the L2/L3 split already signals a change of role.

Voice designer: open `index.html` from the repo root to preview new ElevenLabs voices and grab their voice IDs.

---

## Pending Integrations

| Integration | Notes |
|-------------|-------|
| Hawksoft | Final destination for all leads |
| Calendly | Appointment booking for Home & Auto |
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
