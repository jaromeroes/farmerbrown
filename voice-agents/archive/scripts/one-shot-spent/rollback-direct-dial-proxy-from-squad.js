// Emergency rollback: remove BR Direct-Dial Proxy from BR Unified Squad.
// Used 2026-05-08 when squad started failing with call.start.error-get-assistant
// after adding the proxy. If Grace answers again after this rollback, the proxy
// (or its tool) is the cause and needs adjustment before re-adding.
//
// Idempotent: re-running detects already-removed state.

const VAPI_KEY = process.env.VAPI_KEY;
if (!VAPI_KEY) {
  console.error('VAPI_KEY env var is not set.'); process.exit(1);
}

const BR_UNIFIED_SQUAD_ID    = 'a3269fa7-6229-4bed-817a-c4684878a600';
const GRACE_ASSISTANT_ID     = '52bda5c2-65c0-4604-b988-f56b9f1d98f3';
const BR_DIRECT_DIAL_PROXY_ID = 'f4d38675-97a0-4246-9e64-ff17a9d47cc9';
const BR_DIRECT_DIAL_PROXY_NAME = 'BR Direct-Dial Proxy v1.0';

async function vapi(method, path, body) {
  const res = await fetch(`https://api.vapi.ai${path}`, {
    method,
    headers: { 'Authorization': `Bearer ${VAPI_KEY}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data; try { data = text ? JSON.parse(text) : {}; } catch { data = { _raw: text }; }
  if (!res.ok) throw new Error(`VAPI ${method} ${path} (${res.status}): ${JSON.stringify(data).slice(0, 500)}`);
  return data;
}

async function main() {
  const squad = await vapi('GET', `/squad/${BR_UNIFIED_SQUAD_ID}`);
  console.log(`Before: ${squad.members.length} members`);

  const newMembers = squad.members
    .filter(m => m.assistantId !== BR_DIRECT_DIAL_PROXY_ID)
    .map(m => {
      if (m.assistantId !== GRACE_ASSISTANT_ID) return m;
      const dests = (m.assistantDestinations || []).filter(d => d.assistantName !== BR_DIRECT_DIAL_PROXY_NAME);
      return { ...m, assistantDestinations: dests };
    });

  if (JSON.stringify(squad.members) === JSON.stringify(newMembers)) {
    console.log('Already removed — no change.');
    return;
  }

  await vapi('PATCH', `/squad/${BR_UNIFIED_SQUAD_ID}`, { members: newMembers });
  const after = await vapi('GET', `/squad/${BR_UNIFIED_SQUAD_ID}`);
  console.log(`After: ${after.members.length} members`);
  console.log(`Grace destinations: ${after.members.find(m => m.assistantId === GRACE_ASSISTANT_ID)?.assistantDestinations?.length}`);
  console.log('✓ Proxy removed from squad. Try calling +18882934492 now — Grace should pick up.');
}

main().catch(err => { console.error(`✗ ${err.message}`); process.exit(1); });
