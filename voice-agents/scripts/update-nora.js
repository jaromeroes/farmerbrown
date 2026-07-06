// Update Nora (Commercial Auto specialist) — assistant + ALL referencing
// squads in one transaction.
//
// Follows the Wendy pattern (auto-discover every squad referencing Nora by
// name and co-PATCH it). Nora lives in BR Unified, BR Sales (legacy), CL Sales,
// FB Sales, Test Squad Sales as of 2026-05-13.
//
// Required tools (preserved from live VAPI as of 2026-05-13):
//   - transfer_to_live_agent_farmer_brown  (75d7c8f3-…) — cross-site, FB live agent line
//
// At the end runs scripts/sync-all-squad-names.js as a safety net.

const fs = require('fs');
const { execFileSync } = require('child_process');
const path = require('path');

const VAPI_KEY = process.env.VAPI_KEY;
if (!VAPI_KEY) {
  console.error('VAPI_KEY env var is not set.');
  process.exit(1);
}

const NORA_ID = 'd1055f89-7175-4a51-8f03-a3332d1764ff';
const SYSTEM_PROMPT_PATH = './agents/nora-commercial-auto/system-prompt.md';
const FIRST_MESSAGE_PATH = './agents/nora-commercial-auto/first-message.md';

const REQUIRED_TOOL_IDS = {
  transfer_to_live_agent_farmer_brown: '75d7c8f3-646e-4b44-9629-2baa2a2d81dd',
};

function readPromptAndVersion() {
  const text = fs.readFileSync(SYSTEM_PROMPT_PATH, 'utf8');
  const m = text.match(/\*\*Current version:\*\*\s+(v\d+\.\d+)/);
  if (!m) throw new Error(`Could not parse "**Current version:** vX.Y" from ${SYSTEM_PROMPT_PATH}`);
  return { systemPrompt: text, version: m[1] };
}

async function vapi(method, p, body) {
  const res = await fetch(`https://api.vapi.ai${p}`, {
    method,
    headers: { 'Authorization': `Bearer ${VAPI_KEY}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { _raw: text }; }
  if (!res.ok) throw new Error(`VAPI ${method} ${p} (${res.status}): ${JSON.stringify(data).slice(0, 500)}`);
  return data;
}

async function main() {
  const { systemPrompt, version } = readPromptAndVersion();
  const targetName = `Nora — Commercial Auto ${version}`;
  const firstMessage = fs.readFileSync(FIRST_MESSAGE_PATH, 'utf8').trim();
  const requiredTools = Object.values(REQUIRED_TOOL_IDS);

  console.log(`→ Target name: "${targetName}"`);

  const before = await vapi('GET', `/assistant/${NORA_ID}`);
  console.log(`\n[before] name="${before.name}", toolIds=[${(before.model?.toolIds || []).length}]`);

  await vapi('PATCH', `/assistant/${NORA_ID}`, {
    name: targetName,
    firstMessage,
    model: {
      provider: 'openai',
      model: 'gpt-4o',
      systemPrompt,
      toolIds: requiredTools,
    },
    voice: { provider: '11labs', voiceId: 'Ne7VRnu9eE7lobTDr8Pw' },
    messagePlan: {
      idleMessages: ['Are you still there? Would you like me to connect you with a live agent?'],
      idleMessageMaxSpokenCount: 2,
      idleTimeoutSeconds: 20,
    },
    silenceTimeoutSeconds: 30,
    backgroundSound: 'off',
    recordingEnabled: true,
  });

  const afterA = await vapi('GET', `/assistant/${NORA_ID}`);
  if (afterA.name !== targetName) throw new Error(`name mismatch: got "${afterA.name}"`);
  const missingTools = requiredTools.filter(t => !(afterA.model?.toolIds || []).includes(t));
  if (missingTools.length) throw new Error(`missing toolIds after PATCH: ${missingTools.join(', ')}`);
  console.log(`[step 1/2] ✓ Assistant patched: name="${afterA.name}", toolIds=[${(afterA.model?.toolIds || []).length}]`);

  const allSquads = await vapi('GET', '/squad');
  const affected = [];
  for (const sq of allSquads) {
    let changed = false;
    const newMembers = sq.members.map(m => {
      if (!Array.isArray(m.assistantDestinations) || m.assistantDestinations.length === 0) return m;
      let mc = false;
      const newDests = m.assistantDestinations.map(d => {
        const an = d.assistantName || '';
        if (an.startsWith('Nora') && an !== targetName) { mc = true; return { ...d, assistantName: targetName }; }
        return d;
      });
      if (mc) { changed = true; return { ...m, assistantDestinations: newDests }; }
      return m;
    });
    if (changed) affected.push({ id: sq.id, name: sq.name, members: newMembers });
  }

  if (affected.length === 0) {
    console.log(`[step 2/2] ✓ All squads already in sync.`);
  } else {
    console.log(`\n[step 2/2] Patching ${affected.length} squad(s):`);
    for (const sq of affected) {
      await vapi('PATCH', `/squad/${sq.id}`, { members: sq.members });
      console.log(`   ✓ ${sq.name}`);
    }
  }

  console.log(`\nReconciling any remaining stale destination strings…`);
  execFileSync('node', [path.join(__dirname, 'sync-all-squad-names.js')], { stdio: 'inherit', env: process.env });

  console.log(`\n✓ Done. Nora is now ${targetName}.`);
}

main().catch(err => { console.error(`\n✗ FAILED: ${err.message}`); process.exit(1); });
