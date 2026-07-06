# Emma — VAPI Tool Definitions
Emma is a routing-only agent. She does NOT collect quote data and does NOT call any data-collection APIs. She only needs one explicit tool: `transfer_to_live_agent_farmer_brown`. Handoffs to specialist agents (Jennifer, Sarah) are handled by VAPI automatically at the squad level via `assistantDestinations` — no tool definition needed on the assistant itself.

---

## 1. transfer_to_live_agent_farmer_brown (shared Farmer Brown tool)

SIP transfer to the Farmer Brown licensed-agent line. This tool is **Farmer Brown-specific** — each site (buildersrisk.net, contractorsliability.com) will have its own equivalent tool pointing to a different number when those receptionists are built.

- **Tool ID:** `75d7c8f3-646e-4b44-9629-2baa2a2d81dd`
- **Type:** `transferCall`
- **Destination:** SIP to `+18889730016` (Farmer Brown live-agent line)
- **Currently used by:** Emma (FB receptionist), Jennifer, Sarah, Valeria
  - ⚠️ Jennifer/Sarah/Valeria use this tool today but they primarily serve other sites (buildersrisk.net / contractorsliability.com). When per-site transfer tools are created, those agents should be migrated to their site-specific tool.

**When Emma calls it:**
- Existing-quote callers ("winners") — hot leads ready to close
- Products not yet supported by an AI specialist: Workers' Comp, Commercial Auto, Home & Auto
- Existing policyholders calling on the sales line by mistake
- Caller asks to speak with a person
- Fallback: confusion, background noise, or conversation not progressing

---

## 2. Squad-level handoffs (no tool definition — configured on the Squad)

When Emma is deployed inside a Squad, VAPI exposes the other members as handoff destinations automatically. The Squad config declares `assistantDestinations[]` on Emma's member entry, and VAPI inserts the handoff capability into her tool context at runtime. The `description` field tells the LLM when to trigger each handoff.

Emma's destinations (configured in `scripts/create-squad-fb-sales.js`):

| Destination | Trigger description | Hand-off message (spoken before transfer) |
|-------------|---------------------|-------------------------------------------|
| **Jennifer** (Builder's Risk) | Caller is looking for a new Builder's Risk / course-of-construction insurance quote | "Great — I'll connect you with Jennifer, our Builder's Risk specialist. One moment." |
| **Sarah** (General Liability) | Caller is looking for a new General Liability / contractor liability insurance quote | "Perfect — I'll connect you with Sarah, our General Liability specialist. One moment." |

**Everything else goes to the live agent via `transfer_to_live_agent_farmer_brown`** until dedicated AI specialists exist for Workers' Comp, Commercial Auto, and Home & Auto.

---

## API Mapping Summary

| Tool Name | Type | Action |
|-----------|------|--------|
| `transfer_to_live_agent_farmer_brown` | transferCall | SIP transfer to +18889730016 (Farmer Brown) |
| handoff → Jennifer | squad | Assistant-to-assistant transfer within Squad |
| handoff → Sarah | squad | Assistant-to-assistant transfer within Squad |
