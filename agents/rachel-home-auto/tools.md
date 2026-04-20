# Rachel — VAPI Tool Definitions
These are the tools configured in VAPI for the Rachel Home & Auto intake assistant (v2.1).

Rachel schedules directly with Angie during the call using a dedicated pair of Calendly tools that pin Angie's `event_type_uuid` in the URL. The LLM never sees the UUID — it just calls the tool. The generic `check_availability` / `book_appointment` tools (round-robin across the team) are NOT attached to Rachel, and she's explicitly instructed not to use them.

---

## 1. check_availability_angie

Fetches available appointment slots for Angie specifically (Calendly event type `901112a8-95fa-40bc-8f30-e6c99ae4276c`).

- **Tool ID:** `253df17f-2b43-4880-ad51-d5a3f2a4e655`
- **Type:** apiRequest
- **Method:** GET
- **URL:** `https://farmerbrown-bi.calforce.pro/api/calendly/available_times?agent_api_key=...&event_type_uuid=901112a8-95fa-40bc-8f30-e6c99ae4276c&timezone={{timezone}}`
- **Parameters:** `timezone` (enum of US IANA timezones)
- **Returns:** available slots in UTC for the next 6 days

---

## 2. book_appointment_angie

Books a confirmed appointment on Angie's Calendly.

- **Tool ID:** `35ff8b09-0a1f-4694-adb7-208f2a893434`
- **Type:** apiRequest
- **Method:** POST
- **URL:** `https://farmerbrown-bi.calforce.pro/api/calendly/book_event?agent_api_key=...&event_type_uuid=901112a8-95fa-40bc-8f30-e6c99ae4276c`
- **Parameters (and body):** `name`, `email`, `phone_number`, `timezone`, `start_time` (ISO8601 UTC — must be one of the slots returned by `check_availability_angie`)

---

## 3. transfer_to_live_agent_farmer_brown (global — shared, fallback only)

Used only when scheduling fails (zero slots, API error, or caller frustration).

- **Tool ID:** `75d7c8f3-646e-4b44-9629-2baa2a2d81dd`
- **Type:** transferCall
- **Destination:** +1 (888) 973-0016
- **Note on cross-site transfers:** Rachel also lives in the CL and BR sales squads. Because specialists carry a single hard-coded transfer tool, a caller originating on contractorsliability.com or buildersrisk.net will still be routed to the Farmer Brown human-agent line. See `docs/squads-and-handoffs.md` §6 for the broader limitation.

---

## 4. end_call (VAPI built-in)

Terminates the call cleanly at the end of the scheduling flow. `endCallFunctionEnabled: true` on the assistant.

---

## API Mapping Summary

| Tool Name | API Endpoint / Action | Method |
|-----------|----------------------|--------|
| `check_availability_angie` | `…/api/calendly/available_times?agent_api_key=…&event_type_uuid=<angie>&timezone={{timezone}}` | GET |
| `book_appointment_angie`   | `…/api/calendly/book_event?agent_api_key=…&event_type_uuid=<angie>` | POST |
| `transfer_to_live_agent_farmer_brown` | SIP transfer to +18889730016 | transferCall |

---

## Pending tools (to wire up when backend ships)

| Tool Name | Purpose | Proposed endpoint |
|-----------|---------|-------------------|
| `send_home_auto_application` | Trigger the SMS/email that sends the application form | `POST https://farmerbrown-bi.calforce.pro/api/rachel/send_application` (TBD) |
| `submit_home_quote` | Persist Rachel's intake contact info to the DB | `PATCH …/api/home_submissions/update_by_email` (endpoint exists but not wired to Rachel's short flow — Calendly booking is the source of truth today) |

When `send_home_auto_application` ships, add a silent call at the top of Rachel's Step 4, right before the "let me pull up her available times" line.
