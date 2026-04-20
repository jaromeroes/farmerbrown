# Wendy — VAPI Tool Definitions
Wendy is a data-collection + flash-quote + Calendly-booking agent. In V1 she has 3 tools, all reused from the global pool — no new tools created.

---

## 1. check_availability (Calendly round-robin)

Fetches available appointment slots across ALL licensed agents (no pinning to a specific person). Matches the "one of our pros" language Wendy uses.

- **Tool ID:** `dd2504ab-c665-493f-915d-345b0696017f`
- **Type:** apiRequest
- **Method:** GET
- **URL:** `https://farmerbrown-bi.calforce.pro/api/calendly/available_times?agent_api_key=…&timezone={{timezone}}`
- **Parameters:** `timezone` (IANA string)
- **Returns:** available slots in UTC for the next 6 days

---

## 2. book_appointment (Calendly round-robin)

Books a confirmed appointment. Same round-robin pool as `check_availability` — no `event_type_uuid` filter, so Calendly assigns whoever's next up.

- **Tool ID:** `642280ea-5ea0-4d1e-a7fe-35439016de10`
- **Type:** apiRequest
- **Method:** POST
- **URL:** `https://farmerbrown-bi.calforce.pro/api/calendly/book_event?agent_api_key=…`
- **Parameters (and body):** `name`, `email`, `phone_number`, `timezone`, `start_time` (ISO8601 UTC — must be one of the slots returned by `check_availability`)

---

## 3. transfer_to_live_agent_farmer_brown (fallback only)

Used only when scheduling fails (zero slots, API error, caller frustration) — see Rules 6 and 7 of the system prompt.

- **Tool ID:** `75d7c8f3-646e-4b44-9629-2baa2a2d81dd`
- **Type:** transferCall
- **Destination:** SIP to `+1 (888) 973-0016` (Farmer Brown live-agent line)

**⚠️ Cross-site limitation:** Wendy serves inbound WC requests from all three sites (farmerbrown.com, contractorsliability.com, buildersrisk.net). V1 hard-codes the Farmer Brown transfer number. A caller coming from buildersrisk.net who triggers the fallback will still reach the FB human-agent line, not the BR one. Same limitation as Nora and Rachel (see `docs/squads-and-handoffs.md` §6).

---

## 4. end_call (VAPI built-in)

Terminates the call cleanly at the end of the scheduling flow. Configure `endCallFunctionEnabled: true` on the assistant.

---

## API Mapping Summary

| Tool Name | API Endpoint / Action | Method |
|-----------|----------------------|--------|
| `check_availability` | `…/api/calendly/available_times?agent_api_key=…&timezone={{timezone}}` | GET |
| `book_appointment` | `…/api/calendly/book_event?agent_api_key=…` | POST |
| `transfer_to_live_agent_farmer_brown` | SIP transfer to +18889730016 | transferCall |

---

## Pending tools (to wire up when backend ships)

| Tool Name | Purpose | Proposed endpoint |
|-----------|---------|-------------------|
| `submit_wc_form` | Persist Wendy's intake data (demographics + payroll sub-flow + cross-sell list) to the DB | `PATCH …/api/wc_submissions/update_by_email` (endpoint TBD) |

When `submit_wc_form` ships, add silent checkpoint calls after Step 1 (demographics), Step 3 (payroll sub-flow), and before Step 5 (before the booking), mirroring Jennifer's progressive-capture pattern.
