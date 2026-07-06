# Jennifer (BR) → email de lead automático

| | |
|---|---|
| **Estado** | en build (2026-06-27) |
| **Objetivo** | Al terminar una llamada de Builders Risk que llegó a Jennifer y capturó datos, enviar un email con **(1) el formulario relleno** (todos los campos del `builders_risk_submission`), **(2) el transcript completo** y **(3) metadatos** (fecha, duración, resultado, prima, grabación). |
| **Independiente de Pablo** | Sí. No espera columnas ni backend nuevo; lee la llamada directamente de VAPI. |
| **Host** | `farmerbrown-billing` (Astro en Vercel, auto-deploy desde GitHub). Reutiliza Resend (`EMAIL_FROM` verificado) + cliente VAPI ya existentes. |
| **Destinatarios v1** | `jaromero.es@gmail.com` (override por env `LEAD_NOTIFICATION_EMAILS`, CSV). 2º destinatario pendiente. |

## Por qué aquí y no en VAPI/Pablo

- `farmerbrown-billing` ya está desplegado, ya habla con VAPI (`src/lib/vapi.ts`) y ya envía email (`src/lib/email.ts` + Resend con dominio verificado). Añadir una ruta = `git push`.
- El plano "persistir + notificar por fases" formal (2 correos por hito, idempotencia con columna) es el de `docs/jennifer-builders-risk-contract.md` y depende de Pablo. **Esto es la versión rápida**: 1 email por llamada, idempotente vía Resend, sin tocar el backend.

## Arquitectura

```
Llamada BR cuelga
      │
      ▼
VAPI end-of-call-report  ──POST──▶  /api/vapi-lead-email   (tiempo real)
(server.url en el nº BR)                     │
                                            ├─ fetch /call/{id} en VAPI (fuente autoritativa)
catch-up / re-envío manual ──GET──▶          ├─ ¿llegó a Jennifer con datos? (hay submit_quote)
(Bearer CRON_SECRET)                         ├─ extrae + fusiona builders_risk_submission de todos los checkpoints
                                            ├─ render formulario + transcript
                                            └─ Resend (idempotencyKey = br-lead-<callId>)
```

- **Disparo en tiempo real:** `server.url` + `server.secret` en el **número** `+18882934492` (y todo número que apunte al squad BR Unified). NO se toca Jennifer/Grace/squad → cero riesgo de brickear la línea (histórico de incidentes al tocar esa config). VAPI manda el `end-of-call-report` de toda la llamada al server del número (precedencia assistant > phoneNumber > org; los assistants no tienen server). El endpoint filtra por tipo.
- **Auth webhook:** `server.secret` = mismo valor que `CRON_SECRET` (ya en Vercel) → no hay que crear env nuevas. El endpoint compara `X-Vapi-Secret` con `CRON_SECRET`.
- **Filtro "llegó a Jennifer con datos":** existe ≥1 tool-call `submit_quote` (exclusivo de Jennifer) con al menos email/nombre/teléfono. Colgados en el triage de Grace no disparan email.
- **Idempotencia:** `idempotencyKey: br-lead-<callId>` en Resend → ni el webhook ni el catch-up duplican.
- **Catch-up / test / re-envío:** `GET /api/vapi-lead-email` con `Authorization: Bearer $CRON_SECRET`:
  - `?callId=<id>` procesa una sola llamada.
  - `?sinceHours=N` (def. 48) recorre las llamadas BR recientes.
  - `&dryRun=true` devuelve qué enviaría sin enviar.

## Fuente de los campos

El "formulario relleno" se reconstruye de los argumentos de `submit_quote` (no del transcript), fusionando CP1→CP4. Diccionario de etiquetas/orden/grupos en `src/lib/leadEmail.ts`, derivado de `docs/jennifer-data-fields-for-pablo.md`. Cualquier campo capturado que no esté en el diccionario se muestra en "Other captured fields" (nunca se descarta en silencio).

## Pendiente / cuidado

- **2º destinatario:** cuando se añada (equipo de John = externo), revisar redacción externa antes: el email hoy incluye la URL de grabación (revela la plataforma) y no menciona coste. Regla: en comms externas nunca nombrar la plataforma y cotizar coste ×1.25. Hoy va solo a José (interno) → detalle completo OK.
- **Confirmación del salto VAPI→endpoint:** requiere una llamada real a la línea BR (no simulable headless). El endpoint+render+envío se verifican solos contra llamadas reales históricas vía el modo catch-up.
- **Extender a otros agentes (GL/Sarah, etc.):** el core es genérico; bastaría detectar su tool de submit + un diccionario por producto.
