# Contrato de integración — Jennifer (Builders Risk) → Backend de leads

| | |
|---|---|
| **Versión** | v1.0 (borrador) |
| **Fecha** | 2026-06-22 |
| **Estado** | Borrador para validación de Pablo |
| **Fuente de verdad (campos)** | prompt Jennifer **v2.20** (2026-06-14) + `docs/jennifer-data-fields-for-pablo.md` |
| **Endpoint vivo** | `PATCH https://mission-control.farmerbrown.com/api/builders_risk_submissions/update_by_email` |

> Este documento responde a lo que pidió Pablo: **el contrato (objeto JSON) + el flujo de la información**. El **inventario campo a campo** ya vive, correcto y al día, en [`jennifer-data-fields-for-pablo.md`](./jennifer-data-fields-for-pablo.md); aquí se formaliza como contrato y se resuelve la parte que faltaba: **qué se hace con el dato** (persistir vs. solo email) y **cómo llega el lead por correo en fases**.
>
> El `agents/jennifer-builders-risk/tools.md` está **desfasado** (lista campos muertos como `social_security_number`, `builder_name`, `work_being_done`; le faltan ~17 que sí se envían; y su tabla-resumen aún apunta al POST/host viejos). **No usar como fuente de campos.** La buena es la de este contrato + el doc de campos.

---

## 1. Flujo de la información (la pregunta de Pablo)

Pablo preguntó si el dato es **solo para email** (entonces basta plantilla, sin tabla) o si hace falta para **operar/buscar** (entonces sí hacen falta campos). La respuesta es **persistir + notificar**, por tres razones que ya están en el sistema:

1. El endpoint es un **upsert por email**: Jennifer manda el mismo registro **4 veces** durante una llamada (CP1→CP4) y lo va completando. Eso es mantener estado → **hay persistencia**, no es un disparo único.
2. El lead alimenta (o alimentará) un **resumen de warm transfer**: un breve resumen de la llamada que el agente humano oye antes de que se le pase al cliente. En VAPI estoy intentando montar esa warm transfer, pero **todavía no es seguro que se haga ahí**. Sea cual sea la plataforma, el correo a ventas es la versión completa de ese mismo resumen.
3. `annual_premium` solo se envía si se cotizó; los risk flags condicionan `is_high_risk`. El registro **evoluciona**.

### Dos planos que no hay que mezclar

**Plano de DATOS (mutable — un registro que crece).** Fuente de verdad = el registro persistido por email. Cada PATCH hace upsert aditivo sobre la misma fila. Es lo único que "se actualiza".

**Plano de NOTIFICACIÓN (inmutable — varias fotos).** Un email enviado no se edita. Por eso **no se actualiza un email**: se persiste el lead y se **disparan correos en hitos** del ciclo de vida, cada uno una foto completa hasta ese momento. Esto resuelve la duda de José ("un lead que llega una vez y se va actualizando"): el **dato** se actualiza en el registro; los **correos** son notificaciones puntuales que el comercial ve como un hilo que crece.

> **Decisión de negocio para José (sección 7):** ¿un solo correo final cuando el registro está completo (más simple, lo que sugería el doc de campos §6), o varios correos por fase (lo que pediste en el chat)? El contrato soporta ambos; la recomendación está abajo.

---

## 2. Transporte y clave de upsert (verificado contra el repo)

| Aspecto | Definición | Estado |
|---|---|---|
| **Método / endpoint** | `PATCH .../api/builders_risk_submissions/update_by_email` | confirmado (`apis/builders-risk-api.md`, `CLAUDE.md`) |
| **Semántica** | **UPSERT por email**: crea en la 1ª llamada, actualiza en las siguientes. Varios checkpoints → misma fila, sin duplicados. | confirmado |
| **Clave del upsert** | `email` (top-level, fuera del objeto) | confirmado |
| **Auth** | `agent_api_key=${CALFORCE_AGENT_KEY}` como query param | confirmado |
| **Frecuencia** | 4 checkpoints por llamada (CP1→CP4), aditivos | confirmado |
| **Legacy (NO usar)** | `POST farmerbrown.calforce.pro/api/builders_risk` — creaba duplicados por checkpoint, **ya reemplazado** por el PATCH. El host `farmerbrown-bi.calforce.pro` está muerto (migración 2026-06 → `mission-control`). | deprecado |

> No hay ninguna ambigüedad "append-only" que resolver: el upsert está documentado y vivo. Lo único pendiente de higiene es **actualizar `tools.md`** (su tabla-resumen aún cita el POST/host viejos), pero eso no afecta a la integración real.

---

## 3. Reglas del contrato (las de Pablo, adoptadas)

1. El LLM puede enviar **tantos campos como recoja**, todos dentro de `builders_risk_submission` (+ `email` top-level).
2. **Una vez fijado el contrato, los nombres quedan bloqueados.** El LLM no debe renombrar.
3. **Faltantes → el backend aplica defaults**, no es error.
4. **Sobrantes → se ignoran sin error** (es justo el comportamiento actual: campos sin columna se descartan en silencio).
5. **Implicación:** *añadir* campos no rompe nada; solo *renombrar* rompe. Esto resuelve el dolor de origen (Jennifer cambia mucho de versión) y hace que los 4 campos propuestos (sección 6) sean aditivos y de bajo riesgo.

---

## 4. El contrato — estructura JSON + ejemplo

`email` va al nivel superior (clave del upsert); todo lo demás, en snake_case, dentro de `builders_risk_submission`. Ejemplo de **foto final** de un lead de reforma cotizado y agendado (incluye los 4 campos **propuestos** marcados `// PROPUESTO`):

```json
{
  "email": "michael.donovan@example.com",
  "builders_risk_submission": {
    "first_name": "Michael",
    "last_name": "Donovan",
    "phone": "555-123-4567",
    "company_name": "Donovan Construction LLC",
    "sms_consent": true,

    "project_type": "Renovation",
    "building_coverage": "630000",
    "square_footage": "4200",

    "building_street": "1420 Maple Avenue",
    "building_city": "Austin",
    "building_state": "TX",
    "building_zip": "78704",
    "mailing_street": "PO Box 5567",
    "mailing_city": "Dallas",
    "mailing_state": "TX",
    "mailing_zip": "75201",

    "form_of_business": "LLC",
    "user_type": "Builder",
    "has_basement": "Yes",
    "number_of_stories": "2",
    "building_type": "Single-Family Dwelling",
    "construction_type": "Frame",
    "coverage_date": "2026-09-01",
    "deductible": "$5,000",

    "occupied_during_term": false,
    "project_length_months": 9,
    "project_start_date": "2026-08-15",
    "has_solar": true,
    "previous_damage_perils": false,
    "multiple_structures": false,

    "claims_in_past_2_years": "No",
    "near_coast": "No",
    "project_already_started": "No",
    "high_risk_fire_zone": "No",
    "is_high_risk": false,

    "existing_structure_weatherproof": "Yes",
    "existing_structure_age_years": 35,
    "existing_structure_condition": "good",
    "existing_structure_description": "Two-story wood-frame single-family home built in 1985.",

    "existing_structure_value": "450000",       // PROPUESTO (gap A, R1)
    "renovation_value": "180000",                // PROPUESTO (gap A, R4)
    "moving_load_bearing_walls": "No",           // PROPUESTO (gap B, R5)
    "work_description": "Full kitchen and bath remodel, new panel, 200 sqft rear extension.",  // PROPUESTO (gap B, R6)

    "annual_premium": 3850,
    "appointment_id": "appt_8f3c21ab90",
    "scheduled_time": "2026-06-25T20:30:00Z"
  }
}
```

> Notas del ejemplo: en **reforma**, `building_coverage` = R1 + R4 (aquí 450k + 180k = 630k), confirmado en voz; los campos propuestos guardarían R1 y R4 por separado. En **obra nueva**, `building_coverage` viene directo (Q5b) y los `existing_structure_*` no aplican. `is_high_risk` lo recalcula el backend (OR de los 4 risk flags); si el agente lo manda, mejor que el backend lo recompute.

### 4.1 Diccionario (estado real v2.20)

Tipos y valores tomados de `jennifer-data-fields-for-pablo.md` (= lo que Jennifer **realmente** envía hoy). "CP" = checkpoint en que se envía.

| Campo | Tipo actual | Valores | CP | Condición |
|---|---|---|---|---|
| `first_name`, `last_name` | string | — | CP1 | siempre |
| `phone` | string | — | CP1 | siempre |
| `company_name` | string | texto libre | CP1 | solo si póliza a nombre de empresa |
| `sms_consent` | **boolean** | `true` salvo rechazo | CP1 | siempre |
| `project_type` | string | `New Construction` / `Renovation` ⚠️ (Decisión #3) | CP2 | siempre |
| `building_coverage` | string | USD, p.ej. `"630000"` | CP2 | obra nueva = Q5b; reforma = R1+R4 |
| `square_footage` | string/number | — | CP2/CP3 | siempre |
| `building_street/city/state/zip` | string | `state` = 2 letras | CP3 | siempre |
| `mailing_street/city/state/zip` | string | `state` = 2 letras | CP3 | siempre (copia building si "same") |
| `form_of_business` | string | Individual / LLC / Corporation / Association / Joint Venture | CP3 | siempre |
| `user_type` | string | Owner / Builder / Both | CP3 | siempre |
| `has_basement` | string | `Yes` / `No` | CP3 | siempre |
| `number_of_stories` | string/number | — | CP3 | siempre |
| `building_type` | string | Single-Family Dwelling / Multi-Unit / Commercial | CP3 | siempre |
| `construction_type` | string | `Frame` / `Brick` / `Masonry Non-Combustible` | CP3 | siempre — **texto, no factor** (la tasa 0.00251… se usa solo en el cálculo de prima dentro del prompt) |
| `coverage_date` | string | `YYYY-MM-DD` | CP3 | siempre (fecha *solicitada*) |
| `deductible` | string | `$1,000` / `$2,500` / `$5,000` | CP3 | siempre |
| `occupied_during_term` | **boolean** | `true`=sí | CP3 | siempre |
| `project_length_months` | number | — | CP3 | siempre |
| `project_start_date` | string | `YYYY-MM-DD` | CP3 | siempre |
| `is_model_home` | **boolean** | `true`=sí | CP3 | solo obra nueva |
| `is_modular` | **boolean** | `true`=sí | CP3 | solo obra nueva |
| `has_solar` | **boolean** | `true`=sí | CP3 | siempre |
| `previous_damage_perils` | **boolean** | `true`=sí (**no es lista de perils**) | CP3 | siempre |
| `multiple_structures` | **boolean** | `true`=sí | CP3 | siempre |
| `total_building_coverage` | number | USD | CP3 | **solo si `multiple_structures`=true** (valor agregado de todas las estructuras; no es alias de `building_coverage`) |
| `claims_in_past_2_years` | string | `Yes` / `No` | CP3 | risk flag |
| `near_coast` | string | `Yes` / `No` | CP3 | risk flag |
| `project_already_started` | string | `Yes` / `No` | CP3 | risk flag |
| `high_risk_fire_zone` | string | `Yes` / `No` | CP3 | risk flag |
| `is_high_risk` | **boolean** | OR de los 4 risk flags | CP3 | siempre (recalculable por backend) |
| `existing_structure_weatherproof` | string | `Yes` / `No` | CP3 | solo reforma |
| `existing_structure_age_years` | number | — | CP3 | solo reforma |
| `existing_structure_condition` | string | `good` / `average` / `poor` | CP3 | solo reforma |
| `existing_structure_description` | string | texto libre | CP3 | solo reforma |
| `annual_premium` | number | total cotizado, p.ej. `3850` | CP4 | **solo si se cotizó** (nombre correcto; `quoted_premium` se descartaba) |
| `hard_to_place_details` | string | verbatim del drill-down | CP4 | solo hard-to-place |
| `appointment_id` | string | de `book_appointment` | CP4 | solo si se agendó |
| `scheduled_time` | string | ISO-8601 UTC | CP4 | solo si se agendó |

**Propuestos (gaps A/B, pendientes del OK de Pablo):**

| Campo | Tipo | Decisión | Qué resuelve |
|---|---|---|---|
| `existing_structure_value` | string (USD) | #1 / gap A (R1) | hoy R1 solo vive sumado en `building_coverage` |
| `renovation_value` | string (USD) | #1 / gap A (R4) | hoy R4 solo vive sumado en `building_coverage` |
| `moving_load_bearing_walls` | string `Yes`/`No` | #2 / gap B (R5) | se pregunta y **no se persiste** |
| `work_description` | string | #2 / gap B (R6) | se pregunta y **no se persiste** |

> **Inconsistencia real a limpiar (para Pablo):** los sí/no llegan **mezclados** — unos como boolean (`occupied_during_term`, `is_model_home`, `is_modular`, `has_solar`, `previous_damage_perils`, `multiple_structures`, `sms_consent`, `is_high_risk`) y otros como string `Yes`/`No` (`has_basement`, los 4 risk flags, `existing_structure_weatherproof`). Conviene **elegir UNA convención** y, si se cambia, hacerlo coordinado (regla 2: renombrar/retipar es lo único que rompe). Recomendación: el backend **acepta ambas y normaliza** (lista blanca case-insensitive), para no forzar un cambio de prompt arriesgado.

---

## 5. Modelo de fases / cuándo se notifica

Regla de oro: **emails en hitos, nunca por PATCH.** Hay 4 PATCH por llamada pero como mucho 2–3 correos por lead, en el mismo hilo (asunto ancla + `Re:`, o `In-Reply-To` si el ESP lo respeta — confirmar ESP).

| Checkpoint | Disparador | Qué hay en el registro | ¿Email? |
|---|---|---|---|
| **CP1** | tras email confirmado | identidad + contacto (`first_name`, `last_name`, `phone`, `sms_consent`, `company_name`) | *(no)* — registro creado |
| **CP2** | tras valor del proyecto | + `project_type`, `building_coverage`, `square_footage` | **opcional — Hito 1 "lead nuevo"** |
| **CP3** | registro de cotización completo | + direcciones, perfil del edificio, underwriting, risk flags, `is_high_risk`, `existing_structure_*` si reforma | *(no)* — enriquece |
| **CP4** | cierre / handoff | + `annual_premium` (si cotizó) **o** `hard_to_place_details` **o** `appointment_id`+`scheduled_time` | **Hito 2 "lead completo"** (el que más importa) |

**Recomendación (responde a "en varias fases"):** modelo de **2 correos en el mismo hilo**:

1. **Hito 1 — al cualificar (CP2):** avisa a ventas de que entra un lead, con lo conocido (nombre, contacto, tipo de proyecto, valor, y en CP3 ubicación). Abre el hilo.
2. **Hito 2 — al cerrar (CP4):** foto definitiva, `Re:` en el mismo hilo, con prima/cita/o motivo hard-to-place y el resultado de la llamada.

Si José prefiere el modelo más simple, basta el **único correo en CP4**; el contrato no cambia, solo el disparo. Evitar 1 email por checkpoint (spam).

**Idempotencia:** cada hito se envía **una sola vez** aunque lleguen varios PATCH casi a la vez. Mecanismo: una columna de estado (`last_email_phase`) y un `UPDATE ... WHERE last_email_phase < '<hito>'` condicional; solo envía quien gane el update.

---

## 6. Decisiones abiertas para Pablo

Son las mismas que ya planteaste, ahora con recomendación. (Ya **no** hay "Pregunta #0" de persistencia: es upsert confirmado.)

**Decisión #1 — Separar R1 y R4 (gap A).** Hoy `building_coverage` guarda R1+R4 sumados. Recomendación: crear `existing_structure_value` (R1) y `renovation_value` (R4) como **fuente atómica**, y que `building_coverage` pase a derivado calculado por el backend. Mejora email y warm transfer (estructura vieja vs. inversión en obra son riesgos distintos). *Confirmar nombres exactos; José cablea el envío en el prompt si se aprueba.*

**Decisión #2 — Dos preguntas sin destino (gap B).** Crear `moving_load_bearing_walls` (Yes/No) y `work_description` (texto). Son señales de alto valor para el comercial que hoy se tiran. Recomendación: crear ambas.

**Decisión #3 — String canónico de `project_type`.** Jennifer dice "renovation" en voz; `tools.md` (viejo) decía `Remodel`; el doc de campos propone `New Construction`/`Renovation`. **Elegir UNO y bloquearlo.** Recomendación: `Renovation`. Si el backend no se toca y espera `Remodel`, el agente mapea `renovation`→`Remodel` antes del PATCH.

**Decisión #4 — Convención de booleanos.** Unificar sí/no (ver nota §4.1). Recomendación: backend acepta boolean y `"Yes"/"No"` y normaliza, sin forzar cambio de prompt.

**Higiene (no bloqueante):** actualizar `agents/jennifer-builders-risk/tools.md` (campos muertos + endpoint/host viejos en su tabla-resumen) para que deje de inducir a error.

---

## 7. Almacenamiento (recomendación, decide Pablo)

Como el uso declarado es **email + warm transfer** (sin búsqueda/reporting hoy), encaja un enfoque **JSONB + pocas columnas promovidas**: guardar el objeto del lead como JSONB por email y exponer como columnas reales solo lo que se opera —`email` (PK/único, ya necesario para el upsert), `last_email_phase` (idempotencia de correos), `annual_premium`, timestamps—. Ventaja: acepta cualquier campo nuevo de Jennifer **sin migración** (alinea con la regla "añadir no rompe"). Si más adelante aparece reporting, se añaden índices/columnas — aditivo, no rediseño. La **validación** (estado 2 letras, fechas, normalización de booleanos) vive en la capa de aplicación, no en el JSONB.

---

## 8. Changelog

| Versión | Fecha | Cambios |
|---|---|---|
| v1.0 | 2026-06-22 | Borrador inicial grounded en v2.20 + `jennifer-data-fields-for-pablo.md` + `apis/builders-risk-api.md`. Formaliza el contrato JSON, resuelve el flujo (persistir + emails por fase + warm transfer), diccionario al estado real, 4 decisiones abiertas, recomendación de almacenamiento. |
