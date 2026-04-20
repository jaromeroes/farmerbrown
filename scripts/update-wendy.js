const VAPI_KEY = '7ce0a320-9cbf-4d1c-9c5a-d00dfcace63c';
const ASSISTANT_ID = 'bc789a3e-9e2b-4c60-9778-9e33d0cd826d'; // Wendy

const TOOL_IDS = {
  check_availability:                 'dd2504ab-c665-493f-915d-345b0696017f',
  book_appointment:                   '642280ea-5ea0-4d1e-a7fe-35439016de10',
  transfer_to_live_agent_farmer_brown: '75d7c8f3-646e-4b44-9629-2baa2a2d81dd'
};

async function updateAssistant() {
  const systemPrompt = require('fs')
    .readFileSync('./agents/wendy-workers-comp/system-prompt.md', 'utf8');

  const firstMessage = require('fs')
    .readFileSync('./agents/wendy-workers-comp/first-message.md', 'utf8');

  const res = await fetch(`https://api.vapi.ai/assistant/${ASSISTANT_ID}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${VAPI_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Wendy — Workers\' Comp v1.0',
      firstMessage: firstMessage.trim(),
      model: {
        provider: 'openai',
        model: 'gpt-4o',
        systemPrompt: systemPrompt,
        toolIds: [
          TOOL_IDS.check_availability,
          TOOL_IDS.book_appointment,
          TOOL_IDS.transfer_to_live_agent_farmer_brown
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
          'Workers Compensation',
          "Workers' Compensation",
          'payroll',
          'subcontractor',
          'landscaping',
          'plumbing',
          'roofing',
          'general liability',
          'commercial auto',
          'umbrella',
          'Farmer Brown',
          'Wendy'
        ]
      },
      endCallFunctionEnabled: true,
      endCallMessage: 'Thank you for calling Farmer Brown Insurance. Have a wonderful day!',
      backgroundSound: 'off',
      recordingEnabled: true
    })
  });

  const data = await res.json();
  if (data.id) {
    console.log('Wendy updated successfully!');
    console.log('   Assistant ID:', data.id);
    console.log('   Name:', data.name);
  } else {
    console.error('Error updating assistant:', JSON.stringify(data, null, 2));
  }
}

updateAssistant();
