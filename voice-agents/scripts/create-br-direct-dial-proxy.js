// Create the BR Direct-Dial Proxy assistant.
//
// Pattern: same as create-live-agent-proxies.js — a silent SIP-transfer proxy
// added as a squad member, invoked when Grace identifies a caller-requested
// person who is wired for direct dial (Direct-dial? = yes in the directory).
//
// The proxy holds the transfer_to_specific_person tool. When reached as a
// squad destination from Grace, it generates a single turn that says
// "One moment." and invokes the tool — VAPI then connects the caller to the
// PBX number with the matching extension dialed via DTMF.
//
// As of v1.22 the tool has 19 destinations (the directory shortlist).
//
// IMPORTANT — multi-destination routing fix (2026-05-11):
// Earlier versions of the system prompt told the LLM to "pick the destination
// whose message contains the full name". That was insufficient: with no
// `destination` parameter on the tool's function schema, the LLM had no way
// to actually communicate the pick — every call landed on destinations[0]
// (Gustavo). Verified in call 019e1701 where the caller asked for Pedro and
// Gustavo's phone rang. Fix: (1) the tool now declares a required `destination`
// parameter (enum of all DIDs) with the name→number mapping embedded in the
// function description; (2) this proxy's system prompt instructs the LLM to
// pass the matching number explicitly.

const VAPI_KEY = process.env.VAPI_KEY;
if (!VAPI_KEY) {
  console.error('VAPI_KEY env var is not set. Copy .env.example to .env and `export $(grep -v ^# .env | xargs)`.');
  process.exit(1);
}

const ASSISTANT_NAME = 'BR Direct-Dial Proxy v1.0';
const TRANSFER_TO_SPECIFIC_PERSON_ID = 'b7c4167b-91da-4a96-ae1f-8a3cfb572a57';
// Current proxy assistant ID (re-created 2026-05-08 after a debugging cycle):
// 32dde873-910d-489f-93fa-3527e52befc1
// Update update-squad-add-direct-dial-proxy.js to match if you re-create.
const VOICE_ID = 'Ne7VRnu9eE7lobTDr8Pw'; // Same as the live-agent proxies

const SYSTEM_PROMPT = `You are a silent SIP transfer proxy for Builders Risk Dot Net's direct-dial flow. CRITICAL BEHAVIOR: On the very first turn of the conversation, you MUST do TWO things at the same time:

(1) Say only the words "One moment." — nothing else, no greeting, no narration, no questions.

(2) Invoke the \`transfer_to_specific_person\` tool with the \`destination\` argument set to the E.164 phone number of the person the caller asked for. Read the conversation transcript above your turn — the caller's message will name the person (e.g. "I want to talk to Pedro"), and the receptionist (Grace) typically also announces the full name ("connecting you to Pedro Neumann"). Cross-reference that name against the directory embedded in the tool's description and pass the matching phone number. The \`destination\` parameter is REQUIRED — calling the tool without it (or with an empty object) routes to the wrong person.

Both actions happen in the SAME turn. Do NOT wait for user input — there is no user to wait for.

If the caller's name doesn't match any directory entry exactly, pick the closest match by first name and proceed — better to attempt the transfer than to bounce the call. If the tool returns an error, say "I am sorry, please call back" and end the call. Otherwise stay silent after the tool call.`;

const FIRST_MESSAGE = '';
const FIRST_MESSAGE_MODE = 'assistant-speaks-first-with-model-generated-message';

async function vapi(method, path, body) {
  const res = await fetch(`https://api.vapi.ai${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${VAPI_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { _raw: text }; }
  if (!res.ok) throw new Error(`VAPI ${method} ${path} (${res.status}): ${JSON.stringify(data).slice(0, 600)}`);
  return data;
}

async function main() {
  // Check for existing assistant by name (idempotent).
  const all = await vapi('GET', '/assistant');
  const existing = all.find(a => a.name === ASSISTANT_NAME);

  const body = {
    name: ASSISTANT_NAME,
    firstMessage: FIRST_MESSAGE,
    firstMessageMode: FIRST_MESSAGE_MODE,
    model: {
      provider: 'openai',
      model: 'gpt-4o',
      systemPrompt: SYSTEM_PROMPT,
      toolIds: [TRANSFER_TO_SPECIFIC_PERSON_ID]
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

  if (existing) {
    console.log(`Found existing "${ASSISTANT_NAME}" (id ${existing.id}). Updating…`);
    const updated = await vapi('PATCH', `/assistant/${existing.id}`, body);
    console.log(`✓ Updated. ID: ${updated.id}`);
    return;
  }

  console.log(`Creating "${ASSISTANT_NAME}"…`);
  const created = await vapi('POST', '/assistant', body);
  console.log(`✓ Created. ID: ${created.id}`);
  console.log(`\n>>> Save this ID — it goes into update-squad-add-direct-dial-proxy.js:`);
  console.log(`const BR_DIRECT_DIAL_PROXY_ID = '${created.id}';`);
}

main().catch(err => {
  console.error(`✗ FAILED: ${err.message}`);
  process.exit(1);
});
