// Update Jennifer (Builders Risk specialist) — assistant + squad in one transaction.
//
// Why this script exists:
//   On 2026-05-03 a manual rename of Jennifer (v2.3 → v2.7) was deployed without
//   updating the squad's assistantDestinations string, which references Jennifer
//   by name. VAPI validates destination names against live squad members at call
//   start; the mismatch caused the squad to fail to load and 36h of BR calls fell
//   through to the +18775131573 fallback — silently, because the fallback is itself
//   a real human-staffed line.
//
//   Same deploy also stripped Jennifer's toolIds (submit_quote, check_availability,
//   book_appointment, transfer_to_live_agent_builders_risk). The line answered for
//   another ~48h with no data persistence and a dead scheduling branch before this
//   was caught. See docs/where-we-left-off.md (2026-05-05).
//
// What this script does:
//   1. Reads the current version from agents/jennifer-builders-risk/system-prompt.md
//      (parses "**Current version:** vX.Y") and derives the target assistant name.
//   2. PATCHes Jennifer's assistant: model.systemPrompt + model.toolIds + name.
//   3. PATCHes the BR Unified squad's dispatcher destination so its assistantName
//      matches the new name.
//   4. Re-fetches both and verifies tools are present and names match.
//   5. Runs scripts/sync-all-squad-names.js as a final step — Jennifer is also
//      referenced by name in FB Sales, CL Sales, BR Sales (legacy), and Test Squad
//      Sales. Step 3 alone leaves those 4 squads stale (the cause of a 10-day silent
//      outage on FB/CL Sales discovered 2026-05-13). The universal sync handles all
//      remaining squads.
//   6. Idempotent: re-running with everything in sync is a no-op.

const fs = require('fs');
const { execFileSync } = require('child_process');
const path = require('path');

const VAPI_KEY = process.env.VAPI_KEY;
if (!VAPI_KEY) {
  console.error('VAPI_KEY env var is not set. Copy .env.example to .env and `export $(grep -v ^# .env | xargs)`.');
  process.exit(1);
}

const JENNIFER_ID = '273d2d5a-27e0-40aa-b817-76a51d1c302d';
const SQUAD_ID = 'a3269fa7-6229-4bed-817a-c4684878a600';
const SYSTEM_PROMPT_PATH = './agents/jennifer-builders-risk/system-prompt.md';

// Tools Jennifer MUST have. Stripping any of these silently breaks the line:
//   - submit_quote          → no quote data persists; transcript is the only record
//   - check_availability    → "let me check availability" → silence → idle timeout kills the call
//   - book_appointment      → can't close the scheduling loop
//   - transfer_to_live_…    → no escape hatch from inside the BR flow
const REQUIRED_TOOL_IDS = {
  submit_quote:                       'da21631c-4ba2-4b41-9c06-cb7ffc1c8428',
  check_availability:                 'dd2504ab-c665-493f-915d-345b0696017f', // round-robin
  book_appointment:                   '642280ea-5ea0-4d1e-a7fe-35439016de10', // round-robin
  transfer_to_live_agent_builders_risk: '7eb304a7-ee98-4076-be2f-2d1c5fd6645e',
};

function readSystemPromptAndVersion() {
  const text = fs.readFileSync(SYSTEM_PROMPT_PATH, 'utf8');
  const m = text.match(/\*\*Current version:\*\*\s+(v\d+\.\d+)/);
  if (!m) {
    throw new Error(
      `Could not parse "**Current version:** vX.Y" from ${SYSTEM_PROMPT_PATH}. ` +
      `The script derives the assistant name from this header — fix the header or update the regex.`
    );
  }
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
  if (!res.ok) {
    throw new Error(`VAPI ${method} ${path} failed (${res.status}): ${JSON.stringify(data).slice(0, 500)}`);
  }
  return data;
}

function diffArrays(want, got) {
  const missing = want.filter(x => !got.includes(x));
  const extra = got.filter(x => !want.includes(x));
  return { missing, extra };
}

async function main() {
  const { systemPrompt, version } = readSystemPromptAndVersion();
  const targetName = `Jennifer — Builders Risk ${version}`;
  const requiredTools = Object.values(REQUIRED_TOOL_IDS);

  console.log(`→ Target name: "${targetName}"`);
  console.log(`→ Required toolIds: ${requiredTools.length} tools`);

  // ─── 1. Inspect current state ──────────────────────────────────────────────
  const before = await vapi('GET', `/assistant/${JENNIFER_ID}`);
  const beforeName = before.name;
  const beforeTools = before.model?.toolIds || [];
  console.log(`\n[before] Assistant name: "${beforeName}"`);
  console.log(`[before] Assistant toolIds: ${beforeTools.length === 0 ? 'NONE (degraded)' : `[${beforeTools.length}]`}`);

  // ─── 2. PATCH assistant ────────────────────────────────────────────────────
  // Preserve the legacy `model.systemPrompt` field — VAPI accepts it for this
  // assistant. Don't switch to `model.messages[]` here without verifying VAPI
  // serves both shapes for the same assistant; mid-flight schema changes have
  // bitten this account before.
  //
  // v2.11 — also PATCHes messagePlan so idleTimeoutSeconds doesn't drift back
  // to the engine default. Symmetric to Grace v1.13 (idleTimeout 7 → 20).
  await vapi('PATCH', `/assistant/${JENNIFER_ID}`, {
    name: targetName,
    model: {
      provider: 'openai',
      model: 'gpt-4o',
      systemPrompt: systemPrompt,
      toolIds: requiredTools,
    },
    messagePlan: {
      idleMessages: [
        'Are you still there? Would you like me to connect you with a live agent?'
      ],
      idleMessageMaxSpokenCount: 2,
      idleTimeoutSeconds: 20,
    },
    silenceTimeoutSeconds: 30,
  });

  // Verify assistant
  const afterAssistant = await vapi('GET', `/assistant/${JENNIFER_ID}`);
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

  // ─── 3. PATCH squad destination ────────────────────────────────────────────
  // The squad references Jennifer by `assistantName` string. After renaming the
  // assistant we MUST update this string in the same session, otherwise calls
  // fail to load the squad and fall through to the phone number's fallback.
  const squad = await vapi('GET', `/squad/${SQUAD_ID}`);

  // Find the dispatcher (only member with destinations) — robust to member reorders.
  const dispatcherIdx = squad.members.findIndex(
    m => Array.isArray(m.assistantDestinations) && m.assistantDestinations.length > 0
  );
  if (dispatcherIdx === -1) {
    throw new Error(`No member with assistantDestinations in squad ${SQUAD_ID}. Squad layout unexpected.`);
  }
  const dispatcher = squad.members[dispatcherIdx];

  // Find the destination that points at Jennifer. Match on the OLD name (before rename).
  // If the OLD name is already the target name (idempotent re-run), match on target instead.
  const jenniferDestIdx = dispatcher.assistantDestinations.findIndex(
    d => d.assistantName === beforeName || d.assistantName === targetName
  );
  if (jenniferDestIdx === -1) {
    const seen = dispatcher.assistantDestinations.map(d => `"${d.assistantName}"`).join(', ');
    throw new Error(
      `Could not find Jennifer destination in squad. Looked for "${beforeName}" or "${targetName}". ` +
      `Seen destinations: ${seen}.`
    );
  }

  const currentDestName = dispatcher.assistantDestinations[jenniferDestIdx].assistantName;
  if (currentDestName === targetName) {
    console.log(`[step 2/2] ✓ Squad destination already in sync ("${targetName}") — no PATCH needed.`);
  } else {
    // Rebuild members array with the destination's assistantName updated. Spreads
    // preserve every other property on the destination + member objects.
    const newDestinations = dispatcher.assistantDestinations.map((d, i) =>
      i === jenniferDestIdx ? { ...d, assistantName: targetName } : d
    );
    const newMembers = squad.members.map((m, i) =>
      i === dispatcherIdx ? { ...m, assistantDestinations: newDestinations } : m
    );

    await vapi('PATCH', `/squad/${SQUAD_ID}`, { members: newMembers });

    // Verify squad
    const afterSquad = await vapi('GET', `/squad/${SQUAD_ID}`);
    const afterDestName = afterSquad.members[dispatcherIdx].assistantDestinations[jenniferDestIdx].assistantName;
    if (afterDestName !== targetName) {
      throw new Error(`Squad destination did not update: got "${afterDestName}", expected "${targetName}"`);
    }
    console.log(`[step 2/2] ✓ Squad patched: dest[${jenniferDestIdx}].assistantName "${currentDestName}" → "${afterDestName}"`);
  }

  console.log(`\n✓ Assistant + primary squad patched.`);
  console.log(`   Assistant ${JENNIFER_ID} = ${targetName}`);
  console.log(`   Squad     ${SQUAD_ID} dispatcher.dest[${jenniferDestIdx}] points at "${targetName}"`);
  console.log(`   Tools restored: ${requiredTools.length}`);

  // ─── 4. Reconcile every OTHER squad that references Jennifer by name ──────
  // Jennifer also lives in FB Sales, CL Sales, BR Sales (legacy), Test Squad
  // Sales. Without this step, those 4 squads keep the OLD name and fail to
  // load whenever a caller asks for Builder's Risk on those lines.
  console.log(`\nReconciling all other squads (sync-all-squad-names.js)…\n`);
  const syncScript = path.join(__dirname, 'sync-all-squad-names.js');
  execFileSync('node', [syncScript], { stdio: 'inherit', env: process.env });
}

main().catch(err => {
  console.error(`\n✗ FAILED: ${err.message}`);
  console.error(`\nIf the assistant was patched but the squad was not, RE-RUN this script.`);
  console.error(`It is idempotent and will reconcile the squad to the new name.`);
  process.exit(1);
});
