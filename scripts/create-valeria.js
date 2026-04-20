const VAPI_KEY = '7ce0a320-9cbf-4d1c-9c5a-d00dfcace63c';
const ASSISTANT_ID = '18902649-ea31-4782-a653-601a0c07a5e3'; // Valeria — GL Spanish

// Global tool IDs (shared across agents)
const TOOL_IDS = {
  submit_gl_form: '5d723598-1699-4ec9-96aa-a9d3e645f424',
  check_availability: 'dd2504ab-c665-493f-915d-345b0696017f',
  book_appointment: '642280ea-5ea0-4d1e-a7fe-35439016de10',
  transfer_to_live_agent: '75d7c8f3-646e-4b44-9629-2baa2a2d81dd'
};

async function updateAssistant() {
  const systemPrompt = require('fs')
    .readFileSync('./agents/valeria-gl-spanish/system-prompt.md', 'utf8');

  const firstMessage = require('fs')
    .readFileSync('./agents/valeria-gl-spanish/first-message.md', 'utf8');

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
      name: 'Valeria — GL Spanish v1.2',
      firstMessage: firstMessage.trim(),
      model: {
        provider: 'openai',
        model: 'gpt-4o',
        systemPrompt: systemPrompt,
        toolIds: toolIds
      },
      voice: {
        provider: '11labs',
        voiceId: 'bYkIyYTEAnSXau3SD2ED', // Mexican Spanish female voice
        model: 'eleven_multilingual_v2',
        language: 'es'
      },
      transcriber: {
        provider: 'deepgram',
        model: 'nova-2',
        language: 'es'
      },
      endCallFunctionEnabled: true,
      endCallMessage: 'Gracias por llamar a Contractors Liability. ¡Que tenga un excelente día!',
      backgroundSound: 'off',
      recordingEnabled: true
    })
  });

  const data = await res.json();
  if (data.id) {
    console.log('Valeria assistant updated successfully!');
    console.log('   Assistant ID:', data.id);
    console.log('   Name:', data.name);
  } else {
    console.error('Error updating assistant:', JSON.stringify(data, null, 2));
  }
}

updateAssistant();
