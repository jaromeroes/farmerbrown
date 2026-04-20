const VAPI_KEY = '7ce0a320-9cbf-4d1c-9c5a-d00dfcace63c';

const EMMA_ID = '71c72af4-b87a-43cb-8f0a-661c3febe8ea';
const OLIVIA_ID = 'b5f88994-e045-4996-9f2c-056516e9cf01';
const GRACE_ID = 'fa2897bb-00ee-4680-af00-0e31abeed228';
const JENNIFER_ID = '273d2d5a-27e0-40aa-b817-76a51d1c302d';
const SARAH_ID = '1364ed31-51fa-41a4-8831-491b2ee3ef77';
const NORA_ID = 'd1055f89-7175-4a51-8f03-a3332d1764ff';

const FB_SQUAD_ID = '5cf7afbf-cee7-45cd-8fa1-9ff2989d8e28';
const CL_SQUAD_ID = '3b29fd00-f58a-4282-9cb3-c26c393a7858';
const BR_SQUAD_ID = 'ab53f568-82bf-439f-8fda-d04070864632';

const JENNIFER_NAME = 'Jennifer — Builders Risk v2.3';
const SARAH_NAME = 'Sarah — GL Quote Agent v1.1';
const NORA_NAME = 'Nora — Commercial Auto v1.0';

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

// Grace's BR destination is the default path on the BR line, so its description differs slightly
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

const squads = [
  {
    id: FB_SQUAD_ID,
    name: 'Farmer Brown — Sales EN Squad',
    receptionistId: EMMA_ID,
    destinations: [brDestination, glDestination, caDestination]
  },
  {
    id: CL_SQUAD_ID,
    name: 'Contractors Liability — Sales EN Squad',
    receptionistId: OLIVIA_ID,
    destinations: [brDestination, glDestination, caDestination]
  },
  {
    id: BR_SQUAD_ID,
    name: 'Builders Risk — Sales EN Squad',
    receptionistId: GRACE_ID,
    destinations: [brDestinationForGrace, glDestinationForGrace, caDestinationForGrace]
  }
];

async function updateSquad(squad) {
  const body = {
    name: squad.name,
    members: [
      {
        assistantId: squad.receptionistId,
        assistantDestinations: squad.destinations
      },
      { assistantId: JENNIFER_ID },
      { assistantId: SARAH_ID },
      { assistantId: NORA_ID }
    ]
  };

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
    console.log(`  ${squad.name} updated — ${data.members.length} members`);
  } else {
    console.error(`  Error updating ${squad.name}:`, JSON.stringify(data, null, 2));
  }
}

async function main() {
  console.log('Adding Nora to all 3 sales squads...\n');
  for (const squad of squads) {
    await updateSquad(squad);
  }
  console.log('\nDone.');
}

main();
