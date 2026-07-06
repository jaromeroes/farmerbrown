// Update Wendy (Workers' Comp specialist) — assistant + ALL referencing squads
// in one transaction.
//
// Why this script exists:
//   Wendy is referenced as a destination by FIVE squads (BR Unified, Test
//   Squad, BR Sales EN, CL Sales EN, FB Sales EN). Renaming the assistant
//   without co-PATCHing every squad's `assistantDestinations[].assistantName`
//   results in `endedReason: call.start.error-get-assistant` on the very next
//   call to that squad — same failure mode that bricked the BR line for 36h
//   on 2026-05-03 (see scripts/update-jennifer.js header).
//
//   This script generalizes the Jennifer pattern to N squads: it auto-discovers
//   every squad in the org that references Wendy by name and co-PATCHes them
//   all. New squads added in the future are picked up automatically — no
//   hardcoded squad list to maintain.
//
// What this script does:
//   1. Reads current version from agents/wendy-workers-comp/system-prompt.md.
//   2. PATCHes Wendy's assistant: name + model + voice + transcriber +
//      messagePlan + endCallMessage + recording flags.
//   3. Lists all squads, finds every member.assistantDestinations[] entry whose
//      assistantName starts with "Wendy", and co-PATCHes each squad with the
//      new name. Idempotent: destinations already at target name are skipped.
//   4. Verifies all squads land on the target name.
//
// Race window: between step 2 and step 3 the squads still point at the OLD
// name. Calls to those squads during that window (~1 sec per squad) will hit
// fallbackDestination. RE-RUN if interrupted — the script reconciles to target.

const fs = require('fs');

const VAPI_KEY = process.env.VAPI_KEY;
if (!VAPI_KEY) {
  console.error('VAPI_KEY env var is not set. Copy .env.example to .env and `export $(grep -v ^# .env | xargs)`.');
  process.exit(1);
}

const WENDY_ID = 'bc789a3e-9e2b-4c60-9778-9e33d0cd826d';
const SYSTEM_PROMPT_PATH = './agents/wendy-workers-comp/system-prompt.md';
const FIRST_MESSAGE_PATH = './agents/wendy-workers-comp/first-message.md';

// Tools Wendy MUST have:
//   - check_availability         → scheduling lookup (Calendly round-robin)
//   - book_appointment           → confirm scheduling (round-robin)
//   - transfer_to_live_agent_…   → escape hatch (calendar fail / frustration / Spanish fallback)
//
// No submit_wc_form yet — backend pending. When the tool ships, add it here
// and add the matching toolId to this list.
const REQUIRED_TOOL_IDS = {
  check_availability:                 'dd2504ab-c665-493f-915d-345b0696017f',
  book_appointment:                   '642280ea-5ea0-4d1e-a7fe-35439016de10',
  transfer_to_live_agent_farmer_brown: '75d7c8f3-646e-4b44-9629-2baa2a2d81dd',
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
  const targetName = `Wendy — Workers' Comp ${version}`;
  const firstMessage = fs.readFileSync(FIRST_MESSAGE_PATH, 'utf8').trim();
  const requiredTools = Object.values(REQUIRED_TOOL_IDS);

  console.log(`→ Target name: "${targetName}"`);
  console.log(`→ Required toolIds: ${requiredTools.length}`);

  // ─── 1. Inspect current assistant state ────────────────────────────────────
  const before = await vapi('GET', `/assistant/${WENDY_ID}`);
  const beforeName = before.name;
  const beforeTools = before.model?.toolIds || [];
  console.log(`\n[before] assistant: name="${beforeName}", toolIds=[${beforeTools.length}], idleTimeout=${before.messagePlan?.idleTimeoutSeconds}`);

  // ─── 2. PATCH assistant ────────────────────────────────────────────────────
  await vapi('PATCH', `/assistant/${WENDY_ID}`, {
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
        'Workers Compensation', "Workers' Compensation",
        'payroll', 'sub-contractor', 'subcontractor', '1099', 'FEIN',
        'sole proprietor', 'LLC', 'corporation', 'partnership',
        'landscaping', 'plumbing', 'roofing', 'electrical',
        'general liability', 'commercial auto', 'umbrella',
        'pollution liability', 'professional liability',
        'additional insured', 'certificate of insurance',
        'Farmer Brown', 'Wendy',
      ],
    },
    messagePlan: {
      idleMessages: ['Are you still there? Would you like me to connect you with a live agent?'],
      idleMessageMaxSpokenCount: 2,
      idleTimeoutSeconds: 20,
    },
    silenceTimeoutSeconds: 30,
    endCallFunctionEnabled: true,
    endCallMessage: 'Thank you for calling Farmer Brown Insurance. Have a wonderful day!',
    backgroundSound: 'off',
    recordingEnabled: true,
  });

  // Verify assistant
  const afterAssistant = await vapi('GET', `/assistant/${WENDY_ID}`);
  if (afterAssistant.name !== targetName) {
    throw new Error(`Assistant name mismatch after PATCH: got "${afterAssistant.name}", expected "${targetName}"`);
  }
  const afterTools = afterAssistant.model?.toolIds || [];
  const toolDiff = diffArrays(requiredTools, afterTools);
  if (toolDiff.missing.length) {
    throw new Error(`Assistant toolIds missing after PATCH: ${toolDiff.missing.join(', ')}`);
  }
  const afterIdle = afterAssistant.messagePlan?.idleTimeoutSeconds;
  if (afterIdle !== 20) {
    throw new Error(`messagePlan.idleTimeoutSeconds did not stick: got ${afterIdle}, expected 20`);
  }
  console.log(`\n[step 1/2] ✓ Assistant patched: name="${afterAssistant.name}", toolIds=[${afterTools.length}], idleTimeout=${afterIdle}`);

  // ─── 3. Discover and PATCH all squads referencing Wendy ────────────────────
  const allSquads = await vapi('GET', `/squad`);

  // Match by name prefix "Wendy" — assistantDestinations entries link by name only.
  // We co-PATCH any destination whose assistantName starts with "Wendy" so that
  // (a) v1.0 → v2.0 idempotently updates, and (b) re-runs that already match
  // the target are no-ops.
  const affectedSquads = [];
  for (const squad of allSquads) {
    const newMembers = squad.members.map(m => {
      if (!Array.isArray(m.assistantDestinations) || m.assistantDestinations.length === 0) return m;
      let memberChanged = false;
      const newDests = m.assistantDestinations.map(d => {
        const an = d.assistantName || '';
        if (an.startsWith('Wendy') && an !== targetName) {
          memberChanged = true;
          return { ...d, assistantName: targetName };
        }
        return d;
      });
      return memberChanged ? { ...m, assistantDestinations: newDests } : m;
    });

    // Did anything change in this squad?
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
      // Verify
      const verified = await vapi('GET', `/squad/${sq.id}`);
      const stillStale = verified.members.some(m =>
        (m.assistantDestinations || []).some(d => (d.assistantName || '').startsWith('Wendy') && d.assistantName !== targetName)
      );
      if (stillStale) throw new Error(`Squad ${sq.id} (${sq.name}) did not converge to ${targetName}`);
      console.log(`   ✓ ${sq.name} (${sq.id})`);
    }
  }

  console.log(`\n✓ Done.`);
  console.log(`   Assistant ${WENDY_ID} = ${targetName}`);
  console.log(`   Squads updated: ${affectedSquads.length}`);
}

main().catch(err => {
  console.error(`\n✗ FAILED: ${err.message}`);
  console.error(`\nIf the assistant was patched but some squads were not, RE-RUN this script.`);
  console.error(`It is idempotent and reconciles all referencing squads to the new name.`);
  process.exit(1);
});
