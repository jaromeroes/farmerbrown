# Twilio Account Audit — Farmer Brown

**Account:** info@farmerbrown.com (US1 region)
**Account SID:** AC450cf8…aa788 (full SID redacted; available in `.env`)
**Audit date:** 2026-04-27
**Activity window analyzed:** 2026-01-27 → 2026-04-27 (last 90 days)

---

## TL;DR

- The Twilio account holds **28 phone numbers**.
- **Year-to-date 2026 spend (Jan 1 → Apr 27, ~4 months): $1,637.66**, which extrapolates to a **~$410/month run rate (~$4,900/year)**.
- The single largest cost item is **recording storage at ~$304/month** (~74% of the bill) — Twilio is currently storing **~2.4 million minutes (~46,000 hours) of call recordings**, and that storage cost recurs every month. This is the largest single optimization opportunity in the account.
- Phone-number rentals are a smaller cost: ~$64/month for all 28 numbers combined.
- Of the 28 numbers, **3 are wired to the new VAPI AI agent stack**, **22 forward calls to other numbers via TwiML Bins** (legacy answering / dial setup), **2 run on a Twilio Studio Flow**, and **1 is unconfigured** (still pointing at Twilio's default demo URL).
- The bulk of the inventory is not currently part of the Farmer Brown AI call center plan. The strategic value of cleaning up is having a clear, owned, documented phone footprint — and a smaller storage bill — before the AI rollout scales.

---

## What is connected to what (routing inventory)

The single most important finding: **only 3 of the 28 numbers in this Twilio account currently route inbound calls to VAPI.** The rest predate the AI call center project.

| Where the call goes | Count | Numbers |
|---|---|---|
| **VAPI** (`https://api.vapi.ai/twilio/inbound_call`) | 3 | `+1 (888) 435-6365` Toll-Free CL AI Agent · `+1 (888) 293-4492` Toll-Free BR AI Agent · `+1 (702) 710-8075` LasVegas Test (used by José for QA) |
| TwiML Bin (`<Dial>` forward to another number) | 22 | The rest of the legacy inventory — see "Legacy / non-AI inventory" below |
| Twilio Studio Flow `FWbc0ac9…` | 2 | `+1 (832) 734-8760` Luis Nicole Local · `+1 (844) 770-7979` Luis & Nicole Toll-Free Website |
| Twilio default demo URL (unconfigured) | 1 | `+1 (659) 274-2234` |

The Studio Flow used by the Luis & Nicole numbers exists in the account but the audit could not read its content (the API call requires elevated permissions). Worth a 2-minute look in the Console to confirm what it does.

---

## How much is being paid

Period analyzed: **January 1, 2026 → April 27, 2026** (~4 months of YTD 2026 data).

### Total spend YTD 2026

| Period | Amount |
|---|---|
| YTD 2026 (Jan 1 – Apr 27) | **$1,637.66** |
| Implied monthly run rate | **~$410/mo** |
| Implied annual run rate | **~$4,900/yr** |

### Breakdown by category (YTD 2026)

| Category | YTD 2026 | Monthly avg | Share of bill |
|---|---|---|---|
| **Recording storage** (cumulative, ~2.4M minutes stored) | $1,214.47 | ~$304/mo | **74%** |
| Phone number rentals (all 28 numbers) | $257.15 | ~$64/mo | 16% |
| Voice calls (inbound + outbound, ~7,000 minutes) | $117.72 | ~$29/mo | 7% |
| "Channels" (Twilio Connect / SDK) | $40.60 | ~$10/mo | 2% |
| A2P 10DLC fees (SMS sender registration) | $40.00 | ~$10/mo | 2% |
| Other (recordings new, media streams, SMS/MMS) | < $20 | < $5/mo | < 1% |

### What's driving the bill
- **Recording storage dominates.** Twilio charges ~$0.0005 per recorded-minute per month for stored recordings. This account currently has ~2.4 million stored minutes (~46,000 hours) of call audio, accumulated over years. **This is the single largest optimization opportunity in the account.** Two paths: (a) purge old recordings via the Twilio API or Console; (b) migrate the recording archive to S3 (much cheaper for cold storage) and reference from there.
- **Phone-number rentals are a small share** (~$64/mo for all 28). Even an aggressive cleanup of the inventory will only save a handful of dollars per month on rentals.
- **A2P 10DLC fees** are a fixed compliance cost for any Twilio account that sends marketing/notification SMS in the US. They will not change with phone-number cleanup; they are a function of which Brand/Campaign registrations are active in the account.

---

## Master Data — Per-number inventory

Canonical reference for all 28 numbers in the account, consolidating routing, cost, 90-day activity, the destination of forwarded calls, and the **owner / purpose identified** during the audit (via web research, Trustpilot reviews, public listings, and the Farmer Brown company website). Use this as the single source of truth for cleanup decisions. Deeper per-number activity (distinct callers, distinct active days, SMS detail) is in Appendix B.

**Status legend:**
- **KEEP — Production:** in active production use for the AI call center or for a confirmed live FB workflow.
- **KEEP — FB internal:** identified as belonging to a specific FB agent, office, or product line; release would disrupt real customer flow.
- **VERIFY:** activity exists but the owner, purpose, or value is not fully confirmed; check with John or the owning team before any change.
- **INVESTIGATE:** specific anomaly (broken workflow, public listing mismatch, unknown forward destination) that needs attention before deciding.
- **RELEASE candidate:** no clear current value; release would lower cost without disrupting any identified workflow.

Type abbreviations: **TF** = US toll-free ($2.15/mo), **L** = US local ($1.15/mo), **I** = international ($3.00/mo).
Forward destinations are abbreviated as `area-code (city / role)`. Personal mobile numbers are anonymized; FB-internal office destinations are shown for verification.

| Phone | Type | $/mo | Routing | Friendly name (Twilio) | Calls 90d | Forwards → | Owner / Purpose (identified) | Status |
|---|---|---|---|---|---|---|---|---|
| +1 (888) 435-6365 | TF | $2.15 | VAPI | Toll-Free – CL AI Agent | 20 | n/a (VAPI handles) | CL line of the AI call center, attached to a VAPI Squad | KEEP — Production |
| +1 (888) 293-4492 | TF | $2.15 | VAPI | Toll-Free – BR AI Agent | 8 | n/a (VAPI handles) | BR line of the AI call center | KEEP — Production |
| +1 (702) 710-8075 | L | $1.15 | VAPI | LasVegas Test Phone | 84 | n/a (VAPI handles) | Internal QA / test number for the BR VAPI flow (José) | KEEP — Production (test, releasable when QA done) |
| +1 (855) 935-2108 | TF | $2.15 | TwiML Bin | Camila Video phone (to 3125867580) | 255 | 312-319-5865 (Chicago) | **Camila Atehortúa**, FB agent (confirmed via Trustpilot reviews). Highest-volume number in the account: 209 unique callers / 58 active days in 90d. Despite the "to 3125867580" label, the actual forward target is 312-319-5865 (label out of date). | KEEP — FB internal (notify Camila before any change) |
| +1 (855) 261-5344 | TF | $2.15 | TwiML Bin | Laura's Videos | 51 | 726-203-4943 (San Antonio HQ) | **Laura**, FB agent in San Antonio HQ. 38 unique callers / 31 active days. Forwards to FB's San Antonio reception. | KEEP — FB internal (notify Laura / SA HQ before any change) |
| +1 (855) 958-1897 | TF | $2.15 | TwiML Bin | Razelle Videos | 10 | 726-203-4943 (San Antonio HQ) | **Razelle**, FB agent (confirmed via Trustpilot reviews). Forwards to FB's San Antonio reception. | KEEP — FB internal (notify Razelle / SA HQ before any change) |
| +1 (888) 966-9025 | TF | $2.15 | TwiML Bin | PHONE FOR VIDEOS EN | 20 | 726-203-4943 (San Antonio HQ) | English-language general intake line; routes to FB San Antonio HQ reception. Possibly used in marketing collateral or email signatures. | KEEP — FB internal (verify with SA HQ) |
| +1 (877) 693-1602 | TF | $2.15 | TwiML Bin | videos from 4 sites CL+BR+SBL+FB | 29 | 773-809-5980 (Chicago office) | Cross-brand intake covering Contractors Liability + Builders Risk + **SBL = Surety Bond Line** + Farmer Brown. Routes to Chicago office. 29 unique callers / 29 active days = 1-call-per-caller pattern (one-shot intake). | KEEP — FB internal (verify with Chicago office) |
| +1 (888) 838-3116 | TF | $2.15 | TwiML Bin | FB.com (condo) fw to condo | 26 | 224-323-6688 (Chicago suburbs) | FB **Condo** product line. Forwards to the FB condo team in Chicago suburbs. 25 unique callers / 23 active days = real workflow. | KEEP — FB internal (FB Condo product) |
| +1 (833) 919-2886 | TF | $2.15 | TwiML Bin | (AUTO) | 33 | 726-203-4943 (San Antonio HQ) | FB **AUTO / Personal Lines Auto** product line. Forwards to FB San Antonio HQ. 33 unique callers in 30 days = real workflow. | KEEP — FB internal (FB AUTO product) |
| +1 (773) 492-8950 | L | $1.15 | TwiML Bin | "Old Thai Lotus Number" | 29 | 726-203-4943 (San Antonio HQ) | **Liability finding:** this number is currently published as the main contact for **Thai Lotus Bodywork** (Chicago Thai-massage business) on Yelp, TripAdvisor, Facebook and Instagram. FB owns it in Twilio; calls intended for the massage business land in FB Twilio and forward to FB SA HQ. 29 calls / avg 34 seconds each = wrong-number pattern. No identified business value to FB. | INVESTIGATE → likely RELEASE |
| +1 (888) 684-0539 | TF | $2.15 | TwiML Bin | Personal Lines Spanish | 4 | 773-782-1882 (Chicago) | FB **Personal Lines Spanish** line. Receives calls but **all 4 had 0 minute duration** (line broken or callers hang up immediately). Strongest candidate to **repurpose for the upcoming Spanish AI agent**. | VERIFY → repurpose candidate for ES VAPI agent |
| +1 (866) 704-0510 | TF | $2.15 | TwiML Bin | FB BONDS | 3 | 224-323-6661 (Chicago suburbs) | FB **Bonds** product line. Same Chicago-suburbs target as FB Condo (sister team). Only 3 calls in 90d, all 0 minute duration → line possibly broken. | VERIFY (broken workflow?) |
| +1 (888) 496-2029 | TF | $2.15 | TwiML Bin | Farmerbrown Builders Risk | 1 | 312-224-8312 (Chicago) | Likely the **previous BR public number**, now superseded by the VAPI line +1 (888) 293-4492. 1 call in 90d. | VERIFY → likely RELEASE once BR migration confirmed complete |
| +1 (312) 584-8011 | L | $1.15 | TwiML Bin | FB License & Permit Bonds | 0 | (no calls) | Old FB **License & Permit Bonds** product line. No traffic in 90d. Possibly retired product. | RELEASE candidate (verify product still sold) |
| +1 (832) 734-8760 | L | $1.15 | Studio Flow | Luis Nicole Local | 3 | (Studio Flow) | **Luis & Nicole** workflow (specific FB agents/contacts). Voice volume tiny but **28 outbound SMS in the last week** — actively used for messaging campaigns. | KEEP — FB internal (Luis & Nicole, SMS-active) |
| +1 (844) 770-7979 | TF | $2.15 | Studio Flow | Luis & Nicole Toll-Free Website | 25 | (Studio Flow) | **Luis & Nicole** website-facing toll-free. 25 unique callers, all on distinct days (one call per caller). Likely landing-page or web-form CTA. | KEEP — FB internal (Luis & Nicole) |
| +1 (866) 245-0034 | TF | $2.15 | TwiML Bin | USB | 7 | 312-878-2372 (Chicago) | **"USB" acronym opaque** — does not match any standard insurance term and not found on FB's website (which uses COI, HCC, USLI). Could be internal team initials, partner, or campaign code. 7 unique callers / 6 active days = small but real workflow. | UNCLEAR — needs John to identify what "USB" means at FB |
| +1 (865) 684-4023 | L | $1.15 | TwiML Bin | Email Campaign +1 865 684 4023 | 2 | 726-203-4943 (San Antonio HQ) | Email-campaign tracking number. Tiny volume. Forwards to SA HQ. | VERIFY (which email campaign? still active?) |
| +1 (312) 854-7710 | L | $1.15 | TwiML Bin | Fw to Assigned Risk Group | 0 | (no calls) | Legacy forwarder for the old "Assigned Risk Group" workflow. No traffic. | RELEASE candidate |
| +1 (312) 561-4622 | L | $1.15 | TwiML Bin | TEST NUMBER (DO NOT EDIT) | 3 | +34 … (Spain mobile) | **Anomaly:** labeled TEST DO NOT EDIT but actually forwards to a Spanish mobile (+34). Owner unknown. Last call February. | INVESTIGATE — who owns the +34 forward? |
| +1 (773) 492-8571 | L | $1.15 | TwiML Bin | TEST NUMBER DO NOT USE | 1 | 312-444-0769 (Chicago) | Residual test number. 1 call in 90d to a Chicago local. | RELEASE candidate |
| +1 (312) 500-4290 | L | $1.15 | TwiML Bin | (312) 500-4290 LFR | 1 | +57 … (Colombia mobile) | **Anomaly:** US local that forwards to a Colombian mobile. Only 1 call in 90d. "LFR" meaning unknown. | INVESTIGATE → likely RELEASE |
| +1 (312) 321-8918 | L | $1.15 | TwiML Bin | ContractorDigitalSolution LTC | 0 | (no calls) | Old vendor / partner reference ("Contractor Digital Solution"). No traffic. | RELEASE candidate |
| +1 (626) 901-3742 | L | $1.15 | TwiML Bin | (no friendly name) | 0 | (no calls) | Orphan number, no label, no traffic. | RELEASE candidate |
| +1 (659) 274-2234 | L | $1.15 | Twilio demo | (no friendly name) | 0 | (no calls) | **Completely unconfigured** — voice URL still points to Twilio's default demo (`demo.twilio.com`). Has been paid for but never set up. | RELEASE candidate (or configure if needed) |
| +1 (773) 974-1995 | L | $1.15 | TwiML Bin | (no friendly name) | 0 | (no calls) | Orphan number, 0 voice but received 1 SMS (likely 2FA / wrong number / verification). | RELEASE candidate |
| +57 6045906071 | I | $3.00 | TwiML Bin | (no friendly name) | 0 | (no calls) | International (Colombia) number, no label, no traffic. Most expensive rental in the account. | RELEASE candidate (highest-priority release) |

### Status summary

| Status | Count | Combined rental |
|---|---|---|
| KEEP — Production (VAPI) | 3 | $5.45/mo |
| KEEP — FB internal | 10 | $20.65/mo |
| VERIFY (broken / superseded / unconfirmed) | 4 | $7.45/mo |
| INVESTIGATE (anomalies) | 3 | $3.45/mo |
| UNCLEAR (USB) | 1 | $2.15/mo |
| RELEASE candidate | 7 | $8.90/mo |
| **Total** | **28** | **$48.05/mo** |

A clean release of the 7 candidates yields ~$8.90/mo (~$107/yr) in rental savings — modest. The larger savings opportunity remains the recording-storage cleanup (~$304/mo).

---

## Account hygiene

- **0 SIP Trunks**, **0 Messaging Services** in use.
- **1 Studio Flow** in use (the Luis & Nicole flow).
- **1 leftover sandbox TwiML App** (`Sandbox App`) pointing at `demo.twilio.com` — appears unused.
- **4 active API keys** ranging from 2019 (`checkfront-sms-ebike`) to 2022 (Studio, Zapier transcription) — worth reviewing whether the corresponding integrations are still in use.

---

## Open questions for the client

1. **Group A — video/answering numbers:** who owns this workflow? Is it active business or legacy?
2. **Group B — FB product lines:** are the Bonds, Condo, License & Permit Bonds, and Personal Lines Spanish products still being marketed? Can `+1 (888) 684-0539` (Personal Lines Spanish) be repurposed for the upcoming AI agent's Spanish line?
3. **Group C — Luis & Nicole:** are these personal/agent lines that should remain as-is, or part of a workflow that should be folded into the AI call center?
4. **Group D — TEST numbers:** who owns the forward to the Spanish (+34) mobile?
5. **Marketing collateral:** do any of the low-activity / unlabeled numbers appear on business cards, certificates, ad creatives, or web pages? (Critical before any release.)
6. **Subaccounts:** does this Twilio account have any subaccounts that we should also audit? (Standard API key cannot list them; the master Auth Token can.)

---

## Appendix — methodology

- Data pulled via Twilio REST API (Standard API key, read-only).
- Endpoints used: `/IncomingPhoneNumbers`, `/Calls` (last 90d, paginated), `/Messages` (last 90d), `/Usage/Records/Monthly`, `/Applications`, `/Trunks`, `/v1/Services` (Messaging Services).
- Forwarding destinations were inferred by pairing inbound calls with their child `outbound-dial` legs in the Calls log. Personal mobile numbers identified during the analysis are not reproduced here.
# Appendix B — Granular usage per number (last 90 days)

**How to read this section.** Each block describes a single Twilio number. The fields are:

- **Routing:** where Twilio sends inbound calls. `VAPI` = wired to the AI agent stack; `TwiML Bin` = simple `<Dial>` forward; `Studio Flow` = Twilio Studio workflow; `Twilio demo` = unconfigured.
- **Voice IN:** total inbound calls in the 90-day window, total minutes, **distinct callers** (helps separate real workflows from accidental / wrong-number traffic), **distinct active days** (how spread out the activity is), and date of the last call.
- **Forwarded out:** the bridge legs the number generated when it forwarded calls — useful to distinguish "rang but nobody connected" (~0 min) from "real conversation happened".
- **SMS IN / OUT:** message counts and date of the last message.

Numbers are grouped by routing type and sorted by inbound-call volume.

---

## Routing: VAPI

### `+17027108075` — LasVegas Test Phone (702) 710-8075
- **Type:** local-us · **Rental:** $1.15/mo · **Routing:** VAPI
- **Voice IN (90d):** 84 calls · 248.9 min · 10 distinct callers · 27 distinct active days (30% of window) · last call 2026-04-20
- **Forwarded out (bridge legs):** 5 legs · 0.5 min actually bridged · top destinations: +1877960XXXX (5)
- **SMS IN:** 0 (last —) · **SMS OUT:** 0 (last —)

### `+18884356365` — Toll-Free - Contractors Liability AI Agent. (888) 435-6365
- **Type:** toll-free · **Rental:** $2.15/mo · **Routing:** VAPI
- **Voice IN (90d):** 20 calls · 22.1 min · 2 distinct callers · 3 distinct active days (3% of window) · last call 2026-04-20
- **Forwarded out (bridge legs):** 11 legs · 0.8 min actually bridged · top destinations: +1888973XXXX (11)
- **SMS IN:** 0 (last —) · **SMS OUT:** 0 (last —)

### `+18882934492` — Toll-Free - Builder's Risk AI Agent. (888) 293-4492
- **Type:** toll-free · **Rental:** $2.15/mo · **Routing:** VAPI
- **Voice IN (90d):** 8 calls · 27.9 min · 2 distinct callers · 5 distinct active days (6% of window) · last call 2026-04-13
- **Forwarded out (bridge legs):** 1 legs · 0.2 min actually bridged · top destinations: +1888973XXXX (1)
- **SMS IN:** 0 (last —) · **SMS OUT:** 0 (last —)

## Routing: TwiML Bin

### `+18559352108` — (855) 935-2108 Camila Video phone to 3125867580
- **Type:** toll-free · **Rental:** $2.15/mo · **Routing:** TwiML Bin
- **Voice IN (90d):** 255 calls · 918.4 min · 209 distinct callers · 58 distinct active days (64% of window) · last call 2026-04-15
- **Forwarded out (bridge legs):** 255 legs · 918.0 min actually bridged · top destinations: +1312319XXXX (255)
- **SMS IN:** 0 (last —) · **SMS OUT:** 0 (last —)

### `+18552615344` — (855) 261-5344 Laura's Videos phone
- **Type:** toll-free · **Rental:** $2.15/mo · **Routing:** TwiML Bin
- **Voice IN (90d):** 51 calls · 479.1 min · 38 distinct callers · 31 distinct active days (34% of window) · last call 2026-04-20
- **Forwarded out (bridge legs):** 51 legs · 479.1 min actually bridged · top destinations: +1726203XXXX (51)
- **SMS IN:** 1 (last 2026-02-16) · **SMS OUT:** 1 (last 2026-02-16)

### `+18339192886` — (833) 919-2886 (AUTO)
- **Type:** toll-free · **Rental:** $2.15/mo · **Routing:** TwiML Bin
- **Voice IN (90d):** 33 calls · 159.2 min · 33 distinct callers · 30 distinct active days (33% of window) · last call 2026-04-23
- **Forwarded out (bridge legs):** 33 legs · 159.2 min actually bridged · top destinations: +1726203XXXX (33)
- **SMS IN:** 0 (last —) · **SMS OUT:** 0 (last —)

### `+17734928950` — (773) 492-8950 Old Thai Lotus Number
- **Type:** local-us · **Rental:** $1.15/mo · **Routing:** TwiML Bin
- **Voice IN (90d):** 29 calls · 16.5 min · 27 distinct callers · 20 distinct active days (22% of window) · last call 2026-04-14
- **Forwarded out (bridge legs):** 29 legs · 16.4 min actually bridged · top destinations: +1726203XXXX (29)
- **SMS IN:** 0 (last —) · **SMS OUT:** 0 (last —)

### `+18776931602` — videos from 4 sites CL+BR+SBL+FB
- **Type:** toll-free · **Rental:** $2.15/mo · **Routing:** TwiML Bin
- **Voice IN (90d):** 29 calls · 340.6 min · 29 distinct callers · 29 distinct active days (32% of window) · last call 2026-04-26
- **Forwarded out (bridge legs):** 29 legs · 340.6 min actually bridged · top destinations: +1773809XXXX (29)
- **SMS IN:** 0 (last —) · **SMS OUT:** 0 (last —)

### `+18888383116` — FB.com(condo) fw to condo
- **Type:** toll-free · **Rental:** $2.15/mo · **Routing:** TwiML Bin
- **Voice IN (90d):** 26 calls · 24.2 min · 25 distinct callers · 23 distinct active days (26% of window) · last call 2026-04-21
- **Forwarded out (bridge legs):** 26 legs · 22.0 min actually bridged · top destinations: +1224323XXXX (26)
- **SMS IN:** 0 (last —) · **SMS OUT:** 0 (last —)

### `+18889669025` — PHONE FOR VIDEOS EN
- **Type:** toll-free · **Rental:** $2.15/mo · **Routing:** TwiML Bin
- **Voice IN (90d):** 20 calls · 147.0 min · 19 distinct callers · 18 distinct active days (20% of window) · last call 2026-04-19
- **Forwarded out (bridge legs):** 20 legs · 147.0 min actually bridged · top destinations: +1726203XXXX (20)
- **SMS IN:** 0 (last —) · **SMS OUT:** 0 (last —)

### `+18559581897` — (855) 958-1897 to Videos of Razelle
- **Type:** toll-free · **Rental:** $2.15/mo · **Routing:** TwiML Bin
- **Voice IN (90d):** 10 calls · 116.9 min · 10 distinct callers · 10 distinct active days (11% of window) · last call 2026-04-24
- **Forwarded out (bridge legs):** 10 legs · 116.9 min actually bridged · top destinations: +1726203XXXX (10)
- **SMS IN:** 0 (last —) · **SMS OUT:** 0 (last —)

### `+18662450034` — USB
- **Type:** toll-free · **Rental:** $2.15/mo · **Routing:** TwiML Bin
- **Voice IN (90d):** 7 calls · 8.3 min · 7 distinct callers · 6 distinct active days (7% of window) · last call 2026-04-23
- **Forwarded out (bridge legs):** 7 legs · 8.3 min actually bridged · top destinations: +1312878XXXX (7)
- **SMS IN:** 0 (last —) · **SMS OUT:** 0 (last —)

### `+18886840539` — Personal Lines Spanish
- **Type:** toll-free · **Rental:** $2.15/mo · **Routing:** TwiML Bin
- **Voice IN (90d):** 4 calls · 0.0 min · 3 distinct callers · 3 distinct active days (3% of window) · last call 2026-04-07
- **Forwarded out (bridge legs):** 4 legs · 0.0 min actually bridged · top destinations: +1773782XXXX (4)
- **SMS IN:** 0 (last —) · **SMS OUT:** 0 (last —)

### `+13125614622` — TEST NUMBER (DO NOT EDIT)
- **Type:** local-us · **Rental:** $1.15/mo · **Routing:** TwiML Bin
- **Voice IN (90d):** 3 calls · 1.3 min · 3 distinct callers · 2 distinct active days (2% of window) · last call 2026-02-09
- **Forwarded out (bridge legs):** 3 legs · 0.9 min actually bridged · top destinations: +34… (Spain mobile) (3)
- **SMS IN:** 1 (last 2026-04-03) · **SMS OUT:** 1 (last 2026-04-03)

### `+18667040510` — FB BONDS
- **Type:** toll-free · **Rental:** $2.15/mo · **Routing:** TwiML Bin
- **Voice IN (90d):** 3 calls · 0.0 min · 3 distinct callers · 3 distinct active days (3% of window) · last call 2026-03-18
- **Forwarded out (bridge legs):** 3 legs · 0.0 min actually bridged · top destinations: +1224323XXXX (3)
- **SMS IN:** 0 (last —) · **SMS OUT:** 0 (last —)

### `+18656844023` — Email Campaign +1 865 684 4023
- **Type:** local-us · **Rental:** $1.15/mo · **Routing:** TwiML Bin
- **Voice IN (90d):** 2 calls · 2.0 min · 2 distinct callers · 2 distinct active days (2% of window) · last call 2026-03-10
- **Forwarded out (bridge legs):** 2 legs · 2.0 min actually bridged · top destinations: +1726203XXXX (2)
- **SMS IN:** 1 (last 2026-02-05) · **SMS OUT:** 1 (last 2026-02-05)

### `+13125004290` — (312) 500-4290 LFR
- **Type:** local-us · **Rental:** $1.15/mo · **Routing:** TwiML Bin
- **Voice IN (90d):** 1 calls · 0.1 min · 1 distinct callers · 1 distinct active days (1% of window) · last call 2026-04-15
- **Forwarded out (bridge legs):** 1 legs · 0.0 min actually bridged · top destinations: +57… (Colombia mobile) (1)
- **SMS IN:** 0 (last —) · **SMS OUT:** 0 (last —)

### `+17734928571` — TEST NUMBER DO NOT USE
- **Type:** local-us · **Rental:** $1.15/mo · **Routing:** TwiML Bin
- **Voice IN (90d):** 1 calls · 0.0 min · 1 distinct callers · 1 distinct active days (1% of window) · last call 2026-02-11
- **Forwarded out (bridge legs):** 1 legs · 0.0 min actually bridged · top destinations: +1312444XXXX (1)
- **SMS IN:** 0 (last —) · **SMS OUT:** 0 (last —)

### `+18884962029` — Farmerbrown Builders Risk
- **Type:** toll-free · **Rental:** $2.15/mo · **Routing:** TwiML Bin
- **Voice IN (90d):** 1 calls · 0.2 min · 1 distinct callers · 1 distinct active days (1% of window) · last call 2026-01-27
- **Forwarded out (bridge legs):** 1 legs · 0.1 min actually bridged · top destinations: +1312224XXXX (1)
- **SMS IN:** 0 (last —) · **SMS OUT:** 0 (last —)

### `+13123218918` — ContractorDigitalSolution LTC
- **Type:** local-us · **Rental:** $1.15/mo · **Routing:** TwiML Bin
- **Voice IN (90d):** 0 calls · 0.0 min · 0 distinct callers · no activity · last call —
- **SMS IN:** 0 (last —) · **SMS OUT:** 0 (last —)

### `+16269013742` — (626) 901-3742
- **Type:** local-us · **Rental:** $1.15/mo · **Routing:** TwiML Bin
- **Voice IN (90d):** 0 calls · 0.0 min · 0 distinct callers · no activity · last call —
- **SMS IN:** 0 (last —) · **SMS OUT:** 0 (last —)

### `+13128547710` — Fw to Assigned Risk Group
- **Type:** local-us · **Rental:** $1.15/mo · **Routing:** TwiML Bin
- **Voice IN (90d):** 0 calls · 0.0 min · 0 distinct callers · no activity · last call —
- **SMS IN:** 0 (last —) · **SMS OUT:** 0 (last —)

### `+13125848011` — FB License & Permit Bonds
- **Type:** local-us · **Rental:** $1.15/mo · **Routing:** TwiML Bin
- **Voice IN (90d):** 0 calls · 0.0 min · 0 distinct callers · no activity · last call —
- **SMS IN:** 0 (last —) · **SMS OUT:** 0 (last —)

### `+576045906071` — 576045906071
- **Type:** international · **Rental:** $3.00/mo · **Routing:** TwiML Bin
- **Voice IN (90d):** 0 calls · 0.0 min · 0 distinct callers · no activity · last call —
- **SMS IN:** 0 (last —) · **SMS OUT:** 0 (last —)

### `+17739741995` — (773) 974-1995
- **Type:** local-us · **Rental:** $1.15/mo · **Routing:** TwiML Bin
- **Voice IN (90d):** 0 calls · 0.0 min · 0 distinct callers · no activity · last call —
- **SMS IN:** 1 (last 2026-04-01) · **SMS OUT:** 0 (last —)

## Routing: Studio Flow

### `+18447707979` — Luis AND Nicole toll free WEBSITE NUMBER
- **Type:** toll-free · **Rental:** $2.15/mo · **Routing:** Studio Flow
- **Voice IN (90d):** 25 calls · 17.1 min · 25 distinct callers · 25 distinct active days (28% of window) · last call 2026-04-26
- **Forwarded out (bridge legs):** 25 legs · 0.0 min actually bridged · top destinations: +1773943XXXX (25)
- **SMS IN:** 0 (last —) · **SMS OUT:** 0 (last —)

### `+18327348760` — Luis Nicole Local number
- **Type:** local-us · **Rental:** $1.15/mo · **Routing:** Studio Flow
- **Voice IN (90d):** 3 calls · 0.6 min · 3 distinct callers · 3 distinct active days (3% of window) · last call 2026-03-19
- **Forwarded out (bridge legs):** 3 legs · 0.0 min actually bridged · top destinations: +1773943XXXX (3)
- **SMS IN:** 0 (last —) · **SMS OUT:** 28 (last 2026-04-26)

## Routing: Twilio demo (unconfigured)

### `+16592742234` — (659) 274-2234
- **Type:** local-us · **Rental:** $1.15/mo · **Routing:** Twilio demo (unconfigured)
- **Voice IN (90d):** 0 calls · 0.0 min · 0 distinct callers · no activity · last call —
- **SMS IN:** 0 (last —) · **SMS OUT:** 0 (last —)

