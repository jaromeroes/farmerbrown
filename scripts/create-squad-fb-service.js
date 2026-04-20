const VAPI_KEY = process.env.VAPI_KEY;
if (!VAPI_KEY) { console.error('VAPI_KEY env var is not set. Copy .env.example to .env and export it.'); process.exit(1); }

// FB Service Squad — 2 members: Emma Service + FB Live Agent Proxy
// Production squad for farmerbrown.com English Service line.

const EMMA_SERVICE_ID = 'a1720268-a855-410e-bb7f-687910995dba';
const FB_PROXY_ID = 'fb1e7022-e4ee-42d1-b1db-0977a4e05aad';

const FB_PROXY_NAME = 'FB Live Agent Handoff v1.0';

async function createSquad() {
  const res = await fetch('https://api.vapi.ai/squad', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VAPI_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Farmer Brown — Service EN Squad',
      members: [
        {
          assistantId: EMMA_SERVICE_ID,
          assistantDestinations: [
            {
              type: 'assistant',
              assistantName: FB_PROXY_NAME,
              message: "Let me connect you with a licensed agent right away — one moment please.",
              description: "Transfer whenever Emma needs to hand off to a human: caller has a Payment question, a Claim, is a Sales lead on the Service line, asks for a person, is confused after 2 re-asks, or otherwise can't be served by the COI flow. This is Emma Service's only squad destination — the spoken opener varies per reason (see system prompt HAND-OFF SCRIPTS), but the destination is always this one."
            }
          ]
        },
        { assistantId: FB_PROXY_ID }
      ]
    })
  });

  const data = await res.json();
  if (data.id) {
    console.log('FB Service Squad created successfully!');
    console.log('   Squad ID:', data.id);
    console.log('   Name:', data.name);
    console.log('   Members:', data.members.length);
    console.log('\nAttach the farmerbrown.com EN Service phone number to this Squad ID in the VAPI dashboard.');
  } else {
    console.error('Error creating squad:', JSON.stringify(data, null, 2));
  }
}

createSquad();
