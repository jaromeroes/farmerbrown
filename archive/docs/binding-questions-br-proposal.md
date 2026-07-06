# Rebecca-BR — Binding Info Questions (Proposal for Client Validation)

**Status: DRAFT for validation with John. Not final, not approved for build.** Last updated 2026-06-06. Sibling of the Rebecca-GL design (`docs/binding-stage-discovery.md`, 2026-05-19).

---

## 1. Premise

Rebecca-BR is the Builders Risk version of the post-quote **Binding Info Stage** — a separate L4 voice agent that runs *after* Jennifer delivers a Builders Risk quote and the caller accepts the gate question, and *before* the call ends, to capture commitment at the moment of pricing. It inherits the entire Rebecca-GL pattern verbatim: one agent per product line, pure data-collection (no quote engine, Nora-style), a single linear flow of short questions, a verbatim close, the same `submit_binding_info_form` endpoint (with `product_line: builders_risk`), a service-rep round-robin Calendly, a public DID so CS can forward callers in, and one `transferCall` fallback (here the BR live-agent tool `transfer_to_live_agent_builders_risk`, `7eb304a7-…`).

The core principle is **inherit, don't re-ask**: Jennifer v2.14 already captures a deep quote profile (contact, address, construction type, stories, coverage value, risk flags, etc.). Rebecca-BR must NOT repeat any of it. She only collects what binding genuinely needs *on top* of the quote. Per John, the BR list should be **shorter than GL** — so this proposal curates aggressively.

**Curation threshold (tightened this revision).** A field earns a main-flow slot only if it meets at least one of: **(a) recurs across 3+ of the six carrier forms**, **(b) John explicitly flagged it**, or **(c) it is a payment/binding necessity.** The earlier "2+ carriers" rule was too permissive — it let nearly everything in and bloated the list past the 22-question GL it is supposed to undercut. Under the 3+ threshold, single-carrier "highlighted" fields (model home, solar) lose their automatic pass and survive only if John flags them. **Highlighted ≠ recurring**: a highlight is a priority signal from *one* carrier's form, not multi-carrier recurrence — the tables below now separate the two so John can see which highlighted fields are actually single-carrier.

---

## 2. What Jennifer already captures (INHERITED — do NOT re-ask)

Reliably structured and keyed by email via `submit_quote` CP1–CP3, asked of **every** BR caller:

- **Contact:** first/last name, phone (confirmed + read back), email (upsert key), `sms_consent`
- **Project type:** new construction vs renovation (branches the whole flow)
- **Building coverage value:** new construction = estimated building value (`building_coverage`); renovation = computed existing value + renovation investment (R1 + R4)
- **New-construction-only:** total square footage of finished project (`total_square_footage` / schema `square_footage`)
- **Project address** (street, city, state, ZIP) + **mailing address** (same-or-different sub-question)
- **Form of business** (LLC, Individual, Association, Corporation, Joint Venture)
- **Role:** owner, builder, or both (`user_type`)
- **Basement** (Y/N), **number of stories**, **building type** (single/multi-family/commercial), **construction type** (Frame / Brick / Masonry Non-Combustible)
- **Coverage start date**, **deductible** ($1,000 / $2,500 / $5,000)
- **4 risk flags** (Q15–Q18): prior claims 2yr, within 25mi of Atlantic/Gulf coast, construction already started, high-risk fire zone → derived `is_high_risk`
- **Renovation-only:** existing structure value, existing sq ft, weather-proofed condition, renovation investment, load-bearing walls, work description
- **HARD-TO-PLACE sub-answers** (coastal roof/shutters; fire hydrant/station/staffing; construction-started date/percent/owners/finish-date) — **transcript-only, NOT structured**, so Rebecca cannot rely on them as inherited data fields.

> **⚠️ Blocking caveat — persisted ≠ prompt-named.** Several Jennifer field names differ between the prompt and the `submit_quote` schema (`total_square_footage` vs `square_footage`; `is_high_fire_risk` vs `high_risk_fire_zone`; `mailing_*` possibly absent from the schema; R-series labels). Rebecca cannot reliably know **which fields were actually persisted**. This is not a cosmetic "confirm the names" note: if `mailing_*` or `total_square_footage` are not persisted, the entire **confirm-don't-re-ask** strategy breaks and Rebecca must re-ask those fields. Treated as blocking open item §6.7.

---

## 3. Proposed Rebecca-BR binding questions (curated)

"Already in Jennifer?" = whether the quote stage already has it as **structured** data. "Recurrence" = count of the six carrier forms (US Assure, Appalachian, Lloyd's, CRC, Tokio, Blitz) that ask it. "Hi" = a single carrier *highlighted* the field; this is a priority hint, not recurrence.

### Block A — Binding intent & payment (inherited GL structure; ALL callers)

| Question | Source / recurrence | Already in Jennifer? | Conditional? | Note |
|---|---|---|---|---|
| What effective date are you looking for the policy? | Rebecca-GL Q1; all carriers | Partial — Jennifer has "coverage start date" | No | If inherited coverage date exists, **confirm not re-ask**: "We have you starting [date] — still correct?" |
| Annual or monthly payments? (options will be sent) | Rebecca-GL Q2; Lloyd's "payment option" | No | No | Verbatim GL pattern. |
| Confirm the total insured value for binding. | All 6 carriers (completed/insured value) | YES — but renovation value is **computed** (R1+R4), not caller-stated | No | **Definite confirm for renovation callers** ("We have the project insured at $X — correct?"). A computed figure is exactly what a binding stage must human-confirm; do not leave conditional. |

### Block B — Project scope (John's flagged adds; ALL callers)

| Question | Source / recurrence | Already in Jennifer? | Conditional? | Note |
|---|---|---|---|---|
| Estimated length of the project? | **John #1** ("great question"); recurs 6/6 as policy period/term | No | No | John's top ask. Maps to policy term/duration. |
| Total square footage of the project? | **John #2**; recurs 5–6/6 | **Partial — Jennifer asks this on NEW CONSTRUCTION only** | **Renovation-only** | See §4/§5 — **confirm-don't-re-ask** on new construction; ask only on renovation path (subject to §6.7 persistence check). |
| Are there any separate structures? | **John #3**; US Assure "more than one building/structure" | No | No | Y/N. **Open question §6.8:** on "yes," capture count + value now, or defer to service rep? Affects whether Jennifer's single-building value still holds. |
| Will the structure be occupied during the policy term? | US Assure (Hi); Tokio "occupied during construction" — recurs 2/6 | No | No | Survives on **recurrence + John-adjacent scope**, not the highlight alone. |
| Expected completion date of the project? | US Assure (Hi); Blitz planned end date; Lloyd's period; Appalachian — recurs ~4/6 | Partial — only if construction already started (**transcript-only, unreliable**) | No | Structured field binding needs regardless of start status. Correctly does NOT rely on the transcript-only inherited value. |
| GC / builder years of experience? | **NEW THIS REVISION** — US Assure (≥2yr eligibility), Lloyd's, Tokio, Blitz — recurs **4/6** | No (Jennifer has `user_type`, never experience) | No | Cheap single number, strong recurrence, explicit US Assure eligibility gate. On owner-only policies (Block E) this is the **GC's** experience. |

### Block C — Construction / property details

| Question | Source / recurrence | Already in Jennifer? | Conditional? | Note |
|---|---|---|---|---|
| Is the structure modular / prefab / mobile? | US Assure, Lloyd's, CRC, Blitz — recurs **4–5/6** | No (Jennifer's `construction_type` ∈ {Frame/Brick/Masonry} excludes modular) | No | Genuine add. Phrase as **additive** ("Is it modular or prefab?"), not as re-opening construction type. |
| Year built / building age | **PROMOTED FROM APPENDIX** — Appalachian (Hi, remodel), Lloyd's, CRC — recurs **3/6** | No — **NOT subsumed by Jennifer's R-series** (R-series = existing value, sq ft, condition, investment, load-bearing, work desc; none is age) | **Renovation-only** (new construction has no meaningful "year built") | Earlier draft wrongly appendix'd this; 3-carrier + highlighted field belongs in the main flow. |
| Intended occupancy / **use** of the finished structure? | US Assure (Hi); Blitz, Appalachian classification — recurs 3/6 | Partial — Jennifer's `building_type` already encodes residential vs commercial | No | **Reworded to remove the re-ask.** Must ask the **use/occupancy nuance** (owner-occupied vs spec/rental vs commercial-use) — NOT "residential or commercial?", which `building_type` already answers. |
| ~~Is this a model home?~~ | US Assure ONLY (Hi) — recurs **1/6** | No | — | **DROPPED to Appendix (default).** Single-carrier; survived only on the highlight. Include only if John explicitly asks for it. |
| ~~Solar installation on the project?~~ | US Assure ONLY (Hi) — recurs **1/6** | No | — | **DROPPED to Appendix (default).** Single-carrier; highlight ≠ recurrence. Re-add only on John's flag. |
| Number of stories / construction type / building type | recurs 6/6 | **YES — Jennifer captures all three** | — | **DO NOT re-ask.** Listed only to mark as inherited. |

### Block D — Fire protection / protection class

| Question | Source / recurrence | Already in Jennifer? | Conditional? | Note |
|---|---|---|---|---|
| ISO protection class (PPC 1–10)? | **NEW THIS REVISION** — US Assure, Lloyd's, CRC, Tokio — recurs **4/6** | No (Jennifer has fire-zone Y/N + transcript-only hydrant/station — **not** the structured rating field) | No | **The biggest omission in the prior draft.** Protection class is a core BR rating field in 4/6 carriers and is the structured field carriers actually rate on. Ask it outright. |
| Distance to nearest fire station / hydrant within 500ft? | US Assure; Tokio "hydrant within 500ft" — recurs 2/6 | Partial — Jennifer's fire branch is **transcript-only**, so Rebecca **cannot programmatically know** it was flagged | No | **"Skip if already flagged" does NOT work** — the inherited fire data is unstructured. Either fold into protection-class capture above or drop; do not condition on inheritance Rebecca can't read. |

### Block E — Interests / mortgagee (John flag + most carriers)

| Question | Source / recurrence | Already in Jennifer? | Conditional? | Note |
|---|---|---|---|---|
| Name of the mortgage broker? | **John #6**; US Assure/Appalachian/Blitz "additional interest / lender / mortgagee" | No | No | See §6.6 — its relationship to John #7 is ambiguous and must be resolved before Block G is designed. |
| Name + city/state of the General Contractor (+ GC years experience, Block B) | **John #4** | No | **Owner-only policies** (`user_type = owner`) | Branching rule §5. Skip for builder/both — they *are* the GC. On owner-only, also attach the GC-experience figure here. |
| Name + city/state of the developer | **John #5** | No | **Opt-in only** ("only if they want to include it") | Branching rule §5. Capture name **+ city/state** per John's literal text. |

### Block F — Eligibility attestations (LIGHT touch — 3 consolidated Y/N)

| Question | Source / recurrence | Already in Jennifer? | Conditional? | Note |
|---|---|---|---|---|
| Properly licensed and bonded? | Lloyd's, Blitz, Tokio — recurs 3/6 | No | No | High-recurrence; single Y/N. |
| Any bankruptcy, foreclosure, or insurance cancelled/non-renewed in last 5 years? | Lloyd's, Tokio, CRC, Blitz — recurs 3–4/6 | No | No | **Three concerns consolidated into ONE Y/N** to honor the brevity mandate. |
| BR/property claims in last 3 years? | All 6 carriers | **Partial** — Jennifer asks prior claims past 2yr | No | **Open question §6.5:** rely on Jennifer's 2yr flag, or re-ask the 3yr window most BR carriers use? |
| ~~Signed written contract for the work?~~ | Lloyd's + Blitz-implied — recurs 2/6 | No | — | **DROPPED to hit 3 attestations** (only 2-carrier). Re-add only if the chosen primary carrier requires it. |

> **Deliberately NOT proposing** Tokio's full 20 declinable eligibility questions (welding/LPG/asbestos/dredging/mining/landfill/oil fields/etc.) in the main flow — that alone is longer than the whole GL binding list and contradicts John's "shorter list." Parked in the Appendix pending John's call on attestation aggressiveness.

### Block G — Cross-sell (John #7 — NEW vs Rebecca-GL, which has no cross-sell)

> **⚠️ Design blocked on §6.6.** John #7's literal text tells the *caller* to email `info@buildersrisk.net` ("send any email with your mortgage broker or processor's name and email… and we'll ask"). The flow below assumes Rebecca *captures + routes* it instead, which is a **reinterpretation**, not John's words. Do not build Block G until §6.6 is resolved.

| Step | Source | Note |
|---|---|---|
| Offer $1,000,000 GL for the project for **around $500**: *"We highly recommend it and it's sometimes required by your mortgage company."* | **John #7** | Spoken offer. Y/N capture (`gl_addon_interest`). Confirm "around $500" stays soft vs a firm figure (§6.6). |
| Capture mortgage broker/processor **name + email** → tell caller it goes to `info@buildersrisk.net` for follow-up | **John #7 (interpreted)** | Reuses Block E mortgage-broker name; adds email. **Contingent on §6.6.** |

---

## 4. John's 7 feedback items — explicit mapping

1. **Estimated length of project** → **NEW question**, Block B. (John called it a "great question.") Maps to carrier policy term/duration (6/6).
2. **Total square footage of project** → ⚠️ **REDUNDANCY FLAG.** Jennifer v2.14 *already asks this on the NEW CONSTRUCTION path* (`total_square_footage`). Proposal: **renovation-only** in Rebecca-BR, and on new construction **confirm rather than re-ask** ("We have [N] square feet on file — correct?"). Subject to the §6.7 persistence check — if the field persists under `square_footage` and Rebecca reads `total_square_footage`, the confirm reads null and she re-asks anyway.
3. **Separate structures?** → **NEW question**, Block B (Y/N). Open follow-up §6.8 (count + value now, or defer).
4. **GC name + city/state** → **NEW question, conditional**: only on **Owner-only** policies (`user_type = owner`); skip builder/both. Attach GC years-of-experience here (ties to the new recurrence add). Branching rule §5.
5. **Developer name + city/state** → **NEW question, opt-in only**. Branching rule §5.
6. **Mortgage broker name** → **NEW question**, Block E. Its relationship to #7 (capture-and-route vs tell-caller-to-email) is unresolved — §6.6.
7. **GL cross-sell + mortgage-broker email capture** → **NEW cross-sell flow**, Block G. The one place Rebecca-BR *diverges* from Rebecca-GL (which has **no** cross-sell). **Two confirmations needed (§6.6):** (a) cross-sell belongs here at all despite the GL precedent, and (b) does Rebecca *capture+route* the broker email, or merely *tell the caller* to email `info@buildersrisk.net` themselves — the latter is John's literal text and implies a human follow-up loop the agent doesn't own.

---

## 5. Branching rules

- **DID-origin callers with NO Jennifer quote (was an open question only — now an explicit branch).** When CS forwards a caller straight into Rebecca-BR, no upstream `email`/quote record exists and **every "inherited" field above becomes a must-ask** — the entire inherit-don't-re-ask premise collapses. Rule: if no upstream quote record is found, Rebecca must either **(a)** collect a minimal core profile first (contact, address, project type, construction type, coverage value) before the binding questions, or **(b)** hand the caller back to a quote agent. Final choice pending §6.1, but §5 no longer silently assumes a Jennifer record always exists.
- **GC name (John #4) — Owner-only.** Jennifer captures `user_type` (owner / builder / both). Ask GC name + city/state **+ GC years experience only if `user_type = owner`**; skip for `builder` and `both` (they *are* the GC).
- **Developer name (John #5) — opt-in.** Ask once: "Would you like to include a developer on the policy?" → if yes, capture name + city/state; if no, skip. Never forced.
- **Total sq ft (John #2) — path-dependent.** New construction: inherited from Jennifer → **confirm only** (subject to §6.7). Renovation: Jennifer skips it → **ask it**.
- **Year built (new this revision) — renovation-only.** New construction has no meaningful build year; ask only on the renovation path.
- **New construction vs renovation value (carrier divergence).** Carriers split coverage value differently (Appalachian hard-cost vs renovation-cost+existing; Lloyd's existing-structure vs work-performed). Jennifer **already resolves this**; Rebecca **inherits, does not re-derive**, and **confirms the total for renovation callers** (Block A row 3) because that value is computed, not caller-stated.
- **Fire protection / protection class.** Ask ISO protection class outright (Block D). Do **not** condition the hydrant/station question on Jennifer's fire-zone flag — that data is transcript-only and Rebecca cannot read it programmatically.
- **GL cross-sell (John #7) — contingent on §6.6.** If approved: after the data blocks, before the close, speak the $1M-for-~$500 offer → capture Y/N interest → (if capture-and-route model) capture broker name + email → tell caller it routes to `info@buildersrisk.net`. Cross-sell does **not** branch the rest of the flow; a "no" still books the binding appointment.
- **Close version.** Use the Rebecca-GL **v1.0 *booking* close** (books the service-rep round-robin appointment), **not** the v0.1 *spoken-only* close — with BR branding. The earlier "verbatim service-rep close" was ambiguous about which version.

---

## 6. Open questions FOR JOHN (close these on the call)

1. **Public-DID callers without a Jennifer quote.** When CS forwards a caller straight into Rebecca-BR, the inherited fields don't exist. Does Rebecca **re-ask the core quote profile** (option a in §5), or do we require a Jennifer quote first / hand those callers back (option b)? Materially changes list length for DID-origin calls.
2. **Eligibility-attestation aggressiveness.** Light touch (the 3 consolidated Y/N in Block F: licensed/bonded, bankruptcy-or-cancellation, claims) vs Tokio-style **20 declinable** questions. Recommendation: light touch for v1 to honor "shorter list"; escalate per chosen carrier's true requirements. Which way?
3. **Primary carrier(s).** Which carrier(s) actually bind BR business? Sizing the list to the *real* primary carrier(s) is the single biggest lever on length. (Forms range from Appalachian's short list to US Assure/Tokio's exhaustive ones.)
4. **GL cross-sell mechanics (#7).** Real-time tool (actually create a GL lead / quote during the call) or **spoken promise + email capture only** to `info@buildersrisk.net`? Recommendation: v1 = spoken + capture, no live tool.
5. **Claims window.** Rely on Jennifer's inherited 2-year prior-claims flag, or re-ask the **3-year** window most BR carriers use?
6. **Cross-sell + John #7 literal text (TWO sub-questions).** (a) Does cross-sell belong in Rebecca-BR at all, given Rebecca-GL has none by design? (b) Does Rebecca **capture the mortgage-broker name+email and route it**, or **tell the caller to email `info@buildersrisk.net` themselves** (John's literal "and we'll ask" text)? Sub-question (b) blocks Block G's whole design and was unflagged in the prior draft. Also confirm whether the GL price stays "around $500" (soft) or a firm number.
7. **Persisted inherited fields (BLOCKING).** Confirm the *persisted* (not prompt-named) Jennifer fields before deciding what Rebecca confirms vs re-asks. Mismatches found: `total_square_footage` vs `square_footage`; `is_high_fire_risk` vs `high_risk_fire_zone`; `mailing_*` possibly not persisted; R-series labels. If these aren't persisted as expected, confirm-don't-re-ask breaks and Rebecca must re-ask.
8. **Separate-structures follow-up (John #3).** On a "yes," do we capture count + value per structure now (US Assure asks "total completed value any one structure" AND "all property"), or defer entirely to the service rep? Affects whether Jennifer's single-building inherited value is still valid.
9. **Appendix exotic fields — include or drop?** (crime score, soft costs, scaffolding, dome/green/experimental construction, civil-works, tribal lands, model home, solar, etc.) Default recommendation: **drop from v1**, revisit per primary carrier.
10. **Shared with GL discovery (inherit answers):** real existing-quote phone for any gate-No / fallback wording; **service-rep Calendly event-type UUID** (round-robin) for `book_appointment_service_rep`; backend owner for `submit_binding_info_form` — note CLAUDE.md says Tyler but MEMORY flags **Pablo** now owns the Calforce backend; confirm.

---

## 7. Appendix — single-carrier / exotic fields (parked for later)

Not proposed for v1; surface only if the chosen primary carrier requires them.

- **Demoted this revision (single-carrier, were in main flow on a highlight alone):** model home (US Assure only), solar installation (US Assure only). Re-add to the main flow only on John's explicit flag.
- **US Assure / Zurich:** protection class follow-ons; previous damage by peril (quake/flood/wind/fire/vandalism); long additional-coverages menu — debris removal, ordinance/law, demolition, increased cost of construction, pollution, **scaffolding**, transit, valuable papers, change-order endorsement %, earthquake, flood, testing, **soft costs**, wind coverage + wind/hail deductible %; water source if no hydrants; # structures next 12 months; single loss >$10k last 3yr.
- **Lloyd's / Inland Marine:** contractor license #/type, applicant DL#, **crime score**, ACV valuation, property use prior to construction, demolition/underpinning/lead/asbestos/pollutant, homeowner-named-additional-insured-on-GL, CGL ≥ $1M/occurrence.
- **CRC Tapco:** roof built/update year, $5,000 theft extension buyback, coverage type (Basic/etc.).
- **Tokio Marine:** owner/officer **SSN**, theft-peril deductible, terrorism include/not, how jobsite secured; the **20 declinable eligibility questions** (welding/hot work, LPG, asbestos, bridge building, dredging, farming, mining, landfill, oil fields, structural demolition, mobile home, bankruptcy 10yr, historical landmark, cancelled/non-renewed, repair-due-to-prior-damage, pilings/wastewater/civil works, unconventional materials, condos/townhouse/timeshare, >10-house dev, work above 3 stories exterior).
- **Blitz:** delayed/abandoned project, change in GC, tribal lands, hot work, **seismic retrofitting**, protective safeguards (fenced/lighted), subsidiary, period of restoration for Delay-in-Completion business income, condos/townhomes >15 units.
- **Appalachian:** building-age detail beyond the year-built field now in Block C; remodel classification minutiae — confirm against Jennifer's renovation R-series.

---

Authoritative anchors: `docs/binding-stage-discovery.md` (GL design, §3 question list, §6 open items) and `agents/rebecca-general-liability-binding/` (v0.1 DRAFT pattern to mirror). This BR proposal reuses all DECIDED architecture verbatim; only the BR-specific question list, phone/Calendly/DID values, and the John #7 cross-sell are net-new and require John's sign-off before build.