// Create the VAPI transferCall tool for the dedicated Spanish line.
//
// Used by `BR Spanish Proxy v1.0` (silent SIP proxy) when Grace routes a
// Spanish-speaking caller (Rule 14 / Step 0 Spanish row). Replaces the
// previous v1.x behaviour of falling back to the English live-agent line.
//
// Idempotent: re-running matches by function.name and updates instead of
// duplicating.

const VAPI_KEY = process.env.VAPI_KEY;
if (!VAPI_KEY) {
  console.error('VAPI_KEY env var is not set. Copy .env.example to .env and `export $(grep -v ^# .env | xargs)`.');
  process.exit(1);
}

const TOOL_NAME = 'transfer_to_spanish_team';
const SPANISH_TEAM_NUMBER = '+18332160350';

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
      description: 'Transfer the caller to the dedicated Spanish-speaking team line. Used when the caller speaks Spanish or asks to be helped in Spanish.',
      parameters: { type: 'object', properties: {}, required: [] }
    },
    destinations: [
      {
        type: 'number',
        number: SPANISH_TEAM_NUMBER,
        message: 'Connecting you to our Spanish-speaking team now. One moment.'
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
    return;
  }

  console.log(`No existing tool with that name. Creating new…`);
  const created = await vapi('POST', '/tool', buildToolBody({ includeType: true }));
  console.log(`✓ Created. Tool ID: ${created.id}`);
  console.log(`\n>>> Save this ID — it goes into create-br-spanish-proxy.js:`);
  console.log(`const TRANSFER_TO_SPANISH_TEAM_ID = '${created.id}';`);
}

main().catch(err => {
  console.error(`✗ FAILED: ${err.message}`);
  process.exit(1);
});
