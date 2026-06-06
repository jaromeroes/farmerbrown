const VAPI_KEY = process.env.VAPI_KEY;
if (!VAPI_KEY) { console.error('VAPI_KEY env var is not set. Copy .env.example to .env and export it.'); process.exit(1); }

// Test Dispatcher Service — L1 router for the Service test line
// Parallel to the Sales Test Dispatcher, routes to the 3 Service receptionists.

async function createAssistant() {
  const systemPrompt = require('fs')
    .readFileSync('./agents/test-dispatcher-service/system-prompt.md', 'utf8');

  const firstMessage = require('fs')
    .readFileSync('./agents/test-dispatcher-service/first-message.md', 'utf8');

  const res = await fetch('https://api.vapi.ai/assistant', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VAPI_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Test Dispatcher Service v1.0',
      firstMessage: firstMessage.trim(),
      model: {
        provider: 'openai',
        model: 'gpt-4o',
        systemPrompt: systemPrompt,
        toolIds: []
      },
      voice: {
        provider: '11labs',
        voiceId: 'WlKo88ukhZlZ4fjsOQFI'
      },
      transcriber: {
        provider: 'deepgram',
        model: 'nova-3',
        language: 'en',
        keyterm: [
          'Farmer Brown',
          'Contractors Liability',
          'Builders Risk',
          "Builder's Risk",
          'FB',
          'CL',
          'BR'
        ]
      },
      backgroundSound: 'off',
      recordingEnabled: true
    })
  });

  const data = await res.json();
  if (data.id) {
    console.log('Test Dispatcher Service created successfully!');
    console.log('   Assistant ID:', data.id);
    console.log('   Name:', data.name);
    console.log('\nNext step: add this ID to scripts/create-squad-test-service.js and run it.');
  } else {
    console.error('Error creating assistant:', JSON.stringify(data, null, 2));
  }
}

createAssistant();
