// One-off: add mailing_* properties to the submit_quote tool's body schema.
//
// Why:
//   Per client (John, 2026-05-06), Jennifer must capture mailing address as a
//   separate field from the project/building address. The backend
//   (PATCH /api/builders_risk_submissions/update_by_email) already accepts
//   mailing_street, mailing_city, mailing_state, mailing_zip natively
//   (verified via test PATCH 2026-05-06 — record id 1430). The VAPI tool's
//   JSONSchema doesn't yet declare these fields, so the model has no
//   "structured slot" for them. Adding them keeps the prompt and the schema
//   in sync.
//
// Idempotent: re-runs are no-ops (checks for existing properties before merging).

const VAPI_KEY = process.env.VAPI_KEY;
if (!VAPI_KEY) {
  console.error('VAPI_KEY env var is not set.');
  process.exit(1);
}

const TOOL_ID = 'da21631c-4ba2-4b41-9c06-cb7ffc1c8428'; // submit_quote

const NEW_FIELDS = {
  mailing_street: { type: 'string', description: 'Mailing street address (separate from project/building address). If caller says "same as project", copy building_street.' },
  mailing_city:   { type: 'string', description: 'Mailing city. If "same as project", copy building_city.' },
  mailing_state:  { type: 'string', description: 'Mailing state — 2-letter code. If "same as project", copy building_state.' },
  mailing_zip:    { type: 'string', description: 'Mailing ZIP. If "same as project", copy building_zip.' },
};

async function vapi(method, path, body) {
  const res = await fetch(`https://api.vapi.ai${path}`, {
    method,
    headers: { 'Authorization': `Bearer ${VAPI_KEY}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { _raw: text }; }
  if (!res.ok) throw new Error(`VAPI ${method} ${path} (${res.status}): ${JSON.stringify(data).slice(0, 500)}`);
  return data;
}

async function main() {
  const tool = await vapi('GET', `/tool/${TOOL_ID}`);
  const props = tool.body?.properties?.builders_risk_submission?.properties;
  if (!props) throw new Error('Unexpected tool body shape — body.properties.builders_risk_submission.properties not found.');

  const before = Object.keys(NEW_FIELDS).filter(k => props[k]);
  if (before.length === Object.keys(NEW_FIELDS).length) {
    console.log(`✓ All mailing_* fields already present — no-op.`);
    return;
  }

  const merged = { ...props, ...NEW_FIELDS };
  const newBody = {
    ...tool.body,
    properties: {
      ...tool.body.properties,
      builders_risk_submission: {
        ...tool.body.properties.builders_risk_submission,
        properties: merged,
      },
    },
  };

  await vapi('PATCH', `/tool/${TOOL_ID}`, { body: newBody });

  const after = await vapi('GET', `/tool/${TOOL_ID}`);
  const afterProps = after.body?.properties?.builders_risk_submission?.properties || {};
  const stillMissing = Object.keys(NEW_FIELDS).filter(k => !afterProps[k]);
  if (stillMissing.length) throw new Error(`Fields not stuck after PATCH: ${stillMissing.join(', ')}`);

  console.log(`✓ Patched submit_quote schema. Added: ${Object.keys(NEW_FIELDS).join(', ')}`);
}

main().catch(err => { console.error(`✗ FAILED: ${err.message}`); process.exit(1); });
