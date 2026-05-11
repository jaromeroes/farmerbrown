// Add the 3 new BR routing proxies to the BR Unified Squad.
//
// For each proxy:
//   (1) Append a new squad member: { assistantId: <PROXY_ID> }
//   (2) Append a new destination to Grace's assistantDestinations[] so the
//       LLM can route to it by name from the prompt.
//
// Idempotent — re-running detects any already-added entries and skips them.
//
// Run AFTER scripts/create-br-routing-proxies.js. Paste the 3 IDs into the
// constants below (or update them if you re-create any proxy).

const VAPI_KEY = process.env.VAPI_KEY;
if (!VAPI_KEY) {
  console.error('VAPI_KEY env var is not set. Copy .env.example to .env and `export $(grep -v ^# .env | xargs)`.');
  process.exit(1);
}

const BR_UNIFIED_SQUAD_ID = 'a3269fa7-6229-4bed-817a-c4684878a600';
const GRACE_ASSISTANT_ID  = '52bda5c2-65c0-4604-b988-f56b9f1d98f3';

// Proxy assistant IDs created by scripts/create-br-routing-proxies.js (2026-05-11).
const PROXIES = [
  {
    id: 'af9a33a1-0f3d-4723-b021-1a676ba859c3',
    name: 'BR Spanish Proxy v1.0',
    destination: {
      type: 'assistant',
      assistantName: 'BR Spanish Proxy v1.0',
      message: 'Connecting you to our Spanish-speaking team now.',
      description: 'Transfer here when the caller speaks Spanish or explicitly asks to be helped in Spanish (Step 0 Spanish row / Rule 14). The proxy SIP-forwards to the dedicated Spanish team line (+18332160350).'
    }
  },
  {
    id: 'db9b7095-36a4-48a2-8b22-3cc8f80edeec',
    name: 'BR Existing-Quote Proxy v1.0',
    destination: {
      type: 'assistant',
      assistantName: 'BR Existing-Quote Proxy v1.0',
      message: 'Connecting you with the team that has your quote.',
      description: "Transfer here when the caller is following up on a quote we already sent them (Step 0 row 2 / Step S1 backstop / Step T1 'existing quote' row). HOT LEAD — 5x more valuable than service calls. The proxy SIP-forwards to the dedicated existing-quote line (+17262038542). Replaces the v1.14-v1.21 'disconnect' line."
    }
  },
  {
    id: 'a080eec0-ad05-403c-bcb1-8a61185a268c',
    name: 'BR Service Proxy v1.0',
    destination: {
      type: 'assistant',
      assistantName: 'BR Service Proxy v1.0',
      message: 'Connecting you with our service team now.',
      description: 'Transfer here for any service-branch intent that needs a live human: Payment, Claim, Other-service request (cancel, renewal, change coverage, etc.), or explicit "live agent" request inside the Service branch. The proxy SIP-forwards to the dedicated service line (+17262046968). Replaces the v1.x use of the generic EN live-agent line for these intents.'
    }
  }
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
  console.log(`Squad: ${squad.name} (${squad.members?.length ?? 0} members)`);

  const members = [...(squad.members ?? [])];
  const graceIdx = members.findIndex(m => m.assistantId === GRACE_ASSISTANT_ID);
  if (graceIdx === -1) throw new Error(`Grace (${GRACE_ASSISTANT_ID}) not found among squad members`);

  const graceMember = { ...members[graceIdx] };
  const graceDests = [...(graceMember.assistantDestinations ?? [])];

  let changed = false;

  for (const proxy of PROXIES) {
    // (1) Grace destination.
    const hasDest = graceDests.some(d => d.assistantName === proxy.name);
    if (hasDest) {
      console.log(`✓ Grace already has destination "${proxy.name}" — no change.`);
    } else {
      graceDests.push(proxy.destination);
      console.log(`+ Added "${proxy.name}" to Grace's assistantDestinations.`);
      changed = true;
    }

    // (2) Squad member.
    const isMember = members.some(m => m.assistantId === proxy.id);
    if (isMember) {
      console.log(`✓ Proxy ${proxy.id} already a squad member — no change.`);
    } else {
      members.push({ assistantId: proxy.id });
      console.log(`+ Added proxy ${proxy.id} (${proxy.name}) as squad member.`);
      changed = true;
    }
  }

  if (!changed) {
    console.log('\nNothing to do. Squad already up-to-date.');
    return;
  }

  graceMember.assistantDestinations = graceDests;
  members[graceIdx] = graceMember;

  await vapi('PATCH', `/squad/${BR_UNIFIED_SQUAD_ID}`, { members });

  // Verify.
  const after = await vapi('GET', `/squad/${BR_UNIFIED_SQUAD_ID}`);
  for (const proxy of PROXIES) {
    const verifyDest = (after.members?.[graceIdx]?.assistantDestinations ?? [])
      .some(d => d.assistantName === proxy.name);
    const verifyMember = (after.members ?? []).some(m => m.assistantId === proxy.id);
    if (!verifyDest) throw new Error(`Verification failed: Grace destination "${proxy.name}" not present after PATCH`);
    if (!verifyMember) throw new Error(`Verification failed: proxy ${proxy.id} not a member after PATCH`);
  }

  console.log('\n✓ Squad updated successfully.');
  console.log(`  Members: ${after.members.length}`);
  console.log(`  Grace destinations: ${after.members[graceIdx].assistantDestinations.length}`);
}

main().catch(err => {
  console.error(`✗ FAILED: ${err.message}`);
  process.exit(1);
});
