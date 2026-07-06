// Create the VAPI transferCall tool for the dedicated existing-quote line.
//
// Used by `BR Existing-Quote Proxy v1.0` (silent SIP proxy) when Grace routes
// a caller who is following up on a quote we already sent (Step 0 row 2 / Step
// S1 backstop / Step T1 row "existing quote"). Replaces the v1.14-v1.21 behaviour
// of speaking the disconnect line and ending the call.
//
// Existing-quote callers are HOT LEADS — 5x more valuable than service calls
// per John 2026-05-06 — so they get their own dedicated line.
//
// Idempotent: re-running matches by function.name and updates instead of
// duplicating.

const VAPI_KEY = process.env.VAPI_KEY;
if (!VAPI_KEY) {
  console.error('VAPI_KEY env var is not set. Copy .env.example to .env and `export $(grep -v ^# .env | xargs)`.');
  process.exit(1);
}

const TOOL_NAME = 'transfer_to_existing_quote_team';
const EXISTING_QUOTE_NUMBER = '+17262038542';

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
  const body = {
    function: {
      name: TOOL_NAME,
      description: 'Transfer the caller to the dedicated existing-quote line. Used when the caller is following up on a quote we already sent them (hot lead, 5x more valuable than service calls).',
      parameters: { type: 'object', properties: {}, required: [] }
    },
    destinations: [
      {
        type: 'number',
        number: EXISTING_QUOTE_NUMBER,
        message: 'Connecting you with the team that has your quote. One moment.'
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
  console.log(`\n>>> Save this ID — it goes into create-br-existing-quote-proxy.js:`);
  console.log(`const TRANSFER_TO_EXISTING_QUOTE_TEAM_ID = '${created.id}';`);
}

main().catch(err => {
  console.error(`✗ FAILED: ${err.message}`);
  process.exit(1);
});
