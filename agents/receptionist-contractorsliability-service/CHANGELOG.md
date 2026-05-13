# Olivia — CL Receptionist EN Service — Changelog

This file is the historical log of this agent's prompt versions. It is **not** part of the live system prompt — until v1.1 the table below lived inside [system-prompt.md](./system-prompt.md) and was sent to the LLM on every turn. Moved out in v1.2, same pattern as Grace BR Unified v1.23 + Jennifer v2.13.

When you bump this agent's version, add a row at the top of the table here, then update the `**Current version:**` / `**Last updated:**` lines in `system-prompt.md`.

| Version | Date | Changes |
|---------|------|---------|
| v1.2 | 2026-05-13 | **Changelog moved out of the live system prompt.** Same pattern as Grace BR Unified v1.23 + Jennifer v2.13 (2026-05-12). Companion file split-out, no behavioural change. The Changelog block accounted for ~4% of this agent's system-prompt characters, re-sent to the LLM on every turn before this change. Cost saving propagates across every squad where this agent is referenced. |
| v1.1 | 2026-04-20 | Closed-menu first message ("payment, claim, or certificate of insurance"). New explicit "Other service" row in Step 1 triage — valid non-AI-handleable service requests (cancel, renewal, add vehicle, billing change) now get their own hand-off opener distinct from the confusion fallback. Rule 10 updated. |
| v1.0 | 2026-04-20 | Initial — EN Service triage for contractorsliability.com, inline COI flow (no L3 handoff), Payment/Claim/Sales-misroute all transfer to CL Live Agent Proxy. |
