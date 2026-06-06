// Add the BR Direct-Dial Proxy to the BR Unified Squad.
//
// Two changes:
//   (1) Append a new squad member: { assistantId: BR_DIRECT_DIAL_PROXY_ID }
//   (2) Append a new destination to Grace's assistantDestinations[]:
//       { type: 'assistant', assistantName: 'BR Direct-Dial Proxy v1.0', ... }
//
// Idempotent: re-running detects the existing entries and exits cleanly without
// duplicating them. Run this AFTER scripts/create-br-direct-dial-proxy.js has
// produced an assistant ID — paste it into BR_DIRECT_DIAL_PROXY_ID below.

const VAPI_KEY = process.env.VAPI_KEY;
if (!VAPI_KEY) {
  console.error('VAPI_KEY env var is not set. Copy .env.example to .env and `export $(grep -v ^# .env | xargs)`.');
  process.exit(1);
}

const BR_UNIFIED_SQUAD_ID    = 'a3269fa7-6229-4bed-817a-c4684878a600';
const GRACE_ASSISTANT_ID     = '52bda5c2-65c0-4604-b988-f56b9f1d98f3';
const BR_DIRECT_DIAL_PROXY_ID = '32dde873-910d-489f-93fa-3527e52befc1';
const BR_DIRECT_DIAL_PROXY_NAME = 'BR Direct-Dial Proxy v1.0';

const directDialDestination = {
  type: 'assistant',
  assistantName: BR_DIRECT_DIAL_PROXY_NAME,
  message: 'Connecting you now.',
  description: "Transfer here when the caller asked for a specific person whose directory entry has Direct-dial? = yes (Step P1 / Mechanism D in Grace's prompt). The proxy reads the transcript to identify which person and dials their PBX extension. As of v1.17 this is wired only for Gustavo Alvarez (extension 148)."
};

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
  console.log(`Squad: ${squad.name} (${squad.members?.length ?? 0} members)`);

  const members = [...(squad.members ?? [])];
  const graceIdx = members.findIndex(m => m.assistantId === GRACE_ASSISTANT_ID);
  if (graceIdx === -1) throw new Error(`Grace (${GRACE_ASSISTANT_ID}) not found among squad members`);

  // (1) Add Grace destination if missing.
  const graceMember = { ...members[graceIdx] };
  const graceDests = [...(graceMember.assistantDestinations ?? [])];
  const alreadyHasDirectDial = graceDests.some(d => d.assistantName === BR_DIRECT_DIAL_PROXY_NAME);
  if (alreadyHasDirectDial) {
    console.log(`✓ Grace already has destination "${BR_DIRECT_DIAL_PROXY_NAME}" — no change.`);
  } else {
    graceDests.push(directDialDestination);
    graceMember.assistantDestinations = graceDests;
    members[graceIdx] = graceMember;
    console.log(`+ Added "${BR_DIRECT_DIAL_PROXY_NAME}" to Grace's assistantDestinations (now ${graceDests.length} dests).`);
  }

  // (2) Add proxy as a squad member if missing.
  const proxyAlreadyMember = members.some(m => m.assistantId === BR_DIRECT_DIAL_PROXY_ID);
  if (proxyAlreadyMember) {
    console.log(`✓ Proxy ${BR_DIRECT_DIAL_PROXY_ID} already a squad member — no change.`);
  } else {
    members.push({ assistantId: BR_DIRECT_DIAL_PROXY_ID });
    console.log(`+ Added proxy ${BR_DIRECT_DIAL_PROXY_ID} as squad member (now ${members.length} members).`);
  }

  if (alreadyHasDirectDial && proxyAlreadyMember) {
    console.log('\nNothing to do. Squad already up-to-date.');
    return;
  }

  await vapi('PATCH', `/squad/${BR_UNIFIED_SQUAD_ID}`, { members });

  // Verify.
  const after = await vapi('GET', `/squad/${BR_UNIFIED_SQUAD_ID}`);
  const verifyDirectDialDest = (after.members?.[graceIdx]?.assistantDestinations ?? [])
    .some(d => d.assistantName === BR_DIRECT_DIAL_PROXY_NAME);
  const verifyProxyMember = (after.members ?? []).some(m => m.assistantId === BR_DIRECT_DIAL_PROXY_ID);

  if (!verifyDirectDialDest) throw new Error('Verification failed: Grace destination not present after PATCH');
  if (!verifyProxyMember) throw new Error('Verification failed: proxy not present as member after PATCH');

  console.log('\n✓ Squad updated successfully.');
  console.log(`  Members: ${after.members.length}`);
  console.log(`  Grace destinations: ${after.members[graceIdx].assistantDestinations.length}`);
}

main().catch(err => {
  console.error(`✗ FAILED: ${err.message}`);
  process.exit(1);
});
