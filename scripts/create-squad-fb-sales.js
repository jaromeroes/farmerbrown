const VAPI_KEY = '7ce0a320-9cbf-4d1c-9c5a-d00dfcace63c';

// Assistant IDs
const EMMA_ID = '71c72af4-b87a-43cb-8f0a-661c3febe8ea';
const JENNIFER_ID = '273d2d5a-27e0-40aa-b817-76a51d1c302d'; // Builders Risk
const SARAH_ID = '1364ed31-51fa-41a4-8831-491b2ee3ef77';    // General Liability (EN)

if (!EMMA_ID) {
  console.error('Emma ID is not set. Run scripts/create-receptionist-fb-sales.js first, paste the returned ID into EMMA_ID, then re-run this.');
  process.exit(1);
}

async function createSquad() {
  const res = await fetch('https://api.vapi.ai/squad', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VAPI_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Farmer Brown — Sales EN Squad',
      members: [
        {
          assistantId: EMMA_ID,
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
    console.log('Squad created successfully!');
    console.log('   Squad ID:', data.id);
    console.log('   Name:', data.name);
    console.log('\nNext step: in the VAPI dashboard, attach the farmerbrown.com EN Sales phone number to this Squad.');
  } else {
    console.error('Error creating squad:', JSON.stringify(data, null, 2));
  }
}

createSquad();
