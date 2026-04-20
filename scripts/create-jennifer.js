const VAPI_KEY = '7ce0a320-9cbf-4d1c-9c5a-d00dfcace63c';

// Global tool IDs (shared with Sarah)
const TOOL_IDS = {
  submit_quote: 'da21631c-4ba2-4b41-9c06-cb7ffc1c8428',
  check_availability: 'dd2504ab-c665-493f-915d-345b0696017f',
  book_appointment: '642280ea-5ea0-4d1e-a7fe-35439016de10'
};

async function createAssistant() {
  const systemPrompt = require('fs')
    .readFileSync('./agents/jennifer-builders-risk/system-prompt.md', 'utf8');

  const firstMessage = require('fs')
    .readFileSync('./agents/jennifer-builders-risk/first-message.md', 'utf8');

  const res = await fetch('https://api.vapi.ai/assistant', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VAPI_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Builders Risk Net — Jennifer Quote Agent',
      firstMessage: firstMessage.trim(),
      model: {
        provider: 'openai',
        model: 'gpt-4o',
        systemPrompt: systemPrompt,
        toolIds: [
          TOOL_IDS.submit_quote,
          TOOL_IDS.check_availability,
          TOOL_IDS.book_appointment
        ]
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
  if (data.id) {
    console.log('Jennifer assistant created successfully!');
    console.log('   Assistant ID:', data.id);
    console.log('   Name:', data.name);
  } else {
    console.error('Error creating assistant:', JSON.stringify(data, null, 2));
  }
}

createAssistant();
