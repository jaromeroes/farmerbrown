const VAPI_KEY = process.env.VAPI_KEY;
if (!VAPI_KEY) { console.error('VAPI_KEY env var is not set. Copy .env.example to .env and export it.'); process.exit(1); }

const DISPATCHER_ID = '753657c6-3ed4-487c-8c39-1f65fa4f8287';
const EMMA_ID = '71c72af4-b87a-43cb-8f0a-661c3febe8ea';
const OLIVIA_ID = 'b5f88994-e045-4996-9f2c-056516e9cf01';
const GRACE_ID = 'fa2897bb-00ee-4680-af00-0e31abeed228';
const JENNIFER_ID = '273d2d5a-27e0-40aa-b817-76a51d1c302d';
const SARAH_ID = '1364ed31-51fa-41a4-8831-491b2ee3ef77';
const NORA_ID = 'd1055f89-7175-4a51-8f03-a3332d1764ff';

const EMMA_NAME = 'Emma — FB Receptionist EN Sales v1.3';
const OLIVIA_NAME = 'Olivia — CL Receptionist EN Sales v1.1';
const GRACE_NAME = 'Grace — BR Receptionist EN Sales v1.1';
const JENNIFER_NAME = 'Jennifer — Builders Risk v2.3';
const SARAH_NAME = 'Sarah — GL Quote Agent v1.1';
const NORA_NAME = 'Nora — Commercial Auto v1.0';

// Level 2 standard destinations (used by Emma and Olivia)
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

// Grace-specific destinations (two-step menu: BR default, alternate menu for others)
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

// Level 1 dispatcher destinations (routes to receptionists only, not to specialists)
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

async function createSquad() {
  const body = {
    name: 'Test Squad — Sales EN (all sites)',
    members: [
      // Level 1: Dispatcher
      {
        assistantId: DISPATCHER_ID,
        assistantDestinations: dispatcherDestinations
      },
      // Level 2: Receptionists (each with handoffs to Level 3 specialists)
      {
        assistantId: EMMA_ID,
        assistantDestinations: [brDestination, glDestination, caDestination]
      },
      {
        assistantId: OLIVIA_ID,
        assistantDestinations: [brDestination, glDestination, caDestination]
      },
      {
        assistantId: GRACE_ID,
        assistantDestinations: [brDestinationForGrace, glDestinationForGrace, caDestinationForGrace]
      },
      // Level 3: Specialists (terminal)
      { assistantId: JENNIFER_ID },
      { assistantId: SARAH_ID },
      { assistantId: NORA_ID }
    ]
  };

  const res = await fetch('https://api.vapi.ai/squad', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VAPI_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  if (data.id) {
    console.log('Test Squad created successfully!');
    console.log('   Squad ID:', data.id);
    console.log('   Name:', data.name);
    console.log('   Members:', data.members.length);
    console.log('\nAttach the test phone number to this Squad ID in the VAPI dashboard.');
  } else {
    console.error('Error creating squad:', JSON.stringify(data, null, 2));
  }
}

createSquad();
