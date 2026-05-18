# Bonds — discovery notes
**Last updated:** 2026-05-18

Context for the upcoming Bonds line. John sent an email forwarded from Tom Hester (Bonding Specialist, ext. 105) with the data-collection questionnaire he wants the AI voice agent to use. José then ran a Slack Q&A with Tom to close the gaps. This doc captures the full picture before any agent is built.

---

## 1. What surety bonds are (for context)

A surety bond is a three-party financial guarantee, not a traditional insurance product:
- **Principal** — the contractor who needs the bond.
- **Obligee** — the state, city, or project owner who requires the bond.
- **Surety** — the bonding company that guarantees the principal's performance to the obligee. If the principal fails, the surety pays the obligee and then pursues the principal for recovery.

Very common in US construction because most permits, licenses, and public-works bids require one to operate.

## 2. The three bond categories Farmer Brown sells

| Category | When it's needed | Pricing |
|---|---|---|
| **License or Permit Bond** | State / city / town requires it for the contractor to be issued a license or permit (general contractor, roofing, HVAC, etc.). | Variable. **Permit bonds:** ~$100-250/year. **State license bonds:** $150 (excellent credit) to $3,000+ (poor credit). |
| **Bid Bond** | The owner of a project (typically public works) requires it when a contractor bids on the contract. Guarantees the contractor will sign the contract if they win. | **Free** — supplied at no cost. |
| **Payment & Performance Bond** | The owner of a project requires it once a contract is awarded. *Performance* = contractor will complete the work per contract. *Payment* = contractor will pay subs/suppliers/labor. | **3% of contract price.** Example: $150k contract → $4,500 bond. |

Sold under the **UnitedSuretyBonds.com** brand (sister to FarmerBrown.com per Tom's email signature).

## 3. The data-collection questionnaire (from Tom)

### 3.1. Always asked (6 common fields)

1. Exact name of business (include LLC, Inc., etc.)
2. Address
3. Name of business owner
4. Email address
5. Phone number
6. Type of bond they're looking for (license/permit, bid, or payment & performance)

### 3.2. Branch — License or Permit Bond

- City / town / state requesting the bond
- Bond amount required
- Type of contractor registering as (general, roofing, HVAC, etc.)
- **SSN or ITIN** (NOT EIN) — only if bond > $25,000 OR if the state is **AZ, CA, FL, MD, NJ, WA** (6 states; NJ added per Tom 2026-05-18). Soft credit inquiry — does not affect credit score.

### 3.3. Branch — Bid Bond

Eligibility (hard requirements, no workaround per Tom):
- More than 1 year in business
- Credit score > 700
- No bankruptcy

Then:
- Date of the bid
- Total contract price (NOT the bid amount — the bid is typically 5-20% of contract price)
- Name of the project owner requesting the bid bond
- Names and SSNs of all owners

### 3.4. Branch — Payment & Performance Bond

Same hard eligibility as bid bond (>1 year in business, credit >700, no bankruptcy). Then:
- Contract amount
- Project owner's name
- Names and SSNs of all owners

## 4. Tom's clarifications (Slack, 2026-05-18)

Decisions that close most of the agent design:

| # | Question | Answer | Implication |
|---|---|---|---|
| 1 | Pricing for license/permit bonds | Highly variable — $100-250/year for permits, $150-$3,000+ for state licenses depending on credit. No fixed rate. | Agent should NOT quote license/permit prices. Promise Tom will call back with the exact price. |
| 2 | Who receives transfers | Just Tom (DID `+13128782372`, ext. 105). No team. | Build one new transfer-to-Tom mechanism. No round-robin. Operational risk: single point of failure (see open items below). |
| 3 | Bond-type discovery | Callers know what they need. Bid / payment / performance are requested by the project owner explicitly. License / permit is required by the state / city for the contractor's registration. | Agent asks plainly "what type of bond do you need?" — no disambiguation script required. |
| 4 | Qualification — hard or soft | Hard. No workaround for bad credit or under-1-year-in-business on bid / payment / performance. | Agent disqualifies on the call. (Pending decision with John: do we cross-sell another product before hanging up, or just thank-and-end?) |
| 5 | SSN over the phone | Preferred. Tom has done this 15 years. Most callers expect it because all sureties require it. Soft inquiry, no impact on credit score. **NJ added to the SSN-required state list** (now AZ, CA, FL, MD, NJ, WA). | No need for SMS/email link to a form. Agent asks for SSN out loud during the relevant branches. |
| 6 | What happens after the call | Tom receives an email with the collected data. He then calls the lead and closes the deal. No CRM, no auto-quote. | Backend is simple: collect data → email to Tom. Equivalent of `submit_quote` but lighter (no premium calc). |
| 7 | Spanish | English only for v1. | No Valeria-style Spanish bond agent in scope yet. |
| 8 | Existing customers | Transfer directly to Tom. | The agent's flow handles new-quote intake only; "I already have a bond with you" intent → straight transfer. |

## 5. What this defines for the build

If/when we get the go-ahead, the work breaks down as:

### Specialist agent
New agent (working name TBD — could be "Bryan", to keep the alphabetical specialist naming pattern). Single-purpose: triage bond type → collect category-specific data → transfer to Tom.

Pattern reference: closest existing analogue is **Nora (commercial auto)** — data-collection only, no quote engine, ends in a live-agent transfer. NOT Jennifer (BR) because there's no premium calculation.

### Backend (Tyler)
One new endpoint: `submit_bond_form`. Receives the collected data and emails Tom (`Tom@farmerbrown.com`). No CRM integration, no quote logic. The agent calls it as a checkpoint mid-flow (after the common 6 fields) and again at the end (full payload).

### VAPI tools needed
1. **`submit_bond_form`** — apiRequest tool to call Tyler's new endpoint.
2. **`transfer_to_tom_hester`** — transferCall tool with one destination (`+13128782372`).
   - Alternative: add Tom as a destination on the existing `transfer_to_specific_person` tool. Probably cleaner to keep a separate tool — Tom is the *default* handoff target for the bonds agent, not a directory entry that gets matched by name. Decision to revisit when implementing.

### Receptionist changes
Add "Bonds" as a new option in Emma / Olivia / Grace's sales menu (the "what type of policy?" step). Each receptionist gets a new squad destination → the new bonds specialist. Same pattern as Wendy / Rachel / Nora / Sarah were added in previous iterations.

### Pricing the agent CAN say (without quoting)
- Bid bonds — free.
- Payment & Performance — 3% of contract price (worked example: "a $150,000 contract would be $4,500").
- License/Permit — defer: "Tom will call you back with the exact price."

## 6. Still open — needs John, not Tom

These weren't answered (or only partially) and require a 20-minute call with John to close before any code is written.

1. **Domain / phone-line strategy.** Tom answered "just me" for who receives transfers, but didn't address whether bonds enters through the existing 3 lines (farmerbrown.com / contractorsliability.com / buildersrisk.net) or whether **UnitedSuretyBonds.com** should have its own dedicated public number like buildersrisk.net does. This is a brand/marketing decision and changes the whole routing architecture.
2. **Qualification fail — what does the agent say.** When a caller fails the hard requirements (bad credit / <1 yr in business / bankruptcy), do we (a) politely end the call with a thank-you, (b) cross-sell another product (builders risk, GL, WC) before ending, or (c) transfer to Tom anyway in case there's a judgment call we're not aware of? Tom says no workaround, but John might want to keep the lead warm.
3. **Cross-sell to other lines.** Every other line in the call center does end-of-call cross-sell except Home & Auto. Default assumption: bonds inherits the same cross-sell. Worth confirming with John explicitly.
4. **Tom-unavailable fallback.** Tom is the single destination. If he's out, on another call, or after-hours, what should the agent do? Options: (a) voicemail at Tom's line, (b) fallback to the generic live-agent SIP, (c) offer a Calendly callback, (d) email-only (skip transfer and rely on Tom to call back). Operational, not blocking for v1 design but should be decided before production.

## 7. Recommended next step

Don't start building. Get the 4 open items closed with John first — especially the domain decision in #1, because it determines whether we add "Bonds" to the existing receptionists or stand up a new line and new receptionist for UnitedSuretyBonds.com.

After that conversation, the work to scope is:
- Spec the bonds specialist (system prompt, first message, branches, checkpoints, tools).
- Spec the `submit_bond_form` endpoint for Tyler.
- Plan the receptionist menu changes (or new receptionist + new squad if the new-line option wins).
- Plan how to import the new VAPI phone number if applicable.

---

## Source materials

- Tom Hester's original email to John Brown, forwarded to José on 2026-05-16. Full text in the message thread; questionnaire reproduced in section 3 above.
- José ↔ Tom Slack thread, 2026-05-18 evening. Tom's answers captured in section 4.
