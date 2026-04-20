# Notes for Client — Pending Items
**Running log of items to discuss with Farmer Brown (John) at end-of-day syncs.**
**Last updated:** 2026-04-20

---

## 2026-04-20 — Service branch kickoff

### Backends pendientes (coordinar con Tyler, desarrollador)
Necesarios para que el flujo COI del Service receptionist funcione end-to-end. Para v1 desplegamos con "pending" pattern (el agente *dice* que envía pero no se envía nada — mismo patrón que Rachel hoy). Necesitamos que Tyler construya:

1. **SMS con review link** — disparado cuando el caller acepta el quid-pro-quo de expedited service (1h turn-around a cambio de review). Step 5 del flujo COI.
2. **SMS con aplicación Home & Auto** — disparado cuando el caller acepta el cross-sell al final del flujo COI. Step 6.
3. **Alerta interna urgente** — cuando alguien pide expedited service, el equipo tiene que verlo al instante. Canal por decidir: SMS al grupo de agentes / email a ops / Slack / tarea en Hawksoft. Recomendación nuestra: email (paper trail) + Slack (visibilidad inmediata).

Mientras los 3 endpoints no estén, un COI urgente se queda solo en el transcript del call — nadie del equipo lo ve hasta que alguien revise transcripts manualmente. Priorizar al menos el #3.
