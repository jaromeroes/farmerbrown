# Jennifer (Builders Risk) — Inventario completo de datos para backend / email

**Para:** Pablo (backend Calforce / mission-control)
**De:** equipo agentes de voz
**Fuente:** prompt de Jennifer **v2.20** (2026-06-14) — lo que el agente realmente pregunta y envía
**Objetivo:** que el backend tenga columna para **cada** dato que Jennifer recoge, de modo que el correo-resumen al cliente/agente salga completo y nada se pierda silenciosamente.

> ⚠️ **Aviso clave:** este documento describe lo que **el agente envía**. Cualquier campo de esta lista que **no tenga columna** en `builders_risk_submissions` se descarta sin error (ya nos pasó: campos enviados bajo nombres sin columna se perdieron durante semanas). Por favor, confirma columna a columna.

---

## 1. Cómo llega el dato

El agente hace `PATCH https://mission-control.farmerbrown.com/api/builders_risk_submissions/update_by_email` (upsert por email). El cuerpo es:

```json
{
  "email": "caller@example.com",
  "builders_risk_submission": { /* todos los campos en snake_case */ }
}
```

- `email` (top-level) es la **clave única** del upsert. Todos los demás campos van dentro del objeto `builders_risk_submission`.
- La llamada se repite **4 veces** durante una misma llamada (checkpoints CP1→CP4), siempre sobre el mismo registro, de forma **aditiva**. Por eso el correo final solo debe dispararse cuando el registro está completo (ver §6).

---

## 2. Tabla maestra — toda pregunta de Jennifer → su campo

Orden = orden conversacional real. "CP" = en qué checkpoint se envía ese campo.

| # | Lo que pregunta Jennifer | Campo API (`snake_case`) | Tipo | Valores | CP | Condición |
|---|---|---|---|---|----|----|
| — | *Saludo inicial (first message)* | — | — | — | — | no persiste |
| Q1 | "What's your full name?" | `first_name` + `last_name` | string | — | CP1 | siempre |
| Q1b | "Will the policy be under a business name?" → "What's the business name?" | `company_name` | string | texto libre | CP1 | solo si responde Sí (si no, se omite) |
| Q2 | "Is your phone number the one you're calling from?" (+ read-back) | `phone` | string | — | CP1 | siempre |
| Q3 | "What's your email address?" (+ read-back) | `email` *(top-level)* | string | — | CP1+ | siempre — **clave del registro** |
| Q4 | "Is this a new construction or a renovation?" | `project_type` | string | `New Construction` / `Renovation` ⚠️ confirmar string exacto | CP2 | siempre |
| Q5a | "Total square footage of the finished project, incl. basement?" | `square_footage` | string/number | — | CP2 | **solo obra nueva** (en reforma viene de R2) |
| Q5b | "Estimated total value of the building to cover?" | `building_coverage` | string | USD, p.ej. `500000` | CP2 | **solo obra nueva** (en reforma = R1+R4) |
| Q6 | "Address of the project — street, city, state, ZIP" | `building_street`, `building_city`, `building_state`, `building_zip` | string | `state` = código 2 letras | CP3 | siempre |
| Q6b | "Is your mailing address the same as the project address, or different?" | `mailing_street`, `mailing_city`, `mailing_state`, `mailing_zip` | string | `state` = código 2 letras | CP3 | siempre (si "same", copia los `building_*`) |
| Q7 | "Form of business — Individual, LLC, Corporation, Association, or Joint Venture?" | `form_of_business` | string | `Individual` / `LLC` / `Corporation` / `Association` / `Joint Venture` | CP3 | siempre |
| Q8 | "Owner, builder, or both?" | `user_type` | string | `Owner` / `Builder` / `Both` | CP3 | siempre |
| Q9 | "Is there a basement?" | `has_basement` | string | `Yes` / `No` | CP3 | siempre |
| Q10 | "Number of stories?" | `number_of_stories` | string/number | — | CP3 | siempre |
| Q11 | "Single-family dwelling, more than one unit, or commercial?" | `building_type` | string | `Single-Family Dwelling` / `Multi-Unit` / `Commercial` | CP3 | siempre |
| Q12 | "Construction type — Frame, Brick, or Masonry Non-Combustible?" | `construction_type` | string | `Frame` / `Brick` / `Masonry Non-Combustible` | CP3 | siempre |
| Q13 | "What effective date would you like to request?" | `coverage_date` | string | `YYYY-MM-DD` | CP3 | siempre (es fecha **solicitada**, no vinculante) |
| Q14 | "Deductible — $1,000, $2,500, or $5,000?" | `deductible` | string | `$1,000` / `$2,500` / `$5,000` | CP3 | siempre |
| — | *Intro underwriting (una sola vez)* | — | — | — | — | no persiste |
| AU1 | "Will the building be occupied at any time during the policy term?" | `occupied_during_term` | boolean | true=Sí | CP3 | siempre |
| AU2 | "How long do you think your project will last, in months?" | `project_length_months` | number | — | CP3 | siempre |
| AU2b | "What's the projected start date for your project?" | `project_start_date` | string | `YYYY-MM-DD` (distinto de `coverage_date`) | CP3 | siempre |
| AU4 | "Is this a model home?" | `is_model_home` | boolean | true=Sí | CP3 | **solo obra nueva** |
| AU5 | "Is the structure modular?" | `is_modular` | boolean | true=Sí | CP3 | **solo obra nueva** |
| AU6 | "Will the project involve installing any solar?" | `has_solar` | boolean | true=Sí | CP3 | siempre |
| AU7 | "Any previous damage from quake, flood, wind, fire, or vandalism — even uninsured?" | `previous_damage_perils` | boolean | true=Sí | CP3 | siempre |
| AU8 | "Will this policy cover more than one structure?" | `multiple_structures` | boolean | true=Sí | CP3 | siempre |
| AU8b | "Total completed value of all the covered property combined?" | `total_building_coverage` | number | USD | CP3 | **solo si `multiple_structures` = true** |
| Q15 | "Have you filed any insurance claims in the past 2 years?" | `claims_in_past_2_years` | string | `Yes` / `No` | CP3 | siempre · **risk flag** |
| Q16 | "Is the building within 25 miles of the Atlantic Ocean or Gulf of Mexico?" | `near_coast` | string | `Yes` / `No` | CP3 | siempre · **risk flag** |
| Q17 | "Has construction already started?" | `project_already_started` | string | `Yes` / `No` | CP3 | siempre · **risk flag** |
| Q18 | "Is the building in a high-risk fire zone?" | `high_risk_fire_zone` | string | `Yes` / `No` | CP3 | siempre · **risk flag** |

### Bloque de REFORMA (R1–R9) — solo si Q4 = renovation, preguntado en línea tras Q4

| # | Lo que pregunta Jennifer | Campo API (`snake_case`) | Tipo | Valores | CP | Nota |
|---|---|---|---|---|----|----|
| R1 | "Current value of the existing structure?" | ⚠️ **(no se persiste solo)** | — | USD | — | se suma a R4 → `building_coverage`. Ver §5 (gap A) |
| R2 | "Square footage of the existing structure, incl. basement?" | `square_footage` | string/number | — | CP2/CP3 | en reforma, `square_footage` viene de aquí |
| R3 | "Is the current structure weather-proofed (roof, walls, windows)?" | `existing_structure_weatherproof` | string | `Yes` / `No` | CP3 | reforma |
| R4 | "How much will you be investing into the renovation?" | ⚠️ **(no se persiste solo)** | — | USD | — | R1+R4 → `building_coverage`. Ver §5 (gap A) |
| R5 | "Will you be moving any load-bearing walls?" | ⚠️ **SIN CAMPO** | — | Yes/No | — | se pregunta pero **no se envía**. Ver §5 (gap B) |
| R6 | "Describe the work (electrical, plumbing, roofing, floors, adding a story…)" | ⚠️ **SIN CAMPO** | — | texto libre | — | se pregunta pero **no se envía**. Ver §5 (gap B) |
| R7 | "Approximately how old is the existing structure, in years?" | `existing_structure_age_years` | number | — | CP3 | reforma |
| R8 | "Condition of the existing structure — good, average, or poor?" | `existing_structure_condition` | string | `good` / `average` / `poor` | CP3 | reforma |
| R9 | "Describe the existing structure (e.g. single-family home)" | `existing_structure_description` | string | texto libre | CP3 | reforma |

---

## 3. Campos derivados / calculados (no salen de una sola pregunta)

| Campo API | Tipo | Cómo se obtiene | CP | Condición |
|---|---|---|---|---|
| `sms_consent` | boolean | `true` salvo que el cliente lo rechace | CP1 | siempre |
| `is_high_risk` | boolean | `true` si **alguna** de Q15/Q16/Q17/Q18 = Sí | CP3 | siempre |
| `building_coverage` (reforma) | string | suma **R1 + R4**, confirmada en voz con el cliente | CP2 | solo reforma |
| `annual_premium` | number | **total** dicho en voz (prima + fee, p.ej. `2705`) | CP4 | **solo si se llegó a cotizar** — nunca en hard-to-place ni en transfer previo a cotización |
| `hard_to_place_details` | string (texto libre) | todas las respuestas del drill-down, verbatim (ver §4) | CP4 | solo llamadas hard-to-place |

> Nota sobre `annual_premium`: este es el **nombre de columna correcto** (verificado por probe en v2.20). El nombre antiguo `quoted_premium` **no** tiene columna y se descartaba. Asegúrate de que el correo lea `annual_premium`.

---

## 4. Casos especiales que también alimentan el registro

**Agendado de cita** (solo si el cliente lo pide explícitamente; tras `book_appointment` OK):

| Campo API | Tipo | Origen | CP |
|---|---|---|---|
| `appointment_id` | string | respuesta de `book_appointment` | CP4 |
| `scheduled_time` | string | hora reservada, UTC ISO8601 | CP4 |

**Hard-to-place drill-down** — si Q15/Q16/Q17/Q18 = Sí, Jennifer NO cotiza y hace preguntas extra que se guardan **todas juntas, verbatim, en `hard_to_place_details`**:

- Coastal (Q16 Sí): ¿tejado a cuatro aguas o a dos aguas (hip/gable)? ¿contraventanas anti-huracán?
- Ya empezada (Q17 Sí): ¿% completado? ¿dueños nuevos u originales? ¿qué está hecho ya?
- Zona de fuego (Q18 Sí): ¿distancia al hidrante más cercano? ¿a la estación de bomberos? ¿voluntarios o profesionales? ¿24 h?

---

## 5. ⚠️ Decisiones que necesito de ti (lo más importante)

**Gap A — valores individuales de reforma se pierden.** R1 (valor existente) y R4 (inversión en reforma) hoy solo se persisten como su **suma** en `building_coverage`. Si el correo o el underwriting necesitan ver los dos por separado, hacen falta columnas `existing_structure_value` y `renovation_value` (y yo añado el envío en el prompt). ¿Las quieres separadas?

**Gap B — dos preguntas sin destino.** R5 (paredes de carga) y R6 (descripción del trabajo) se preguntan al cliente pero **no se envían a ningún campo**. Propongo columnas `moving_load_bearing_walls` (Yes/No) y `work_description` (texto libre). ¿OK? Si las creas, las cableo en el prompt.

**Gap C — `tools.md` está desfasado, no te fíes de él.** El esquema viejo en `agents/jennifer-builders-risk/tools.md` lista campos que **ya no se envían** (`builder_name`, `builder_city_state`, `expected_complete_date`, `percent_complete`, `work_already_completed_description`, `existing_structure_value`, `renovation_value`, `square_footage_after_renovation`, `structure_condition`, `work_being_done`, `work_description`, `provide_social_security`, `social_security_number`) y le **faltan ~17** que sí se envían hoy (todos los `mailing_*`, `occupied_during_term`, `project_length_months`, `project_start_date`, `is_model_home`, `is_modular`, `has_solar`, `previous_damage_perils`, `multiple_structures`, `total_building_coverage`, los 4 `existing_structure_*`, `annual_premium`, `hard_to_place_details`). **La lista buena es la de este documento.**

**Confirmar string exacto de `project_type`** — el prompt dice "new construction / renovation" en voz; necesito saber qué string espera tu columna (`New Construction`/`Renovation` vs `Remodel`).

---

## 6. Resumen plano — todos los campos que el correo debe contemplar

Top-level: **`email`**.

Dentro de `builders_risk_submission`:

```
first_name, last_name, phone, company_name, sms_consent,
project_type, building_coverage, square_footage,
building_street, building_city, building_state, building_zip,
mailing_street, mailing_city, mailing_state, mailing_zip,
form_of_business, user_type, has_basement, number_of_stories,
building_type, construction_type, coverage_date, deductible,
occupied_during_term, project_length_months, project_start_date,
is_model_home, is_modular, has_solar, previous_damage_perils,
multiple_structures, total_building_coverage,
claims_in_past_2_years, near_coast, project_already_started, high_risk_fire_zone,
is_high_risk,
existing_structure_weatherproof, existing_structure_age_years,
existing_structure_condition, existing_structure_description,
annual_premium, hard_to_place_details,
appointment_id, scheduled_time
```

**Pendientes de tu OK (gaps A/B):** `existing_structure_value`, `renovation_value`, `moving_load_bearing_walls`, `work_description`.

---

### Checkpoints (cuándo se envía cada bloque)

- **CP1** (tras email): `first_name, last_name, phone, sms_consent, company_name`
- **CP2** (tras valor del proyecto): + `project_type, building_coverage, square_footage`
- **CP3** (tras las 4 risk flags, registro completo de cotización): + direcciones, `form_of_business, user_type, has_basement, number_of_stories, building_type, construction_type, coverage_date, deductible`, las 4 risk flags, `is_high_risk`, todo el underwriting (AU1–AU8), y los `existing_structure_*` si es reforma
- **CP4** (handoff/cierre): todo lo anterior + `annual_premium` (si se cotizó) / `appointment_id`+`scheduled_time` (si se agendó) / `hard_to_place_details` (si hard-to-place)
