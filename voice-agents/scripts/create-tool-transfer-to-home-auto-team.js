// Create the VAPI transferCall tool for the Home & Auto team direct line.
//
// Used by Rachel v2.4+ as the fallback when Calendly scheduling fails — sends
// the caller straight to +18339024483 (the H&A team line, Angie + Andrés)
// instead of the generic Farmer Brown live-agent line. The generic live-agent
// line stays available for confusion fallbacks (Rules 5/7 in Rachel's prompt).
//
// Idempotent: re-running matches by function.name and updates instead of
// duplicating.

const VAPI_KEY = process.env.VAPI_KEY;
if (!VAPI_KEY) {
  console.error('VAPI_KEY env var is not set. Copy .env.example to .env and `export $(grep -v ^# .env | xargs)`.');
  process.exit(1);
}

const TOOL_NAME = 'transfer_to_home_auto_team';
const HA_TEAM_NUMBER = '+18339024483';

async function vapi(method, path, body) {
  const res = await fetch(`https://api.vapi.ai${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${VAPI_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { _raw: text }; }
  if (!res.ok) throw new Error(`VAPI ${method} ${path} (${res.status}): ${JSON.stringify(data).slice(0, 600)}`);
  return data;
}

function buildToolBody({ includeType }) {
  // VAPI: POST /tool requires `type`; PATCH /tool/:id rejects it.
  // function.parameters is REQUIRED even when the tool takes no arguments —
  // without it OpenAI function calling spec is invalid and any assistant
  // that uses this tool fails to load (causing call.start.error-get-assistant
  // for a squad that includes such an assistant). Bug found 2026-05-08.
  const body = {
    function: {
      name: TOOL_NAME,
      description: 'Transfer the caller directly to the Home & Auto team (Angie + Andrés) when Calendly scheduling fails or the caller wants a live person on H&A. Bypasses the generic Farmer Brown live-agent line.',
      parameters: { type: 'object', properties: {}, required: [] }
    },
    destinations: [
      {
        type: 'number',
        number: HA_TEAM_NUMBER,
        message: 'Connecting you to one of our professionals now. One moment.'
      }
    ]
  };
  if (includeType) body.type = 'transferCall';
  return body;
}

async function main() {
  console.log(`Looking for existing tool "${TOOL_NAME}"…`);
  const existing = await vapi('GET', '/tool');
  const match = existing.find(t => t.function?.name === TOOL_NAME);

  if (match) {
    console.log(`Found existing tool: ${match.id}. Updating destinations…`);
    const updated = await vapi('PATCH', `/tool/${match.id}`, buildToolBody({ includeType: false }));
    console.log(`✓ Updated. Tool ID: ${updated.id}`);
    return;
  }

  console.log(`No existing tool with that name. Creating new…`);
  const created = await vapi('POST', '/tool', buildToolBody({ includeType: true }));
  console.log(`✓ Created. Tool ID: ${created.id}`);
  console.log(`\n>>> Save this ID — it goes into update-rachel.js TOOL_IDS:`);
  console.log(`transfer_to_home_auto_team: '${created.id}'`);
}

main().catch(err => {
  console.error(`✗ FAILED: ${err.message}`);
  process.exit(1);
});
