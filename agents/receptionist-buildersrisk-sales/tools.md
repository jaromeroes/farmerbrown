# Grace — VAPI Tool Definitions
Grace is a routing-only agent. She does NOT collect quote data and does NOT call any data-collection APIs. She only needs one explicit tool: `transfer_to_live_agent_builders_risk`. Handoffs to specialist agents (Jennifer, Sarah) are handled by VAPI automatically at the squad level via `assistantDestinations` — no tool definition needed on the assistant itself.

---

## 1. transfer_to_live_agent_builders_risk (BR-specific tool)

SIP transfer to the BuildersRisk.Net licensed-agent line.

- **Tool ID:** `7eb304a7-ee98-4076-be2f-2d1c5fd6645e`
- **Type:** `transferCall`
- **Destination:** SIP to `+18779600221` (BuildersRisk.Net live-agent line)
- **Used by:** Grace (BR receptionist)

**When Grace calls it:**
- Existing-quote callers ("winners") — hot leads ready to close
- Products not yet supported by an AI specialist: Workers' Comp, Commercial Auto, Home & Auto
- Existing policyholders calling on the sales line by mistake
- Caller asks to speak with a person
- Fallback: confusion, background noise, or conversation not progressing

---

## 2. Squad-level handoffs (no tool definition — configured on the Squad)

When Grace is deployed inside a Squad, VAPI exposes the other members as handoff destinations automatically. The Squad config declares `assistantDestinations[]` on Grace's member entry.

Grace's destinations (configured in `scripts/create-squad-br-sales.js`):

| Destination | Trigger description | Hand-off message (spoken before transfer) |
|-------------|---------------------|-------------------------------------------|
| **Jennifer** (Builder's Risk) | Caller is looking for a new Builder's Risk / course-of-construction insurance quote — THIS IS THE DEFAULT PATH on this line | "Great — I'll connect you with Jennifer, our Builder's Risk specialist. One moment." |
| **Sarah** (General Liability) | Caller said "something else" at Step 2 and picked General Liability from the alternate menu | "Perfect — I'll connect you with Sarah, our General Liability specialist. One moment." |

**Everything else goes to the live agent via `transfer_to_live_agent_builders_risk`** until dedicated AI specialists exist for Workers' Comp, Commercial Auto, and Home & Auto.

---

## API Mapping Summary

| Tool Name | Type | Action |
|-----------|------|--------|
| `transfer_to_live_agent_builders_risk` | transferCall | SIP transfer to +18779600221 (BuildersRisk.Net) |
| handoff → Jennifer | squad | Assistant-to-assistant transfer within Squad |
| handoff → Sarah | squad | Assistant-to-assistant transfer within Squad |
