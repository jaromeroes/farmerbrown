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
// 18 entries — the 20-name shortlist from John MINUS:
//   - John Brown (owner, no RingCentral line)
//   - Jorge (alias of George, doesn't appear in the RingCentral export)
// Pedro Neumann was removed in v1.21 (test-subject only) and re-added in
// v1.22 at José's request because callers do ask for him by name.
// Source DIDs: docs/farmer-brown-phone-directory.md. Convention: where a
// person has both Softphone and Desk Phone, use the Softphone.
const DESTINATIONS = [
  { fullName: 'Gustavo Alvarez',  number: '+13127618580', message: 'Of course — connecting you to Gustavo Alvarez. One moment.' },
  { fullName: 'Erich Frank',      number: '+17732450633', message: 'Of course — connecting you to Erich Frank. One moment.' },
  { fullName: 'Katerine Zapata',  number: '+17733127722', message: 'Of course — connecting you to Katerine Zapata. One moment.' },
  { fullName: 'Monica Bar',       number: '+13128680693', message: 'Of course — connecting you to Monica Bar. One moment.' },
  { fullName: 'Jim Kocchiu',      number: '+17734538381', message: 'Of course — connecting you to Jim Kocchiu. One moment.' },
  { fullName: 'Fernando Galvan',  number: '+12104181235', message: 'Of course — connecting you to Fernando Galvan. One moment.' },
  { fullName: 'Nichole West',     number: '+17262387739', message: 'Of course — connecting you to Nichole West. One moment.' },
  { fullName: 'Eduarda Viloria',  number: '+17733123591', message: 'Of course — connecting you to Eduarda Viloria. One moment.' },
  { fullName: 'Beth Medina',      number: '+17262338347', message: 'Of course — connecting you to Beth Medina. One moment.' },
  { fullName: 'Angie Latorre',    number: '+13124770149', message: 'Of course — connecting you to Angie Latorre. One moment.' },
  { fullName: 'Gerard Bogadi',    number: '+17262308417', message: 'Of course — connecting you to Gerard Bogadi. One moment.' },
  { fullName: 'Luis Montilla',    number: '+17262133514', message: 'Of course — connecting you to Luis Montilla. One moment.' },
  { fullName: 'Denver B',         number: '+17262242405', message: 'Of course — connecting you to Denver. One moment.' },
  { fullName: 'Daniela Arevalo',  number: '+13129850881', message: 'Of course — connecting you to Daniela Arevalo. One moment.' },
  { fullName: 'James Noreen',     number: '+17732192943', message: 'Of course — connecting you to James Noreen. One moment.' },
  { fullName: 'Jackie Restrepo',  number: '+17734232075', message: 'Of course — connecting you to Jackie Restrepo. One moment.' },
  { fullName: 'John Sanchez',     number: '+17262229401', message: 'Of course — connecting you to John Sanchez. One moment.' },
  { fullName: 'Maria Portillo',   number: '+17262242489', message: 'Of course — connecting you to María Portillo. One moment.' },
  { fullName: 'Pedro Neumann',    number: '+17262334655', message: 'Of course — connecting you to Pedro Neumann. One moment.' },
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
  //
  // SCHEMA NOTES (lessons learned the hard way):
  //   - function.parameters is REQUIRED. Missing it bricks any assistant that
  //     uses this tool (call.start.error-get-assistant). Bug found 2026-05-08.
  //   - For multi-destination transferCall, the LLM MUST be able to specify
  //     which destination. With `parameters: {}` empty, VAPI silently falls
  //     back to destinations[0] regardless of the caller's request. Bug found
  //     2026-05-11 (Pedro test → Gustavo answered). Fix: declare a `destination`
  //     parameter with enum of all valid numbers, AND embed the name→number
  //     mapping in the function.description so the LLM can pick correctly.
  const directoryLines = DESTINATIONS.map(d => `  - ${d.fullName} → ${d.number}`).join('\n');
  const body = {
    function: {
      name: TOOL_NAME,
      description: `Transfer the caller to a specific person via their direct DID. You MUST set the \`destination\` argument to the phone number of the person the caller asked for. Read the conversation context to identify the requested name, then match it to this directory:\n${directoryLines}\n\nIf the caller's name doesn't match any entry exactly, pick the closest match by first name. Never invent a number that isn't in this list.`,
      parameters: {
        type: 'object',
        properties: {
          destination: {
            type: 'string',
            enum: DESTINATIONS.map(d => d.number),
            description: 'The E.164 phone number of the person to connect to. Must be one of the numbers in the directory above.'
          }
        },
        required: ['destination']
      }
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
