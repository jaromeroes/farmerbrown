const VAPI_KEY = '7ce0a320-9cbf-4d1c-9c5a-d00dfcace63c';
const ASSISTANT_ID = 'b5f88994-e045-4996-9f2c-056516e9cf01'; // Olivia

// v1.6 — toolIds intentionally empty. Live-agent escalation is now a squad
// destination (CL Live Agent Handoff v1.0), not an explicit tool. See
// agents/receptionist-contractorsliability-sales/system-prompt.md v1.6 changelog.

async function updateAssistant() {
  const systemPrompt = require('fs')
    .readFileSync('./agents/receptionist-contractorsliability-sales/system-prompt.md', 'utf8');

  const firstMessage = require('fs')
    .readFileSync('./agents/receptionist-contractorsliability-sales/first-message.md', 'utf8');

  const res = await fetch(`https://api.vapi.ai/assistant/${ASSISTANT_ID}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${VAPI_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Olivia — CL Receptionist EN Sales v1.7',
      firstMessage: firstMessage.trim(),
      model: {
        provider: 'openai',
        model: 'gpt-4o',
        systemPrompt: systemPrompt,
        toolIds: []
      },
      voice: {
        provider: '11labs',
        voiceId: 'WlKo88ukhZlZ4fjsOQFI' // L2 receptionist voice (distinct from L3 specialists)
      },
      transcriber: {
        provider: 'deepgram',
        model: 'nova-3',
        language: 'en',
        keyterm: [
          'Home and Auto',
          'Builders Risk',
          "Builder's Risk",
          'General Liability',
          'Workers Compensation',
          "Workers' Compensation",
          'Commercial Auto',
          'Farmer Brown',
          'Contractors Liability',
          'Jennifer',
          'Sarah',
          'Nora',
          'Rachel'
        ]
      },
      backgroundSound: 'off',
      recordingEnabled: true
    })
  });

  const data = await res.json();
  if (data.id) {
    console.log('Olivia updated successfully!');
    console.log('   Assistant ID:', data.id);
    console.log('   Name:', data.name);
  } else {
    console.error('Error updating assistant:', JSON.stringify(data, null, 2));
  }
}

updateAssistant();
