const VAPI_KEY = process.env.VAPI_KEY;
if (!VAPI_KEY) { console.error('VAPI_KEY env var is not set. Copy .env.example to .env and export it.'); process.exit(1); }
const ASSISTANT_ID = '1364ed31-51fa-41a4-8831-491b2ee3ef77'; // Sarah — reused for GL

// Global tool IDs (shared across agents)
const TOOL_IDS = {
  submit_gl_form: '5d723598-1699-4ec9-96aa-a9d3e645f424',
  check_availability: 'dd2504ab-c665-493f-915d-345b0696017f',
  book_appointment: '642280ea-5ea0-4d1e-a7fe-35439016de10',
  transfer_to_live_agent: '75d7c8f3-646e-4b44-9629-2baa2a2d81dd'
};

async function updateAssistant() {
  const systemPrompt = require('fs')
    .readFileSync('./agents/sarah-general-liability/system-prompt.md', 'utf8');

  const firstMessage = require('fs')
    .readFileSync('./agents/sarah-general-liability/first-message.md', 'utf8');

  const toolIds = [
    TOOL_IDS.submit_gl_form,
    TOOL_IDS.check_availability,
    TOOL_IDS.book_appointment,
    TOOL_IDS.transfer_to_live_agent
  ];

  const res = await fetch(`https://api.vapi.ai/assistant/${ASSISTANT_ID}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${VAPI_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Sarah — GL Quote Agent v1.1',
      firstMessage: firstMessage.trim(),
      model: {
        provider: 'openai',
        model: 'gpt-4o',
        systemPrompt: systemPrompt,
        toolIds: toolIds
      },
      voice: {
        provider: '11labs',
        voiceId: 'Ne7VRnu9eE7lobTDr8Pw' // Same as Jennifer for now — replace with new voice later
      },
      transcriber: {
        provider: 'deepgram',
        model: 'nova-2',
        language: 'en'
      },
      endCallFunctionEnabled: true,
      endCallMessage: 'Thank you for calling Contractors Liability. Have a wonderful day!',
      backgroundSound: 'off',
      recordingEnabled: true
    })
  });

  const data = await res.json();
  if (data.id) {
    console.log('Sarah GL assistant updated successfully!');
    console.log('   Assistant ID:', data.id);
    console.log('   Name:', data.name);
  } else {
    console.error('Error updating assistant:', JSON.stringify(data, null, 2));
  }
}

updateAssistant();
