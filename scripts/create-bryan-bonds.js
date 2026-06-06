const VAPI_KEY = process.env.VAPI_KEY;
if (!VAPI_KEY) { console.error('VAPI_KEY env var is not set. Copy .env.example to .env and export it.'); process.exit(1); }

const TOOL_IDS = {
  transfer_to_bonds_specialist: '830bbad3-29c4-4ca9-9769-e0ad12908164'
};

async function createAssistant() {
  const systemPrompt = require('fs')
    .readFileSync('./agents/bryan-bonds/system-prompt.md', 'utf8');

  const firstMessage = require('fs')
    .readFileSync('./agents/bryan-bonds/first-message.md', 'utf8');

  const res = await fetch('https://api.vapi.ai/assistant', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VAPI_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Bryan — Bonds v0.1',
      firstMessage: firstMessage.trim(),
      firstMessageMode: 'assistant-speaks-first',
      model: {
        provider: 'openai',
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt }
        ],
        toolIds: [
          TOOL_IDS.transfer_to_bonds_specialist
        ]
      },
      voice: {
        provider: '11labs',
        voiceId: 'Ne7VRnu9eE7lobTDr8Pw'
      },
      transcriber: {
        provider: 'deepgram',
        model: 'nova-3',
        language: 'en',
        keyterm: [
          'surety bond',
          'bid bond',
          'payment and performance bond',
          'license bond',
          'permit bond',
          'OCIP',
          'wrap-up',
          'general contractor',
          'roofing contractor',
          'HVAC contractor',
          'ITIN',
          'SSN',
          'EIN',
          'lien',
          'bankruptcy',
          'Tom Hester',
          'United Surety Bonds',
          'Farmer Brown',
          'Bryan'
        ]
      },
      messagePlan: {
        idleMessages: ['Are you still there?'],
        idleTimeoutSeconds: 10,
        idleMessageMaxSpokenCount: 2
      },
      silenceTimeoutSeconds: 30,
      endCallFunctionEnabled: true,
      endCallMessage: 'Thanks again for calling Farmer Brown — have a great day!',
      backgroundSound: 'off',
      recordingEnabled: true
    })
  });

  const data = await res.json();
  if (data.id) {
    console.log('Bryan (Bonds) created successfully!');
    console.log('   Assistant ID:', data.id);
    console.log('   Name:', data.name);
  } else {
    console.error('Error creating assistant:', JSON.stringify(data, null, 2));
    process.exit(1);
  }
}

createAssistant();
