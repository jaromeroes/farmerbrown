const VAPI_KEY = process.env.VAPI_KEY;
if (!VAPI_KEY) { console.error('VAPI_KEY env var is not set. Copy .env.example to .env and export it.'); process.exit(1); }

const OLIVIA_ID = 'b5f88994-e045-4996-9f2c-056516e9cf01';
const JENNIFER_ID = '273d2d5a-27e0-40aa-b817-76a51d1c302d';
const SARAH_ID = '1364ed31-51fa-41a4-8831-491b2ee3ef77';

async function createSquad() {
  const res = await fetch('https://api.vapi.ai/squad', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VAPI_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Contractors Liability — Sales EN Squad',
      members: [
        {
          assistantId: OLIVIA_ID,
          assistantDestinations: [
            {
              type: 'assistant',
              assistantName: 'Jennifer — Builders Risk v2.3',
              message: "Great — I'll connect you with Jennifer, our Builder's Risk specialist. She'll get you an instant quote in under five minutes. One moment.",
              description: "Transfer when the caller is looking for a NEW Builder's Risk quote (course of construction, new construction coverage, renovation coverage). Do NOT transfer here if the caller has an existing quote — those go to a live agent."
            },
            {
              type: 'assistant',
              assistantName: 'Sarah — GL Quote Agent v1.1',
              message: "Perfect — I'll connect you with Sarah, our General Liability specialist. She'll pull up real-time pricing for you. One moment.",
              description: "Transfer when the caller is looking for a NEW General Liability quote (contractor liability, GL, business liability). Do NOT transfer here if the caller has an existing quote — those go to a live agent."
            }
          ]
        },
        { assistantId: JENNIFER_ID },
        { assistantId: SARAH_ID }
      ]
    })
  });

  const data = await res.json();
  if (data.id) {
    console.log('CL Squad created successfully!');
    console.log('   Squad ID:', data.id);
    console.log('   Name:', data.name);
  } else {
    console.error('Error creating squad:', JSON.stringify(data, null, 2));
  }
}

createSquad();
