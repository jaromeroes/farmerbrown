# Olivia — CL Receptionist EN Sales — Changelog

This file is the historical log of this agent's prompt versions. It is **not** part of the live system prompt — until v1.7 the table below lived inside [system-prompt.md](./system-prompt.md) and was sent to the LLM on every turn. Moved out in v1.8, same pattern as Grace BR Unified v1.23 + Jennifer v2.13.

When you bump this agent's version, add a row at the top of the table here, then update the `**Current version:**` / `**Last updated:**` lines in `system-prompt.md`.

| Version | Date | Changes |
|---------|------|---------|
| v1.8 | 2026-05-13 | **Changelog moved out of the live system prompt.** Same pattern as Grace BR Unified v1.23 + Jennifer v2.13 (2026-05-12). Companion file split-out, no behavioural change. The Changelog block accounted for ~13% of this agent's system-prompt characters, re-sent to the LLM on every turn before this change. Cost saving propagates across every squad where this agent is referenced. |
| v1.7 | 2026-04-18 | Workers' Comp now hands off to Wendy (new specialist) instead of transferring to live agent. Routing table + hand-off scripts + Rule 9 list updated. |
| v1.6 | 2026-04-18 | ARCHITECTURAL FIX — dropped `transfer_to_live_agent_contractors_liability` from toolIds. Live-agent escalation is now a squad destination (`CL Live Agent Handoff v1.0`) just like specialists. All routes use a single `transferCall` mechanism, eliminating the tool-name bias that sent every call to live agent regardless of product. Rule 9 rewritten. |
| v1.5 | 2026-04-17 | Rule 11 — MUST speak the destination aloud before any transfer. Rule 10 strengthened — forbid live-agent fallback on the first unclear attempt. Transcriber upgraded to Deepgram Nova 3 with `keyterm` phrase boosting. |
| v1.4 | 2026-04-17 | Rule 10 — fuzzy matching for garbled product transcriptions (Deepgram mishears "Home and Auto" as "Home Anoto" / "Tom Analdo"). Deepgram keywords boosted for menu phrases. |
| v1.3 | 2026-04-17 | BUGFIX — explicit `transferCall` instructions per specialist, prevents LLM from always invoking `transfer_to_live_agent_*` even on specialist routes |
| v1.2 | 2026-04-17 | Home & Auto now hands off to Rachel (new intake specialist) instead of transferring to live agent |
| v1.1 | 2026-04-16 | Commercial Auto now hands off to Nora (new specialist) instead of transferring to live agent |
| v1.0 | 2026-04-16 | Initial — sales triage for contractorsliability.com EN line. Mirrors Emma (Farmer Brown) with branding swap and CL-specific live-agent transfer |
