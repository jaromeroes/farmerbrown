const VAPI_KEY = process.env.VAPI_KEY;
if (!VAPI_KEY) { console.error('VAPI_KEY env var is not set. Copy .env.example to .env and export it.'); process.exit(1); }

// BR Service Squad — 2 members: Grace Service + BR Live Agent Proxy
// Production squad for buildersrisk.net English Service line.

const GRACE_SERVICE_ID = '9f4ae2af-1286-41e6-894c-c09fd3d7d6c3';
const BR_PROXY_ID = '180a9367-df40-4e46-91c8-a28b13901e53';

const BR_PROXY_NAME = 'BR Live Agent Handoff v1.0';

async function createSquad() {
  const res = await fetch('https://api.vapi.ai/squad', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VAPI_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Builders Risk — Service EN Squad',
      members: [
        {
          assistantId: GRACE_SERVICE_ID,
          assistantDestinations: [
            {
              type: 'assistant',
              assistantName: BR_PROXY_NAME,
              message: "Let me connect you with a licensed agent right away — one moment please.",
              description: "Transfer whenever Grace needs to hand off to a human: caller has a Payment question, a Claim, is a Sales lead on the Service line, asks for a person, is confused after 2 re-asks, or otherwise can't be served by the COI flow. This is Grace Service's only squad destination — the spoken opener varies per reason (see system prompt HAND-OFF SCRIPTS), but the destination is always this one."
            }
          ]
        },
        { assistantId: BR_PROXY_ID }
      ]
    })
  });

  const data = await res.json();
  if (data.id) {
    console.log('BR Service Squad created successfully!');
    console.log('   Squad ID:', data.id);
    console.log('   Name:', data.name);
    console.log('   Members:', data.members.length);
    console.log('\nAttach the buildersrisk.net EN Service phone number to this Squad ID in the VAPI dashboard.');
  } else {
    console.error('Error creating squad:', JSON.stringify(data, null, 2));
  }
}

createSquad();
