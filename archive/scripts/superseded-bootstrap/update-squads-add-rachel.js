const VAPI_KEY = process.env.VAPI_KEY;
if (!VAPI_KEY) { console.error('VAPI_KEY env var is not set. Copy .env.example to .env and export it.'); process.exit(1); }

// Assistant IDs
const DISPATCHER_ID = '753657c6-3ed4-487c-8c39-1f65fa4f8287';
const EMMA_ID       = '71c72af4-b87a-43cb-8f0a-661c3febe8ea';
const OLIVIA_ID     = 'b5f88994-e045-4996-9f2c-056516e9cf01';
const GRACE_ID      = 'fa2897bb-00ee-4680-af00-0e31abeed228';
const JENNIFER_ID   = '273d2d5a-27e0-40aa-b817-76a51d1c302d';
const SARAH_ID      = '1364ed31-51fa-41a4-8831-491b2ee3ef77';
const NORA_ID       = 'd1055f89-7175-4a51-8f03-a3332d1764ff';
const RACHEL_ID     = 'b4957315-f53f-4296-9ca6-58748f4a4041';

// VAPI Names (must match exactly — receptionist names bumped today)
const EMMA_NAME     = 'Emma — FB Receptionist EN Sales v1.7';
const OLIVIA_NAME   = 'Olivia — CL Receptionist EN Sales v1.5';
const GRACE_NAME    = 'Grace — BR Receptionist EN Sales v1.5';
const JENNIFER_NAME = 'Jennifer — Builders Risk v2.3';
const SARAH_NAME    = 'Sarah — GL Quote Agent v1.1';
const NORA_NAME     = 'Nora — Commercial Auto v1.0';
const RACHEL_NAME   = 'Rachel — FB Home & Auto Intake v2.2';

// Squad IDs
const FB_SQUAD_ID   = '5cf7afbf-cee7-45cd-8fa1-9ff2989d8e28';
const CL_SQUAD_ID   = '3b29fd00-f58a-4282-9cb3-c26c393a7858';
const BR_SQUAD_ID   = 'ab53f568-82bf-439f-8fda-d04070864632';
const TEST_SQUAD_ID = '2ae25a8b-6ff0-49db-abfc-197b751f533a';

// ────────────────────────────────────────────────────────────────────
// Level 2 → Level 3 destinations (Emma / Olivia share this exact set)
// ────────────────────────────────────────────────────────────────────

const brDestination = {
  type: 'assistant',
  assistantName: JENNIFER_NAME,
  message: "Great — I'll connect you with Jennifer, our Builder's Risk specialist. She'll get you an instant quote in under five minutes. One moment.",
  description: "Transfer when the caller is looking for a NEW Builder's Risk quote (course of construction, new construction coverage, renovation coverage). Do NOT transfer here if the caller has an existing quote — those go to a live agent."
};

const glDestination = {
  type: 'assistant',
  assistantName: SARAH_NAME,
  message: "Perfect — I'll connect you with Sarah, our General Liability specialist. She'll pull up real-time pricing for you. One moment.",
  description: "Transfer when the caller is looking for a NEW General Liability quote (contractor liability, GL, business liability). Do NOT transfer here if the caller has an existing quote — those go to a live agent."
};

const caDestination = {
  type: 'assistant',
  assistantName: NORA_NAME,
  message: "Great — I'll connect you with Nora, our Commercial Auto specialist. She'll collect your fleet details in about eight to ten minutes and hand you off to a licensed agent for pricing. One moment.",
  description: "Transfer when the caller is looking for a NEW Commercial Auto quote (business auto, commercial vehicle, fleet coverage, delivery, livery, black car). Do NOT transfer here if the caller has an existing quote — those go to a live agent."
};

const haDestination = {
  type: 'assistant',
  assistantName: RACHEL_NAME,
  message: "Perfect — I'll connect you with Rachel, our Home and Auto specialist. She'll get your details and set you up with one of our agents. One moment.",
  description: "Transfer when the caller is looking for a NEW Home, Auto, or Home & Auto quote (homeowners, home insurance, personal auto, car insurance, home and auto bundle). Do NOT transfer here if the caller has an existing quote — those go to a live agent."
};

// ────────────────────────────────────────────────────────────────────
// Grace-specific variants (BR is the DEFAULT path; other products come
// from the alternate menu at Step 3 after the caller says "something else")
// ────────────────────────────────────────────────────────────────────

const brDestinationForGrace = {
  type: 'assistant',
  assistantName: JENNIFER_NAME,
  message: brDestination.message,
  description: "DEFAULT PATH on this line. Transfer when the caller confirms Builder's Risk at Step 2, or says 'yes' / 'builders risk' / 'construction' / 'course of construction'. Do NOT transfer here if the caller has an existing quote — those go to a live agent."
};

const glDestinationForGrace = {
  type: 'assistant',
  assistantName: SARAH_NAME,
  message: glDestination.message,
  description: "Transfer when the caller said 'something else' at Step 2 and then picked General Liability from the alternate menu at Step 3. Do NOT transfer here if the caller has an existing quote — those go to a live agent."
};

const caDestinationForGrace = {
  type: 'assistant',
  assistantName: NORA_NAME,
  message: caDestination.message,
  description: "Transfer when the caller said 'something else' at Step 2 and then picked Commercial Auto from the alternate menu at Step 3. Do NOT transfer here if the caller has an existing quote — those go to a live agent."
};

const haDestinationForGrace = {
  type: 'assistant',
  assistantName: RACHEL_NAME,
  message: haDestination.message,
  description: "Transfer when the caller said 'something else' at Step 2 and then picked Home and Auto from the alternate menu at Step 3. Do NOT transfer here if the caller has an existing quote — those go to a live agent."
};

// ────────────────────────────────────────────────────────────────────
// Level 1 (Test Dispatcher) → Level 2 destinations
// Receptionist version suffixes bumped today — must update assistantName.
// ────────────────────────────────────────────────────────────────────

const dispatcherDestinations = [
  {
    type: 'assistant',
    assistantName: EMMA_NAME,
    message: "Got it — connecting you to Farmer Brown sales now.",
    description: "John picked Farmer Brown / FB / farmerbrown.com / the main site."
  },
  {
    type: 'assistant',
    assistantName: OLIVIA_NAME,
    message: "Got it — connecting you to Contractors Liability sales now.",
    description: "John picked Contractors Liability / CL / contractorsliability / contractors."
  },
  {
    type: 'assistant',
    assistantName: GRACE_NAME,
    message: "Got it — connecting you to Builders Risk sales now.",
    description: "John picked Builders Risk / BR / buildersrisk.net / construction."
  }
];

// ────────────────────────────────────────────────────────────────────
// Squad definitions (full members[] — PATCH replaces the array, not merges)
// ────────────────────────────────────────────────────────────────────

const squads = [
  {
    id: FB_SQUAD_ID,
    name: 'Farmer Brown — Sales EN Squad',
    members: [
      { assistantId: EMMA_ID, assistantDestinations: [brDestination, glDestination, caDestination, haDestination] },
      { assistantId: JENNIFER_ID },
      { assistantId: SARAH_ID },
      { assistantId: NORA_ID },
      { assistantId: RACHEL_ID }
    ]
  },
  {
    id: CL_SQUAD_ID,
    name: 'Contractors Liability — Sales EN Squad',
    members: [
      { assistantId: OLIVIA_ID, assistantDestinations: [brDestination, glDestination, caDestination, haDestination] },
      { assistantId: JENNIFER_ID },
      { assistantId: SARAH_ID },
      { assistantId: NORA_ID },
      { assistantId: RACHEL_ID }
    ]
  },
  {
    id: BR_SQUAD_ID,
    name: 'Builders Risk — Sales EN Squad',
    members: [
      { assistantId: GRACE_ID, assistantDestinations: [brDestinationForGrace, glDestinationForGrace, caDestinationForGrace, haDestinationForGrace] },
      { assistantId: JENNIFER_ID },
      { assistantId: SARAH_ID },
      { assistantId: NORA_ID },
      { assistantId: RACHEL_ID }
    ]
  },
  {
    id: TEST_SQUAD_ID,
    name: 'Test Squad — Sales EN (all sites)',
    members: [
      { assistantId: DISPATCHER_ID, assistantDestinations: dispatcherDestinations },
      { assistantId: EMMA_ID,       assistantDestinations: [brDestination, glDestination, caDestination, haDestination] },
      { assistantId: OLIVIA_ID,     assistantDestinations: [brDestination, glDestination, caDestination, haDestination] },
      { assistantId: GRACE_ID,      assistantDestinations: [brDestinationForGrace, glDestinationForGrace, caDestinationForGrace, haDestinationForGrace] },
      { assistantId: JENNIFER_ID },
      { assistantId: SARAH_ID },
      { assistantId: NORA_ID },
      { assistantId: RACHEL_ID }
    ]
  }
];

async function updateSquad(squad) {
  const body = { name: squad.name, members: squad.members };

  const res = await fetch(`https://api.vapi.ai/squad/${squad.id}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${VAPI_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  if (data.id) {
    console.log(`  ${squad.name} — updated (${data.members.length} members)`);
  } else {
    console.error(`  Error updating ${squad.name}:`, JSON.stringify(data, null, 2));
  }
}

async function main() {
  console.log('Adding Rachel to all 4 squads + refreshing receptionist names in Test Dispatcher destinations...\n');
  for (const squad of squads) {
    await updateSquad(squad);
  }
  console.log('\nDone.');
}

main();
