# Rebecca GL — Tools (DRAFT)

**Status:** 🔵 Planning. None of these tools exist in VAPI yet; the IDs are placeholders. Build order: Calendly event type → `submit_binding_info_form` (Tyler) → wrapper VAPI tools → wire to Rebecca.

---

## Required toolIds (preliminary)

| Tool | ID | Type | Purpose | Status |
|------|----|------|---------|--------|
| `submit_binding_info_form` | TBD | apiRequest | POST/PATCH 22 fields to Tyler's new binding endpoint | 🔵 not built |
| `check_availability_service_rep` | TBD | apiRequest | GET Calendly available_times for the service rep round-robin pool | 🔵 not built — depends on event-type UUID |
| `book_appointment_service_rep` | TBD | apiRequest | POST Calendly book_event with `event_type_uuid=<service_rep_uuid>` | 🔵 not built — depends on event-type UUID |
| `transfer_to_live_agent_contractors_liability` | `05bc12e6-ee8a-44cf-8abd-816244480509` | transferCall | Existing CL live-agent SIP — used as confusion / silence fallback only | ✅ exists |

**Constraint:** max one `transferCall` per assistant (see `feedback_vapi_one_transfercall_per_assistant.md`). Rebecca only needs one (the CL live-agent fallback), so this is fine.

---

## `submit_binding_info_form` — backend spec for Tyler

**Suggested endpoint:** `PATCH https://farmerbrown-bi.calforce.pro/api/binding_info_submissions/update_by_email` (mirrors the `update_by_email` pattern of `submit_quote` so the binding info upserts onto the same lead record).

**Suggested payload (22 fields):**

```json
{
  "agent_api_key": "${CALFORCE_AGENT_KEY}",
  "email": "<from upstream Sarah session>",
  "binding_info": {
    "product_line": "general_liability",
    "effective_date": "YYYY-MM-DD",
    "payment_preference": "annual|monthly",
    "max_stories": 0,
    "performs_waterproofing": true,
    "uses_motorized_or_heavy_equipment": true,
    "uses_heating_equipment": true,
    "tract_home_developments_25_plus": true,
    "new_condos_townhouses_multiunit": true,
    "repair_only_condo_unit_owners": true,
    "ocip_wrap_up_work": true,
    "playgrounds_hospitals_churches": true,
    "single_family_over_5000_sqft": true,
    "commercial_over_20000_sqft": true,
    "other_business_names": true,
    "licensing_authority_action": true,
    "license_allowed_for_other_contractor": true,
    "owner_judgements_liens_bankruptcy": true,
    "lawsuits_against_company": true,
    "aware_of_faulty_construction_incidents": true,
    "written_contract_for_all_work": true,
    "uses_subcontractors": true,
    "collects_subcontractor_coi": true
  }
}
```

Values can be `true | false | "unknown"` (caller said "I don't know"). Cross-line naming: keep the same `binding_info.product_line` field so a future `Rebecca-BR` can post to the same endpoint with `product_line: "builders_risk"` and a different (shorter) field set.

---

## Checkpoint cadence (TBD)

If we burn calls into multiple checkpoints (per Jennifer's pattern), suggested split:
- CP1 after Bloque 1 (effective_date + payment_preference) — partial payload, captures the "I'm going to bind" signal early.
- CP2 after Bloque 2 (operational exposure complete) — most of the risk classifiers.
- CP3 after Bloque 3 (all 22 fields).
- CP4 after `book_appointment_service_rep` — appointment confirmation.

Token-cost tradeoff: 4 checkpoints quadruples the `submit_binding_info_form` cost line. For v1, consider only CP3 + CP4 unless John pushes back on partial-data preservation.
