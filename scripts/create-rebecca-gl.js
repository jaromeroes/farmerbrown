const VAPI_KEY = process.env.VAPI_KEY;
if (!VAPI_KEY) { console.error('VAPI_KEY env var is not set. Copy .env.example to .env and export it.'); process.exit(1); }

const TOOL_IDS = {
  transfer_to_live_agent_contractors_liability: '05bc12e6-ee8a-44cf-8abd-816244480509'
};

async function createAssistant() {
  const systemPrompt = require('fs')
    .readFileSync('./agents/rebecca-general-liability-binding/system-prompt.md', 'utf8');

  const firstMessage = require('fs')
    .readFileSync('./agents/rebecca-general-liability-binding/first-message.md', 'utf8');

  const res = await fetch('https://api.vapi.ai/assistant', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VAPI_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Rebecca — GL Binding Info v0.1',
      firstMessage: firstMessage.trim(),
      firstMessageMode: 'assistant-speaks-first',
      model: {
        provider: 'openai',
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt }
        ],
        toolIds: [
          TOOL_IDS.transfer_to_live_agent_contractors_liability
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
          'General Liability',
          'OCIP',
          'wrap-up',
          'tract home',
          'condominium',
          'townhouse',
          'multi-unit',
          'waterproofing',
          'subcontractor',
          'certificate of insurance',
          'bankruptcy',
          'lien',
          'judgement',
          'Farmer Brown',
          'Rebecca',
          'Sarah'
        ]
      },
      messagePlan: {
        idleMessages: ['Are you still there?'],
        idleTimeoutSeconds: 10,
        idleMessageMaxSpokenCount: 2
      },
      silenceTimeoutSeconds: 30,
      endCallFunctionEnabled: true,
      endCallMessage: 'Thanks again for choosing Farmer Brown — have a great day!',
      backgroundSound: 'off',
      recordingEnabled: true
    })
  });

  const data = await res.json();
  if (data.id) {
    console.log('Rebecca (GL Binding) created successfully!');
    console.log('   Assistant ID:', data.id);
    console.log('   Name:', data.name);
  } else {
    console.error('Error creating assistant:', JSON.stringify(data, null, 2));
    process.exit(1);
  }
}

createAssistant();
