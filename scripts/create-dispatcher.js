const VAPI_KEY = '7ce0a320-9cbf-4d1c-9c5a-d00dfcace63c';

async function createAssistant() {
  const systemPrompt = require('fs')
    .readFileSync('./agents/test-dispatcher/system-prompt.md', 'utf8');

  const firstMessage = require('fs')
    .readFileSync('./agents/test-dispatcher/first-message.md', 'utf8');

  const res = await fetch('https://api.vapi.ai/assistant', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VAPI_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Test Dispatcher v1.0',
      firstMessage: firstMessage.trim(),
      model: {
        provider: 'openai',
        model: 'gpt-4o',
        systemPrompt: systemPrompt,
        toolIds: []
      },
      voice: {
        provider: '11labs',
        voiceId: 'Ne7VRnu9eE7lobTDr8Pw'
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
    console.log('Test Dispatcher created successfully!');
    console.log('   Assistant ID:', data.id);
    console.log('   Name:', data.name);
  } else {
    console.error('Error creating assistant:', JSON.stringify(data, null, 2));
  }
}

createAssistant();
