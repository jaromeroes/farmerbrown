# Where we left off — Farmer Brown
**Last touched:** 2026-07-06 — Lead-email notifier LIVE (built 2026-06-27) + now also sends the complete lead to `leads@farmerbrown.com`; Pablo's Builders Risk *sessions* staging API under negotiation; Jennifer price-hook agreed but NOT built yet. (Prev: 2026-06-14 Jennifer v2.20 pricing fix.)

---

## 2026-07-06 — Lead-email live + leads@, billing close-out, repo/VAPI cleanup (read first)

**0. Billing close-out (John).** Ran the metering cron (0 new calls); balance was −$81.08. Posted a **+$131.08 `adjustment`** (`external_ref manual:invoice-closeout-2026-07-06`) → **balance now +$50.00**. **Invoice John $131.08** = $81.08 consumed + $50 prepaid buffer (buffer fronted before payment, per José). Margin is **35%** (`margin_bps=3500`), already baked into charges. Manual credits use `kind=adjustment` (topups are Stripe-only). When John pays the invoice, nothing more to do in the portal.

**0b. Repo + VAPI cleanup.** Archived to `archive/`: Rebecca/Bryan/bonds + binding scripts/agents/docs (scrapped). **VAPI deleted:** Test Squad (Rebecca/Bryan) + legacy BR Sales EN squad; 8 assistants (Test Dispatcher, Bryan, Rebecca, old BR-Net Sarah, bak-farmerbrown-sarah, farmerbrown-es-wip, Riley, legacy Grace BR Sales); 2 tools (end_call_tool, transfer_to_bonds_specialist). Org now **20 assistants / 14 tools / 6 squads / 5 numbers**. **Fixed:** QA number `+17027108075` was misrouted to the dead Test Squad → repointed to BR Unified. **Still open:** undocumented English line `+13412049248 → farmerbrown-en` (`1aab1ae9`) left untouched — José to identify (keep/release). `set-br-lead-webhook.js` now pins to `+18882934492` only. **CLAUDE.md is now STALE** (references deleted assets) — refresh when building the monorepo master CLAUDE.md.

**1. BR lead-email notifier — LIVE (built 2026-06-27).** When a BR call reaches Jennifer with data, an email (filled quote form + full transcript + metadata) is sent. **Hosted in `farmerbrown-billing`** (Astro/Vercel, auto-deploys from GitHub main): `src/pages/api/vapi-lead-email.ts` + `src/lib/leadEmail.ts` + `sendLeadSummary` in `src/lib/email.ts`. Prod URL `https://farmerbrown.theb2btinkerers.com/api/vapi-lead-email`. Trigger = VAPI `server.url`+`secret` on the BR number `+18882934492` (NOT on Jennifer/Grace/squad → no brick risk; wired via `scripts/set-br-lead-webhook.js`). `end-of-call-report` → complete email; `conversation-update` → mid-call `[In progress]` partial (once, tail-gated). Webhook secret = `CRON_SECRET`; idempotency via Resend key. **Hard rules (verified in delivered mail): recording NEVER shown, zero platform reference anywhere, time in US Central.** Recipients (2026-07-06): complete → José + `leads@farmerbrown.com`; partial → José only (`COMPLETE_RECIPIENTS`/`PARTIAL_RECIPIENTS` constants in the route). Spec: `docs/jennifer-lead-email-notifications.md`. Adversarial-reviewed + hardened. Coexists with Pablo's future Zapier email (also to leads@).

**2. Pablo's "Builders Risk Sessions" staging API — negotiation ongoing (José leads).** Replaces `update_by_email` with a session model (`stagingforms.farmerbrown.com`). **Not final; do NOT point the live line at staging.** Full state + agreed direction in **`docs/pablo-br-sessions-negotiation.md`**: append-only (one row per checkpoint keyed by a `call_id` **our layer injects via {{call.id}}**, not LLM-threaded; merge latest-wins → email on close), **backend computes the premium** (the web form already does — just expose it), **machine auth** for the agent (OAuth is for humans only). Blockers before we build: Pablo confirms (1) premium endpoint, (2) machine credential, (3) merge latest-wins. Pablo is EXTERNAL for platform-naming.

**3. Jennifer price-hook — agreed, NOT built yet (awaiting José greenlight).** Fix for "sometimes quotes wrong": take the math off the LLM → deterministic `calculate_premium` tool. Assets exist: `scripts/lib/br-premium.js` (formula + tests), `premium-api/api/quote.js`, `scripts/create-tool-calculate-premium.js`. **Blocker was "no deploy target" — now solved** (deploy to the billing app, same as the lead-email endpoint). Next: verify `br-premium.js` matches v2.20 pricing → deploy endpoint → create tool → bump Jennifer to CALL it instead of computing → then a cheaper model becomes safe. José asked about this on 2026-07-03 ("hook not prompt" from the Claude Architect cert — correct instinct; the "hook" for Jennifer = a tool, not a Claude Code hook).

---

## 2026-06-14 — Pricing was broken in two ways; v2.20 fixes/mitigates both (read first)

**Two real test calls quoted WRONG:**
- Car call `019ec0bf` (2026-06-13, $5.59, 7.5 min): $900k NC Masonry, $1k ded → Jennifer said **$1,017** = base only, skipped the +10% deductible AND the $95 fee. Correct: **$1,214**.
- "Romero" call (transcript José pasted): $2M NC Frame, $2.5k ded → said **$875** = pure hallucination. Correct: **$5,215**.

**Two distinct root causes, both addressed:**
1. **gpt-4o can't do the arithmetic.** Either hallucinates (`$875`) or skips steps (`$1,017`). → v2.20 rewrites INSTANT QUOTE as **rate-per-$100,000** (whole-dollar rates so it multiplies small integers: units = value÷100k, × rate), **5 mandatory steps**, a **SANITY CHECK** (total must be 0.1–0.7% of insured value, recompute if not — explicitly catches the $875/$2M case), full worked examples per deductible, compute silently. This is mitigation, **not a guarantee** — gpt-4o doing any mental math is fundamentally unreliable.
2. **🔴 The premium wasn't even being saved.** PATCH-probe of the live backend: the column is **`annual_premium`**, but Jennifer sent **`quoted_premium`** → silently dropped (same class as the field-name-mismatch bug). → v2.20 sends `annual_premium`. (100% fixed.)

**The REAL fix (definitive, not shipped yet): take the math off the LLM.**
- Canonical formula coded + tested: `scripts/lib/br-premium.js` (`node scripts/test-br-premium.js` → 6/6, incl. both failed calls). This is the single source of truth.
- Deterministic endpoint coded: `premium-api/api/quote.js` (Vercel-ready) + `scripts/create-tool-calculate-premium.js` (VAPI `calculate_premium` tool). **NOT deployed** — no deploy target available this session (vercel token invalid, wrangler unauth).
- **Preferred path: Pablo computes `annual_premium` in the backend** (it has the field + inputs, just doesn't autocalc — verified). Formula handed to him in `client-notes-pending.md` §2026-06-14. Backend = one source, no new infra.
- **Option B (José can do alone): `cd premium-api && vercel deploy`** → run the create-tool script → bump Jennifer to v2.21 to CALL the tool instead of computing. Full steps in `premium-api/README.md`.

**Cost — why a 7.5-min call cost $5.59 (José's "why so much"):**
- 88% is LLM: **1.68M prompt tokens** on gpt-4o. The car call was long + chaotic (caller testing, re-asking addresses/deductible), so ~40+ turns, each re-sending the full context (Grace+Jennifer prompts compounding in the squad, the big v2.x prompt, 4 tool schemas, and submit_quote's full-record echo) → tokens balloon.
- **MODEL DID NOT CHANGE.** José thought he'd switched to something cheaper — Jennifer (and Grace) are STILL gpt-4o (verified on the live assistant + in the call's cost breakdown). The "feels faster to answer" is the barge-in (v2.19), not a model swap. **The dashboard change didn't stick / wasn't saved.**
- Levers (in order): (a) **move premium calc to a tool/backend → THEN safely drop Jennifer to a mini model** (the calc was the main reason a smart model was needed; mini is ~15–20× cheaper on input and also kills the "Just a sec" filler gpt-4o keeps emitting). (b) Pablo slims the `update_by_email` echo (pending). (c) shorter prompt. The Jennifer model swap is COUPLED to the calc fix — do the tool first, then swap.
- **DONE 2026-06-14: Grace → `gpt-4.1-mini`** (lower latency on the triage leg + cheaper). Safe because Grace does no arithmetic, only routing. Jennifer STAYS on gpt-4o until the calc moves off the LLM (Pablo). José asked about "gpt-4o-mini-cluster" — no `-cluster` model exists in VAPI's list (121 options, regional `:region` suffixes exist but no cluster); picked 4.1-mini over 4o-mini for Grace's multi-branch routing. **Verify next call: Grace still triages/routes correctly on 4.1-mini** (revert the model line in `update-receptionist-br-unified.js` to gpt-4o if routing degrades). Note: a chunk of the latency is the 1.68M-token compounded context, not just the model — the prompt-size + echo-slim levers matter for latency too, not only cost.

### What to verify next call (José)
- New-construction quote: confirm the spoken total matches `scripts/test-br-premium.js` for the same inputs, and that the BI record now has `annual_premium` populated (was being dropped).
- Still listen for "Just a sec" filler (gpt-4o) — expected until the model swap.

---

## 2026-06-11 — Jennifer v2.19 + barge-in + warm transfer (read this first)

**Trigger:** John's test call 2026-06-10 08:10 UTC (call `019eb095-2a28-7000-8e4f-83a8b94e228b`, $4.31, 8 min) + two WhatsApp feedback messages (pricing + UX). Transcript analysis found MORE than John reported: he never heard his quote, said YES twice to a live-agent offer and was never transferred (idle-message yes → model resumed script), filler phrases back ("Just a sec" ×4), 12–22s dead-air gaps, building-type mis-asked (dropped "or commercial", accepted "No" as answer).

### Shipped (all LIVE in production)
1. **Jennifer v2.19** (deployed via `update-jennifer.js`; 4 squads synced):
   - **Pricing replaced**: `premium = insuredValue × rate` re-based to $2,500 deductible — NC Frame 0.251% / Brick 0.242% / Masonry NC 0.113%; Rehab 0.492% / 0.462% / 0.192%. Deductible: $5k = −15% (**José confirmed John's −10% example was John's miscalc — the −15% text wins**), $1k = +10%. Round to whole dollars → flat fee $95 (<$2,000) / $195 (≥$2,000), threshold on the adjusted premium. Spoken as ONE total "including fees". insuredValue = combined `total_building_coverage` when multi-structure (was ambiguous — flagged to John).
   - **Flow cuts per John**: business-name question now clean yes/no; Individual first in form-of-business; AU+risk merged into ONE underwriting block, single intro; AU3 (completion date) + AU9 (additional coverages) DELETED; H&A cross-sell DELETED; **appointment offer DELETED → FAST TRANSFER** right after the quote (scheduling only if the CALLER asks); HARD TO PLACE also transfers (no booking).
   - **NEW Rule 11**: any YES to a live-agent offer (incl. idle prompt) → immediate CP4 + transfer. Fixes John's exact failure.
   - **CP4 redefined** (adversarial review caught the gaps): fires before ANY transfer OR after caller-initiated booking OR as step 0 of NO-TRANSFER CLOSE (safety net); sends all-data-so-far + `quoted_premium` ONLY if an estimate was actually spoken; skip if no email captured; explicit sequencing (submit_quote first, never both tools in one turn). NEW fields sent: `quoted_premium`, `hard_to_place_details` (pending Pablo columns — pass-through meanwhile).
   - Closing script EXCEPTION on hard-to-place ("within about two business days" instead of "within the hour") — flagged to John for wording sign-off.
   - firstMessage trimmed; `update-jennifer.js` now PATCHes firstMessage too (it never did — silent drift risk closed).
2. **Barge-in** on Jennifer AND Grace: `firstMessageInterruptionsEnabled: true` + `stopSpeakingPlan: { numWords: 2 }` (2 real words to interrupt — noise-safe). John's "first sentence you should be able to answer right away". Enforced by both update scripts now.
3. **Warm transfer** on `transfer_to_live_agent_builders_risk` (7eb304a7): mode `warm-transfer-wait-for-operator-to-speak-first-and-then-say-summary` — waits for the human to speak (hunt-group-safe), reads a 2-sentence LLM summary (name, project, location, coverage, quoted premium), then bridges. **⚠ Shared tool — Jennifer's transfers AND Grace's Mechanism B (BR Live Agent Proxy) both get it.** Rollback: `node scripts/add-warm-transfer-to-br-live-agent-tool.js --rollback`. NOT yet test-called.
4. **book_event slim** applied (`slim-book-event-tools.js`) — both book_appointment tools now send `&slim=true` (Pablo confirmed live 2026-06-09).
5. Squad assembly validated post-deploy (POST /call probe → call object created, no config errors).

### Process notes
- **Adversarial review workflow caught 24 real findings pre-deploy** (5 lenses × verify). Top catches: multi-structure pricing base undefined; CP4 lost on decline-path; "within the hour" contradiction; 3 mandated lines starting with meta-check trigger words ("Just a few more details…" → "A few more details…", "Let me read that back" → "I'll read that back", "One last thing" → "Before we wrap up"); "finalize everything" → "finalize your quote and go over next steps" (Rule 10).
- **Cost finding (José's $4.31 concern):** 88% of John's call cost was LLM — 1.27M prompt tokens (gpt-4o, ~40 completions × ~30k tokens). Calendly slim irrelevant on that call (never invoked). Levers queued: Pablo slims the `update_by_email` echo (#3 in client-notes-pending), v2.19's shorter flow (~8 fewer turns), and the open MODEL question (gpt-4.1 for Jennifer: better instruction-following → filler fix + cheaper) — discuss separately, don't mix with this test round.

### What to verify (José, 2026-06-12 — call +18882934492)
1. **Barge-in**: interrupt Grace's greeting mid-sentence (2+ words) — she should stop and route.
2. **Full quote flow (new construction)**: business-name yes/no · Individual-first options · ONE underwriting intro, no second "risk questions" preamble · no completion-date question · no additional-coverages question · quote = coverage × rate (+fee, whole dollars, "including fees") · NO appointment offer · fast transfer with the new line.
3. **Warm transfer**: whoever answers +18775131573 should hear the 2-sentence briefing BEFORE the caller is bridged. Check caller-side wait feels OK. If awkward → rollback script.
4. **No-repeat**: after the call, check the BI record in mission-control has `quoted_premium` (and on a hard-to-place test, `hard_to_place_details`) — pass-through until Pablo's columns, so check the record JSON, not the UI.
5. **Filler**: listen for "Just a sec" after checkpoints — if still there, it's the gpt-4o model issue (prompt levers exhausted since v2.11) → model conversation.
6. Optional: deductible $5,000 quote → should be base −15% + fee (NOT John's $2,454 example — his math slip).

### Open after this session
- John confirmations (see client-notes-pending §2026-06-11): multi-structure pricing base, hard-to-place closing wording, −15% note.
- Pablo: 2 new columns + deprioritized binding columns + update_by_email slim + lead-notification email + the pre-existing list (8 AU columns minus 2, GL `submit_gl_form` rebuild, event_type 43071621).
- Warm transfer NOT yet extended to Grace's other proxies (Spanish/Existing-Quote/Service/direct-dial) — pending the Phase-1 test result (docs/warm-transfer-plan.md).
- Git: `chore/repo-cleanup` branch has v2.18 + v2.19 commits — merge to `main` still undecided (José).
- Model swap conversation (gpt-4.1 on Jennifer): filler + cost. Separate test round.

---

## 2026-06-06 — full session (read this first)

### 1. Calforce backend MIGRATED ✅ (done without Pablo — Saturday, line was parked)
- **Old domains are DEAD** — `farmerbrown-bi.calforce.pro` AND `farmerbrown.calforce.pro` no longer resolve. New domain: **`mission-control.farmerbrown.com`**. New `agent_api_key` = **`16bad4ae-bd41-4469-b0f9-09a6f9937d1c`** (now in `.env`; old `3a8c4681…` dead). Slim param is **`?slim=true`** (NOT `format=slim`), live on `available_times` only.
- **5 VAPI tools migrated + verified** (host + key, + `slim=true` on the two availability tools): `submit_quote`, `check_availability`, `book_appointment`, `check_availability_angie`, `book_appointment_angie`. Idempotent script `scripts/migrate-tools-to-mission-control.js`. Angie event_type `901112a8` still alive on new backend.
- **`submit_gl_form` NOT migrated** — old `/api/submit` removed (404); replacement is `POST /api/insurance_quote_submissions` (wrapper `insurance_quote_submission:{}`, different contract); the tool has `body:null` today → must be **REBUILT, pending Pablo's payload confirmation**.
- **`event_type 43071621`** Pablo gave us returns slots from a DIFFERENT calendar than Angie's — purpose unconfirmed, NOT wired. Ask Pablo.
- `book_event` slim deferred to next week (José). Full detail: memory `project_calforce_slim_response.md`.

### 2. Repo cleanup — branch `chore/repo-cleanup` (2 commits, NOT merged) ✅
- 38 files archived to `archive/`; junk deleted (3 `.DS_Store`, empty `marco-farmer-brown` stub); **2 dangerous DEAD-DOMAIN scripts quarantined** (`fix-calendly-tools.js`, `update-angie-tools-uuid.js` — re-running re-breaks the migrated tools); duplicate `architecture.html` archived; `CLAUDE.md` + `apis/*.md` refreshed to mission-control; Tyler→Pablo.
- VAPI: **Service test squad `d989f711` + dispatcher `e8a656cf` DELETED** (Emma/Olivia/Grace Service members + proxies left intact).
- **⚠️ Git state is messy:** commit 1 (`git add -A`) also swept in all the prior uncommitted WIP (Rebecca/Bryan/binding docs/migration script). Then the HTML retouches + Jennifer v2.15/v2.16 edits are UNCOMMITTED on top, same branch. **Needs ordering into clean commits + merge to `main` — José hasn't decided yet.**

### 3. PIVOT: Rebecca-BR scrapped → Jennifer absorbs binding (John, 2026-06-06)
No separate post-quote "Rebecca" agent for Builders Risk. The quote specialist (Jennifer) asks the binding/"Additional Underwriting" questions inline. **Invalidates** the Rebecca-BR premise in `docs/binding-questions-br-proposal.md`, the BR half of `docs/binding-questions.html`, `docs/binding-architecture.html`, and `agents/rebecca-general-liability-binding/` *as applied to BR*. **GL still open** — John said "we'll handle General Liability later"; likely Sarah absorbs the 22 GL questions the same way. Bryan/bonds unaffected. Memory `project_binding_in_specialist.md`.

### 4. Jennifer v2.15 + v2.16 SHIPPED + verified (live in prod) ✅
- **v2.15:** NEW **ADDITIONAL UNDERWRITING** block (AU1–AU9) after Q14, before risk check — occupied-during-term, project length months, completion date, model home + modular (NEW-CONSTRUCTION only), solar, previous-damage-by-peril (incl. uninsured), more-than-one-structure→`total_building_coverage`, open additional-coverages. Business-name-after-name → `company_name`. **Rule 10 (LEGAL):** never imply coverage active / "will start"; Q13 → "requested effective date". Zeros-in-value-figures hardened (Rule 3). Move-forward close ("transfer to an agent now or set up an appointment to move forward purchasing a policy… we take care of everything with your mortgage broker").
- **🔴 CRITICAL preexisting bug fixed in v2.15:** the 4 risk flags + finished-project sqft were being sent under names that AREN'T backend columns → **silently lost for weeks**. Fixed: `has_prior_claims`→`claims_in_past_2_years`, `is_coastal`→`near_coast`, `construction_started`→`project_already_started`, `is_high_fire_risk`→`high_risk_fire_zone`, `total_square_footage`→`square_footage`. Memory `feedback_jennifer_field_name_mismatch.md`. (Verify field names against the live backend with a PATCH probe before trusting them; deployed prompt lives in `model.systemPrompt`.)
- **Tool schema:** `submit_quote` body extended with 9 AU fields via `scripts/update-submit-quote-au-fields.js`. **8 still need backend COLUMNS (Pablo)**: `occupied_during_term`, `is_model_home`, `is_modular`, `has_solar`, `previous_damage_perils`, `multiple_structures`, `additional_coverages`, `project_length_months`. Until then they sit in the transcript; `expected_complete_date` + `total_building_coverage` + `project_start_date` already persist.
- **v2.16:** sqft → "…including the basement **if there is one**"; NEW **AU2b** "projected start date" → `project_start_date`.
- Deploy via `scripts/update-jennifer.js` (parses version header, PATCHes assistant + syncs 4 squads). Adversarial review workflow caught the legal SUMMARY bug + the field-name mismatch before deploy.

### 5. ⏳ PENDING — Jennifer **v2.17: PRICING FORMULA** (awaiting John, expected today)
John (2026-06-06): *"Use .29% for new construction and .573% for rehab. Prices too low now."* Mechanic is ambiguous → sent John a WhatsApp with 3 options + resulting prices on a $500k / $2,500-deductible quote (today ≈ $1,878):
- **A (recommended):** project-type rate REPLACES the material rate, KEEP deductible factor + 1.15 + 1.30 → new build ≈ **$2,168** (+15%), rehab ≈ **$4,283**. (Only option that raises new construction, matching "too low".)
- **B:** rate is final, `premium = value × rate` → new ≈ $1,450, rehab ≈ $2,865.
- **C:** keep deductible factor, drop the 1.15/1.30 loads → same as B at $2,500.
Also asked John: should construction material still affect price, or purely project-type now?
**When John replies → edit the INSTANT QUOTE formula in Jennifer's prompt, bump v2.17, deploy.** Current formula: `premium = coverage × constructionRate(material) × deductibleMod × 1.15 × 1.30` (Frame 0.00251 / Brick 0.00242 / Masonry 0.002; deductMod 0.95/1.00/1.05 for $5k/$2.5k/$1k).

### 6. Other pending
- **Pablo (Mon):** create the 8 BR columns (§4) + GL `insurance_quote_submissions` payload/auth + what `event_type 43071621` is + `book_event` slim ETA + Swagger still lists the old host as "Production server" (errata he acknowledged).
- **Grace (BR Unified) barge-in:** caller should be able to answer the first triage question before it finishes — VAPI config (startSpeakingPlan / interruptions), NOT prompt.
- **GL binding:** Sarah likely absorbs the 22 GL questions (mirror Jennifer) — John "later".
- **Git:** order commits (cleanup / migration / binding HTML / Jennifer) + merge `chore/repo-cleanup` to `main`.
- Harmless test records left in BI: `vapi-migration-probe@farmerbrown.test` (id 1935), `v215-fieldprobe@farmerbrown.test`.

---

## Previously — 2026-05-18 — Bonds discovery (planning, no code shipped).

John forwarded an email from Tom Hester (Bonding Specialist, ext. 105) on 2026-05-16 with the data-collection questionnaire for a new **Bonds** line. José ran a Slack Q&A with Tom on 2026-05-18 to close the gaps. All of it captured in [docs/bonds-discovery.md](bonds-discovery.md). **Nothing built yet** — 4 open items need a 20-min call with John before any code:

1. Domain / phone-line strategy — does UnitedSuretyBonds.com get its own number (like buildersrisk.net) or does "Bonds" become a menu option on the existing 3 receptionists?
2. What to say when a caller fails the hard qualification (bad credit / <1yr / bankruptcy) — thank-and-end, cross-sell, or transfer to Tom anyway?
3. End-of-call cross-sell — bonds inherits the standard pattern (every line except H&A cross-sells)?
4. Tom-unavailable fallback — Tom is a single destination; what happens when he's out / on another call?

Side note from same session: **investigated 32 missed weekend calls reported by Pedro/Angie.** Confirmed via VAPI call log that NONE of them touched the AI agents — last VAPI call was 2026-05-14 16:15 UTC. Those calls came through the traditional Twilio infrastructure, not VAPI. Follow-up suggested to Pedro: audit Twilio call logs for the weekend if they want to know what happened.

---

## Previously — 2026-05-15 (full session)
**Multi-front session, none of it test-called yet.** Three big things shipped:

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

**HIGHEST — Bonds, John conversation needed before building anything:**

0. **Schedule a 20-min call with John to close the 4 open Bonds items.** All listed in [docs/bonds-discovery.md](bonds-discovery.md) §6: (a) domain / phone-line strategy for UnitedSuretyBonds.com, (b) qualification-fail behaviour, (c) cross-sell inheritance, (d) Tom-unavailable fallback. Domain decision is the blocker — it determines whether we add "Bonds" to the existing 3 receptionists or stand up a new line + new receptionist. Tom's questionnaire and answers are fully captured in the doc.

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
