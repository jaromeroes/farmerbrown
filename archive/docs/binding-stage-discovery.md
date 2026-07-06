# Binding Info Stage — discovery notes
**Last updated:** 2026-05-19

Context for the upcoming **Binding Info Stage**, a new L4 layer that runs AFTER a specialist delivers a quote and BEFORE the call ends. John forwarded a `.docx` titled *"additonal info for binding"* on 2026-05-19 with the GL version of the questionnaire. Tom Hester is not involved — this is John's own iteration on the Sarah flow.

---

## 1. What John is proposing (and why it matters)

The doc is not just "more questions". It introduces a **stage** that sits after pricing, intentionally placed to leverage caller commitment.

John's framing, verbatim:
> *"Getting them to answer additional questions is big and they are already somewhat committed at this point for have answered most. This stage will be a separate agent that cs can forward to also. I will work on builders risk next and not too many for that."*

Three things to extract from that line:

1. **Psychology of conversion.** The caller has just heard a price and answered ~15 questions to get there. Asking "would you like to qualify for this price?" at that moment is a high-leverage close.
2. **Separate agent, not a Sarah extension.** John is explicit. This is a new specialist (call it **Rebecca**), not a new section of Sarah's prompt. Reasons (technical, validated with José 2026-05-19):
   - CS humans need to be able to forward calls into this agent (so it needs its own squad identity and probably a public DID).
   - Prompt tone differs from Sarah's (efficient data-collection vs warm sales).
   - Independent versioning — John will tweak binding questions repeatedly without re-touching Sarah.
3. **One Rebecca per product line** (decision 2026-05-19, José + Claude). Token efficiency compounds because VAPI reloads the system prompt every turn; a focused 22-question Rebecca-GL is far lighter than a multi-product Rebecca with 5 products' worth of branches. Also matches the repo convention (Jennifer/Sarah/Nora/Wendy/Rachel are separate specialists per product).

Today's discovery is **GL-only**. The doc John sent contains GL underwriting questions (operational hazard classes, construction-defect exposure triggers, etc.). John said BR is "next" and will have fewer questions, but we have nothing concrete for BR yet.

## 2. The gate question (and its two branches)

After Sarah delivers the GL premium:

> *"Would you like to answer a few additional questions to qualify for this price along with monthly payment options?"*

| Caller answer | Action |
|---|---|
| **Yes** | "Great — let's get started." → Sarah hands off to **Rebecca GL** (squad destination). |
| **No** | Sarah closes cordially: *"No problem — be on the lookout for more quotes in your email to see if we do better. If you would like to talk to one of our pros anytime, please call [NUMBER] and say 'existing quote' or set up an appointment. We would love to talk to you to see how we can be of service."* |

The placeholder phone in John's "no" branch is `9999999999` — needs to be replaced with the real existing-quote line for GL (see open items below).

## 3. The Rebecca GL questionnaire (22 questions)

### 3.1. Binding intent and payment (2 questions)

1. What effective date are you looking for?
2. Will you plan on paying your premium annually or would you like to make payments? (Inform caller that payment options will be sent.)

### 3.2. Operational exposure (11 questions)

3. Maximum # of stories you perform work on
4. Will you perform any waterproofing? (Yes/No)
5. Do you use motorized or heavy equipment in any of your operations? (Yes/No)
6. Do you use any heating equipment in your operations? (Yes/No)
7. Will you perform work in new tract home developments of 25 or more units? (Yes/No)
8. Will any of your work involve the construction of or be for new condominiums/townhouses/multi-unit residences? (Yes/No)
9. Will you perform repair only for individual unit owners of condominiums/townhouses/multi-unit residences? (Yes/No)
10. Will you perform OCIP (Wrap-up) work? (Yes/No)
11. Will you or do you perform or subcontract any work involving playgrounds, hospitals, or churches? (Yes/No)
12. Will you perform work (new/remodel) on single family residences, in which the dwelling exceeds 5,000 square feet? (Yes/No)
13. Will you perform work on commercial buildings over 20,000 square feet? (Yes/No)

> **Editorial note from John ("AI in RED"):** John's `.docx` includes a stray "Do you use heavy equipment in your operations?" right after Q5+Q6 with the annotation *"AI in RED"*. Reading this as John flagging it as a duplicate of Q5 (which already covers motorized OR heavy equipment) and marking it for removal. **Confirm with John before deploy.**

### 3.3. Additional Business Information (9 questions)

14. Are there any other business names which you have used in the past or are currently using? (Yes/No)
15. Has any licensing authority taken any action against you, your company, or any affiliates? (Yes/No)
16. Have you allowed or will you allow your license to be used by any other contractor? (Yes/No)
17. Has the applicant or business owner ever had any judgements or liens filed against them, or filed for bankruptcy? (Yes/No)
18. Has any lawsuit been made against your company? (Yes/No)
19. Is your company aware of any incidents that might involve faulty construction? (Yes/No)
20. Do you have a written contract for all work you perform? (Yes/No)
21. Do you use subcontractors? (Yes/No)
22. Do you always collect certificates of insurance from subcontractors? (Yes/No)

### 3.4. Closing

> *"Thank you for answering our questions. We will be firming up pricing right away with underwriting and will be emailing you an application to sign within the hour along with your financing options. Please set up an appointment below with one of our service representatives to take payment and get your policy going as soon as possible. You can also call any time and ask for 'live agent'."*

Then: Calendly with a **service representative** (the team that takes payment and binds the policy — NOT the same Calendly pool as Angie/Andrés for H&A scheduling, NOT the same pool as the existing GL Buy Now appointments). New event-type UUID needed.

## 4. Architectural implications

The call center grows a new layer:

```
Receptionist (L2)
    ↓
Specialist (L3) — quote + gate
    ↓ (only if gate = Yes)
Binding Info Stage (L4) — Rebecca per product
    ↓
Service Rep appointment (Calendly) + email to bind
```

What needs to exist for L4 to work:

| Piece | Status |
|---|---|
| **Rebecca GL specialist agent** | 🔵 not built — plantilla in [`agents/rebecca-general-liability-binding/`](../agents/rebecca-general-liability-binding/) |
| **Rebecca GL squad destination** in Sarah's squads | 🔵 not wired |
| **`submit_binding_info_form` API endpoint** | 🔵 not built — Tyler |
| **Calendly event type for service reps** (UUID) | 🔵 unknown — depends on John |
| **Public DID for CS-to-Rebecca forward** | 🔵 to define — depends on John on whether CS forwards via a public number or via a SIP-internal mechanism |
| **Rebecca per other product lines** (BR, CA, WC, H&A) | ⚪ not in scope yet — John will send BR questions next |

Versioning of the GL flow now changes:
- **Sarah's job ends at the gate.** Her current cross-sell + close + Buy Now flow get replaced by the gate + handoff (Yes) or cordial close (No).
- **Rebecca owns everything past the gate**, including the appointment with the service rep.

The existing **GL Buy Now Close** (architecture doc §"General Liability (Sarah / Valeria) — Buy Now Close") is what this new stage **replaces** in functional terms. The "BUY NOW" priority-flag on the Calendly booking can survive as a tag on Rebecca's appointment — to confirm with John whether that flag still has meaning when every Rebecca-completed lead is by definition high-intent.

## 5. Tom Hester's bonds parallel — what's similar and what's different

For reference, the recent Bonds discovery introduced a similar "specialist that doesn't quote, just collects data and books an appointment" pattern. Rebecca-GL and the future Bonds agent share:
- Pure data-collection (no premium calc).
- Calendly appointment at the end.
- Single backend endpoint pattern.

But they differ:
- Bonds is the **first contact** for a new lead. Rebecca is **post-quote** — the caller has already been through Sarah.
- Bonds destination is one human (Tom). Rebecca's destination is a **team** of service reps (round-robin Calendly).
- Bonds has 3 branches (license/permit / bid / payment+performance). Rebecca-GL is a single linear flow (no product-type branching, because product was already established as GL upstream by Sarah).

Useful when sequencing the build: solving Tyler's "data-collection → email/CRM" pattern once should cover both.

## 6. Still open — needs John, not Tyler

7 items to close in the next John call before building Rebecca-GL. None of them are blockers for **scoping** the agent or wiring the architectural decision — they are blockers for **deploying**.

1. **The placeholder phone number `9999999999`** in the gate-No close — what real existing-quote line for GL should we send callers to? Probably the same as BR's `transfer_to_existing_quote_team` (`+17262038542`), or a GL-specific equivalent.
2. **Service representatives Calendly setup.** Need the event-type UUID and confirmation that it's round-robin across the CS rep team (vs single person). Equivalent of how Angie's `event_type_uuid` was set up for Rachel.
3. **Confirm "AI in RED" interpretation** — remove the duplicated "Do you use heavy equipment" question.
4. **Gate vs current Sarah cross-sell.** Sarah currently does cross-sell after the quote. Does the new gate replace the cross-sell entirely, or does cross-sell run first and the gate after? Strong assumption: gate replaces cross-sell on GL (it's a higher-value outcome and the flow lengths combined would lose callers).
5. **"Qualify for THIS price" — literal or psychological?** Does the price actually require these answers to hold (i.e. could underwriting come back and modify it based on the answers)? Or is the price firm and the framing is a conversion device? Affects what we tell a caller who abandons mid-Rebecca.
6. **CS-to-Rebecca transfer mechanics.** Is CS calling a public DID that drops the caller into Rebecca directly, or is there a warm-transfer pattern? For v1 the simplest is option A: assign a public DID to a "Rebecca GL Sales" squad with only Rebecca + a fallback.
7. **Cross-sell at the end of Rebecca?** The doc's closing doesn't mention cross-sell. Safest assumption is "no cross-sell on Rebecca" (caller has been on the line a long time by this point and is moving to bind, not to compare). Confirm.

## 7. Recommended next step

Same shape as Bonds: **don't build yet**. Once these 7 items are closed with John, the work breakdown is:

- Spec Rebecca-GL system prompt (template already in [`agents/rebecca-general-liability-binding/`](../agents/rebecca-general-liability-binding/)).
- Spec `submit_binding_info_form` for Tyler (22 fields, simple POST/PATCH).
- Define the Sarah handoff: gate question + squad destination on the existing CL Sales Squad / FB Sales Squad / BR Unified Squad (wherever GL is offered).
- Create the public DID + squad for CS-to-Rebecca forward.
- Deploy Rebecca GL, smoke test, then iterate with John on prompt tuning.

For Rebecca-BR: wait for John's BR question list before doing anything. Per his note, the list will be shorter and the pattern will copy from Rebecca-GL.

---

## Source materials

- John's `.docx` "additonal info for binding" (received via José 2026-05-19; full text reproduced in section 3 above).
- José's note on John's forwarding message: *"this stage will be a separate agent that cs can forward to also. I will work on builders risk next and not too many for that"*.
- Decision log on Rebecca-per-product: see this doc §1 item 3 and the chat log of 2026-05-19.
