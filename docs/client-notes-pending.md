# Notes for Client — Pending Items
**Running log of items to discuss with Farmer Brown (John) at end-of-day syncs.**
**Last updated:** 2026-06-04

---

## 2026-06-04 — Calforce `format=slim` cost optimization (backend dev: ahora **Pablo**, antes Tyler)

Petición de optimización de coste enviada a Tyler (sin urgencia). **El responsable de APIs de Calforce pasó a ser Pablo, que ha respondido** — hilo a retomar.

**El problema (con números, del cost audit de la línea BR):** llamadas largas a ~$0.98/min vs target ~$0.38/min. El mayor contribuyente controlable es UN tool response: `GET /api/calendly/available_times`, que hoy devuelve la colección Calendly cruda (~29 KB) con `scheduling_url`, `event_type_uuid`, `invitees_remaining`, `end_time`, etc. El agente solo usa **día + hora local**. La mecánica que lo hace caro: el body del tool response se queda cargado en el contexto LLM el **resto de la llamada** (en una llamada de 10 min, esos 29 KB siguieron en contexto 48 turnos más → ~$1.25 de puro desperdicio en una llamada de ~$9.68). Es la mecánica documentada en `feedback_vapi_squad_context_compounds.md`.

**La petición — query param opt-in `?format=slim` (o `?compact=true`) en 2 endpoints, default sin tocar:**

1. **`GET /api/calendly/available_times`** — de ~29 KB a <1 KB. Día + hora local (ya timezone-converted, misma lógica) + el `start_time` ISO por slot **solo si** `book_event` lo necesita para round-trip (si `book_event` acepta fecha+hora en lenguaje natural, fuera también el ISO). Todo lo demás se elimina.
2. **`POST /api/calendly/book_event`** — de ~3.3 KB a <200 bytes: `{ status, summary, appointment_id }`. Sin `cancel_url`/`reschedule_url` (los humanos usan el flujo normal de Calendly).

Aplica también al event_type de Angie/Andrés (`event_type_uuid=901112a8-…`, usado por Rachel H&A) — mismo flag, misma shape, sin lógica extra.

**Backward compatibility:** `format=slim` opt-in, NO default — no romper dashboard, Sarah GL, ni nada que consuma la respuesta verbosa.

**Impacto estimado:** ~$1.25/llamada en las que agendan cita; BR ~140 calls/mes, ~20-25% agendan → ~$38-44/mo solo en BR; ×3-4 al escalar Rachel (H&A) y Wendy (WC). *(Números crudos — esto es coordinación con el dev de backend, no comunicación al cliente; aplicar `× 1.25` solo en lo que llega a John, ver `feedback_external_comms_rules.md`.)*

**Pendiente:** revisar la respuesta de Pablo y contestar. José ofreció a Tyler el transcript completo + el dump de 29 KB de una llamada real, y la opción de partir en 2 PRs (slim primero, variante Rachel después).

**Estado 2026-06-04 — Pablo ha implementado `?slim=true`** (Swagger "Farmer Brown Mission Control API"). `available_times` slim: `{ timezone, slots:[{display, start_time}] }`, <2 KB, opt-in, default intacto, soporta `event_type_uuid` (Angie/Andrés). Cuadra con lo pedido. **Verificar antes del OK final:** (a) `start_time` del ejemplo (`2026-05-12T14:00:00.0000002`) NO lleva sufijo `Z`/offset UTC → confirmar round-trip real a `book_event` sin desfase de zona; (b) `book_event` aparece colapsado en el Swagger → confirmar que también acepta slim y devuelve `{status, summary, appointment_id}`.

### ⚠️ Cambio de dominio de la API (CRÍTICO — riesgo de caída silenciosa)
Pablo (2026-06-04): *"hemos cambiado el dominio de la API… es `mission-control.farmerbrown.com`"*. Hoy **6 tools apiRequest de VAPI** apuntan al dominio viejo: 5 a `farmerbrown-bi.calforce.pro` (check_availability ×2, book_appointment ×2, submit_quote) + 1 a `farmerbrown.calforce.pro` (submit_gl_form). Repo: 33 + 9 referencias. **Nada migrado aún.** Si el dominio viejo se apaga, las líneas contestan pero dejan de persistir leads / agendar (fallo silencioso). **Preguntas bloqueantes a Pablo antes de migrar:** (1) ¿el viejo sigue vivo o hay fecha de corte? (2) ¿`mission-control` reemplaza también a `farmerbrown.calforce.pro` (Sarah GL) o solo al `-bi`? — el Swagger trae un `/api/insurance_quote_submissions` que podría sustituir al `/api/submit`; (3) el Swagger aún lista `farmerbrown-bi.calforce.pro` como Production server → ¿alias o sin actualizar? (4) ¿mismos paths + misma `agent_api_key` (`3a8c4681-…`)? **Migración (tras OK):** PATCH idempotente de los 6 tools (patrón `apply-custom-headers-to-apirequest-tools.js`) + find-replace en repo + test-call (un submit + un book) contra el dominio nuevo.

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
