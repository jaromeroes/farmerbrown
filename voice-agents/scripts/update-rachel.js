// Update Rachel (Home & Auto intake) — assistant + ALL referencing squads
// in one transaction.
//
// Why this script exists:
//   Rachel is referenced as a destination by multiple squads (BR Unified,
//   Test Squad, BR Sales EN, CL Sales EN, FB Sales EN). Renaming the assistant
//   without co-PATCHing every squad's `assistantDestinations[].assistantName`
//   results in `endedReason: call.start.error-get-assistant` on the very next
//   call to that squad — same failure mode that bricked the BR line for 36h
//   on 2026-05-03 (see scripts/update-jennifer.js header).
//
//   Pattern copied from scripts/update-wendy.js: auto-discover every squad
//   that references Rachel by name and co-PATCH them all. New squads added
//   in the future are picked up automatically.
//
// What this script does:
//   1. Reads current version from agents/rachel-home-auto/system-prompt.md.
//   2. PATCHes Rachel's assistant: name + model + voice + transcriber +
//      toolIds + endCall + recording flags.
//   3. Lists all squads, finds every member.assistantDestinations[] entry whose
//      assistantName starts with "Rachel", and co-PATCHes each squad with the
//      new name. Idempotent: destinations already at target name are skipped.
//   4. Verifies all squads land on the target name.

const fs = require('fs');

const VAPI_KEY = process.env.VAPI_KEY;
if (!VAPI_KEY) {
  console.error('VAPI_KEY env var is not set. Copy .env.example to .env and `export $(grep -v ^# .env | xargs)`.');
  process.exit(1);
}

const RACHEL_ID = 'b4957315-f53f-4296-9ca6-58748f4a4041';
const SYSTEM_PROMPT_PATH = './agents/rachel-home-auto/system-prompt.md';
const FIRST_MESSAGE_PATH = './agents/rachel-home-auto/first-message.md';

// Tools Rachel MUST have:
//   - check_availability_angie   → Calendly lookup pinned to H&A team's event_type
//   - book_appointment_angie     → confirm scheduling on the same event_type
//   - transfer_to_home_auto_team → ALL escalations (scheduling fail, confusion, fallback)
//
// IMPORTANT — VAPI does NOT allow an assistant to have more than one tool of
// type `transferCall`. Earlier v2.4 attempt included BOTH transfer_to_home_auto_team
// AND transfer_to_live_agent_farmer_brown and VAPI rejected the assistant
// with "Invalid Configuration. Assistant has more than one tool of type
// 'transferCall'", which then broke the entire BR Unified Squad with
// `call.start.error-get-assistant`. Removed the generic FB live-agent tool —
// the H&A team line is the right fallback for every Rachel-context escalation.
const REQUIRED_TOOL_IDS = {
  check_availability_angie:               '253df17f-2b43-4880-ad51-d5a3f2a4e655',
  book_appointment_angie:                 '35ff8b09-0a1f-4694-adb7-208f2a893434',
  transfer_to_home_auto_team:             '152b99c4-9461-4c3f-831f-fd02af9d3c7f',
};

function readPromptAndVersion() {
  const text = fs.readFileSync(SYSTEM_PROMPT_PATH, 'utf8');
  const m = text.match(/\*\*Current version:\*\*\s+(v\d+\.\d+)/);
  if (!m) throw new Error(`Could not parse "**Current version:** vX.Y" from ${SYSTEM_PROMPT_PATH}`);
  return { systemPrompt: text, version: m[1] };
}

async function vapi(method, path, body) {
  const res = await fetch(`https://api.vapi.ai${path}`, {
    method,
    headers: { 'Authorization': `Bearer ${VAPI_KEY}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { _raw: text }; }
  if (!res.ok) throw new Error(`VAPI ${method} ${path} (${res.status}): ${JSON.stringify(data).slice(0, 500)}`);
  return data;
}

function diffArrays(want, got) {
  const missing = want.filter(x => !got.includes(x));
  return { missing };
}

async function main() {
  const { systemPrompt, version } = readPromptAndVersion();
  const targetName = `Rachel — FB Home & Auto Intake ${version}`;
  const firstMessage = fs.readFileSync(FIRST_MESSAGE_PATH, 'utf8').trim();
  const requiredTools = Object.values(REQUIRED_TOOL_IDS);

  console.log(`→ Target name: "${targetName}"`);
  console.log(`→ Required toolIds: ${requiredTools.length}`);

  // ─── 1. Inspect current assistant state ────────────────────────────────────
  const before = await vapi('GET', `/assistant/${RACHEL_ID}`);
  const beforeName = before.name;
  const beforeTools = before.model?.toolIds || [];
  console.log(`\n[before] assistant: name="${beforeName}", toolIds=[${beforeTools.length}]`);

  // ─── 2. PATCH assistant ────────────────────────────────────────────────────
  await vapi('PATCH', `/assistant/${RACHEL_ID}`, {
    name: targetName,
    firstMessage: firstMessage,
    model: {
      provider: 'openai',
      model: 'gpt-4o',
      systemPrompt: systemPrompt,
      toolIds: requiredTools,
    },
    voice: {
      provider: '11labs',
      voiceId: 'Ne7VRnu9eE7lobTDr8Pw',
    },
    transcriber: {
      provider: 'deepgram',
      model: 'nova-3',
      language: 'en',
      keyterm: [
        'Rachel',
        'Home and Auto', 'Home & Auto', 'homeowners', 'auto insurance',
        'Farmer Brown',
        'Eastern', 'Central', 'Mountain', 'Pacific',
      ],
    },
    endCallFunctionEnabled: true,
    endCallMessage: 'Thank you for calling Farmer Brown Insurance. Have a wonderful day!',
    backgroundSound: 'off',
    recordingEnabled: true,
  });

  // Verify assistant
  const afterAssistant = await vapi('GET', `/assistant/${RACHEL_ID}`);
  if (afterAssistant.name !== targetName) {
    throw new Error(`Assistant name mismatch after PATCH: got "${afterAssistant.name}", expected "${targetName}"`);
  }
  const afterTools = afterAssistant.model?.toolIds || [];
  const toolDiff = diffArrays(requiredTools, afterTools);
  if (toolDiff.missing.length) {
    throw new Error(`Assistant toolIds missing after PATCH: ${toolDiff.missing.join(', ')}`);
  }
  console.log(`\n[step 1/2] ✓ Assistant patched: name="${afterAssistant.name}", toolIds=[${afterTools.length}]`);

  // ─── 3. Discover and PATCH all squads referencing Rachel ───────────────────
  const allSquads = await vapi('GET', `/squad`);

  // Match by name prefix "Rachel" — assistantDestinations entries link by name only.
  const affectedSquads = [];
  for (const squad of allSquads) {
    const newMembers = squad.members.map(m => {
      if (!Array.isArray(m.assistantDestinations) || m.assistantDestinations.length === 0) return m;
      let memberChanged = false;
      const newDests = m.assistantDestinations.map(d => {
        const an = d.assistantName || '';
        if (an.startsWith('Rachel') && an !== targetName) {
          memberChanged = true;
          return { ...d, assistantName: targetName };
        }
        return d;
      });
      return memberChanged ? { ...m, assistantDestinations: newDests } : m;
    });

    const before = JSON.stringify(squad.members);
    const after = JSON.stringify(newMembers);
    if (before !== after) {
      affectedSquads.push({ id: squad.id, name: squad.name, members: newMembers });
    }
  }

  if (affectedSquads.length === 0) {
    console.log(`[step 2/2] ✓ No squad destinations needed updating — already in sync.`);
  } else {
    console.log(`\n[step 2/2] Patching ${affectedSquads.length} squad(s):`);
    for (const sq of affectedSquads) {
      await vapi('PATCH', `/squad/${sq.id}`, { members: sq.members });
      const verified = await vapi('GET', `/squad/${sq.id}`);
      const stillStale = verified.members.some(m =>
        (m.assistantDestinations || []).some(d => (d.assistantName || '').startsWith('Rachel') && d.assistantName !== targetName)
      );
      if (stillStale) throw new Error(`Squad ${sq.id} (${sq.name}) did not converge to ${targetName}`);
      console.log(`   ✓ ${sq.name} (${sq.id})`);
    }
  }

  console.log(`\n✓ Done.`);
  console.log(`   Assistant ${RACHEL_ID} = ${targetName}`);
  console.log(`   Squads updated: ${affectedSquads.length}`);
}

main().catch(err => {
  console.error(`\n✗ FAILED: ${err.message}`);
  console.error(`\nIf the assistant was patched but some squads were not, RE-RUN this script.`);
  console.error(`It is idempotent and reconciles all referencing squads to the new name.`);
  process.exit(1);
});
