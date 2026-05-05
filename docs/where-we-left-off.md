# Where we left off — Farmer Brown
**Last touched:** 2026-05-05 (mid-session checkpoint — Grace v1.12 shipped, BR call-start regression fixed, Jennifer toolIds restoration pending client OK)

This is a session-resumption checkpoint: enough context to pick the project back up cold without re-reading the full conversation history.

---

## ⚠️ Production blocker still open

**Jennifer v2.7 has `toolIds: undefined`.** Since 2026-05-03 19:34 UTC (when Jennifer was renamed v2.3 → v2.7) all four tools were stripped: `submit_quote`, `check_availability`, `book_appointment`, `transfer_to_live_agent_builders_risk`. Consequences live in production now:

- **No BR quote data has been saved to the backend since 2026-05-03 19:34.** Jennifer collects all 13–15 fields, even reads back a premium estimate, but never PATCHes `/api/builders_risk_submissions/update_by_email`. Every call's data is in the transcript only.
- When Jennifer reaches the "Would you like to schedule a call?" branch, she says *"1 moment while I check the availability"* and goes silent — there is no `check_availability` tool to invoke. The idle/silence-timeout fires after ~10 sec and the call dies.
- `transfer_to_live_agent_builders_risk` is also missing — Jennifer's "live agent" escape hatch from inside the BR flow doesn't work.

**Pending user OK** to deploy Jennifer with:
1. Restore four `toolIds`: `submit_quote` (`da21631c-…`), `check_availability` (`dd2504ab-…`, round-robin), `book_appointment` (`642280ea-…`, round-robin), `transfer_to_live_agent_builders_risk` (`7eb304a7-…`).
2. Rename 2× *"licensed agent(s)"* → *"professional(s)"* in Jennifer's system prompt (the "Our licensed agents will confirm…" line + the "schedule a call with one of our licensed agents" line).

There is no deploy script for Jennifer in `scripts/` (CLAUDE.md notes the 5 specialists were patched via direct curl). When resuming, either write `scripts/update-jennifer.js` or do a one-shot PATCH against `https://api.vapi.ai/assistant/273d2d5a-27e0-40aa-b817-76a51d1c302d` with the new `model.toolIds` array and the rename. Bump name to `Jennifer — Builders Risk v2.8`.

**Be careful when renaming Jennifer.** This same rename — done on 2026-05-03 with no corresponding squad update — is what broke Grace's `assistantDestinations` and bricked the entire BR line for ~36 hours. The squad references Jennifer by `assistantName` string. If you bump v2.7 → v2.8, you MUST PATCH the squad `members[0].assistantDestinations[0].assistantName` in the same session. (The squad is `a3269fa7-6229-4bed-817a-c4684878a600`.)

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

- Public toll-free: `+18882934492` → BR Unified Squad (`a3269fa7-6229-4bed-817a-c4684878a600`) → **Grace v1.12** as entry point.
- QA test line: `+17027108075` → same squad.
- Squad members (7): Grace v1.12 + Jennifer v2.7 + Sarah v1.1 + Wendy v1.0 + Nora v1.0 + Rachel v2.3 + BR Live Agent Proxy v1.0.
- ⚠️ **Jennifer v2.7 is functionally degraded — see "Production blocker" at top.** Calls connect and run the conversation, but no data persists and Calendly is unreachable.
- Grace has `toolIds: []` (intentional — see `memory/feedback_vapi_function_call_bias.md`).
- Voice: Grace on `I5gP2xcJJRbiVkFuanfS` with extreme settings (stability 0.20, style 0.70). Specialists on `Ne7VRnu9eE7lobTDr8Pw` defaults.
- Silence-timeout: `idleTimeoutSeconds: 7` on Grace (engine-side via `messagePlan`); `silenceTimeoutSeconds: 30`. Specialists were also configured for this on 2026-04-29/30 by direct curl, but Jennifer v2.7 currently shows `idleTimeoutSeconds: undefined` — possibly another regression from the same 2026-05-03 deploy. Verify when restoring her tools.

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

1. ❗ **Jennifer toolIds restoration** — see "Production blocker" at top. Restore 4 toolIds + 2× *"professional"* prompt edit + bump name v2.7 → v2.8 + co-PATCH squad destination assistantName. **This is the priority for the next session.** Until done, the BR line is taking calls but losing all quote data.

2. **CL + FB still on v3.6 architecture.** When you migrate to v4.0 (CL Unified, FB Unified), reuse the Grace pattern. Crucial: start with `toolIds: []` from day one. Do NOT add a function-call live-agent tool to a receptionist that also has squad destinations.

3. **Emma + Olivia still share the old L2 voice** (`WlKo88ukhZlZ4fjsOQFI`). When their sites migrate, give each receptionist its own distinct voice via the in-repo voice designer (`index.html`).

4. **Twilio bill validation in late May / early June** — pull `/Usage/Records` to confirm the savings landed. Recording Storage line should drop from ~$304/mo to near-zero.

5. **9 internal Twilio numbers under review** — pending John's confirmation of owner/use for each.

6. **`+18884962029` reserved for future VAPI** — currently a TwiML Bin to Chicago.

7. **Documentation pass needed.** `docs/call-center-architecture.md` still describes v3.6 production state for CL + FB. `docs/squads-and-handoffs.md` and `CLAUDE.md` still describe the 2026-04-18 architecture. Worth a doc update once Jennifer is unblocked.

8. **No deploy script for the 5 specialists.** Patches for Jennifer / Sarah / Wendy / Nora / Rachel (silence-timeout config, the 2026-04-29/30 messagePlan, and now the pending toolIds restoration) all happen via direct API calls. Worth writing `scripts/update-jennifer.js` etc. so the next regression doesn't take 2 days to detect.

9. **Stale `CALFORCE_AGENT_KEY` in `.env`** — overwrite with the working key from VAPI tool config when convenient. Not blocking.

---

## How to resume

1. **Read this file** (you are here).
2. **Verify the BR line is still operational** with a test call to `+18882934492`. Grace should pick up, the new flat menu should fire on "new quote", and the call should hand off to Jennifer cleanly. If it falls through to the support phone again, check the squad destinations against the actual member names — that's the failure mode.
3. **Decide on Jennifer**: write a proper `scripts/update-jennifer.js` (preferred) or do a direct PATCH. Either way: (a) restore 4 `toolIds`, (b) prompt: 2× rename, (c) bump name to v2.8, (d) co-PATCH squad destination assistantName in the SAME session. Test with a real call before declaring done.
4. **Before adding any tool to a receptionist** (Grace / future Emma-Unified / future Olivia-Unified), read `memory/feedback_vapi_function_call_bias.md`. Different problem than Jennifer's — receptionists with squad destinations should keep `toolIds: []` so gpt-4o doesn't bias toward function-calls and skip the specialist routing. The Jennifer fix is the opposite case (a specialist that needs its tools back).
5. **If the bug detective itch persists**: figure out what exactly got stripped on 2026-05-03 19:34. Was it a manual deploy without `toolIds` in the payload? Was it a VAPI dashboard edit? Whatever it was, it shouldn't be possible to leave a specialist with empty tools silently.
