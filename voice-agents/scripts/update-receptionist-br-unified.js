// Update Grace — BR Receptionist EN Unified.
//
// Reads version from agents/receptionist-buildersrisk-unified/system-prompt.md
// (parses "**Current version:** vX.Y") so the assistant name follows the prompt
// header automatically. Bump the file → run the script → name updates.
//
// Grace is a squad DISPATCHER, not a destination, so renaming her does NOT
// require updating any squad's assistantDestinations[].assistantName. Only the
// other squad members (Jennifer, Sarah, etc.) need that co-PATCH treatment —
// see scripts/update-jennifer.js for that pattern.

const fs = require('fs');

const VAPI_KEY = process.env.VAPI_KEY;
if (!VAPI_KEY) {
  console.error('VAPI_KEY env var is not set. Copy .env.example to .env and `export $(grep -v ^# .env | xargs)`.');
  process.exit(1);
}

const ASSISTANT_ID = '52bda5c2-65c0-4604-b988-f56b9f1d98f3'; // Grace BR Unified
const SYSTEM_PROMPT_PATH = './agents/receptionist-buildersrisk-unified/system-prompt.md';
const FIRST_MESSAGE_PATH = './agents/receptionist-buildersrisk-unified/first-message.md';

function readVersion() {
  const text = fs.readFileSync(SYSTEM_PROMPT_PATH, 'utf8');
  const m = text.match(/\*\*Current version:\*\*\s+(v\d+\.\d+)/);
  if (!m) throw new Error(`Could not parse version header from ${SYSTEM_PROMPT_PATH}`);
  return { systemPrompt: text, version: m[1] };
}

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
  if (!res.ok) throw new Error(`VAPI ${method} ${path} (${res.status}): ${JSON.stringify(data).slice(0, 500)}`);
  return data;
}

async function main() {
  const { systemPrompt, version } = readVersion();
  const targetName = `Grace — BR Receptionist EN Unified ${version}`;
  const firstMessage = fs.readFileSync(FIRST_MESSAGE_PATH, 'utf8').trim();

  console.log(`→ Target name: "${targetName}"`);

  const before = await vapi('GET', `/assistant/${ASSISTANT_ID}`);
  console.log(`[before] name="${before.name}", idleTimeout=${before.messagePlan?.idleTimeoutSeconds}, toolIds=${(before.model?.toolIds || []).length}`);

  await vapi('PATCH', `/assistant/${ASSISTANT_ID}`, {
    name: targetName,
    firstMessage: firstMessage,
    model: {
      provider: 'openai',
      // 2026-06-14 — gpt-4o → gpt-4.1-mini for lower latency + cost on the triage leg.
      // Grace does NO arithmetic (she only routes), so a mini model is safe here —
      // unlike Jennifer, whose premium calc stays on gpt-4o until the calc moves off
      // the LLM (Pablo backend / calc tool). 4.1-mini > 4o-mini at following Grace's
      // multi-branch routing. If routing degrades, revert this line to 'gpt-4o'.
      model: 'gpt-4.1-mini',
      systemPrompt: systemPrompt,
      // v1.7 — toolIds: [] is intentional. Keeping receptionist tool-less
      // forces the model to use squad destinations for ALL transfers, eliminating
      // the function-call bias bug. See memory/feedback_vapi_function_call_bias.md
      // and the v1.7 changelog entry above for the full story.
      toolIds: []
    },
    voice: {
      provider: '11labs',
      voiceId: 'I5gP2xcJJRbiVkFuanfS',
      stability: 0.20,
      similarityBoost: 0.75,
      style: 0.70,
      useSpeakerBoost: true
    },
    transcriber: {
      provider: 'deepgram',
      model: 'nova-3',
      language: 'en',
      keyterm: [
        'Home and Auto', 'Builders Risk', "Builder's Risk", 'General Liability',
        'Workers Compensation', "Workers' Compensation", 'Commercial Auto',
        'Certificate of insurance', 'COI', 'additional insured', 'waiver of subrogation',
        'primary and non-contributory', 'products and completed operations', 'live agent',
        'Farmer Brown', 'Builders Risk Net', 'Contractors Liability',
        'Jennifer', 'Sarah', 'Nora', 'Rachel', 'Wendy', 'Grace'
      ]
    },
    backgroundSound: 'off',
    recordingEnabled: true,
    endCallMessage: 'Thanks for calling — have a great day!',
    // v1.13 — idleTimeoutSeconds raised 7 → 20. The 7-second window was firing
    // during specialist-handoff latency, making Grace prompt "Are you still there?"
    // before the next assistant could take over. See v1.13 changelog and call
    // 019df8b1 (2026-05-05 15:11) for evidence. silenceTimeoutSeconds stays at
    // 30 so genuinely-stuck callers still get unblocked.
    messagePlan: {
      idleMessages: [
        'Are you still there? Would you like me to connect you with a live agent?'
      ],
      idleMessageMaxSpokenCount: 2,
      idleTimeoutSeconds: 20
    },
    silenceTimeoutSeconds: 30,
    // 2026-06-11 — barge-in (John: "first sentence you should be able to answer right
    // away"). The greeting is non-interruptible by VAPI default; this lets callers
    // answer the triage question mid-greeting. numWords: 2 = needs a real two-word
    // utterance to interrupt, so coughs/background noise don't cut Grace off.
    firstMessageInterruptionsEnabled: true,
    stopSpeakingPlan: { numWords: 2 }
  });

  const after = await vapi('GET', `/assistant/${ASSISTANT_ID}`);
  if (after.name !== targetName) {
    throw new Error(`name mismatch after PATCH: got "${after.name}", expected "${targetName}"`);
  }
  if (after.messagePlan?.idleTimeoutSeconds !== 20) {
    throw new Error(`idleTimeoutSeconds did not stick: got ${after.messagePlan?.idleTimeoutSeconds}, expected 20`);
  }
  if (after.firstMessageInterruptionsEnabled !== true) {
    throw new Error(`firstMessageInterruptionsEnabled did not stick: got ${after.firstMessageInterruptionsEnabled}`);
  }
  console.log(`[after]  name="${after.name}", idleTimeout=${after.messagePlan?.idleTimeoutSeconds}, toolIds=${(after.model?.toolIds || []).length}, bargeIn=on (numWords=${after.stopSpeakingPlan?.numWords})`);
  console.log(`\n✓ Done. Grace is now ${targetName}.`);
}

main().catch(err => {
  console.error(`\n✗ FAILED: ${err.message}`);
  process.exit(1);
});
