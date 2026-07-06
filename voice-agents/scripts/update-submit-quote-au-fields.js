#!/usr/bin/env node
/*
 * Add the Jennifer v2.15 "Additional Underwriting" fields to the submit_quote tool
 * body schema (builders_risk_submission.properties) so the LLM is allowed to send them.
 *
 * Backend columns for most of these are still pending (Pablo) — until they exist the
 * Calforce backend silently ignores the extra keys; once the columns are created the
 * values persist with NO further change to Jennifer or this tool. expected_complete_date
 * is already in the schema; total_building_coverage is a backend column but was missing
 * from the tool schema, so it's added here too.
 *
 * Idempotent: only adds properties that are absent. Safe to re-run.
 */
const VAPI_KEY = process.env.VAPI_KEY;
if (!VAPI_KEY) { console.error('Set VAPI_KEY (export $(grep -v "^#" .env | xargs))'); process.exit(1); }

const TOOL_ID = 'da21631c-4ba2-4b41-9c06-cb7ffc1c8428'; // submit_quote

const NEW_FIELDS = {
  occupied_during_term:    { type: 'string', description: 'yes/no — building occupied at any time during the policy term (AU1)' },
  project_length_months:   { type: 'string', description: 'expected project length in months (AU2)' },
  is_model_home:           { type: 'string', description: 'yes/no — model home (AU4, new construction only)' },
  is_modular:              { type: 'string', description: 'yes/no — modular structure (AU5, new construction only)' },
  has_solar:               { type: 'string', description: 'yes/no — project involves solar installation (AU6)' },
  previous_damage_perils:  { type: 'string', description: 'yes/no — previous damage from quake/flood/wind/fire/vandalism, incl. uninsured (AU7)' },
  multiple_structures:     { type: 'string', description: 'yes/no — policy covers more than one structure (AU8)' },
  total_building_coverage: { type: 'string', description: 'total completed value of all covered property combined; sent only when multiple_structures = yes (AU8)' },
  additional_coverages:    { type: 'string', description: 'free text of any additional coverages requested, or "none" (AU9)' },
};

async function vapi(method, path, body) {
  const r = await fetch('https://api.vapi.ai' + path, {
    method,
    headers: { Authorization: 'Bearer ' + VAPI_KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status}: ${t.slice(0, 400)}`);
  return t ? JSON.parse(t) : {};
}

(async () => {
  const tool = await vapi('GET', '/tool/' + TOOL_ID);
  const body = tool.body;
  if (!body || !body.properties || !body.properties.builders_risk_submission || !body.properties.builders_risk_submission.properties) {
    throw new Error('Unexpected submit_quote body shape — aborting to avoid corrupting the tool');
  }
  const props = body.properties.builders_risk_submission.properties;
  const added = [];
  for (const [k, v] of Object.entries(NEW_FIELDS)) {
    if (!props[k]) { props[k] = v; added.push(k); }
  }
  if (added.length === 0) { console.log('= all AU fields already in schema; no change'); return; }

  await vapi('PATCH', '/tool/' + TOOL_ID, { body });

  const after = await vapi('GET', '/tool/' + TOOL_ID);
  const ap = after.body.properties.builders_risk_submission.properties;
  const fnOk = after.function && after.function.parameters !== undefined;
  console.log('Added:', added.join(', '));
  console.log('All AU fields now present:', Object.keys(NEW_FIELDS).every(k => ap[k]) ? 'yes' : 'NO — INVESTIGATE');
  console.log('builders_risk_submission props count:', Object.keys(ap).length);
  console.log('function.parameters still present (squad-safety):', fnOk ? 'yes' : 'NO — INVESTIGATE');
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
