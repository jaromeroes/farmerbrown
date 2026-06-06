# Rebecca — General Liability Binding Info — Changelog

## v0.1 — 2026-05-19 (DRAFT, not deployed)
Initial planning skeleton. Created in response to John's `.docx` "additonal info for binding" (received via José 2026-05-19) and the architectural decision to build one Rebecca per product line.

- Spec lives in [`system-prompt.md`](system-prompt.md) (skeleton with placeholders).
- 22-question canonical list in [`docs/binding-stage-discovery.md`](../../docs/binding-stage-discovery.md) §3.
- 7 open items must be resolved with John before v1.0 deploy — see discovery doc §6.

Pending for v1.0:
- Real existing-quote phone for GL gate-No close (placeholder is `9999999999`)
- Calendly event-type UUID for service rep team
- "AI in RED" duplicate question removal confirmation
- Cross-sell at end of Rebecca (assumption: no)
- "Qualify for THIS price" — literal or psychological framing
- CS-to-Rebecca transfer mechanics (public DID + squad?)
- Cross-product field naming for `submit_binding_info_form` so Rebecca-BR can share the endpoint
