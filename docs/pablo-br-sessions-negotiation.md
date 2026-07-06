# Pablo — Builders Risk "Sessions" API (negociación en curso)

| | |
|---|---|
| **Estado** | En curso, José lo lleva con Pablo. Complejo, va para largo. |
| **Última actualización** | 2026-07-03 |
| **Staging** | `https://stagingforms.farmerbrown.com` · Swagger: `/api-docs/` (spec embebido en `swagger-ui-init.js`). Título: "Farmer Brown Forms API" v1.0.0. |
| **Aviso de Pablo** | "No es la última versión, es algo funcional para recibir feedback." → **no apuntar la línea viva a staging.** |

## Qué montó Pablo (nuevo modelo "sessions" para BR)

Sustituye el `update_by_email` actual por un modelo de sesión:

- `POST /api/builders_risk_sessions` → crea sesión vacía, devuelve `{ session_id }` (UUID del servidor). "Llamar al inicio de la llamada."
- `PATCH /api/builders_risk_sessions/{session_id}` con `{ email, data, session_finished }` en cada checkpoint.
- `data` = **objeto libre (JSONB)** → sin columnas enumeradas ⇒ **desaparece el bug histórico** de campos perdidos por no tener columna.
- **`data` se REEMPLAZA, no se fusiona** (en el diseño original): el LLM tendría que reenviar el objeto completo cada vez, y omitir un campo lo borra. ⚠️ frágil con gpt-4o.
- `session_finished: true` → cierra la sesión y, si hay email, **dispara un lead-email vía Zapier a `leads@farmerbrown.com`** (el mismo destino que ya usa el web-form de BR).
- `email` inmutable (422 si cambia); `session_finished` debe ser boolean nativo (422 si `"true"`/`1`).
- Auth: esquema `x-api-key` (header) definido, pero **staging está abierto ahora mismo** (creé una sesión de prueba sin clave: `df177b89-…`). Pablo prefiere OAuth de Google.

## Dirección acordada (tras ida y vuelta)

1. **`call_id` inyectado por NUESTRA capa, no arrastrado por el LLM.** Pablo malinterpretó (creía que el LLM crearía/recordaría el id). Aclarado: nuestra integración pone un identificador de llamada único y de formato consistente en **cada** petición; el modelo ni lo genera ni lo ve. Sin el fallo que temía Pablo.
2. **Append-only (propuesta de Pablo, aceptada):** en vez de un registro que se sobrescribe, **un registro por checkpoint** con el mismo `call_id`; al cerrar, el backend recolecta todo (merge "último valor gana") y manda el email. Elimina la sobreescritura **y** quita la necesidad de que el LLM mantenga el objeto completo. Con esto **ni siquiera hace falta el POST de create** (el primer PATCH con un `call_id` nuevo abre el registro).
3. **Prima en backend:** Pablo confirma que **el form de BR ya calcula la prima**; solo hay que exponerla. Pedido: un endpoint que llamemos con los inputs → devuelve la **prima anual** (para que el agente la lea en la llamada). Resuelve de raíz que el LLM calcula mal. Ver también el "hook" (abajo).
4. **Auth:** OAuth de Google vale para el **panel humano**, pero el **agente hace peticiones servidor-a-servidor** y no puede hacer login interactivo → necesita **credencial de máquina** (API key con scope o token de servicio/client-credentials). Pendiente que Pablo la provea.
5. **Email:** el suyo (Zapier → `leads@farmerbrown.com`, equipo cliente) y el nuestro (→ Gmail de José) **coexisten de momento** (decisión de José). Requisito: el suyo **no debe filtrar la plataforma** (sin links de grabación ni referencias a la tecnología) porque `leads@` es cliente.
6. **Nombres de campo en `data`:** claves snake_case del inventario `jennifer-data-fields-for-pablo.md`. Siguen **abiertas**: gaps A/B (`existing_structure_value`, `renovation_value`, `moving_load_bearing_walls`, `work_description`) y el string canónico de `project_type` (`New Construction`/`Renovation` vs `Remodel`).

## Bloqueantes antes de construir la migración

Pendiente de que Pablo confirme:
1. **Cómo expone la prima** (endpoint inputs → prima anual).
2. **Credencial de máquina** para los endpoints del agente (no OAuth interactivo).
3. **Merge "último valor gana"** en la reconstrucción append-only.

Con esos 3, se monta la integración (1 tool por checkpoint, `call_id` autoinyectado, sin create, sin full-payload) y se prueba **en staging** antes de tocar la línea de producción (`+18882934492`). Flip a prod solo cuando Pablo tenga URL de prod + auth + contrato congelado.

## Regla de comunicación

Pablo es **externo** para el secreto de plataforma (rol Calforce, antes "Tyler"): en mensajes hacia él, **nunca nombrar la plataforma de voz** ni su sintaxis de variables; "el agente"/"el LLM"/"nuestra capa"/"un call_id que controlamos" está bien. Ver memoria `external-comms-rules`.
