const VAPI_KEY = '7ce0a320-9cbf-4d1c-9c5a-d00dfcace63c';

const GRACE_ID = 'fa2897bb-00ee-4680-af00-0e31abeed228';
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
      name: 'Builders Risk — Sales EN Squad',
      members: [
        {
          assistantId: GRACE_ID,
          assistantDestinations: [
            {
              type: 'assistant',
              assistantName: 'Jennifer — Builders Risk v2.3',
              message: "Great — I'll connect you with Jennifer, our Builder's Risk specialist. She'll get you an instant quote in under five minutes. One moment.",
              description: "DEFAULT PATH on this line. Transfer when the caller confirms Builder's Risk at Step 2, or says 'yes' / 'builders risk' / 'construction' / 'course of construction'. Do NOT transfer here if the caller has an existing quote — those go to a live agent."
            },
            {
              type: 'assistant',
              assistantName: 'Sarah — GL Quote Agent v1.1',
              message: "Perfect — I'll connect you with Sarah, our General Liability specialist. She'll pull up real-time pricing for you. One moment.",
              description: "Transfer when the caller said 'something else' at Step 2 and then picked General Liability from the alternate menu at Step 3. Do NOT transfer here if the caller has an existing quote — those go to a live agent."
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
    console.log('BR Squad created successfully!');
    console.log('   Squad ID:', data.id);
    console.log('   Name:', data.name);
  } else {
    console.error('Error creating squad:', JSON.stringify(data, null, 2));
  }
}

createSquad();
