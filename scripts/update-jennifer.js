const VAPI_KEY = process.env.VAPI_KEY;
if (!VAPI_KEY) { console.error('VAPI_KEY env var is not set. Copy .env.example to .env and export it.'); process.exit(1); }
const JENNIFER_ID = '273d2d5a-27e0-40aa-b817-76a51d1c302d';

const TOOL_IDS = {
  submit_quote: 'da21631c-4ba2-4b41-9c06-cb7ffc1c8428',
  check_availability: 'dd2504ab-c665-493f-915d-345b0696017f',
  book_appointment: '642280ea-5ea0-4d1e-a7fe-35439016de10',
  transfer_to_live_agent: '75d7c8f3-646e-4b44-9629-2baa2a2d81dd',
  end_call: '12a6fdc3-170a-4bf8-bf6b-5d3db3081386'
};

async function updateAssistant() {
  const systemPrompt = require('fs')
    .readFileSync('./agents/jennifer-builders-risk/system-prompt.md', 'utf8');

  const firstMessage = require('fs')
    .readFileSync('./agents/jennifer-builders-risk/first-message.md', 'utf8');

  const res = await fetch(`https://api.vapi.ai/assistant/${JENNIFER_ID}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${VAPI_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Jennifer — Builders Risk v2.3',
      firstMessage: firstMessage.trim(),
      model: {
        provider: 'openai',
        model: 'gpt-4o',
        systemPrompt: systemPrompt,
        toolIds: [
          TOOL_IDS.submit_quote,
          TOOL_IDS.check_availability,
          TOOL_IDS.book_appointment,
          TOOL_IDS.transfer_to_live_agent,
          TOOL_IDS.end_call
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
      recordingEnabled: true,
      endCallFunctionEnabled: true,
      endCallMessage: "Thank you for calling BuildersRisk.Net. Have a wonderful day!",
      backgroundSound: 'off'
    })
  });

  const data = await res.json();
  if (data.id) {
    console.log('Jennifer assistant updated to v2.0!');
    console.log('   Assistant ID:', data.id);
    console.log('   Name:', data.name);
  } else {
    console.error('Error updating assistant:', JSON.stringify(data, null, 2));
  }
}

updateAssistant();
