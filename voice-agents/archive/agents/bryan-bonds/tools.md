# Bryan — Bonds — Tools

## v0.1 (test)

Single `transferCall` tool — `transfer_to_bonds_specialist`. In v0.1 this routes to a TEST destination (Pedro Neumann's DID, `+17262334655`) so we don't call Tom Hester during testing. In v1.0 we PATCH the destination to Tom's DID (`+13128782372`).

| Tool | ID | Type | Destination (v0.1) | Destination (v1.0) |
|------|----|------|---------------------|---------------------|
| `transfer_to_bonds_specialist` | (created by `scripts/create-tool-transfer-to-bonds-specialist.js`) | transferCall | `+17262334655` (Pedro — test) | `+13128782372` (Tom Hester) |

**No backend tool yet** — `submit_bond_form` is pending Tyler. v0.1 captures the bond data in the call transcript only; the closing line *promises* email-to-Tom but no email is sent.

**No Calendly tool** — Tom calls back directly, no appointment scheduling needed.

**Only one transferCall on this assistant** — within VAPI's per-assistant limit.
