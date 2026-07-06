# Emma Service — VAPI Tool Definitions

Emma Service is a triage + inline-COI agent. She carries **ZERO explicit tools** in her `toolIds` array. Every transfer goes through a squad `assistantDestinations` handoff — the LLM sees an implicit `transferCall` capability injected by VAPI at runtime.

This is identical to the Sales receptionist pattern from v1.8 onwards. See `docs/squads-and-handoffs.md` §2 for the "why": when an assistant has BOTH an explicit `transferCall`-type tool AND squad destinations, the LLM biases almost always toward the named tool. Emma Service ships with an empty toolset so there is no tool to bias toward — the only transfer option is the squad destination.

---

## 1. Squad-level handoff (no tool definition — configured on the Squad)

Emma Service's only squad destination is the FB Live Agent Proxy. It is the destination for every transfer trigger (Payment, Claim, Sales-misroute, fallback, confusion).

| Destination | Trigger description | Hand-off message (spoken before transfer) |
|-------------|---------------------|-------------------------------------------|
| **FB Live Agent Handoff v1.0** | Caller wants to speak to a person for Payment, Claim, is actually a Sales lead on the Service line, or the conversation is not progressing after 2 attempts. | (multiple openers — see `system-prompt.md` HAND-OFF SCRIPTS section) |

The receptionist selects the spoken opener based on the trigger (Payment line, Claim line, Sales-misroute line, or fallback line). The destination is always the same.

---

## 2. Pending integrations — NOT YET WIRED

These are backend endpoints that Tyler (Farmer Brown backend dev) needs to deliver. Until then, the prompt's Rule 12 requires Emma Service to speak the pending actions in future tense and claim nothing was sent. See `docs/client-notes-pending.md` for the running tracker.

| Pending tool | Trigger | Endpoint (to decide) |
|---|---|---|
| `send_review_sms` | Step 6 = expedited + review agreed | POST to SMS provider with `{phone, review_link_url}` |
| `send_home_auto_application_sms` | Step 7 = Yes | POST to SMS provider with `{phone, application_link_url}` |
| `send_urgent_coi_alert` | Step 6 = expedited + review agreed | Email + Slack (recommendation) carrying the COI details from Steps 2-5 |
| `submit_coi_form` | End of COI flow (silent, like Jennifer's submit_quote) | PATCH to Calforce backend with the full COI payload |

When these ship, the wire-up pattern is the same as Jennifer's `submit_quote` / Rachel's Calendly tools: add them to `toolIds`, invoke them silently at the right checkpoint without changing the caller-facing scripts.

---

## API Mapping Summary

| Tool Name | Type | Status |
|-----------|------|--------|
| handoff → FB Live Agent Proxy | squad | ✅ active — every transfer goes here |
| `send_review_sms` | apiRequest | ⏳ pending backend |
| `send_home_auto_application_sms` | apiRequest | ⏳ pending backend |
| `send_urgent_coi_alert` | apiRequest | ⏳ pending backend |
| `submit_coi_form` | apiRequest | ⏳ pending backend |
