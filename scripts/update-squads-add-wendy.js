const VAPI_KEY = '7ce0a320-9cbf-4d1c-9c5a-d00dfcace63c';

// Assistant IDs
const DISPATCHER_ID = '753657c6-3ed4-487c-8c39-1f65fa4f8287';
const EMMA_ID       = '71c72af4-b87a-43cb-8f0a-661c3febe8ea';
const OLIVIA_ID     = 'b5f88994-e045-4996-9f2c-056516e9cf01';
const GRACE_ID      = 'fa2897bb-00ee-4680-af00-0e31abeed228';
const JENNIFER_ID   = '273d2d5a-27e0-40aa-b817-76a51d1c302d';
const SARAH_ID      = '1364ed31-51fa-41a4-8831-491b2ee3ef77';
const NORA_ID       = 'd1055f89-7175-4a51-8f03-a3332d1764ff';
const RACHEL_ID     = 'b4957315-f53f-4296-9ca6-58748f4a4041';
const WENDY_ID      = 'bc789a3e-9e2b-4c60-9778-9e33d0cd826d';

// Live Agent Proxies (one per site)
const FB_PROXY_ID = 'fb1e7022-e4ee-42d1-b1db-0977a4e05aad';
const CL_PROXY_ID = 'f06c2ad0-1a21-491d-916d-cbbf09e1118e';
const BR_PROXY_ID = '180a9367-df40-4e46-91c8-a28b13901e53';

// VAPI Names — receptionists bumped to v1.9 / v1.7 / v1.7 for this update.
const EMMA_NAME     = 'Emma — FB Receptionist EN Sales v1.9';
const OLIVIA_NAME   = 'Olivia — CL Receptionist EN Sales v1.7';
const GRACE_NAME    = 'Grace — BR Receptionist EN Sales v1.7';
const JENNIFER_NAME = 'Jennifer — Builders Risk v2.3';
const SARAH_NAME    = 'Sarah — GL Quote Agent v1.1';
const NORA_NAME     = 'Nora — Commercial Auto v1.0';
const RACHEL_NAME   = 'Rachel — FB Home & Auto Intake v2.3';
const WENDY_NAME    = 'Wendy — Workers\' Comp v1.0';

const FB_PROXY_NAME = 'FB Live Agent Handoff v1.0';
const CL_PROXY_NAME = 'CL Live Agent Handoff v1.0';
const BR_PROXY_NAME = 'BR Live Agent Handoff v1.0';

// Squad IDs
const FB_SQUAD_ID   = '5cf7afbf-cee7-45cd-8fa1-9ff2989d8e28';
const CL_SQUAD_ID   = '3b29fd00-f58a-4282-9cb3-c26c393a7858';
const BR_SQUAD_ID   = 'ab53f568-82bf-439f-8fda-d04070864632';
const TEST_SQUAD_ID = '2ae25a8b-6ff0-49db-abfc-197b751f533a';

// ────────────────────────────────────────────────────────────────────
// L2 → L3 destinations (Emma + Olivia)
// ────────────────────────────────────────────────────────────────────

const brDestination = {
  type: 'assistant',
  assistantName: JENNIFER_NAME,
  message: "Great — I'll connect you with Jennifer, our Builder's Risk specialist. She'll get you an instant quote in under five minutes. One moment.",
  description: "Transfer when the caller is looking for a NEW Builder's Risk quote (course of construction, new construction coverage, renovation coverage). Do NOT transfer here if the caller has an existing quote."
};

const glDestination = {
  type: 'assistant',
  assistantName: SARAH_NAME,
  message: "Perfect — I'll connect you with Sarah, our General Liability specialist. She'll pull up real-time pricing for you. One moment.",
  description: "Transfer when the caller is looking for a NEW General Liability quote (contractor liability, GL, business liability). Do NOT transfer here if the caller has an existing quote."
};

const caDestination = {
  type: 'assistant',
  assistantName: NORA_NAME,
  message: "Great — I'll connect you with Nora, our Commercial Auto specialist. She'll collect your fleet details in about eight to ten minutes and hand you off to a licensed agent for pricing. One moment.",
  description: "Transfer when the caller is looking for a NEW Commercial Auto quote (business auto, commercial vehicle, fleet coverage, delivery, livery, black car). Do NOT transfer here if the caller has an existing quote."
};

const haDestination = {
  type: 'assistant',
  assistantName: RACHEL_NAME,
  message: "Perfect — I'll connect you with Rachel, our Home and Auto specialist. She'll get your details and set you up with one of our agents. One moment.",
  description: "Transfer when the caller is looking for a NEW Home, Auto, or Home & Auto quote (homeowners, home insurance, personal auto, car insurance, home and auto bundle). Do NOT transfer here if the caller has an existing quote."
};

// NEW — Wendy (Workers' Compensation)
const wcDestination = {
  type: 'assistant',
  assistantName: WENDY_NAME,
  message: "Perfect — I'll connect you with Wendy, our Workers' Comp specialist. She'll walk you through a few quick questions and set you up with one of our pros. One moment.",
  description: "Transfer when the caller is looking for a NEW Workers' Compensation quote (workers comp, workman's comp, WC, employee coverage). Do NOT transfer here if the caller has an existing quote."
};

// ────────────────────────────────────────────────────────────────────
// Live-agent proxy destinations (site-specific)
// ────────────────────────────────────────────────────────────────────

const fbLiveAgentDestination = {
  type: 'assistant',
  assistantName: FB_PROXY_NAME,
  message: "Connecting you to a licensed agent now, one moment.",
  description: "Transfer here when: caller has an EXISTING quote (hot lead / winner), caller is an existing policyholder on the wrong line, caller explicitly asks for a person, or fallback after two unclear routing attempts."
};

const clLiveAgentDestination = { ...fbLiveAgentDestination, assistantName: CL_PROXY_NAME };
const brLiveAgentDestination = { ...fbLiveAgentDestination, assistantName: BR_PROXY_NAME };

// ────────────────────────────────────────────────────────────────────
// Grace-specific variants — BR is default, others come from Step 3 alt menu
// ────────────────────────────────────────────────────────────────────

const brDestinationForGrace = {
  ...brDestination,
  description: "DEFAULT PATH on this line. Transfer when the caller confirms Builder's Risk at Step 2, or says 'yes' / 'builders risk' / 'construction' / 'course of construction'. Do NOT transfer here if the caller has an existing quote."
};

const glDestinationForGrace = {
  ...glDestination,
  description: "Transfer when the caller said 'something else' at Step 2 and then picked General Liability from the alternate menu at Step 3. Do NOT transfer here if the caller has an existing quote."
};

const caDestinationForGrace = {
  ...caDestination,
  description: "Transfer when the caller said 'something else' at Step 2 and then picked Commercial Auto from the alternate menu at Step 3. Do NOT transfer here if the caller has an existing quote."
};

const haDestinationForGrace = {
  ...haDestination,
  description: "Transfer when the caller said 'something else' at Step 2 and then picked Home and Auto from the alternate menu at Step 3. Do NOT transfer here if the caller has an existing quote."
};

const wcDestinationForGrace = {
  ...wcDestination,
  description: "Transfer when the caller said 'something else' at Step 2 and then picked Workers' Compensation from the alternate menu at Step 3. Do NOT transfer here if the caller has an existing quote."
};

// ────────────────────────────────────────────────────────────────────
// Dispatcher destinations (unchanged — receptionist names just bumped)
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
// Destination sets per receptionist (5 specialists + site-specific proxy)
// ────────────────────────────────────────────────────────────────────

const emmaDestinations = [
  brDestination, glDestination, caDestination, haDestination, wcDestination,
  fbLiveAgentDestination
];

const oliviaDestinations = [
  brDestination, glDestination, caDestination, haDestination, wcDestination,
  clLiveAgentDestination
];

const graceDestinations = [
  brDestinationForGrace, glDestinationForGrace, caDestinationForGrace, haDestinationForGrace, wcDestinationForGrace,
  brLiveAgentDestination
];

// ────────────────────────────────────────────────────────────────────
// Squad definitions — full members[] (PATCH replaces, not merges)
// ────────────────────────────────────────────────────────────────────

const squads = [
  {
    id: FB_SQUAD_ID,
    name: 'Farmer Brown — Sales EN Squad',
    members: [
      { assistantId: EMMA_ID, assistantDestinations: emmaDestinations },
      { assistantId: JENNIFER_ID },
      { assistantId: SARAH_ID },
      { assistantId: NORA_ID },
      { assistantId: RACHEL_ID },
      { assistantId: WENDY_ID },
      { assistantId: FB_PROXY_ID }
    ]
  },
  {
    id: CL_SQUAD_ID,
    name: 'Contractors Liability — Sales EN Squad',
    members: [
      { assistantId: OLIVIA_ID, assistantDestinations: oliviaDestinations },
      { assistantId: JENNIFER_ID },
      { assistantId: SARAH_ID },
      { assistantId: NORA_ID },
      { assistantId: RACHEL_ID },
      { assistantId: WENDY_ID },
      { assistantId: CL_PROXY_ID }
    ]
  },
  {
    id: BR_SQUAD_ID,
    name: 'Builders Risk — Sales EN Squad',
    members: [
      { assistantId: GRACE_ID, assistantDestinations: graceDestinations },
      { assistantId: JENNIFER_ID },
      { assistantId: SARAH_ID },
      { assistantId: NORA_ID },
      { assistantId: RACHEL_ID },
      { assistantId: WENDY_ID },
      { assistantId: BR_PROXY_ID }
    ]
  },
  {
    id: TEST_SQUAD_ID,
    name: 'Test Squad — Sales EN (all sites)',
    members: [
      { assistantId: DISPATCHER_ID, assistantDestinations: dispatcherDestinations },
      { assistantId: EMMA_ID,       assistantDestinations: emmaDestinations },
      { assistantId: OLIVIA_ID,     assistantDestinations: oliviaDestinations },
      { assistantId: GRACE_ID,      assistantDestinations: graceDestinations },
      { assistantId: JENNIFER_ID },
      { assistantId: SARAH_ID },
      { assistantId: NORA_ID },
      { assistantId: RACHEL_ID },
      { assistantId: WENDY_ID },
      { assistantId: FB_PROXY_ID },
      { assistantId: CL_PROXY_ID },
      { assistantId: BR_PROXY_ID }
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
    process.exit(1);
  }
}

async function main() {
  console.log('Adding Wendy (Workers\' Comp) to all 4 squads...\n');
  for (const squad of squads) {
    await updateSquad(squad);
  }
  console.log('\nDone.');
}

main();
