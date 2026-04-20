const VAPI_KEY = process.env.VAPI_KEY;
if (!VAPI_KEY) { console.error('VAPI_KEY env var is not set. Copy .env.example to .env and export it.'); process.exit(1); }

const ASSISTANT_ID = '9f4ae2af-1286-41e6-894c-c09fd3d7d6c3'; // Grace — BR Receptionist EN Service

async function updateAssistant() {
  const systemPrompt = require('fs')
    .readFileSync('./agents/receptionist-buildersrisk-service/system-prompt.md', 'utf8');

  const firstMessage = require('fs')
    .readFileSync('./agents/receptionist-buildersrisk-service/first-message.md', 'utf8');

  const res = await fetch(`https://api.vapi.ai/assistant/${ASSISTANT_ID}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${VAPI_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Grace — BR Receptionist EN Service v1.1',
      firstMessage: firstMessage.trim(),
      model: {
        provider: 'openai',
        model: 'gpt-4o',
        systemPrompt: systemPrompt,
        toolIds: []
      }
    })
  });

  const data = await res.json();
  if (data.id) {
    console.log('Grace Service (BR) updated to v1.1');
    console.log('   Name:', data.name);
  } else {
    console.error('Error updating assistant:', JSON.stringify(data, null, 2));
  }
}

updateAssistant();
