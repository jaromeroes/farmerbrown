# Where we left off — Farmer Brown
**Last touched:** 2026-05-15 (full session) — **Multi-front session, none of it test-called yet.** Three big things shipped:

1. **Jennifer v2.14** — NEW Q5a "total square footage of the finished project" inserted BEFORE the building-value question on NEW CONSTRUCTION flow only. Renovations unchanged. CP2 payload extended with `total_square_footage`. Five squads auto-synced by `update-jennifer.js`.

2. **Emma FB Sales v1.11 + Olivia CL Sales v1.9** — full **Grace BR Unified replication (Level 2)**. firstMessage expanded from 2-intent to 4-intent triage + Spanish offer at the end (textual match with Grace BR). system-prompt restructured to mirror Grace: Step 0 (4-way intent triage) → Sales Branch (S1+S2, unchanged) + new EXISTING-QUOTE / EXISTING-POLICY / SPECIFIC-PERSON / SPANISH branches. Routing simplifications vs Grace (FB/CL don't yet have direct-dial directory, dedicated existing-quote line, or dedicated service line): all three non-Sales branches collapse into Mechanism B (`FB Live Agent Handoff` / `CL Live Agent Handoff`); Spanish → shared `Spanish Team Proxy v1.0` (Mechanism C). Per John's request: *"las recepcionistas de CL y FB tienen que replicar el mensaje que ahora tiene Grace de BR"*.

3. **Routing reshuffle:**
   - `BR Spanish Proxy v1.0` **renamed → `Spanish Team Proxy v1.0`** (cross-site, shared). BR Unified Squad reference fixed in same operation (would have bricked BR otherwise — first-word match in `sync-all-squad-names.js` doesn't auto-fix this because "BR" → "Spanish" changes the lead token).
   - Spanish Team Proxy **added as member + Emma/Olivia destination** in FB Sales Squad and CL Sales Squad. Both squads now have 8 members.
   - **`+18884356365` reapuntado del Test Dispatcher al CL Sales Squad** (now CL production line directly to Olivia; previously a multi-site testing menu).
   - **Test Dispatcher Sales DELETED** (assistant `753657c6-…` + squad `2ae25a8b-…`). Multi-site testing is gone — to test Emma FB now you need the FB production number (pending import).

**Previously (2026-05-11 late):** Grace v1.22 deployed + **two VAPI gotchas discovered and fixed during direct-dial smoke test** (multi-destination `transferCall` requires a `destination` parameter; squad-destination `message` field doubles up with Grace's spoken line when both say similar things). **All 4 new routing flows verified by real test calls** — Pedro direct-dial (call `019e1711` → `+17262334655`), Spanish, Existing-Quote, and Service.

This is a session-resumption checkpoint: enough context to pick the project back up cold without re-reading the full conversation history.

---

## Current state (after 2026-05-11 session)

| Component | Version | Notes |
|---|---|---|
| **Jennifer** (BR specialist) | **v2.14** (NEW 2026-05-15) | v2.13 (changelog moved out, no behaviour change) + **v2.14: new NEW-CONSTRUCTION question Q5a "total square footage of the finished project"** asked BEFORE the building-value question. Renovations flow unchanged. CP2 payload extended with `total_square_footage` (only for new construction). Backend accepts it transparently because `builders_risk_submission` is a generic object. **Not test-called after the v2.14 deploy** — spot-check the new question fires on a new-construction call. |
| **Emma** (FB Sales receptionist) | **v1.11** (NEW 2026-05-15) | Major — full Grace BR Unified replication (Level 2). 4-way triage + Spanish offer. See top of doc. **Not test-called** — no production number on Emma yet (`+18884962029` pending Twilio import). |
| **Olivia** (CL Sales receptionist) | **v1.9** (NEW 2026-05-15) | Major — full Grace BR Unified replication (Level 2). 4-way triage + Spanish offer. See top of doc. **+18884356365 reapuntado al CL Sales Squad el 2026-05-15** — now Olivia is the production receptionist for CL. **Not test-called yet** — first thing for next session. |
| **Spanish Team Proxy** (was BR Spanish Proxy) | **v1.0** (RENAMED 2026-05-15) | Same assistant `af9a33a1-…`, holds `transfer_to_spanish_team` → +18332160350. Now cross-site — squad member of BR Unified + FB Sales + CL Sales (3 squads). When extended to the 3 Service squads in next session, will be in 6 squads total. |
| **Test Dispatcher Sales** | ❌ DELETED 2026-05-15 | Assistant `753657c6-…` + squad `2ae25a8b-…` gone. Its number `+18884356365` is now the CL production line. |
| **Grace** (BR receptionist Unified) | **v1.22** (NEW) | All v1.21 features + **Pedro Neumann re-added to direct-dial** (18 of 20 directory entries wired now; was 17 of 19) + **3 new dedicated team lines wired** (Spanish, Existing-Quote, Service) + **Spanish offer in intro** ("if you'd prefer to be helped in Spanish, just let me know"). Existing-quote disconnect line REMOVED — now routes via `BR Existing-Quote Proxy`. All service-branch transfers (Payment / Claim / Other-service / explicit live-agent inside Service / confusion-in-service) now route via `BR Service Proxy` instead of `BR Live Agent Proxy`. Spanish callers route via `BR Spanish Proxy`. The generic EN live-agent (`BR Live Agent Proxy` → +18775131573) remains for Sales-branch only (explicit "live agent" inside Sales, Sales confusion fallback, `Direct-dial? = pending` directory entries). New Mechanisms E (Spanish), F (Existing-Quote), G (Service) added to Rule 9. Mechanism B narrowed. Mechanism C reframed (was disconnect, now historical placeholder). |
| **Rachel** (H&A specialist) | **v2.4** | Unchanged today. |
| **Wendy** (WC specialist, cross-site) | **v2.0** | Unchanged today. Spanish PPC routing pending number from new team. |
| **BR Direct-Dial Proxy** | **v1.0** | Unchanged today. Tool `transfer_to_specific_person` now has 19 destinations (Pedro re-added in v1.22). |
| **BR Spanish Proxy** (NEW) | **v1.0** | Silent SIP-transfer proxy assistant `af9a33a1-0f3d-4723-b021-1a676ba859c3` ("BR Spanish Proxy v1.0"). Same pattern as the Live Agent + Direct-Dial proxies. Holds `transfer_to_spanish_team` (ID `b432ef17-e76f-409f-a755-db140c31aa28`) — single SIP destination to `+18332160350`. Squad member of BR Unified Squad. |
| **BR Existing-Quote Proxy** (NEW) | **v1.0** | Silent SIP-transfer proxy assistant `db9b7095-36a4-48a2-8b22-3cc8f80edeec` ("BR Existing-Quote Proxy v1.0"). Holds `transfer_to_existing_quote_team` (ID `a1644cf7-9fae-4ccb-9ae0-bff4b84554ea`) — single SIP destination to `+17262038542`. Squad member of BR Unified Squad. Replaces the v1.14-v1.21 "disconnect line + end call" pattern for existing-quote hot leads. |
| **BR Service Proxy** (NEW) | **v1.0** | Silent SIP-transfer proxy assistant `a080eec0-ad05-403c-bcb1-8a61185a268c` ("BR Service Proxy v1.0"). Holds `transfer_to_service_team` (ID `a589dc49-f053-459a-9162-9d18b7d37e9e`) — single SIP destination to `+17262046968`. Squad member of BR Unified Squad. Receives Payment, Claim, Other-service, explicit "live agent" inside Service, and Service-side confusion fallback (was all going to `BR Live Agent Proxy` before v1.22). |
| **Squad** `a3269fa7-…` (BR Unified) | synced | **11 members** now (was 8; added 3 new routing proxies 2026-05-11). Grace's `assistantDestinations` now **10 entries** (was 7; added the 3 new proxies). All other destinations unchanged. |
| **BR public line** `+18882934492` | operational + verified | **All 4 new routing flows verified by real test calls 2026-05-11 (late):** Pedro direct-dial (call `019e1711` → `+17262334655` after Bug 4 + Bug 5 fixes), Spanish (→ `+18332160350`), Existing-Quote (→ `+17262038542`), Service (→ `+17262046968`). |

## Today's session (2026-05-11) — what shipped

Four related changes in one Grace version bump (v1.21 → v1.22):

### 1. Pedro Neumann back in the direct-dial directory
v1.21 removed him (he was the 2026-05-08 verification test subject only). Client (José) confirmed callers do ask for Pedro by name → re-added to Grace's INTERNAL DIRECTORY (Step P1) and to the `transfer_to_specific_person` tool destinations. The tool now has 19 destinations; the directory shows 18-of-20 wired (Pedro + the other 17 verified-wired entries; John Brown and Jorge still `pending`). His DID `+17262334655` and extension `275` come from the RingCentral export.

### 2. Three new dedicated team lines wired
Per José (2026-05-11): "when callers say 'live agent', we now have 4 different lines depending on context — Inglés, Español, Existing Quotes, Service".

| Category | New phone | Mechanism | Replaces |
|---|---|---|---|
| Spanish-speaking | `+18332160350` | Mechanism E (`BR Spanish Proxy`) | Old Rule 14 Spanish fallback to EN live-agent |
| Existing-quote follow-ups (hot leads) | `+17262038542` | Mechanism F (`BR Existing-Quote Proxy`) | v1.14-v1.21 disconnect line + end-call |
| Service-branch escalations | `+17262046968` | Mechanism G (`BR Service Proxy`) | Was all routed to `BR Live Agent Proxy` |
| Sales-branch live-agent (UNCHANGED) | `+18775131573` | Mechanism B (`BR Live Agent Proxy`) | — |

Mechanism B is now narrowed to: explicit live-agent inside Sales + Sales-branch confusion fallback + direct-dial `pending` entries (John Brown, Jorge) + no-match-in-directory specific-person requests.

Mechanism C is now a historical placeholder (was used for the disconnect line). The Rule 9 entry was kept for traceability — easier to read the v1.14→v1.22 evolution.

### 3. Spanish offer in the intro
Grace's first-message now ends with "And if you'd prefer to be helped in Spanish, just let me know." Many Spanish callers will trigger Rule 14 on their first response. The acknowledgement stays in English ("Of course — let me connect you with our Spanish-speaking team. One moment.") because Grace herself is English-only — switching mid-conversation would be unreliable.

### 4. New scripts (all idempotent except `create-br-routing-proxies.js`)

- [scripts/create-tool-transfer-to-spanish-team.js](../scripts/create-tool-transfer-to-spanish-team.js) — creates/updates `transfer_to_spanish_team` (idempotent by `function.name`).
- [scripts/create-tool-transfer-to-existing-quote-team.js](../scripts/create-tool-transfer-to-existing-quote-team.js) — creates/updates `transfer_to_existing_quote_team`.
- [scripts/create-tool-transfer-to-service-team.js](../scripts/create-tool-transfer-to-service-team.js) — creates/updates `transfer_to_service_team`.
- [scripts/create-br-routing-proxies.js](../scripts/create-br-routing-proxies.js) — creates the 3 silent SIP proxies. **NOT idempotent — re-running creates duplicates.** If you need to re-create a proxy, delete the existing one first.
- [scripts/update-squad-add-routing-proxies.js](../scripts/update-squad-add-routing-proxies.js) — adds the 3 proxies to BR Unified Squad as members + Grace destinations. Idempotent.

## Bugs found and fixed in the post-deploy smoke test (2026-05-11 late)

### Bug 4 — Multi-destination `transferCall` silently routes to destinations[0] when no `destination` param

First Pedro test (call `019e1701`, 12:27 UTC) routed to **Gustavo Alvarez** (`+13127618580`) instead of Pedro (`+17262334655`). Root cause: `transfer_to_specific_person` had `parameters: { type: 'object', properties: {}, required: [] }` — no way for the LLM to specify which destination. The proxy LLM dutifully invoked the tool with `{}` and VAPI defaulted to destinations[0] (Gustavo).

This worked for the 2026-05-08 verification because at that moment the tool had only ONE destination (Pedro). When the tool was scaled to 18+ destinations in v1.20, this bug went live but wasn't caught because nobody re-tested direct-dial — the where-we-left-off doc's "spot-check sufficient because identical mechanism" assumption was wrong.

**Fix:** declared `destination` (required, string, enum of all 19 DIDs) on the function schema and embedded the name→number directory in `function.description`. Updated the BR Direct-Dial Proxy's system prompt to instruct the LLM to identify the caller's requested name from the transcript and pass the matching phone number as the `destination` argument.

Verified working on call `019e1711` (12:44 UTC) — caller asked for Pedro, tool was invoked with `destination: "+17262334655"`, call forwarded to Pedro's number.

Files: [scripts/create-tool-transfer-to-specific-person.js](../scripts/create-tool-transfer-to-specific-person.js) + [scripts/create-br-direct-dial-proxy.js](../scripts/create-br-direct-dial-proxy.js). Both are idempotent.

Memory: `feedback_vapi_multi_destination_param.md`.

### Bug 5 — Squad destination `message` field doubles up with the receptionist's spoken line

Same successful Pedro call (`019e1711`) still had a UX glitch: the caller heard "Connecting you now." TWICE before the proxy spoke. Trace:
- `[bot Grace]` "Connecting you now."  ← Grace's LLM emission (generic — she did NOT speak the personalized "Of course — connecting you to Pedro Neumann. One moment." that her prompt mandates)
- `[squad auto-msg]` plays the destination's `message` field ("Connecting you now." for `BR Direct-Dial Proxy v1.0`)
- `[bot proxy]` "Of course, connecting you to Pedro Newman. One moment."

The squad's destination `message` field auto-plays during the handoff window. If the receptionist's spoken line is similar, they overlap and the caller hears the same words twice. This is the same class of problem as v1.13's specialist-handoff fix.

**Fix:** cleared `message` to `''` on Grace's destinations for all 4 routing proxies (Direct-Dial + Spanish + Existing-Quote + Service). Now only Grace + the proxy LLM speak; no automatic squad message. Applied to all 4 preemptively because the same pattern would have hit Spanish/Existing-Quote/Service on first test.

Specialist destinations (Jennifer/Sarah/Wendy/Nora/Rachel) kept their `message` fields — they're 1:1 matched with Grace's hand-off lines per the v1.13 design, and the specialist re-introduces itself in its `firstMessage`.

File: [scripts/clear-grace-proxy-destination-messages.js](../scripts/clear-grace-proxy-destination-messages.js). Idempotent.

**Open sub-issue:** Grace's LLM is still emitting the GENERIC "Connecting you now." instead of the personalized "Of course — connecting you to Pedro Neumann. One moment." that Step P1 + HAND-OFF SCRIPTS demand. The personalization currently comes from the proxy LLM, not Grace. Fine for now (caller hears the name from the proxy), but if it becomes an issue, prompt Grace's HAND-OFF SCRIPTS more aggressively or accept that the proxy is the canonical personalized speaker.

**Side issue:** TTS pronounced "Neumann" as "Newman" (English-style) instead of "Noyman" (German). Cosmetic. Fix would be to either change the spelled name to "Noyman" in the directory or attach an ElevenLabs `pronunciationDictionary`. Not blocking.

## Verification status (end of 2026-05-11)

All 4 new routing flows verified by real test calls on `+18882934492`:

| Flow | Verified | Destination | Notes |
|---|---|---|---|
| Pedro direct-dial | ✅ call `019e1711` 12:44 UTC | `+17262334655` | After Bug 4 + Bug 5 fixes |
| Spanish | ✅ 2026-05-11 (late) | `+18332160350` | — |
| Existing-Quote | ✅ 2026-05-11 (late) | `+17262038542` | — |
| Service | ✅ 2026-05-11 (late) | `+17262046968` | — |

Sales flow (Grace → Jennifer for new Builder's Risk) was NOT re-verified after the v1.22 deploy. Last verified working was 2026-05-06. Should still work — no changes to specialist routing — but spot-check on next session if convenient. The 17 other wired direct-dial entries (Gustavo, Beth, Daniela, etc.) also weren't individually tested; same code path as Pedro so the bar should be lower, but worth one spot-check.

## Open / pending for the next session (priority order)

**HIGHEST — verify the 2026-05-15 deploys before anything else:**

1. **Test call to `+18884356365`** — verify Olivia v1.9 4-way triage works end-to-end on CL. Try: (a) "new quote" → menu → product → specialist hand-off; (b) "I already have a quote" → live agent; (c) "Spanish please" → Spanish Team Proxy → +18332160350; (d) "I want to speak to John" → live agent with name. **First call should also confirm BR has no regression** — the Spanish Proxy rename + BR Unified Squad re-sync was the riskiest change of the session.
2. **Test call to `+18882934492`** — sanity check that Grace BR Unified still routes correctly after the Spanish Proxy rename + Jennifer v2.14 deploy + BR Unified Squad re-sync.
3. **Spot-check Jennifer v2.14** — make a new-construction quote call and confirm she asks "What is the total square footage of the finished project?" BEFORE the building-value question. Then verify the field reaches the backend (check the BI record for `total_square_footage`).

**HIGH — finish the production routing setup:**

4. **Import `+18884962029` (FB) from Twilio to VAPI.** José said he'd pass the Twilio credentials (account `AC450cf8...`). Once we have them, POST to `/phone-number` with `provider: 'twilio'`, the Account SID, Auth Token, and the number; then PATCH the resulting record with `squadId: '5cf7afbf-cee7-45cd-8fa1-9ff2989d8e28'` so it routes to Emma FB Sales. Once done, repeat the test-call routine for FB.
5. **Fase C — Spanish offer in the 3 Service receptionists** (Emma FB Service `a1720268-…`, Olivia CL Service `e4597689-…`, Grace BR Service `9f4ae2af-…`). Mechanical: add the offer to each `first-message.md`, add a Spanish Rule to each `system-prompt.md`, add `Spanish Team Proxy v1.0` as member + destination on each of the 3 Service squads, deploy. Should take ~15 minutes — none of the 3 has a number assigned today, so this is preventive.
6. **Decide what to do with Test Dispatcher Service** (squad `d989f711-…`). Like its Sales counterpart, has no number assigned. Probably should be deleted unless we explicitly need multi-site Service testing.

**MEDIUM — pending earlier requests:**

7. **Warm transfer with context** (pending since 2026-05-08 PM) — when Grace transfers to a specific person, the receiver should hear a brief context summary ("you have a caller interested in a Builder's Risk quote, name…") before being bridged. Currently a blind SIP transfer. Implementation: VAPI's `transferPlan: { mode: 'warm-transfer-say-summary' }` on each destination of `transfer_to_specific_person`. See `memory/project_pending_warm_transfer.md`.

2. **Grace prompt sub-issue: generic line instead of personalized.** Grace's LLM emits "Connecting you now." instead of the prompt-mandated "Of course — connecting you to Pedro Neumann. One moment." for direct-dial unique-matches. The proxy LLM compensates by speaking the personalized line, so the caller still hears the name. If we want Grace herself to speak the personalized line (instead of letting the proxy do it), the HAND-OFF SCRIPTS section for direct-dial needs a stronger formulation — replace the `<full name from directory>` placeholder pattern with worked examples per directory entry, OR make the prompt's Rule 11 explicitly forbid generic "Connecting you now." for direct-dial. Not blocking.

3. **TTS pronunciation of "Neumann" as "Newman"** — ElevenLabs reads German-style surnames in English phonetics. Cosmetic. Options: (a) change spelled name to "Noyman" in the directory's "Speak this full name" column (English phonetic spelling); (b) attach an ElevenLabs `pronunciationDictionary` to Grace + the direct-dial proxy. Not blocking.

4. **Multi-destination `transferCall` lesson now in memory.** New `feedback_vapi_multi_destination_param.md` documents: a transferCall tool with 2+ destinations MUST declare a `destination` (string enum) parameter, otherwise VAPI silently routes to destinations[0]. Apply to any future multi-destination tool from day one. Test with a destination that ISN'T at index 0 — a test that lands on destinations[0] is indistinguishable from the bug.

If any of these fail with `endedReason: call.start.error-get-assistant`, use the 2026-05-08 diagnostic technique: `POST /call` with the squad ID and a phoneNumberId, inspect the 4xx response body for the actual `Invalid Configuration` validation error.

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
- `scripts/apply-custom-headers-to-apirequest-tools.js` (NEW 2026-05-08) — applies a neutral `User-Agent` and `X-Source` to every apiRequest tool in the org so the requests don't visibly identify VAPI as the platform. Idempotent. Run after creating any new apiRequest tool.

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
