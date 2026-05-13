# Nora — Commercial Auto — Changelog

This file is the historical log of this agent's prompt versions. It is **not** part of the live system prompt — until v1.0 the table below lived inside [system-prompt.md](./system-prompt.md) and was sent to the LLM on every turn. Moved out in v1.1, same pattern as Grace BR Unified v1.23 + Jennifer v2.13.

When you bump this agent's version, add a row at the top of the table here, then update the `**Current version:**` / `**Last updated:**` lines in `system-prompt.md`.

| Version | Date | Changes |
|---------|------|---------|
| v1.1 | 2026-05-13 | **Changelog moved out of the live system prompt.** Same pattern as Grace BR Unified v1.23 + Jennifer v2.13 (2026-05-12). Companion file split-out, no behavioural change. The Changelog block accounted for ~3% of this agent's system-prompt characters, re-sent to the LLM on every turn before this change. Cost saving propagates across every squad where this agent is referenced. |
| v1.0 | 2026-04-16 | Initial — 16 data points from client spec, livery-supplement heads-up, loss-history rule, SMS VIN/DL follow-up, cross-sell for personal insurance, transfer to live agent at close |
