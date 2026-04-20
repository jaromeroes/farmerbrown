const VAPI_KEY = '7ce0a320-9cbf-4d1c-9c5a-d00dfcace63c';

// SIP transfer tools already deployed in VAPI (one per site).
const TRANSFER_TOOLS = {
  farmer_brown:         '75d7c8f3-646e-4b44-9629-2baa2a2d81dd', // +18889730016
  contractors_liability: '05bc12e6-ee8a-44cf-8abd-816244480509', // +18889730016
  builders_risk:         '7eb304a7-ee98-4076-be2f-2d1c5fd6645e'  // +18779600221
};

// Shared voice (TODO: distinctive voices — not critical for a proxy that speaks once)
const VOICE_ID = 'Ne7VRnu9eE7lobTDr8Pw';

const SYSTEM_PROMPT_TEMPLATE = (toolName) => `You are a silent SIP transfer proxy. The previous receptionist has ALREADY spoken the transfer line ("Connecting you to a licensed agent now, one moment") before handing you the call — you do NOT speak anything else.

Your ONLY job: call the \`${toolName}\` tool immediately upon receiving control of the call. Do not greet, do not ask questions, do not say "one moment" — just invoke the tool.

If the tool fails or returns an error, say exactly: "I'm sorry, I'm having trouble connecting that line — please call back in a moment." and end the call.`;

const FIRST_MESSAGE = ''; // Silent — prior receptionist already spoke the transfer line.

const proxies = [
  {
    name: 'FB Live Agent Handoff v1.0',
    toolId: TRANSFER_TOOLS.farmer_brown,
    toolName: 'transfer_to_live_agent_farmer_brown'
  },
  {
    name: 'CL Live Agent Handoff v1.0',
    toolId: TRANSFER_TOOLS.contractors_liability,
    toolName: 'transfer_to_live_agent_contractors_liability'
  },
  {
    name: 'BR Live Agent Handoff v1.0',
    toolId: TRANSFER_TOOLS.builders_risk,
    toolName: 'transfer_to_live_agent_builders_risk'
  }
];

async function createProxy(proxy) {
  const body = {
    name: proxy.name,
    firstMessage: FIRST_MESSAGE,
    firstMessageMode: 'assistant-speaks-first',
    model: {
      provider: 'openai',
      model: 'gpt-4o',
      systemPrompt: SYSTEM_PROMPT_TEMPLATE(proxy.toolName),
      toolIds: [proxy.toolId]
    },
    voice: {
      provider: '11labs',
      voiceId: VOICE_ID
    },
    transcriber: {
      provider: 'deepgram',
      model: 'nova-2',
      language: 'en'
    },
    backgroundSound: 'off',
    recordingEnabled: true
  };

  const res = await fetch('https://api.vapi.ai/assistant', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VAPI_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  if (data.id) {
    console.log(`${proxy.name} — created`);
    console.log(`  Assistant ID: ${data.id}`);
    return { ...proxy, id: data.id };
  }
  console.error(`${proxy.name} — FAILED:`, JSON.stringify(data, null, 2));
  process.exit(1);
}

async function main() {
  console.log('Creating 3 Live Agent Proxy assistants...\n');
  const created = [];
  for (const p of proxies) {
    created.push(await createProxy(p));
  }
  console.log('\n>>> Add these IDs to scripts/update-squads-add-rachel.js:');
  for (const c of created) {
    const varName = c.name.startsWith('FB') ? 'FB_PROXY_ID'
                  : c.name.startsWith('CL') ? 'CL_PROXY_ID'
                  : 'BR_PROXY_ID';
    console.log(`const ${varName} = '${c.id}';`);
  }
  console.log('\nDone.');
}

main();
