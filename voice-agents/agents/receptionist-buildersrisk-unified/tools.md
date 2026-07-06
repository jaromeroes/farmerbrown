# Tools — Grace BR Unified Receptionist

**`toolIds`: empty `[]`** — same architectural pattern as BR Sales v1.6+ and BR Service v1.0+. Live-agent escalation and all specialist hand-offs are squad destinations, not explicit tools. The agent uses `transferCall` (built-in) with the destination's exact VAPI name to route. No custom tools attached.

This avoids the tool-name bias that was fixed in v1.6 of the per-channel receptionists (where having an explicit `transfer_to_live_agent_*` tool caused the LLM to route every call to live agent regardless of intent).

## Squad destinations Grace can transfer to (set on the squad, not the assistant)

| Destination VAPI name | When |
|---|---|
| `Jennifer — Builders Risk v2.3` | New BR quote (DEFAULT path on this line) |
| `Sarah — GL Quote Agent v1.1` | New GL quote (alt menu) |
| `Wendy — Workers' Comp v1.0` | New WC quote (alt menu) |
| `Nora — Commercial Auto v1.0` | New Commercial Auto quote (alt menu) |
| `Rachel — FB Home & Auto Intake v2.3` | New Home / Auto / H&A quote (alt menu) |
| `BR Live Agent Handoff v1.0` | Existing quote winner, payment, claim, "live agent" request, other-service, Spanish fallback, confusion fallback |

## Pending tools (when backends ship — see `docs/client-notes-pending.md`)

These are real promises in the current prompt that today have NO backend wired. The agent says it but nothing is sent. To be wired by Tyler:

- `submit_coi_form` → POST captured certificate data (policyholder, additional insured, endorsements, contact) to `certificates@farmerbrown.com`
- `send_review_sms` → SMS with review link when caller accepts the expedited COI quid-pro-quo (Step T6)
- `send_home_auto_application_sms` → SMS with H&A application link when caller accepts the cross-sell at end of COI (Step T7)
- `send_urgent_coi_alert` → internal alert when expedited COI is requested (channel TBD with client — recommended: email + Slack)

When the tools ship, attach them to this assistant via `toolIds` in the update script and add silent tool-call instructions to the system prompt at the matching steps.
