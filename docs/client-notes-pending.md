# Notes for Client — Pending Items
**Running log of items to discuss with Farmer Brown (John) at end-of-day syncs.**
**Last updated:** 2026-04-27

---

## 2026-04-27 — Client feedback (John) on flows + behavior

Cuatro items recibidos del cliente, todos incorporados ya en `docs/call-center-architecture.md` y `docs/architecture.html`. Aquí queda el resumen para discusión y para coordinar con Tyler donde aplique.

1. **GL Buy-Now close (solo Contractors Liability / GL — Sarah & Valeria)** — Después de dar el premium en llamada, preguntar: *"Would you like to purchase this policy now and get your policy started with your certificate of insurance right away?"*. Si sí → cita Calendly con flag **`BUY NOW`** (alta prioridad → callback inmediato). El cliente ha confirmado que esto NO aplica a Jennifer (BR), Wendy (WC), Nora (CA) ni Rachel (Home & Auto). Solo GL.
   - **Pendiente:** mecanismo del flag `BUY NOW` en Calendly (custom field, default note, post-booking webhook). A definir con la configuración de los event types.

2. **Silence-timeout global → live agent (~7 seg)** — Si el caller queda en silencio ~7 segundos en cualquier punto, el agente proactivamente pregunta *"Are you still there? Would you like me to connect you with a live agent?"*. Si responde positivamente o sigue en silencio → transfer inmediato. **Aplica a TODOS los agentes en TODAS las situaciones**, no solo receptionists.
   - **Pendiente:** validar threshold exacto en VAPI (silence detection settings). El target es 7s, ajustable.

3. **COI → certificates@farmerbrown.com** — El destino del `submit_coi_form` queda confirmado: email a `certificates@farmerbrown.com`. Coordinar con Tyler el formato del payload (HTML email, plain text, JSON attachment, etc.).
   - **Pendiente con Tyler:** endpoint de submit + formato del email destination.

4. **Service agent menu reorder + explicit live-agent escape** — La pregunta del Service receptionist cambia de "are you calling about a payment, a claim, or a certificate of insurance?" a:
   > *"May I help you with certificates of insurance, payments, claims — or you can say 'live agent' anytime."*
   
   Cambios: COI primero (es el único intent AI-handled, los demás transfieren), y mención explícita de "live agent anytime" como escape inmediato. Ya reflejado en la tabla de intents — orden nuevo: COI / Payment / Claim / live agent / Other / Sales misroute.

**Implicación de implementación:** los items #1, #2 y #4 requieren cambios en system-prompts de los agentes. #3 espera Tyler. Plan de implementación de los prompts es trabajo separado de esta nota — la nota solo deja constancia de lo acordado con el cliente.

---

## 2026-04-20 — Service branch kickoff

### Backends pendientes (coordinar con Tyler, desarrollador)
Necesarios para que el flujo COI del Service receptionist funcione end-to-end. Para v1 desplegamos con "pending" pattern (el agente *dice* que envía pero no se envía nada — mismo patrón que Rachel hoy). Necesitamos que Tyler construya:

1. **SMS con review link** — disparado cuando el caller acepta el quid-pro-quo de expedited service (1h turn-around a cambio de review). Step 5 del flujo COI.
2. **SMS con aplicación Home & Auto** — disparado cuando el caller acepta el cross-sell al final del flujo COI. Step 6.
3. **Alerta interna urgente** — cuando alguien pide expedited service, el equipo tiene que verlo al instante. Canal por decidir: SMS al grupo de agentes / email a ops / Slack / tarea en Hawksoft. Recomendación nuestra: email (paper trail) + Slack (visibilidad inmediata).
4. **COI submit endpoint** — para enviar el contenido del certificado (policyholder, additional insured, endorsements, contacto) al CRM. Mismo patrón que WC submit y CA submit — también pendientes. Sin este endpoint, los datos del certificado solo viven en el transcript hasta que alguien los procese a mano.

Mientras los 4 endpoints no estén, un COI urgente se queda solo en el transcript del call — nadie del equipo lo ve hasta que alguien revise transcripts manualmente. **Priorizar #3** (la alerta urgente) como más crítico — los otros tres son mejoras de flujo, pero la alerta urgente evita que un lead expedited se pierda.
