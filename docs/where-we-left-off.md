# Where we left off — Farmer Brown
**Last touched:** 2026-05-08 PM (late) — Grace v1.20 + 18 of 20 shortlist entries wired for direct-dial. After the Pedro Neumann test passed end-to-end, the remaining 17 names with DIDs in the RingCentral export were added as destinations on `transfer_to_specific_person` (now 19 destinations) and flipped to `Direct-dial? = yes` in Grace's directory. Two names remain `pending` (no DID in the export): **John Brown** (owner) and **Jorge** (alias of "George" — doesn't appear). Both fall through to the live-agent line as before.

This is a session-resumption checkpoint: enough context to pick the project back up cold without re-reading the full conversation history.

---

## Current state (after 2026-05-08 session)

| Component | Version | Notes |
|---|---|---|
| **Jennifer** (BR specialist) | **v2.12** | All v2.11 fixes + new MAILING ADDRESS sub-flow after Q6. submit_quote tool schema co-updated. Backend verified 2026-05-06. **Not re-verified after 2026-05-06 deploy.** |
| **Grace** (BR receptionist Unified) | **v1.20** (NEW) | v1.16 fixes + **directory ambiguities resolved** (George → Jorge; Maria → María Portillo) + **direct-dial pivoted from PBX/DTMF to per-person DIDs** + **18 of 20 shortlist names wired** (verified end-to-end for Pedro Neumann; the rest deployed but not individually tested). Step P1 branches on a `Direct-dial?` column: `yes` → squad destination `BR Direct-Dial Proxy` → tool `transfer_to_specific_person` (19 destinations) with the matching DID; `pending` → live-agent line. Only John Brown and Jorge are still `pending` (no DID in the RingCentral export). Each entry's "Speak this full name" column now reflects the proper full name from the export (e.g. Maria → María Portillo). **Existing-quote rama still disconnected** (waiting on a separate dedicated number from Pedro). |
| **Rachel** (H&A specialist) | **v2.4** (NEW) | All v2.3 fixes + caller-facing wording de-personalised: every spoken "Angie" replaced with "one of our agents" / "our team" / "our professionals" because both Angie and Andrés handle these calls. NEW scheduling fallback: `transfer_to_home_auto_team` (SIP to `+18339024483`, the H&A team direct line) replaces `transfer_to_live_agent_farmer_brown` for calendar failures. The generic live-agent transfer remains for confusion / general fallbacks (Rules 5, 7). Tool internal names (`check_availability_angie`, `book_appointment_angie`) unchanged — never spoken. |
| **Wendy** (WC specialist, cross-site) | **v2.0** | Full redesign 2026-05-06 — unchanged today. Spanish PPC routing pending number from new team. **Not verified by test call.** |
| **BR Direct-Dial Proxy** (NEW) | **v1.0** | Silent SIP-transfer proxy assistant `32dde873-910d-489f-93fa-3527e52befc1` ("BR Direct-Dial Proxy v1.0"). Same pattern as the Live Agent Proxies — `firstMessage: ''` + `firstMessageMode: 'assistant-speaks-first-with-model-generated-message'`, system prompt forces "One moment." + tool invocation in the same turn. Holds `transfer_to_specific_person`. Squad member of BR Unified Squad only. **NOTE:** original ID was `f4d38675-…` but that assistant was deleted during debugging (cache-clearing attempt) and re-created with a new ID. If a third party still references the old ID anywhere, update it. |
| **Tool `transfer_to_specific_person`** (NEW) | — | ID `b7c4167b-91da-4a96-ae1f-8a3cfb572a57`. Currently 1 destination (Pedro, raw DID `+17262334655`, no extension/PBX). Architecture: each future destination uses its own E.164 number directly. Includes `function.parameters: { type: object, properties: {}, required: [] }` (REQUIRED, see "Bugs fixed today"). Add destinations + re-run `scripts/create-tool-transfer-to-specific-person.js` (idempotent) to scale. |
| **Tool `transfer_to_home_auto_team`** (NEW) | — | ID `152b99c4-9461-4c3f-831f-fd02af9d3c7f`. Single SIP destination to `+18339024483` (Angie + Andrés). Used by Rachel only. |
| **Squad** `a3269fa7-…` (BR Unified) | synced | 8 members now (added BR Direct-Dial Proxy 2026-05-08). Grace's `assistantDestinations` now 7 entries (added BR Direct-Dial Proxy v1.0). Rachel destination = v2.4. |
| **Squads** (5 referencing Rachel) | synced | BR Unified, Test, BR Sales EN, CL Sales EN, FB Sales EN — all `assistantDestinations[].assistantName` updated to "Rachel — FB Home & Auto Intake v2.4" via the new auto-discovering deploy script (`scripts/update-rachel.js` rewritten today with the Wendy pattern). |
| **BR public line** `+18882934492` | operational | No test calls verified yet. **First test priority:** call this line, ask for "Gustavo" — does the line connect to extension 148 audibly? |

## Bugs fixed today (2026-05-08)

The session went from "let's wire up direct-dial" to a 3-hour debugging cycle when the BR public line started routing every call to the live-agent fallback instead of Grace. Root cause was a chain of three issues, each masking the next:

### Bug 1 — VAPI tools without `function.parameters` brick the squad

When creating new VAPI tools (`transfer_to_specific_person`, `transfer_to_home_auto_team`), the deploy scripts initially built the tool body with `function.name` + `function.description` only — no `function.parameters`. VAPI accepted the POST/PATCH (200 OK) but at runtime any assistant referencing such a tool fails to load, and any squad including that assistant fails its inbound calls with `call.start.error-get-assistant`. The phone number's `fallbackDestination` answers (`+18775131573` for the BR line — the live-agent line), making it look like Grace was bypassed.

**Fix:** every tool now includes `function.parameters: { type: 'object', properties: {}, required: [] }` even when it takes no arguments. Deploy scripts under `scripts/create-tool-*.js` updated to include this by default.

Memory: `feedback_vapi_tool_parameters_required.md`.

### Bug 2 — `submit_quote` had a corrupted function spec

The `da21631c-…` tool (submit_quote, used by Jennifer) had `function: {}` — completely empty — while the top-level `name` / `description` / `body` were intact. Most likely a side-effect of the 2026-05-06 `update-submit-quote-mailing-fields.js` PATCH or a dashboard edit. apiRequest tools need BOTH the top-level fields (so VAPI builds the HTTP request) AND the nested `function.*` fields (so the LLM gets the OpenAI function spec). Without `function.*`, Jennifer fails to load and the squad fails on every call.

**Fix:** `scripts/fix-submit-quote-function-spec.js` reconstructs `function.name/description/parameters` from the still-intact top-level `name/description/body`. Idempotent — re-run safely if it ever breaks again.

Memory updated in `feedback_vapi_tool_parameters_required.md` with the apiRequest-specific notes.

### Bug 3 — VAPI rejects assistants with more than one `transferCall` tool

This was the actual final cause of the production breakage. Rachel v2.4 had been given `transfer_to_home_auto_team` (NEW H&A fallback) but the legacy `transfer_to_live_agent_farmer_brown` was left attached. VAPI quietly accepts the PATCH but at runtime returns:

```
Invalid Configuration. Assistant 'Rachel — FB Home & Auto Intake v2.4' has more than one tool of type 'transferCall'.
```

Same downstream effect: Rachel fails to load → squad fails → `+18775131573` answers.

**Fix:** Rachel's toolset trimmed to one transferCall (`transfer_to_home_auto_team` only). Rule 6 + Rule 7 of her prompt now use the H&A team line for ALL escalations (scheduling, confusion, general fallback) — appropriate because if a caller is talking to Rachel, the product is already qualified as Home & Auto. `update-rachel.js` REQUIRED_TOOL_IDS shrunk from 4 to 3.

Memory: `feedback_vapi_one_transfercall_per_assistant.md`.

### How the bugs were diagnosed

VAPI's call logs show only `call.start.error-get-assistant` with no detail. The breakthrough was running `POST /call` programmatically against the squad — the response body of the 4xx surfaced the actual `Invalid Configuration` validation error. **Save this technique for future debugging** when a squad starts failing without a clear cause.

```bash
curl -s -X POST -H "Authorization: Bearer $VAPI_KEY" -H "Content-Type: application/json" \
  https://api.vapi.ai/call \
  -d '{"phoneNumberId": "<id>", "customer": {"number": "+1XXXXXXXXXX"}, "squadId": "<id>"}'
```

A side-effect of the test is that VAPI actually queues the outbound call. If that's not desirable, use a non-existent E.164 — VAPI still validates the squad config before checking number reachability.

---

## Deploy scripts (idempotent, future-proof)

- `scripts/update-jennifer.js` — parses version from prompt header, PATCHes assistant (model + toolIds + messagePlan) + co-PATCHes ONE squad's `assistantDestinations[].assistantName` (BR Unified). Re-runnable.
- `scripts/update-receptionist-br-unified.js` — parses version from prompt header, PATCHes Grace (model + voice + transcriber + messagePlan + endCallMessage). Grace is dispatcher (not destination) so no squad co-PATCH needed.
- `scripts/update-wendy.js` — same Jennifer pattern but **auto-discovers ALL squads referencing Wendy by name** (currently 5) and co-PATCHes every one of them. Idempotent.
- `scripts/update-rachel.js` (REWRITTEN 2026-05-08) — was a single-squad PATCH; now uses the Wendy auto-discover pattern. Five squads currently reference Rachel; the script updates all of them in one transaction per version bump.
- `scripts/update-submit-quote-mailing-fields.js` — one-shot/idempotent: PATCHes the submit_quote VAPI tool schema to add the four `mailing_*` properties.
- `scripts/create-tool-transfer-to-specific-person.js` (NEW 2026-05-08) — creates / updates the multi-destination tool used by `BR Direct-Dial Proxy`. Idempotent: re-running matches by `function.name` and PATCHes destinations[] in place. **To wire more directory entries:** add to the `DESTINATIONS` array and re-run.
- `scripts/create-br-direct-dial-proxy.js` (NEW 2026-05-08) — creates / updates the silent SIP-transfer proxy that holds the tool. Idempotent.
- `scripts/update-squad-add-direct-dial-proxy.js` (NEW 2026-05-08) — adds the proxy to the BR Unified Squad as both (a) a member and (b) a Grace `assistantDestination`. Idempotent — safe to re-run.
- `scripts/create-tool-transfer-to-home-auto-team.js` (NEW 2026-05-08) — creates / updates the SIP-transfer tool for Rachel's H&A team fallback line. Idempotent.
- `scripts/fix-submit-quote-function-spec.js` (NEW 2026-05-08) — recovery script for Bug 2 above; reconstructs `submit_quote.function.*` from the top-level fields if it ever ends up empty again. Idempotent.
- `scripts/rollback-direct-dial-proxy-from-squad.js` (NEW 2026-05-08) — emergency rollback used during the debugging cycle. Removes the Direct-Dial Proxy from BR Unified Squad. Useful if direct-dial misbehaves and you want Grace back to v1.16-style behaviour quickly.

**Pattern to reuse for Sarah / Nora** — they're still patched via direct curl. Mirror `update-rachel.js` (or `update-wendy.js` — same shape) next time one of them needs changes. Both are in 4-5 squads, so single-squad logic isn't enough.

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
2. **Direct-dial — verified for Pedro Neumann; 17 more wired but not individually tested.** Pick 2-3 random names (e.g. Gustavo, Beth, Daniela) and test that calling `+18882934492` → asking for them → connects to their direct number. Spot-check is sufficient because all 18 entries use the identical mechanism that already works for Pedro. If any specific person's call fails, check their DID in `docs/farmer-brown-phone-directory.md` against the destination in the tool — the most likely source of failure is a mistyped DID.

3. **Follow-up requested by client (2026-05-08 PM):** *"would be great if Grace also passed CONTEXT to the destination on transfer"* — i.e. the receiver hears *"You have a caller on the line who's interested in a Builders Risk quote, here's their name…"* before being connected. This is VAPI's **warm transfer** feature — `transferPlan: { mode: 'warm-transfer-say-summary' }` or `'warm-transfer-say-message'` on each destination. Currently the proxy uses a plain blind transfer. Implementation work for the next session — not a quick edit because it involves: (a) configuring `transferPlan` on every destination of `transfer_to_specific_person`, (b) deciding whether the summary is LLM-generated from the transcript or a templated message Grace builds. See [VAPI Call Forwarding docs](https://docs.vapi.ai/call-forwarding) §Warm Transfer.
3. **Run a test call to `+18882934492`** and verify the legacy open items still pending from 2026-05-06:
3. **If filler phrases still appear in v2.11**, prompt-side levers are exhausted. Next moves: (a) look at VAPI's `model.messages[]` shape with a system message that includes pre-tool-call empty assistant turns, (b) consider gpt-4o-mini for Grace (free side benefit: cost optimization deferred from this session), (c) test if VAPI has a `responseDelaySeconds` or similar config to suppress filler.
4. **Cola pendiente del cliente** (deferred — surfaced earlier in session, not yet specced):
   - **WC flow change** for Wendy — specs to come.
   - **submit_quote checkpoint when project value is known** — already covered by Jennifer v2.10 CP2 (project_type + building_coverage). Confirm with John whether this is what he meant or if he wants a separate Sarah GL change.
   - **Spanish in conversation** — approach to be defined by client.
5. **Pattern when you write `scripts/update-{specialist}.js`** for Sarah/Wendy/Nora/Rachel: copy `update-jennifer.js` shape exactly. Parse version from prompt header → PATCH assistant (model + toolIds + messagePlan) → find squad dispatcher and target's destination defensively → co-PATCH assistantName → verify both. The cost is a small amount of boilerplate per specialist; the savings is never having a 36-hour silent outage again.
6. **Don't optimize cost yet** — user explicit: nail quality first. Levers documented in "Cost data" section above for when the time comes.
5. **If the bug detective itch persists**: figure out what exactly got stripped on 2026-05-03 19:34. Was it a manual deploy without `toolIds` in the payload? Was it a VAPI dashboard edit? Whatever it was, it shouldn't be possible to leave a specialist with empty tools silently.
