const VAPI_KEY = process.env.VAPI_KEY;
if (!VAPI_KEY) { console.error('VAPI_KEY env var is not set. Copy .env.example to .env and export it.'); process.exit(1); }

// SIP transfer tools already deployed in VAPI (one per site).
const TRANSFER_TOOLS = {
  farmer_brown:         '75d7c8f3-646e-4b44-9629-2baa2a2d81dd', // +18889730016
  contractors_liability: '05bc12e6-ee8a-44cf-8abd-816244480509', // +18889730016
  builders_risk:         '7eb304a7-ee98-4076-be2f-2d1c5fd6645e'  // +18775131573
};

// Shared voice (TODO: distinctive voices — not critical for a proxy that speaks once)
const VOICE_ID = 'Ne7VRnu9eE7lobTDr8Pw';

// IMPORTANT — proxy LLM activation pattern (verified 2026-05-01).
// With firstMessage:'' + firstMessageMode:'assistant-speaks-first', VAPI plays
// no message and never gives the proxy LLM a turn — the call sits silent and
// the caller hangs up. Same outcome with firstMessage:'One moment.' +
// 'assistant-speaks-first': VAPI plays the line but then waits for user input
// instead of letting the LLM act, so the tool is never invoked.
//
// What WORKS: firstMessage:'' + firstMessageMode:'assistant-speaks-first-with-
// model-generated-message'. This forces the LLM to generate the opening turn
// itself, and gpt-4o will emit text + tool_call together when the system prompt
// asks for both in the same response.
const SYSTEM_PROMPT_TEMPLATE = (toolName) => `You are a silent SIP transfer proxy. CRITICAL BEHAVIOR: On the very first turn of the conversation, you MUST do TWO things at the same time: (1) say only the words "One moment." — nothing else, no questions, no greeting, no narration; (2) invoke the \`${toolName}\` tool with no arguments. Both actions happen in the SAME turn. Do NOT wait for user input — there is no user to wait for. The previous receptionist has already greeted the caller and announced the transfer; your only job is to execute the SIP forwarding immediately while playing the brief acknowledgement. If the tool returns an error, say "I am sorry, please call back" and end the call. Otherwise stay silent after the tool call.`;

const FIRST_MESSAGE = ''; // Empty — the LLM generates the opening line itself (model-generated mode).
const FIRST_MESSAGE_MODE = 'assistant-speaks-first-with-model-generated-message';

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
    firstMessageMode: FIRST_MESSAGE_MODE,
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
