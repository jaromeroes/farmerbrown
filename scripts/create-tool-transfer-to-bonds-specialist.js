// Create the VAPI transferCall tool used by Bryan (Bonds intake agent) for
// escalations, "live agent" requests, and existing-customer transfers.
//
// v0.1 — destination is Pedro Neumann's DID (+17262334655) so we don't ring
// Tom Hester during testing. When v1.0 ships, PATCH the destination to Tom
// Hester's DID (+13128782372).
//
// Idempotent: re-running matches by function.name and updates instead of
// duplicating.

const VAPI_KEY = process.env.VAPI_KEY;
if (!VAPI_KEY) {
  console.error('VAPI_KEY env var is not set. Copy .env.example to .env and `export $(grep -v ^# .env | xargs)`.');
  process.exit(1);
}

const TOOL_NAME = 'transfer_to_bonds_specialist';
const TEST_DESTINATION_NUMBER = '+17262334655'; // Pedro Neumann (test destination for v0.1)
const TEST_DESTINATION_LABEL = 'test destination (Pedro Neumann)';
// Production destination (DO NOT enable for v0.1 test): '+13128782372' (Tom Hester ext. 105)

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
  // function.parameters is REQUIRED even when the tool takes no arguments —
  // missing it bricks any assistant that uses this tool. See bug fixed 2026-05-08.
  const body = {
    function: {
      name: TOOL_NAME,
      description: 'Transfer the caller to our Bonding Specialist. Used when the caller asks for a live agent, is an existing bond customer wanting to renew/modify, or when Bryan needs to escalate due to confusion or silence.',
      parameters: { type: 'object', properties: {}, required: [] }
    },
    destinations: [
      {
        type: 'number',
        number: TEST_DESTINATION_NUMBER,
        message: 'Connecting you to our Bonding Specialist now. One moment.'
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
    console.log(`Found existing tool: ${match.id}. Updating…`);
    const updated = await vapi('PATCH', `/tool/${match.id}`, buildToolBody({ includeType: false }));
    console.log(`✓ Updated. Tool ID: ${updated.id}`);
    console.log(`   Destination: ${TEST_DESTINATION_NUMBER} (${TEST_DESTINATION_LABEL})`);
    return;
  }

  console.log(`No existing tool with that name. Creating new…`);
  const created = await vapi('POST', '/tool', buildToolBody({ includeType: true }));
  console.log(`✓ Created. Tool ID: ${created.id}`);
  console.log(`   Destination: ${TEST_DESTINATION_NUMBER} (${TEST_DESTINATION_LABEL})`);
  console.log(`\n>>> Save this ID — it goes into create-bryan-bonds.js:`);
  console.log(`const TRANSFER_TO_BONDS_SPECIALIST_ID = '${created.id}';`);
}

main().catch(err => {
  console.error(`✗ FAILED: ${err.message}`);
  process.exit(1);
});
