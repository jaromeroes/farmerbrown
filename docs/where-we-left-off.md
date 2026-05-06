# Where we left off — Farmer Brown
**Last touched:** 2026-05-06 (Jennifer v2.11 + Grace v1.13 deployed — full iteration cycle from broken toolIds → 5 prompt-fix rounds. BR line operational, awaiting next test-call round.)

This is a session-resumption checkpoint: enough context to pick the project back up cold without re-reading the full conversation history.

---

## Current state (BR line)

| Component | Version | Notes |
|---|---|---|
| **Jennifer** (BR specialist) | **v2.11** | All 4 toolIds restored, 4 submit_quote checkpoints (CP3 = risk + CP4 = appointment), spoken-form premium examples, Rule 1 at ABSOLUTE TOP w/ pre-response meta-check, Rule 4 no-stack for Q2 phone, idleTimeoutSeconds 20. |
| **Grace** (BR receptionist) | **v1.13** | Hand-off scripts shortened (no more *"she'll get you an instant quote"* duplication), Rule 15 anti-repeat, idleTimeoutSeconds 20. |
| **Squad** `a3269fa7-…` | synced | Jennifer destination string = "Jennifer — Builders Risk v2.11". |
| **BR public line** `+18882934492` | operational | Test calls 14:19, 14:45, 15:04, 15:11, 15:55 UTC all answered correctly. |

## Deploy scripts (idempotent, future-proof)

- `scripts/update-jennifer.js` — parses version from prompt header, PATCHes assistant (model + toolIds + messagePlan) + co-PATCHes squad `assistantDestinations[].assistantName`, verifies. Re-runnable.
- `scripts/update-receptionist-br-unified.js` — parses version from prompt header, PATCHes Grace (model + voice + transcriber + messagePlan + endCallMessage). Grace is dispatcher (not destination) so no squad co-PATCH needed.

**Pattern to reuse for Sarah / Wendy / Nora / Rachel** — they're still patched via direct curl. Mirror the Jennifer script shape next time one of them needs changes (assistant + same-squad destination co-PATCH).

---

## What got fixed across the iteration cycle (2026-05-05)

After restoring Jennifer's toolIds (v2.8), 5 test-call rounds surfaced these issues, each fixed in a tight iteration loop. Useful to know which problems are actually solved vs. open.

### Solved (verified in calls)
- ✅ Risk questions Q15-Q18 always asked before SUMMARY (was: skipped). Fix: dedicated RISK CHECK section + SUMMARY guard (v2.9).
- ✅ Hand-off Grace→Jennifer says line ONCE (was: 2-3× repetition during handoff latency). Fix: shortened hand-off scripts to match squad message + Rule 15 anti-repeat + idleTimeout raised 7→20 (v1.13).
- ✅ Email *"john dot brown at gmail dot com"* spoken as words (was: spelled "J O H N..."). Fix: Rule 3 emails differentiates pronounceable words from random strings (v2.10).
- ✅ Timezone question is now open (was: enumerated whole IANA list). Fix: marked table as `[INTERNAL — DO NOT SAY ALOUD]` (v2.10).
- ✅ Spoken-form fixes for times/dates/ZIPs (Rule 8) — all working.
- ✅ submit_quote checkpoints firing — verified in tool calls of call 14:19.

### Open (last test, awaiting v2.11 verification)
- ⏳ Filler phrases ("Just a sec", "1 moment") — Rule 1 strengthened twice; v2.11 moves it to ABSOLUTE TOP w/ pre-response meta-check. **If still failing in next test, we've exhausted prompt-side levers** and need to consider VAPI-level mechanisms (e.g., a `messages` array with start-tool / end-tool empty strings, or model swap).
- ⏳ Premium readback in spoken form — v2.11 added explicit examples in INSTANT QUOTE (was: said *"1 1 4 8 dollars"* in last test). Should work but needs verification.
- ⏳ Q2 phone two-turn (no stacking) — v2.11 Rule 4 hardened. Should work but needs verification.
- ⏳ idleTimeoutSeconds=20 on Jennifer — set in v2.11 deploy, verified at PATCH-time, but only test-call traffic will confirm it stops mid-conversation idle prompts.

### Cost data (real calls today)
- Average: **$0.41/min** on calls that reach the full quote flow. Range $0.08-0.18/min for early-hangup triage, $0.41-0.63/min for completed leads w/ appointment.
- 85% of cost is the LLM (gpt-4o, ~$0.35/min). Voice + STT + infra is ~$0.06/min.
- Per-lead cost: $2.10-$2.65 for a complete 5-min lead with appointment.
- User decision: **don't optimize cost yet** — first nail quality, then revisit. Levers in priority: (1) Grace → gpt-4o-mini, (2) full migration to mini, (3) Cartesia voice instead of ElevenLabs, (4) prompt compaction. None pursued.

---

## SHIPPED TODAY (2026-05-05)

### 1. BR call-start regression fixed (root cause: stale destination string)

`+18882934492` had been falling through to the support phone (+18775131573, the BR `fallbackDestination`) since the morning of 2026-05-05. Two new VAPI calls today both ended with `endedReason: call.start.error-get-assistant` and `cost: 0` — VAPI couldn't load the squad.

Root cause traced through call logs + squad inspection: when Jennifer was renamed v2.3 → v2.7 on 2026-05-03 19:34, Grace's `assistantDestinations[0].assistantName` was left as `"Jennifer — Builders Risk v2.3"`. VAPI validates destination names against the live squad members at call start. Mismatch → squad load aborts → `fallbackDestination` fires → caller hears the support team picking up.

Fix: PATCH the squad with `assistantName: "Jennifer — Builders Risk v2.7"`. Test call 06:50 UTC ran cleanly (5+ min, normal end). Production line restored.

**Architectural lesson saved.** See `memory/feedback_squad_name_resolution.md` (TBD on next session — the existing memory file `feedback_vapi_function_call_bias.md` covers a different aspect of this same area). The general rule: **rename a squad-member assistant ⇒ PATCH the squad in the same operation**. Otherwise the next caller falls through.

### 2. Grace v1.11 → v1.12 deployed

Two client-feedback changes after the 2026-05-05 test call:

(a) **Sales menu collapsed from two-step to one-step.** Old gate (S2 *"Builder's Risk or something else?"* → S3 alt menu of the other four products) was awkward for callers who wanted a non-BR product. New S2 reads all five products in a single line:

> *"Perfect — we offer Builder's Risk, General Liability, Workers' Compensation, Commercial Auto, and Home and Auto. Which one are you looking for?"*

The routing table moves up to S3 (was S4). All cross-refs renumbered in the prompt: `S1-S4` → `S1-S3`; `Step S2 / S3 / S4` → `Step S2 / S3`; `Steps 0, S1-S4` → `Steps 0, S1-S3`.

(b) **`"licensed agent"` → `"professional"` everywhere** because not all live-team members are licensed at the moment Grace says it. 8× replacements in Grace's prompt (Rule 5 confusion fallback, hand-off scripts for Nora/Payment/Claim/Other-service/Spanish, Rule 9 mechanics description, Step 0 framing).

Source files: [agents/receptionist-buildersrisk-unified/system-prompt.md](../agents/receptionist-buildersrisk-unified/system-prompt.md), deploy script [scripts/update-receptionist-br-unified.js](../scripts/update-receptionist-br-unified.js). Live in production as `Grace — BR Receptionist EN Unified v1.12`.

### 3. Squad-level message patches (3 separate PATCHes during this session)

Beyond the structural rename fix, the squad's `assistantDestinations` messages got two content updates:

- **Jennifer destination message** — dropped *"She'll get you an instant quote in under five minutes"* (Jennifer says this herself in her firstMessage; Grace was repeating it back-to-back). New copy: *"Great — I'll connect you with Jennifer, our Builder's Risk specialist. One moment."*
- **Nora destination message** — *"hand you off to a licensed agent for pricing"* → *"hand you off to a professional for pricing"*.
- **BR Live Agent Handoff destination message** — *"Connecting you to a licensed agent now"* → *"Connecting you to a professional now"*.

These were applied via direct PATCH on the squad (no script in `scripts/` for this — squad message edits are content tweaks, not architecturally interesting enough to script).

---

## What's live in production

### Builders Risk — buildersrisk.net

- Public toll-free: `+18882934492` → BR Unified Squad (`a3269fa7-6229-4bed-817a-c4684878a600`) → **Grace v1.13** as entry point.
- QA test line: `+17027108075` → same squad.
- Squad members (7): Grace v1.13 + Jennifer v2.11 + Sarah v1.1 + Wendy v1.0 + Nora v1.0 + Rachel v2.3 + BR Live Agent Proxy v1.0.
- Grace has `toolIds: []` (intentional — see `memory/feedback_vapi_function_call_bias.md`).
- Jennifer has 4 `toolIds` (intentional — `submit_quote`, `check_availability`, `book_appointment`, `transfer_to_live_agent_builders_risk`). Enforced by `scripts/update-jennifer.js`.
- Voice: Grace on `I5gP2xcJJRbiVkFuanfS` with extreme settings (stability 0.20, style 0.70). Specialists on `Ne7VRnu9eE7lobTDr8Pw` defaults.
- Silence-timeout: `messagePlan.idleTimeoutSeconds: 20` on both Grace (since v1.13) and Jennifer (since v2.11); `silenceTimeoutSeconds: 30`. Both raised from 7 because the 7s window was firing during handoff latency and slow-caller turns.

### Contractors Liability — contractorsliability.com (UNCHANGED)

- Public toll-free: `+18884356365` → Test Dispatcher Sales squad. Still on v3.6 architecture. Migration to v4.0 (CL Unified) is a future workstream.

### Farmer Brown — farmerbrown.com (UNCHANGED)

- No dedicated VAPI line on the website yet. Cross-brand intake numbers route to FB internal teams via TwiML Bin.

---

## Calendly API — verified healthy on 2026-05-05

`GET https://farmerbrown-bi.calforce.pro/api/calendly/available_times?agent_api_key=…&timezone=America/Chicago` returns **HTTP 200** with >100 slots over the next several days. Latency ~4.5 s. The API itself is fine. The agent rayada had nothing to do with the API and everything to do with Jennifer's missing `toolIds` (see top).

**Aside:** the `CALFORCE_AGENT_KEY` in `.env` is stale (returns 401 against the live API). VAPI tool config uses a different key (`3a8c4681-…`). When you next need to test Calendly locally, copy the working key out of the VAPI tool config to `.env`. Not blocking — VAPI tools work fine; this only affects local curl tests.

---

## Architectural lessons today

1. **Squad name-resolution is strict, not best-effort.** When you rename an assistant that's referenced by `assistantName` in another squad member's `assistantDestinations`, the squad fails to load on the very next call — `endedReason: call.start.error-get-assistant`, `assistantId: undefined`, `cost: 0`. The phone number's `fallbackDestination` fires. Callers hear whatever number you set as fallback (in BR's case, the live-agent SIP +18775131573, which felt like a real "support phone" answer). Always co-PATCH renames + destination strings.

2. **Phone numbers' `fallbackDestination` is a silent failure mode that looks like success.** Because `+18775131573` is itself a real human-staffed line, callers and the client never noticed an outage — they thought it was a normal call. Two days passed before this surfaced. Worth logging an alert when calls hit fallback (TBD as a follow-up if it keeps happening).

3. **Renaming the version suffix on an assistant's `name` is a destructive change to the squad graph.** Every prior receptionist deploy that renamed a specialist needed a corresponding squad PATCH; doing one without the other bricks the line. The Grace deploy script (and the future Jennifer deploy script) should ideally also PATCH the relevant squad's destination string to match the new name in a single transaction.

4. **No tools = no data, no scheduling, no escape hatch.** Jennifer's `toolIds: []` regression is the highest-leverage bug we've seen on this account: the line still answers, the conversation still runs, no error is reported anywhere — but the entire backend half of the agent is silently dead. Whatever stripped Jennifer's tools on 2026-05-03 19:34 deserves a post-mortem when fixed; a deploy script ought to fail loudly rather than send `{ model: { toolIds: undefined } }`.

---

## Open / pending after today

1. ✅ **Jennifer toolIds restoration — DONE 2026-05-05 PM.** Shipped via `scripts/update-jennifer.js`. v2.8 live with all 4 toolIds, prompt edits in, squad destination string in sync. Idempotent re-run verified.

2. **CL + FB still on v3.6 architecture.** When you migrate to v4.0 (CL Unified, FB Unified), reuse the Grace pattern. Crucial: start with `toolIds: []` from day one. Do NOT add a function-call live-agent tool to a receptionist that also has squad destinations.

3. **Emma + Olivia still share the old L2 voice** (`WlKo88ukhZlZ4fjsOQFI`). When their sites migrate, give each receptionist its own distinct voice via the in-repo voice designer (`index.html`).

4. **Twilio bill validation in late May / early June** — pull `/Usage/Records` to confirm the savings landed. Recording Storage line should drop from ~$304/mo to near-zero.

5. **9 internal Twilio numbers under review** — pending John's confirmation of owner/use for each.

6. **`+18884962029` reserved for future VAPI** — currently a TwiML Bin to Chicago.

7. **Documentation pass needed.** `docs/call-center-architecture.md` still describes v3.6 production state for CL + FB. `docs/squads-and-handoffs.md` and `CLAUDE.md` still describe the 2026-04-18 architecture. Worth a doc update once Jennifer is unblocked.

8. **Deploy scripts: 1 of 5 specialists covered.** Jennifer now has `scripts/update-jennifer.js` (idempotent, co-PATCHes squad destination). Sarah / Wendy / Nora / Rachel still go via direct API calls. Mirror the Jennifer script shape next time one of them needs a change — assistant + squad destination co-PATCH in one transaction, version parsed from system-prompt.md header.

9. **Stale `CALFORCE_AGENT_KEY` in `.env`** — overwrite with the working key from VAPI tool config when convenient. Not blocking.

---

## How to resume

1. **Read this file** (you are here). Then read the "Current state" table at the top — that's the source of truth.
2. **Run a test call to `+18882934492`** and verify the four open items in the table above:
   - Premium spoken in word form? (e.g. *"eleven hundred forty-eight dollars"*, not *"1 1 4 8 dollars"*).
   - Filler phrases gone? (no *"Just a sec"*, *"1 moment"*, *"Hold on"* before tool calls).
   - Q2 phone is two turns? (yes/no question first, then readback in next turn).
   - Idle prompt no longer fires mid-conversation on slow user turns?
3. **If filler phrases still appear in v2.11**, prompt-side levers are exhausted. Next moves: (a) look at VAPI's `model.messages[]` shape with a system message that includes pre-tool-call empty assistant turns, (b) consider gpt-4o-mini for Grace (free side benefit: cost optimization deferred from this session), (c) test if VAPI has a `responseDelaySeconds` or similar config to suppress filler.
4. **Cola pendiente del cliente** (deferred — surfaced earlier in session, not yet specced):
   - **WC flow change** for Wendy — specs to come.
   - **submit_quote checkpoint when project value is known** — already covered by Jennifer v2.10 CP2 (project_type + building_coverage). Confirm with John whether this is what he meant or if he wants a separate Sarah GL change.
   - **Spanish in conversation** — approach to be defined by client.
5. **Pattern when you write `scripts/update-{specialist}.js`** for Sarah/Wendy/Nora/Rachel: copy `update-jennifer.js` shape exactly. Parse version from prompt header → PATCH assistant (model + toolIds + messagePlan) → find squad dispatcher and target's destination defensively → co-PATCH assistantName → verify both. The cost is a small amount of boilerplate per specialist; the savings is never having a 36-hour silent outage again.
6. **Don't optimize cost yet** — user explicit: nail quality first. Levers documented in "Cost data" section above for when the time comes.
5. **If the bug detective itch persists**: figure out what exactly got stripped on 2026-05-03 19:34. Was it a manual deploy without `toolIds` in the payload? Was it a VAPI dashboard edit? Whatever it was, it shouldn't be possible to leave a specialist with empty tools silently.
