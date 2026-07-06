const VAPI_KEY = process.env.VAPI_KEY;
if (!VAPI_KEY) { console.error('VAPI_KEY env var is not set.'); process.exit(1); }

const DISPATCHER_ID = '28310335-f689-407d-8f71-f58e0a783a7f';
const REBECCA_ID    = 'd3c18ea7-5b75-4196-8685-0253e27e6165';
const BRYAN_ID      = '2c9c12f5-5e0a-4f7a-b23d-11d2cf44bc43';

// Destinations reference assistants by NAME (not ID) — see
// feedback_squad_name_resolution.md. Keep these in sync with the actual
// assistant names if any of them are renamed.
const REBECCA_NAME = 'Rebecca — GL Binding Info v0.1';
const BRYAN_NAME   = 'Bryan — Bonds v0.1';

const dispatcherDestinations = [
  {
    type: 'assistant',
    assistantName: REBECCA_NAME,
    message: '',
    description: "Caller said Rebecca / binding / GL / general liability / the binding agent. Transfer to Rebecca for the post-quote GL binding info test flow."
  },
  {
    type: 'assistant',
    assistantName: BRYAN_NAME,
    message: '',
    description: "Caller said Bryan / bonds / surety / bond / the bonds agent. Transfer to Bryan for the surety bonds intake test flow."
  }
];

async function createSquad() {
  const body = {
    name: 'Test Squad — Rebecca / Bryan v1.0',
    members: [
      {
        assistantId: DISPATCHER_ID,
        assistantDestinations: dispatcherDestinations
      },
      { assistantId: REBECCA_ID },
      { assistantId: BRYAN_ID }
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
    console.log('Test Squad (Rebecca/Bryan) created successfully!');
    console.log('   Squad ID:', data.id);
    console.log('   Name:', data.name);
    console.log('   Members:', data.members.length);
    console.log('\n>>> Save this ID — it goes into the phone number repoint step:');
    console.log(`const REBECCA_BRYAN_TEST_SQUAD_ID = '${data.id}';`);
  } else {
    console.error('Error creating squad:', JSON.stringify(data, null, 2));
    process.exit(1);
  }
}

createSquad();
