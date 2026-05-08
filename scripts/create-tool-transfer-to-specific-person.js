// Create the VAPI transferCall tool used by the BR Direct-Dial Proxy.
//
// Each entry in DESTINATIONS is a person with their own direct DID
// (E.164 number). The previous PBX + extension approach was abandoned on
// 2026-05-08 after José clarified that +18889730016 is a RingCentral
// hunt-group line (used by `transfer_to_live_agent_*`), not the PBX that
// holds the internal extensions in Grace's directory. Direct DIDs are more
// reliable than DTMF and don't depend on PBX timing.
//
// To wire additional directory entries: add more entries to DESTINATIONS,
// re-run this script (idempotent — matches by function.name), and flip the
// `Direct-dial?` column in Grace's directory to `yes` for those names.

const VAPI_KEY = process.env.VAPI_KEY;
if (!VAPI_KEY) {
  console.error('VAPI_KEY env var is not set. Copy .env.example to .env and `export $(grep -v ^# .env | xargs)`.');
  process.exit(1);
}

const TOOL_NAME = 'transfer_to_specific_person';

// One entry per directory name with `Direct-dial? = yes`. Each maps to a
// destinations[] entry on the transferCall tool. The proxy LLM picks the
// correct destination by matching the spoken name in the transcript against
// the `message` field — keep messages distinctive (full name + first phrase).
const DESTINATIONS = [
  {
    fullName: 'Pedro',
    number: '+17262334655',
    message: 'Of course — connecting you to Pedro. One moment.'
  }
  // To add more: { fullName: 'Gustavo Alvarez', number: '+1XXXXXXXXXX', message: 'Of course — connecting you to Gustavo Alvarez. One moment.' }
];

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
  // VAPI: POST /tool requires `type`; PATCH /tool/:id rejects it. Caller passes
  // includeType=true on create, false on update.
  // function.parameters is REQUIRED even when the tool takes no arguments —
  // without it any assistant using this tool fails to load and a containing
  // squad fails with call.start.error-get-assistant. Bug found 2026-05-08.
  const body = {
    function: {
      name: TOOL_NAME,
      description: 'Transfer the caller directly to a specific person via their direct DID. Each destination corresponds to a person in the directory; pick the one whose message contains the full name the caller asked for.',
      parameters: { type: 'object', properties: {}, required: [] }
    },
    destinations: DESTINATIONS.map(d => ({
      type: 'number',
      number: d.number,
      message: d.message,
      description: `${d.fullName} (${d.number})`
    }))
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
    console.log(`  Destinations now: ${updated.destinations?.length ?? 0}`);
    return;
  }

  console.log(`No existing tool with that name. Creating new…`);
  const created = await vapi('POST', '/tool', buildToolBody({ includeType: true }));
  console.log(`✓ Created. Tool ID: ${created.id}`);
  console.log(`\n>>> Save this ID — it goes into create-br-direct-dial-proxy.js:`);
  console.log(`const TRANSFER_TO_SPECIFIC_PERSON_ID = '${created.id}';`);
}

main().catch(err => {
  console.error(`✗ FAILED: ${err.message}`);
  process.exit(1);
});
