const VAPI_KEY = process.env.VAPI_KEY;
if (!VAPI_KEY) { console.error('VAPI_KEY env var is not set. Copy .env.example to .env and export it.'); process.exit(1); }

// CL Service Squad — 2 members: Olivia Service + CL Live Agent Proxy
// Production squad for contractorsliability.com English Service line.

const OLIVIA_SERVICE_ID = 'e4597689-cf8c-4801-96af-302bdbc0eb2a';
const CL_PROXY_ID = 'f06c2ad0-1a21-491d-916d-cbbf09e1118e';

const CL_PROXY_NAME = 'CL Live Agent Handoff v1.0';

async function createSquad() {
  const res = await fetch('https://api.vapi.ai/squad', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VAPI_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Contractors Liability — Service EN Squad',
      members: [
        {
          assistantId: OLIVIA_SERVICE_ID,
          assistantDestinations: [
            {
              type: 'assistant',
              assistantName: CL_PROXY_NAME,
              message: "Let me connect you with a licensed agent right away — one moment please.",
              description: "Transfer whenever Olivia needs to hand off to a human: caller has a Payment question, a Claim, is a Sales lead on the Service line, asks for a person, is confused after 2 re-asks, or otherwise can't be served by the COI flow. This is Olivia Service's only squad destination — the spoken opener varies per reason (see system prompt HAND-OFF SCRIPTS), but the destination is always this one."
            }
          ]
        },
        { assistantId: CL_PROXY_ID }
      ]
    })
  });

  const data = await res.json();
  if (data.id) {
    console.log('CL Service Squad created successfully!');
    console.log('   Squad ID:', data.id);
    console.log('   Name:', data.name);
    console.log('   Members:', data.members.length);
    console.log('\nAttach the contractorsliability.com EN Service phone number to this Squad ID in the VAPI dashboard.');
  } else {
    console.error('Error creating squad:', JSON.stringify(data, null, 2));
  }
}

createSquad();
