const VAPI_KEY = process.env.VAPI_KEY;
if (!VAPI_KEY) { console.error('VAPI_KEY env var is not set. Copy .env.example to .env and export it.'); process.exit(1); }

async function createAssistant() {
  const systemPrompt = require('fs')
    .readFileSync('./agents/sarah-builders-risk/system-prompt.md', 'utf8');
  
  const firstMessage = require('fs')
    .readFileSync('./agents/sarah-builders-risk/first-message.md', 'utf8');

  const res = await fetch('https://api.vapi.ai/assistant', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VAPI_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Claude Code  — Sarah Quote Agent',
      firstMessage: firstMessage.trim(),
      model: {
        provider: 'openai',
        model: 'gpt-4o',
        systemPrompt: systemPrompt
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
      recordingEnabled: true
    })
  });

  const data = await res.json();
  console.log('Assistant created:', data.id);
}

createAssistant();