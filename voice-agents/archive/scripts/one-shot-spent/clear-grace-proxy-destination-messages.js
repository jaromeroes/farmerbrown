// Clear the `message` field on Grace's destinations for the 4 routing proxies:
//   - BR Direct-Dial Proxy
//   - BR Spanish Proxy
//   - BR Existing-Quote Proxy
//   - BR Service Proxy
//
// Why: VAPI plays the destination's `message` field automatically during squad
// handoff. If Grace's LLM also emits a similar acknowledgement (e.g.
// "Connecting you now.") AND the squad message is identical or similar, the
// caller hears the same line twice back-to-back. Symptom on the Pedro test call
// (019e1711, 2026-05-11 12:44): "Connecting you now." spoken twice before the
// proxy said "Of course, connecting you to Pedro Newman. One moment."
//
// Fix: clear the destination message on these 4 proxies. Grace's spoken line
// runs once; then the proxy LLM speaks its (personalized or short) line and
// invokes the SIP-forward tool. Less acoustic clutter, no duplication.
//
// Specialist destinations (Jennifer/Sarah/Wendy/Nora/Rachel) keep their
// messages — those are 1:1 matched with Grace's hand-off lines per the v1.13
// design and the specialist re-introduces itself. Different intent.
//
// Idempotent — re-running just re-empties already-empty messages.

const VAPI_KEY = process.env.VAPI_KEY;
if (!VAPI_KEY) {
  console.error('VAPI_KEY env var is not set. Copy .env.example to .env and `export $(grep -v ^# .env | xargs)`.');
  process.exit(1);
}

const BR_UNIFIED_SQUAD_ID = 'a3269fa7-6229-4bed-817a-c4684878a600';
const GRACE_ASSISTANT_ID  = '52bda5c2-65c0-4604-b988-f56b9f1d98f3';

const TARGET_DESTINATION_NAMES = [
  'BR Direct-Dial Proxy v1.0',
  'BR Spanish Proxy v1.0',
  'BR Existing-Quote Proxy v1.0',
  'BR Service Proxy v1.0',
];

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
  const squad = await vapi('GET', `/squad/${BR_UNIFIED_SQUAD_ID}`);
  const members = [...(squad.members ?? [])];
  const graceIdx = members.findIndex(m => m.assistantId === GRACE_ASSISTANT_ID);
  if (graceIdx === -1) throw new Error('Grace not found among squad members');

  const graceMember = { ...members[graceIdx] };
  const graceDests = [...(graceMember.assistantDestinations ?? [])];

  let changed = 0;
  for (let i = 0; i < graceDests.length; i++) {
    const d = graceDests[i];
    if (TARGET_DESTINATION_NAMES.includes(d.assistantName)) {
      if (d.message !== '') {
        console.log(`  Clearing "${d.assistantName}" message: ${JSON.stringify(d.message)} -> ""`);
        graceDests[i] = { ...d, message: '' };
        changed++;
      } else {
        console.log(`  "${d.assistantName}" already has empty message`);
      }
    }
  }

  if (!changed) {
    console.log('\nNothing to do. All target destinations already empty.');
    return;
  }

  graceMember.assistantDestinations = graceDests;
  members[graceIdx] = graceMember;

  await vapi('PATCH', `/squad/${BR_UNIFIED_SQUAD_ID}`, { members });

  // Verify.
  const after = await vapi('GET', `/squad/${BR_UNIFIED_SQUAD_ID}`);
  const afterDests = after.members?.[graceIdx]?.assistantDestinations ?? [];
  for (const name of TARGET_DESTINATION_NAMES) {
    const d = afterDests.find(x => x.assistantName === name);
    if (d && d.message !== '') {
      throw new Error(`Verification failed: "${name}" message did not stick (got ${JSON.stringify(d.message)})`);
    }
  }
  console.log(`\n✓ Cleared ${changed} destination messages.`);
}

main().catch(err => {
  console.error(`✗ FAILED: ${err.message}`);
  process.exit(1);
});
