# Nora — VAPI Tool Definitions
Nora is a data-collection + transfer agent. In V1 she has only one tool: `transfer_to_live_agent_farmer_brown`. A `submit_commercial_auto_form` tool is planned but deferred until the backend endpoint exists.

---

## 1. transfer_to_live_agent_farmer_brown (default transfer)

SIP transfer to the Farmer Brown licensed-agent line. Used as the close of every successful data collection AND as the fallback for any caller frustration / confusion.

- **Tool ID:** `75d7c8f3-646e-4b44-9629-2baa2a2d81dd`
- **Type:** `transferCall`
- **Destination:** SIP to `+18889730016` (Farmer Brown live-agent line)

**⚠️ Cross-site limitation:** Nora is designed to serve inbound commercial-auto requests from all three sites (farmerbrown.com, contractorsliability.com, buildersrisk.net). V1 hard-codes the Farmer Brown transfer number. When Nora is wired into the CL or BR squads, the transfer destination should be swapped to the site-specific tool (`transfer_to_live_agent_contractors_liability` or `transfer_to_live_agent_builders_risk`). This will likely require either:
- Separate Nora deployments per site, OR
- VAPI squad-level tool overrides (to be researched)

---

## 2. Pending: submit_commercial_auto_form

Not yet built. When the backend endpoint exists, add a PATCH upsert-by-email tool following the `submit_quote` (Jennifer) pattern. Proposed schema fields:

- `name`, `business_name`, `email`, `phone`
- `mailing_address`, `garaging_address`
- `number_of_vehicles`, `number_of_drivers`
- `primary_use` (jobs / delivery / livery / black_car)
- `service_radius` (under_50 / 50_to_250 / over_250)
- `miles_per_year`, `gps_tracking` (yes/no)
- `currently_insured` (yes/no), `current_carrier`
- `has_loss_history` (yes/no)
- `claims_last_4_years` (list of {date, description})
- `need_by_date`
- `personal_insurance_cross_sell` (yes/no)

Proposed endpoint: `PATCH https://farmerbrown-bi.calforce.pro/api/commercial_auto_submissions/update_by_email` (pending backend).

---

## 3. Pending: SMS follow-up for VINs and driver's licenses

Not yet built. Per client: "We will send you a text to input your VIN#s and drivers' license numbers or pictures. Please include name, bday, DL# and state." In V1 Nora tells the caller the SMS is coming but no tool actually sends it — this is a post-call backend task. When the SMS sender is built, Nora should trigger it silently as part of the close (before transfer).

---

## API Mapping Summary

| Tool Name | Type | Action |
|-----------|------|--------|
| `transfer_to_live_agent_farmer_brown` | transferCall | SIP transfer to +18889730016 (default, see cross-site note above) |
| `submit_commercial_auto_form` | pending | PATCH upsert by email (backend not yet built) |
| SMS follow-up (VINs + DLs) | pending | Post-call SMS with photo-reply instructions |
