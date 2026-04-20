const VAPI_KEY = process.env.VAPI_KEY;
if (!VAPI_KEY) { console.error('VAPI_KEY env var is not set. Copy .env.example to .env and export it.'); process.exit(1); }
const ASSISTANT_ID = 'b4957315-f53f-4296-9ca6-58748f4a4041'; // Rachel

const TOOL_IDS = {
  check_availability_angie:               '253df17f-2b43-4880-ad51-d5a3f2a4e655',
  book_appointment_angie:                 '35ff8b09-0a1f-4694-adb7-208f2a893434',
  transfer_to_live_agent_farmer_brown:    '75d7c8f3-646e-4b44-9629-2baa2a2d81dd'
};

async function updateAssistant() {
  const systemPrompt = require('fs')
    .readFileSync('./agents/rachel-home-auto/system-prompt.md', 'utf8');

  const firstMessage = require('fs')
    .readFileSync('./agents/rachel-home-auto/first-message.md', 'utf8');

  const toolIds = [
    TOOL_IDS.check_availability_angie,
    TOOL_IDS.book_appointment_angie,
    TOOL_IDS.transfer_to_live_agent_farmer_brown
  ];

  const res = await fetch(`https://api.vapi.ai/assistant/${ASSISTANT_ID}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${VAPI_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Rachel — FB Home & Auto Intake v2.3',
      firstMessage: firstMessage.trim(),
      model: {
        provider: 'openai',
        model: 'gpt-4o',
        systemPrompt: systemPrompt,
        toolIds: toolIds
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
          'Angie',
          'Rachel',
          'Home and Auto',
          'Farmer Brown',
          'Eastern',
          'Central',
          'Mountain',
          'Pacific'
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
    console.log('Rachel updated successfully!');
    console.log('   Assistant ID:', data.id);
    console.log('   Name:', data.name);
  } else {
    console.error('Error updating assistant:', JSON.stringify(data, null, 2));
  }
}

updateAssistant();
