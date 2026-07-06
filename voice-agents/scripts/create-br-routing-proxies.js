// Create the 3 new silent SIP-transfer proxies used by Grace (BR Unified) to
// route specific categories of "live agent" calls to dedicated team lines.
//
//   - BR Spanish Proxy v1.0        → transfer_to_spanish_team        → +18332160350
//   - BR Existing-Quote Proxy v1.0 → transfer_to_existing_quote_team → +17262038542
//   - BR Service Proxy v1.0        → transfer_to_service_team        → +17262046968
//
// All three follow the exact same pattern as `create-live-agent-proxies.js`:
// firstMessage:'' + firstMessageMode:'assistant-speaks-first-with-model-
// generated-message' so the LLM emits "One moment." AND invokes its tool in
// the same first turn. See create-live-agent-proxies.js header for the
// reasoning — that pattern is verified working in production (2026-05-01).
//
// NOT idempotent — re-running creates duplicates. Run once. If you need to
// re-create one, delete the existing proxy first via the VAPI dashboard
// (or by ID via the API).

const VAPI_KEY = process.env.VAPI_KEY;
if (!VAPI_KEY) {
  console.error('VAPI_KEY env var is not set. Copy .env.example to .env and `export $(grep -v ^# .env | xargs)`.');
  process.exit(1);
}

// Tool IDs created by:
//   scripts/create-tool-transfer-to-spanish-team.js
//   scripts/create-tool-transfer-to-existing-quote-team.js
//   scripts/create-tool-transfer-to-service-team.js
const TRANSFER_TOOLS = {
  spanish:        'b432ef17-e76f-409f-a755-db140c31aa28', // +18332160350
  existing_quote: 'a1644cf7-9fae-4ccb-9ae0-bff4b84554ea', // +17262038542
  service:        'a589dc49-f053-459a-9162-9d18b7d37e9e', // +17262046968
};

// Shared L3 voice (same as the other proxies — voice almost never matters for
// a proxy that speaks one short line).
const VOICE_ID = 'Ne7VRnu9eE7lobTDr8Pw';

const SYSTEM_PROMPT_TEMPLATE = (toolName) => `You are a silent SIP transfer proxy. CRITICAL BEHAVIOR: On the very first turn of the conversation, you MUST do TWO things at the same time: (1) say only the words "One moment." — nothing else, no questions, no greeting, no narration; (2) invoke the \`${toolName}\` tool with no arguments. Both actions happen in the SAME turn. Do NOT wait for user input — there is no user to wait for. The previous receptionist has already greeted the caller and announced the transfer; your only job is to execute the SIP forwarding immediately while playing the brief acknowledgement. If the tool returns an error, say "I am sorry, please call back" and end the call. Otherwise stay silent after the tool call.`;

const FIRST_MESSAGE = '';
const FIRST_MESSAGE_MODE = 'assistant-speaks-first-with-model-generated-message';

const proxies = [
  {
    name: 'BR Spanish Proxy v1.0',
    toolId: TRANSFER_TOOLS.spanish,
    toolName: 'transfer_to_spanish_team'
  },
  {
    name: 'BR Existing-Quote Proxy v1.0',
    toolId: TRANSFER_TOOLS.existing_quote,
    toolName: 'transfer_to_existing_quote_team'
  },
  {
    name: 'BR Service Proxy v1.0',
    toolId: TRANSFER_TOOLS.service,
    toolName: 'transfer_to_service_team'
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
  console.log('Creating 3 BR routing proxies (Spanish / Existing-Quote / Service)...\n');
  const created = [];
  for (const p of proxies) {
    created.push(await createProxy(p));
  }
  console.log('\n>>> Save these IDs — they go into update-squad-add-routing-proxies.js:');
  for (const c of created) {
    const varName = c.name.includes('Spanish') ? 'BR_SPANISH_PROXY_ID'
                  : c.name.includes('Existing-Quote') ? 'BR_EXISTING_QUOTE_PROXY_ID'
                  : 'BR_SERVICE_PROXY_ID';
    console.log(`const ${varName} = '${c.id}';`);
  }
  console.log('\nDone.');
}

main();
