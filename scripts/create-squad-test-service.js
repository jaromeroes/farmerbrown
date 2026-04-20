const VAPI_KEY = process.env.VAPI_KEY;
if (!VAPI_KEY) { console.error('VAPI_KEY env var is not set. Copy .env.example to .env and export it.'); process.exit(1); }

// Test Squad — Service EN (all sites)
// Single-number test entry point parallel to the Sales Test Squad.
// L1 dispatcher → L2 Service receptionist → L3 Live Agent Proxy.

// Assistant IDs
const DISPATCHER_ID = 'e8a656cf-3017-4b3b-9dd7-78d8e85186ad';
const EMMA_SERVICE_ID = 'a1720268-a855-410e-bb7f-687910995dba';
const OLIVIA_SERVICE_ID = 'e4597689-cf8c-4801-96af-302bdbc0eb2a';
const GRACE_SERVICE_ID = '9f4ae2af-1286-41e6-894c-c09fd3d7d6c3';
const FB_PROXY_ID = 'fb1e7022-e4ee-42d1-b1db-0977a4e05aad';
const CL_PROXY_ID = 'f06c2ad0-1a21-491d-916d-cbbf09e1118e';
const BR_PROXY_ID = '180a9367-df40-4e46-91c8-a28b13901e53';

// Assistant names (exact, for assistantDestinations)
const EMMA_SERVICE_NAME = 'Emma — FB Receptionist EN Service v1.0';
const OLIVIA_SERVICE_NAME = 'Olivia — CL Receptionist EN Service v1.0';
const GRACE_SERVICE_NAME = 'Grace — BR Receptionist EN Service v1.0';
const FB_PROXY_NAME = 'FB Live Agent Handoff v1.0';
const CL_PROXY_NAME = 'CL Live Agent Handoff v1.0';
const BR_PROXY_NAME = 'BR Live Agent Handoff v1.0';

// L1 dispatcher routes — to the 3 Service receptionists
const dispatcherDestinations = [
  {
    type: 'assistant',
    assistantName: EMMA_SERVICE_NAME,
    message: "Got it — connecting you to Farmer Brown service now.",
    description: "John picked Farmer Brown / FB / farmerbrown.com / the main site."
  },
  {
    type: 'assistant',
    assistantName: OLIVIA_SERVICE_NAME,
    message: "Got it — connecting you to Contractors Liability service now.",
    description: "John picked Contractors Liability / CL / contractorsliability / contractors."
  },
  {
    type: 'assistant',
    assistantName: GRACE_SERVICE_NAME,
    message: "Got it — connecting you to Builders Risk service now.",
    description: "John picked Builders Risk / BR / buildersrisk.net / construction."
  }
];

// Standard "transfer to live agent" destination used by each L2 Service receptionist.
// Each receptionist has exactly ONE squad destination — their site's live-agent proxy.
const proxyDestinationFor = (proxyName, agentName) => ({
  type: 'assistant',
  assistantName: proxyName,
  message: "Let me connect you with a licensed agent right away — one moment please.",
  description: `Transfer whenever ${agentName} needs to hand off to a human: caller has a Payment question, a Claim, is a Sales lead on the Service line, asks for a person, is confused after 2 re-asks, or otherwise can't be served by the COI flow.`
});

async function createSquad() {
  const body = {
    name: 'Test Squad — Service EN (all sites)',
    members: [
      // L1: Dispatcher
      {
        assistantId: DISPATCHER_ID,
        assistantDestinations: dispatcherDestinations
      },
      // L2: Service receptionists (each with their site's proxy as destination)
      {
        assistantId: EMMA_SERVICE_ID,
        assistantDestinations: [proxyDestinationFor(FB_PROXY_NAME, 'Emma')]
      },
      {
        assistantId: OLIVIA_SERVICE_ID,
        assistantDestinations: [proxyDestinationFor(CL_PROXY_NAME, 'Olivia')]
      },
      {
        assistantId: GRACE_SERVICE_ID,
        assistantDestinations: [proxyDestinationFor(BR_PROXY_NAME, 'Grace')]
      },
      // L3ᴴ: Live agent proxies (terminal)
      { assistantId: FB_PROXY_ID },
      { assistantId: CL_PROXY_ID },
      { assistantId: BR_PROXY_ID }
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
    console.log('Test Squad Service created successfully!');
    console.log('   Squad ID:', data.id);
    console.log('   Name:', data.name);
    console.log('   Members:', data.members.length);
    console.log('\nAttach the Service test phone number to this Squad ID in the VAPI dashboard.');
    console.log('IMPORTANT: attach to the squadId, NOT to any assistantId — assistantDestinations only fire when the call enters via the squad.');
  } else {
    console.error('Error creating squad:', JSON.stringify(data, null, 2));
  }
}

createSquad();
