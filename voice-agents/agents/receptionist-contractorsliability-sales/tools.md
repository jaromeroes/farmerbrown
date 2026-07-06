# Olivia — VAPI Tool Definitions
Olivia is a routing-only agent. She does NOT collect quote data and does NOT call any data-collection APIs. She only needs one explicit tool: `transfer_to_live_agent_contractors_liability`. Handoffs to specialist agents (Jennifer, Sarah) are handled by VAPI automatically at the squad level via `assistantDestinations` — no tool definition needed on the assistant itself.

---

## 1. transfer_to_live_agent_contractors_liability (CL-specific tool)

SIP transfer to the Contractors Liability licensed-agent line.

- **Tool ID:** `05bc12e6-ee8a-44cf-8abd-816244480509`
- **Type:** `transferCall`
- **Destination:** SIP to `+18889730016` (Contractors Liability live-agent line)
- **Used by:** Olivia (CL receptionist)

**When Olivia calls it:**
- Existing-quote callers ("winners") — hot leads ready to close
- Products not yet supported by an AI specialist: Workers' Comp, Commercial Auto, Home & Auto
- Existing policyholders calling on the sales line by mistake
- Caller asks to speak with a person
- Fallback: confusion, background noise, or conversation not progressing

---

## 2. Squad-level handoffs (no tool definition — configured on the Squad)

When Olivia is deployed inside a Squad, VAPI exposes the other members as handoff destinations automatically. The Squad config declares `assistantDestinations[]` on Olivia's member entry.

Olivia's destinations (configured in `scripts/create-squad-cl-sales.js`):

| Destination | Trigger description | Hand-off message (spoken before transfer) |
|-------------|---------------------|-------------------------------------------|
| **Jennifer** (Builder's Risk) | Caller is looking for a new Builder's Risk / course-of-construction insurance quote | "Great — I'll connect you with Jennifer, our Builder's Risk specialist. One moment." |
| **Sarah** (General Liability) | Caller is looking for a new General Liability / contractor liability insurance quote | "Perfect — I'll connect you with Sarah, our General Liability specialist. One moment." |

**Everything else goes to the live agent via `transfer_to_live_agent_contractors_liability`** until dedicated AI specialists exist for Workers' Comp, Commercial Auto, and Home & Auto.

---

## API Mapping Summary

| Tool Name | Type | Action |
|-----------|------|--------|
| `transfer_to_live_agent_contractors_liability` | transferCall | SIP transfer to +18889730016 (Contractors Liability) |
| handoff → Jennifer | squad | Assistant-to-assistant transfer within Squad |
| handoff → Sarah | squad | Assistant-to-assistant transfer within Squad |
