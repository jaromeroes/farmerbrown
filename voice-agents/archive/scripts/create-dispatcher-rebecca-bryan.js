const VAPI_KEY = process.env.VAPI_KEY;
if (!VAPI_KEY) { console.error('VAPI_KEY env var is not set.'); process.exit(1); }

async function createAssistant() {
  const systemPrompt = require('fs')
    .readFileSync('./agents/test-dispatcher-rebecca-bryan/system-prompt.md', 'utf8');

  const firstMessage = require('fs')
    .readFileSync('./agents/test-dispatcher-rebecca-bryan/first-message.md', 'utf8');

  const res = await fetch('https://api.vapi.ai/assistant', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VAPI_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Test Dispatcher — Rebecca/Bryan v1.0',
      firstMessage: firstMessage.trim(),
      firstMessageMode: 'assistant-speaks-first',
      model: {
        provider: 'openai',
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt }
        ]
        // intentionally no toolIds — routing is done via squad destinations
      },
      voice: {
        provider: '11labs',
        voiceId: 'WlKo88ukhZlZ4fjsOQFI' // L2 dispatcher voice
      },
      transcriber: {
        provider: 'deepgram',
        model: 'nova-3',
        language: 'en',
        keyterm: ['Rebecca', 'Bryan', 'binding', 'bonds', 'surety', 'GL', 'general liability']
      },
      silenceTimeoutSeconds: 30,
      endCallFunctionEnabled: true,
      endCallMessage: 'Goodbye.',
      backgroundSound: 'off',
      recordingEnabled: true
    })
  });

  const data = await res.json();
  if (data.id) {
    console.log('Test Dispatcher (Rebecca/Bryan) created successfully!');
    console.log('   Assistant ID:', data.id);
    console.log('   Name:', data.name);
  } else {
    console.error('Error creating assistant:', JSON.stringify(data, null, 2));
    process.exit(1);
  }
}

createAssistant();
