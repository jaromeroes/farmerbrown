# Design Spec — Service Receptionists (EN) for Farmer Brown

**Date:** 2026-04-20
**Status:** Design
**Author:** José A. Romero + Claude
**Related docs:** [`../../call-center-architecture.md`](../../call-center-architecture.md) (v3.4), [`../../squads-and-handoffs.md`](../../squads-and-handoffs.md) (v1.1)

---

## 1. Context

Farmer Brown's call center is a multi-agent VAPI system serving three sites (farmerbrown.com, contractorsliability.com, buildersrisk.net), each with three inbound lines (EN Sales, EN Service, ES combined). The EN Sales branch is already fully deployed — 3 receptionists (Emma / Olivia / Grace), 5 specialists (Jennifer BR, Sarah GL, Nora CA, Rachel H&A, Wendy WC), and 3 live-agent SIP proxies, organized into 3 production squads plus 1 test squad.

This spec covers the **EN Service branch** — the second of the three line types. The ES branch remains out of scope for this spec and will follow its own design.

### Why now
- The client (Farmer Brown's John) has reviewed and signed off the COI conversational flow (see `../../call-center-architecture.md` §Certificate of Insurance v3.4), including a new quid-pro-quo urgency step and a COI-specific Home & Auto cross-sell.
- EN Sales has been stable in production; lessons learned (squad tool disambiguation, Deepgram mistranscription patterns, L2/L3 voice tier split) are ready to be reused.
- Closing Service unlocks the ES design, which reuses the Service flow verbatim in Spanish.

### Success criteria
- Three production receptionists (one per site) handle inbound Service calls in English.
- Payment and Claim intents transfer immediately to the existing live-agent SIP proxy for that site.
- COI (Certificate of Insurance) requests are handled end-to-end by the receptionist with the 6-step conversational flow from `../../call-center-architecture.md`, including the Step 6 Home & Auto cross-sell.
- A second Test Dispatcher + Test Squad lets the team exercise all three Service flows from a single test number without touching production numbers.
- Zero regressions in EN Sales — no existing assistant, squad, or tool is modified except for docs.

---

## 2. Scope

### In scope
- 3 new L2 receptionist assistants (Emma Service, Olivia Service, Grace Service)
- 1 new L1 Test Dispatcher assistant (`Test Dispatcher Service v1.0`)
- 3 new production squads (FB / CL / BR — Service EN)
- 1 new test squad (`Test Squad — Service EN`)
- Agent config folders under `agents/`
- Deploy scripts under `scripts/`
- Doc updates: `CLAUDE.md`, `docs/call-center-architecture.md`, `docs/squads-and-handoffs.md`

### Out of scope (deliberate deferrals)
- **ES branch (Spanish)** — next spec, after Service EN ships.
- **Backend integrations for COI** — four endpoints are pending on Tyler (Farmer Brown's backend dev): SMS review link, SMS H&A application, internal urgent alert (SMS/email/Slack), and COI submit endpoint. For V1 we ship with the same "pending" pattern already used by Rachel and Wendy: the receptionist *says* "I'll send you a text" verbally but no tool call is made. Data lives in the call transcript. Noted in [`../../client-notes-pending.md`](../../client-notes-pending.md) for the next client sync.
- **Cross-sell routing from Service to Sales** — if a Service caller is actually shopping for a new quote, the receptionist transfers to the same live-agent proxy (same phone number today). A dedicated Sales handoff from Service is out of scope; captured as a client note.
- **L2/L3 voice distinctiveness** — current voices are too similar per user feedback; deferred intentionally ("no ahora"). Memory note kept for when voices get replaced.
- **No L3 specialists for Service** — COI is handled inline by the receptionist, not via a dedicated L3 agent. This is a deliberate departure from the Sales pattern (L2 routes → L3 specialist) because Service has only three branches and two of them are immediate live-agent transfers.

---

## 3. Architecture decisions

Each decision below was discussed and approved during brainstorming on 2026-04-20.

### D1. COI flow lives inside the Service receptionist (no L3 specialist)

**Decision:** The Service receptionist handles Payment/Claim/COI routing **and** executes the 6-step COI conversational flow itself. No separate L3 "COI specialist" agent.

**Alternatives considered:**
- (B) L2 receptionist + L3 COI specialist — one COI agent shared across all three sites, mirroring the Sales pattern.

**Rationale:**
- Service has only 3 branches, and 2 of them (Payment, Claim) are immediate transfers to a human. A dedicated L3 for COI would handoff from an agent that itself had almost nothing to do — unnecessary overhead.
- The COI flow is not cross-product (like GL vs BR), so there's no routing decision that calls for a specialist.
- Fewer handoffs = less latency, lower risk of state loss, no voice-tier change mid-flow.

**Implication:** Each Service receptionist prompt is longer than its Sales counterpart (adds ~6 steps of flow to the routing triage).

### D2. Same "persona" for Sales and Service (Emma/Olivia/Grace retained)

**Decision:** Reuse the Sales receptionist names in Service. Emma, Olivia, and Grace each get a second VAPI assistant suffixed "Service" (e.g. `Emma — FB Receptionist EN Service v1.0`). Same ElevenLabs voice as their Sales counterpart.

**Alternatives considered:**
- (2) Three new names for Service (e.g. Sophia, Chloe, Ava).
- (3) Suffix variants ("Emma from Service").

**Rationale:**
- Brand continuity: a caller who interacts with Farmer Brown across sales and service recognizes the same "person".
- VAPI `name` uniqueness is preserved via the `Sales` / `Service` suffix + version, so there's no technical collision.
- Internal dashboards / CLAUDE.md already disambiguate by line suffix.

### D3. Backend integrations: "pending" pattern for V1

**Decision:** None of the four backend integrations ship with V1. The receptionist speaks the pending action verbally (e.g. "I'll send you a text with a review link right now") but invokes no tool. Data remains in the call transcript.

**Alternatives considered:**
- (B) Block Service deployment until backends ship.
- (C) Ship SMS pending but implement urgent alert (email + Slack) day-1.

**Rationale:**
- Same pattern is already in production for Rachel (H&A application), Wendy (WC submit), and Nora (CA submit). Consistency with existing agents.
- The lead capture happens in the transcript regardless — Hawksoft integration is the destination for all leads and is also pending.
- Blocking on backends would stall the client-facing Service work for an infra dependency.

**Known risk:** a caller requesting expedited COI service produces no internal alert — the lead sits in the transcript until someone reviews it. Called out explicitly in client notes. Urgent alert is the highest-priority item to unblock.

### D4. Reuse existing live-agent SIP proxies

**Decision:** Payment and Claim transfer targets are the existing live-agent proxies used by Sales: `FB Live Agent Handoff v1.0` (+18889730016), `CL Live Agent Handoff v1.0` (+18889730016), `BR Live Agent Handoff v1.0` (+18779600221). No new proxies or SIP tools created.

**Rationale:** User confirmed "son los mismos de momento" — Farmer Brown hasn't split their human-agent line between sales and service yet. If that changes, we create site+line-specific proxies later.

### D5. Second Test Dispatcher for Service (not extend the Sales one)

**Decision:** Build a new `Test Dispatcher Service v1.0` + `Test Squad — Service EN` with its own test phone number. The existing Sales Test Dispatcher is unchanged.

**Alternatives considered:**
- (A) Extend the Sales dispatcher with a "Sales or Service?" second question.
- (C) Skip the dispatcher and attach three test numbers directly to the three Service squads.

**Rationale:** User preference — keeps each dispatcher small and focused. Cleaner separation when debugging test calls. Cost is one extra assistant and one extra test phone number.

### D6. Same L2 voice across Sales and Service (no change)

**Decision:** All 3 Service receptionists use the current L2 receptionist voice `WlKo88ukhZlZ4fjsOQFI`, identical to their Sales counterparts.

**Rationale:** Consistent with D2 — if Emma is Emma, Emma Service must sound like Emma Sales. The audible distinction between Sales and Service is conveyed by the first message, not the voice.

**Known limitation:** user flagged that the L2 and L3 voices currently in production sound near-identical, which defeats the tier-split design intent. This is deferred to a separate task; memory note captured.

### D7. Squad handoff uses `transferCall` + `destination` string (not explicit SIP tool in `toolIds`)

**Decision:** Service receptionists **do not** carry `transfer_to_live_agent_*` in their `toolIds`. The transfer to the proxy is a squad destination handoff, identical to how Sales v1.8+ Emma/Olivia/Grace route to their specialists and their proxy.

**Rationale:** Documented at length in [`../../squads-and-handoffs.md`](../../squads-and-handoffs.md) §2 and in Emma Sales v1.8 changelog. When the LLM has both an explicit `transferCall` tool AND squad destinations, it biases heavily toward the explicit tool and mis-routes. Proven fix: one transfer mechanism only (`transferCall` with `destination` string), every destination looked up by semantic name match.

---

## 4. Component design

### 4.1 Service receptionist prompt structure

Each of Emma / Olivia / Grace Service shares the same prompt skeleton, with site-specific tweaks in the first message and proxy destination name.

**Sections (mirrors Emma Sales v1.9 structure):**

1. **Header** — name, version, role description
2. **Changelog** — starting at v1.0
3. **System prompt body**
   - Role description: front-desk receptionist handling Service calls in English.
   - Goal: identify whether caller needs Payment / Claim / COI, route or execute.
4. **FLOW**
   - Step 0 — first message (see 4.2).
   - Step 1 — triage (decision table below).
   - Steps 2-7 — COI conversational flow inline (copy of `call-center-architecture.md` §COI Steps 1-6, renumbered as Steps 2-7 here for local prompt continuity).
5. **HAND-OFF SCRIPTS** — single destination (the site's live-agent proxy), one script per trigger reason (Payment, Claim, confusion fallback, caller asks for person, caller is actually a Sales lead).
6. **CRITICAL RULES** — adapted from Emma Sales v1.9 (see 4.4).

**Step 1 — triage decision table (applies to all 3 Service receptionists):**

| Caller intent | Action |
|---|---|
| Payment / billing / card expired | transferCall → `{site} Live Agent Handoff v1.0` with Payment hand-off line |
| Claim / accident / loss | transferCall → `{site} Live Agent Handoff v1.0` with Claim hand-off line |
| Certificate of Insurance (COI, cert, certificate) | Continue to Step 2 (COI flow inline) |
| Existing policy, no specific reason | Re-ask once: "Of course — is this about a payment, a claim, or a certificate of insurance?" |
| Sales intent (new quote / GL / BR / auto / WC / H&A) | transferCall → `{site} Live Agent Handoff v1.0` with "sounds like sales" hand-off line |
| Confusion after 2 attempts | Fallback Rule 5 — transferCall → proxy |

**Steps 2-7 — COI flow.** Copy of `call-center-architecture.md` §Certificate of Insurance Steps 1-6, verbatim in the prompt. No L3 handoff — the receptionist executes each step itself.

### 4.2 First messages

| Agent | First message |
|---|---|
| Emma Service (FB) | "Thank you for calling Farmer Brown Insurance, this is Emma — how can I help you today?" |
| Olivia Service (CL) | "Thank you for calling Contractors Liability, this is Olivia — how can I help you today?" |
| Grace Service (BR) | "Thank you for calling Builders Risk, this is Grace — how can I help you today?" |

Deliberately open-ended — Service callers don't fit a fixed menu (unlike Sales' new/existing split). The triage happens in Step 1 based on their freeform answer.

### 4.3 Hand-off scripts

All three receptionists have **one** handoff destination (their site's proxy). Multiple scripted openers depending on trigger reason, all invoking the same `transferCall` with `destination: "{site} Live Agent Handoff v1.0"`.

| Trigger | Spoken line |
|---|---|
| Payment | "Of course — let me get you to the team that handles payments. One moment." |
| Claim | "I'm sorry to hear that — let me connect you with our claims team right away. One moment." |
| Sales intent on Service line | "Oh, sounds like you're looking for a quote — let me get you to our sales team. One moment." |
| Caller asks for person / confusion fallback | Rule 5 standard line: "I'm sorry, I'm having a little trouble with that. Let me connect you with one of our agents right away — one moment please." |

### 4.4 Critical rules (deltas from Emma Sales v1.9)

Emma Sales has 11 numbered rules. The Service version inherits most and modifies a few:

| Rule | Change |
|---|---|
| R1 — Be fast | **Scoped to triage only.** Step 1 must complete in ≤20s. Steps 2-7 (COI) are deliberately slow — **target end-to-end COI duration 2-4 min**. The prompt must state this target verbatim and instruct the agent never to rush readbacks (especially the additional-insured address in Step 3 and the endorsements list in Step 4). |
| R2 — Silent tool calls | Unchanged |
| R3 — Never collect quote data | **Removed.** In COI the receptionist collects additional insured details, endorsements, etc. **Mitigating sentence to include in V1 prompt verbatim:** "Do not collect caller identity fields (name, phone, email, address) unless the caller volunteered them inside the COI flow (Steps 2-5). If the caller starts giving sales-like data outside the COI flow, politely redirect to Sales via the proxy handoff." This prevents the agent from opportunistically data-gathering during triage. |
| R4 — When in doubt, transfer | Unchanged |
| R5 — Fallback (confusion/stuck) | Unchanged |
| R6 — One question at a time | Unchanged. **Especially critical** in the 3-endorsement checklist (waiver of subrogation / primary and non-contributory / products and completed ops). |
| R7 — Tone | Unchanged |
| R8 — No inventing | Unchanged — especially applies to endorsement meanings ("what's waiver of subrogation?" → "great question, our team will explain it, I'll flag 'not sure'"). |
| R9 — Single transfer mechanism | Unchanged. Only one destination (`{site} Live Agent Handoff v1.0`). |
| R10 — Garbled transcriptions | **Vocabulary adapted.** Drop Sales-specific mishears (Builder's Risk, GL, etc.). Add Service-specific: "certificate"/"cert"/"COI"/"see oh eye"; "waiver of subrogation"/"waver"/"subro"; "primary and non-contributory"/"non contribute"; "additional insured"/"additional assured"/"additional insured". |
| R11 — Speak destination before transfer | Unchanged |
| **R12 — NO-BACKEND HONESTY (new)** | The 3 SMS moments (review link, H&A application, urgent alert) are not yet wired. The agent MUST speak them in future tense ("I'll send you a text"), MUST NOT claim past success ("I've sent it"). No `transferCall` for these — the transcript is the only record today. When Tyler delivers the endpoints, silent tool calls will be added as checkpoints without prompt rewrites. |

### 4.5 Tools

**Service receptionists carry ZERO tools in `toolIds`.** All handoffs are squad destinations. This is identical to Emma Sales v1.8+.

**Tools documentation file (`agents/receptionist-*-service/tools.md`):** lists the squad destination (the site's proxy) and notes the 3 pending SMS / alert integrations as future additions.

### 4.6 Test Dispatcher Service

**Structure:** clone of `Test Dispatcher v1.0` (`agents/test-dispatcher/`). Routing table points to the 3 Service receptionists instead of the Sales ones.

**First message:** "Hi, this is the Farmer Brown Service test line. Which site do you want to test — Farmer Brown, Contractors Liability, or Builders Risk?"

**Routing:**
- "Farmer Brown" / "FB" / "farmerbrown" → Emma Service
- "Contractors Liability" / "CL" / "contractors" → Olivia Service
- "Builders Risk" / "BR" / "builders" → Grace Service

**Critical rules:** reduced set, 5 rules verbatim:
1. **Be fast** — complete in ≤20 seconds. No small talk.
2. **Silent tool calls** — never narrate technical actions.
3. **Never collect caller data** — no name, email, or intent beyond site choice.
4. **Speak destination before transferring** — "Connecting you to {name} now, one moment." (same as Sales dispatcher R11 pattern).
5. **No backend, no tools** — the dispatcher has zero entries in `toolIds`; all routing is via squad `transferCall` destinations.

The Sales dispatcher's garbled-transcription rule (R10) is not needed here because the 3 site names are phonetically distinct; handle unclear answers with a single re-ask, then end the call politely.

---

## 5. Squad topology

### 5.1 Production squads (3 new)

```
Farmer Brown — Service EN Squad
├─ Emma Service (L2)
│   └─ assistantDestinations: [FB Live Agent Handoff v1.0]
└─ FB Live Agent Proxy (L3ᴴ, terminal)

Contractors Liability — Service EN Squad
├─ Olivia Service (L2)
│   └─ assistantDestinations: [CL Live Agent Handoff v1.0]
└─ CL Live Agent Proxy (L3ᴴ, terminal)

Builders Risk — Service EN Squad
├─ Grace Service (L2)
│   └─ assistantDestinations: [BR Live Agent Handoff v1.0]
└─ BR Live Agent Proxy (L3ᴴ, terminal)
```

Each production squad has **2 members** (vs 7 members in the Sales squads) because there are no specialists and only one destination.

### 5.2 Test squad

```
Test Squad — Service EN
├─ Test Dispatcher Service (L1)
│   └─ assistantDestinations: [Emma Service, Olivia Service, Grace Service]
├─ Emma Service (L2, destinations → FB Proxy)
├─ Olivia Service (L2, destinations → CL Proxy)
├─ Grace Service (L2, destinations → BR Proxy)
├─ FB Live Agent Proxy (terminal)
├─ CL Live Agent Proxy (terminal)
└─ BR Live Agent Proxy (terminal)
```

Total 7 members.

### 5.3 Phone numbers

**Critical binding rule:** every phone number (production AND test) must be attached to the **squad's `squadId`**, never to an individual `assistantId`. VAPI only injects the implicit `assistantDestinations` handoff capability when the call enters through the squad — a number attached directly to an assistant bypasses the squad and the handoffs silently fail. This is the same bug that forced us to bind the Sales test number to the squad (`CLAUDE.md` Test Dispatcher section, "attached to `squadId`, not `assistantId`"). Deploy notes must reinforce this for every number attachment.

- **Production:** user will attach 3 VAPI phone numbers to the 3 production squads' `squadId` via the VAPI dashboard, one per site. Not in scope for deploy scripts.
- **Test:** user will provision one VAPI phone number and attach it to the `Test Squad — Service EN`'s `squadId`. User will provide the number after squads are deployed so we can smoke-test.

---

## 6. File layout

```
agents/
  receptionist-farmerbrown-service/
    system-prompt.md
    first-message.md
    tools.md
  receptionist-contractorsliability-service/
    system-prompt.md
    first-message.md
    tools.md
  receptionist-buildersrisk-service/
    system-prompt.md
    first-message.md
    tools.md
  test-dispatcher-service/
    system-prompt.md
    first-message.md
    tools.md

scripts/
  create-receptionist-fb-service.js
  create-receptionist-cl-service.js
  create-receptionist-br-service.js
  update-receptionist-fb-service.js        # for iteration after deploy
  update-receptionist-cl-service.js
  update-receptionist-br-service.js
  create-dispatcher-service.js
  create-squad-fb-service.js
  create-squad-cl-service.js
  create-squad-br-service.js
  create-squad-test-service.js

docs/
  call-center-architecture.md              # bump v3.4 → v3.5
  squads-and-handoffs.md                   # bump v1.1 → v1.2
  client-notes-pending.md                  # already updated

CLAUDE.md                                  # new blocks for 4 agents + 4 squads
```

No existing files other than the three docs and `CLAUDE.md` are modified.

---

## 7. Implementation order

1. **Config folders** — create `agents/receptionist-{fb,cl,br}-service/` and `agents/test-dispatcher-service/` with `system-prompt.md`, `first-message.md`, `tools.md`. Copy from Sales counterparts and adapt per §4.
2. **Deploy scripts — assistants** — write `scripts/create-receptionist-{fb,cl,br}-service.js` and `create-dispatcher-service.js` following the pattern of `create-receptionist-fb-sales.js` and `create-dispatcher.js`. Keep VAPI `name` under 40 characters.
3. **Deploy assistants** — run the 4 create scripts. Capture assistant IDs.
4. **Deploy scripts — squads** — write `scripts/create-squad-{fb,cl,br}-service.js` and `create-squad-test-service.js` following the pattern of `create-squad-fb-sales.js` and `create-squad-test.js`. Each squad references assistants by the exact VAPI `name`.
5. **Deploy squads** — run the 4 create scripts. Capture squad IDs.
6. **Update docs:**
   - `CLAUDE.md` — add blocks for the 4 new agents (assistant IDs, config paths, deploy scripts) and the 4 new squads.
   - `docs/call-center-architecture.md` — mark EN Service as deployed in Agent Inventory table; bump version header to v3.5.
   - `docs/squads-and-handoffs.md` — add §3.5 / §3.6 / §3.7 (production Service squads), §3.8 (test Service squad), update §4 assistant inventory; bump version to v1.2. Update §10 ("What's not built yet") to remove the Service-branch line.
7. **Handoff to user for phone-number assignment** — notify user when squads are live so they can attach the 4 phone numbers (3 production + 1 test) from the VAPI dashboard.
8. **Smoke test** — user calls the test number, exercises FB / CL / BR Service flows including Payment, Claim, and the full COI path (no-expedited, expedited-with-review-agreed, expedited-without-review, H&A cross-sell accepted, H&A declined).

---

## 8. Risks and mitigations

| Risk | Mitigation |
|---|---|
| LLM rushes the COI flow (R1 bias from Sales prompt skeleton) | Explicitly scope R1 to triage only in the prompt; add a "COI is deliberately slow" note in the flow section. |
| Deepgram mistranscribes endorsement names | R10 vocabulary expanded with Service terms. If needed, add `keyterm` phrase boosts per-assistant (same pattern Emma Sales uses). |
| Caller requests expedited COI but urgent alert doesn't exist yet | Document prominently in client notes; prioritize alert endpoint with Tyler as highest-priority backend ask. |
| Service receptionist accidentally collects Sales data | R3 was removed; this is now a real risk. Monitor first test calls; if observed, add an explicit "Do not collect name/phone/email unless caller gave them in Step 2 (policyholder identity)" sentence. |
| Proxy confusion: Service caller actually wants Sales | Explicit triage row + hand-off script; still goes to same SIP number so no user-visible harm. Reassess if FB splits sales/service lines. |
| Tool bias reintroduced (R9 regression) | Service receptionists ship with empty `toolIds` — enforced by deploy script, not just prompt. |

---

## 9. Open questions

None blocking. All architectural questions were resolved during the 2026-04-20 brainstorming session. Outstanding items are:
- Client sync with John re: backend endpoint priorities and urgent-alert channel choice.
- Future cross-line Sales/Service split if Farmer Brown splits their human-agent phone groups.

---

## 10. Approval

Design approved by José A. Romero on 2026-04-20. Proceeding to writing-plans for implementation plan.
