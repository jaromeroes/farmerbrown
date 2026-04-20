const VAPI_KEY = '7ce0a320-9cbf-4d1c-9c5a-d00dfcace63c';

const TOOL_IDS = {
  transfer_to_live_agent_farmer_brown: '75d7c8f3-646e-4b44-9629-2baa2a2d81dd'
};

async function createAssistant() {
  const systemPrompt = require('fs')
    .readFileSync('./agents/nora-commercial-auto/system-prompt.md', 'utf8');

  const firstMessage = require('fs')
    .readFileSync('./agents/nora-commercial-auto/first-message.md', 'utf8');

  const res = await fetch('https://api.vapi.ai/assistant', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VAPI_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Nora — Commercial Auto v1.0',
      firstMessage: firstMessage.trim(),
      model: {
        provider: 'openai',
        model: 'gpt-4o',
        systemPrompt: systemPrompt,
        toolIds: [
          TOOL_IDS.transfer_to_live_agent_farmer_brown
        ]
      },
      voice: {
        provider: '11labs',
        voiceId: 'Ne7VRnu9eE7lobTDr8Pw' // TODO: distinctive Nora voice
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
    console.log('Nora (commercial auto) created successfully!');
    console.log('   Assistant ID:', data.id);
    console.log('   Name:', data.name);
  } else {
    console.error('Error creating assistant:', JSON.stringify(data, null, 2));
  }
}

createAssistant();
