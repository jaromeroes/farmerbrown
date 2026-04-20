const VAPI_KEY = process.env.VAPI_KEY;
if (!VAPI_KEY) { console.error('VAPI_KEY env var is not set. Copy .env.example to .env and export it.'); process.exit(1); }

// Global tool IDs (shared across agents)
const TOOL_IDS = {
  transfer_to_live_agent: '75d7c8f3-646e-4b44-9629-2baa2a2d81dd'
};

async function createAssistant() {
  const systemPrompt = require('fs')
    .readFileSync('./agents/receptionist-farmerbrown-sales/system-prompt.md', 'utf8');

  const firstMessage = require('fs')
    .readFileSync('./agents/receptionist-farmerbrown-sales/first-message.md', 'utf8');

  const res = await fetch('https://api.vapi.ai/assistant', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VAPI_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Emma — FB Receptionist EN Sales v1.0',
      firstMessage: firstMessage.trim(),
      model: {
        provider: 'openai',
        model: 'gpt-4o',
        systemPrompt: systemPrompt,
        toolIds: [
          TOOL_IDS.transfer_to_live_agent
        ]
      },
      voice: {
        provider: '11labs',
        voiceId: 'Ne7VRnu9eE7lobTDr8Pw' // TODO: create distinctive Emma voice
      },
      transcriber: {
        provider: 'deepgram',
        model: 'nova-2',
        language: 'en'
      },
      backgroundSound: 'off',
      recordingEnabled: true
    })
  });

  const data = await res.json();
  if (data.id) {
    console.log('Emma (receptionist) created successfully!');
    console.log('   Assistant ID:', data.id);
    console.log('   Name:', data.name);
    console.log('\nNext step: add this ID to scripts/create-squad-fb-sales.js and run it.');
  } else {
    console.error('Error creating assistant:', JSON.stringify(data, null, 2));
  }
}

createAssistant();
