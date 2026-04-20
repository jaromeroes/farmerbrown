# Test Dispatcher Service — VAPI Tool Definitions

Test-only L1 router. **ZERO explicit tools** in `toolIds`. Handoffs to Emma Service, Olivia Service, and Grace Service are squad destinations, configured in `scripts/create-squad-test-service.js`.

| Destination | Trigger description | Hand-off message |
|-------------|---------------------|------------------|
| `Emma — FB Receptionist EN Service v1.0` | John picked Farmer Brown / FB / farmerbrown.com | "Got it — connecting you to Farmer Brown service now." |
| `Olivia — CL Receptionist EN Service v1.0` | John picked Contractors Liability / CL / contractors | "Got it — connecting you to Contractors Liability service now." |
| `Grace — BR Receptionist EN Service v1.0` | John picked Builders Risk / BR / construction | "Got it — connecting you to Builders Risk service now." |

This mirrors the Sales `Test Dispatcher v1.0` exactly, with Service receptionists as destinations. No live-agent proxy at this level — the dispatcher is testing-only and has no real-customer fallback.
