const VAPI_KEY = process.env.VAPI_KEY;
if (!VAPI_KEY) { console.error('VAPI_KEY env var is not set. Copy .env.example to .env and export it.'); process.exit(1); }

// Update Test Service Squad — re-sends `members[]` with current assistant names.
// Needed after any rename of Emma/Olivia/Grace Service (e.g. v1.0 → v1.1) because
// squad destinations are matched by exact `assistantName`.

const SQUAD_ID = 'd989f711-a436-421d-a3c8-ce06b570ad40';

const DISPATCHER_ID = 'e8a656cf-3017-4b3b-9dd7-78d8e85186ad';
const EMMA_SERVICE_ID = 'a1720268-a855-410e-bb7f-687910995dba';
const OLIVIA_SERVICE_ID = 'e4597689-cf8c-4801-96af-302bdbc0eb2a';
const GRACE_SERVICE_ID = '9f4ae2af-1286-41e6-894c-c09fd3d7d6c3';
const FB_PROXY_ID = 'fb1e7022-e4ee-42d1-b1db-0977a4e05aad';
const CL_PROXY_ID = 'f06c2ad0-1a21-491d-916d-cbbf09e1118e';
const BR_PROXY_ID = '180a9367-df40-4e46-91c8-a28b13901e53';

const EMMA_SERVICE_NAME = 'Emma — FB Receptionist EN Service v1.1';
const OLIVIA_SERVICE_NAME = 'Olivia — CL Receptionist EN Service v1.1';
const GRACE_SERVICE_NAME = 'Grace — BR Receptionist EN Service v1.1';
const FB_PROXY_NAME = 'FB Live Agent Handoff v1.0';
const CL_PROXY_NAME = 'CL Live Agent Handoff v1.0';
const BR_PROXY_NAME = 'BR Live Agent Handoff v1.0';

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

const proxyDestinationFor = (proxyName, agentName) => ({
  type: 'assistant',
  assistantName: proxyName,
  message: "Let me connect you with a licensed agent right away — one moment please.",
  description: `Transfer whenever ${agentName} needs to hand off to a human: caller has a Payment question, a Claim, is a Sales lead on the Service line, has an Other service request outside the menu, asks for a person, is confused after 2 re-asks, or otherwise can't be served by the COI flow.`
});

async function updateSquad() {
  const body = {
    members: [
      { assistantId: DISPATCHER_ID, assistantDestinations: dispatcherDestinations },
      { assistantId: EMMA_SERVICE_ID, assistantDestinations: [proxyDestinationFor(FB_PROXY_NAME, 'Emma')] },
      { assistantId: OLIVIA_SERVICE_ID, assistantDestinations: [proxyDestinationFor(CL_PROXY_NAME, 'Olivia')] },
      { assistantId: GRACE_SERVICE_ID, assistantDestinations: [proxyDestinationFor(BR_PROXY_NAME, 'Grace')] },
      { assistantId: FB_PROXY_ID },
      { assistantId: CL_PROXY_ID },
      { assistantId: BR_PROXY_ID }
    ]
  };

  const res = await fetch(`https://api.vapi.ai/squad/${SQUAD_ID}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${VAPI_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  if (data.id) {
    console.log('Test Service Squad updated successfully!');
    console.log('   Members:', data.members.length);
  } else {
    console.error('Error updating squad:', JSON.stringify(data, null, 2));
  }
}

updateSquad();
