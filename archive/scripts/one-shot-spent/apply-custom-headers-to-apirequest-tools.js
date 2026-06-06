// Apply custom HTTP headers to every apiRequest tool in the org.
//
// Goal (per José, 2026-05-08): mask the underlying voice platform from the
// backend (Calforce, managed by Tyler). VAPI's default User-Agent on
// outbound apiRequest calls likely contains an identifying string. By
// setting a neutral User-Agent and an X-Source header, the requests look
// like they come from "our internal voice app" rather than from a third-
// party platform.
//
// Idempotent: re-running detects tools already at target headers and skips
// them. Safe to run anytime to ensure new tools get the same treatment.
//
// What does NOT change:
//   - URL, method, body, function spec — all left alone
//   - Existing Authorization-style query params (agent_api_key) stay in URL
//   - transferCall / endCall tools are skipped (only apiRequest tools have
//     a headers field that VAPI uses for outbound HTTP)

const VAPI_KEY = process.env.VAPI_KEY;
if (!VAPI_KEY) {
  console.error('VAPI_KEY env var is not set. Copy .env.example to .env and `export $(grep -v ^# .env | xargs)`.');
  process.exit(1);
}

// VAPI stores headers in JSON-Schema form: { type: object, properties: { NAME: { type: string, value: VALUE } } }.
// This is the same shape as the body schema (verified 2026-05-08 with a probe PATCH).
const TARGET_HEADERS = {
  type: 'object',
  properties: {
    'User-Agent': { type: 'string', value: 'FarmerBrown-VoiceApp/1.0' },
    'X-Source':   { type: 'string', value: 'farmerbrown-app' },
  },
};

function headersMatch(existing) {
  if (!existing || typeof existing !== 'object') return false;
  const want = TARGET_HEADERS.properties;
  const got = existing.properties || {};
  if (Object.keys(want).length !== Object.keys(got).length) return false;
  for (const [k, v] of Object.entries(want)) {
    if (!got[k] || got[k].value !== v.value) return false;
  }
  return true;
}

async function vapi(method, path, body) {
  const res = await fetch(`https://api.vapi.ai${path}`, {
    method,
    headers: { 'Authorization': `Bearer ${VAPI_KEY}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data; try { data = text ? JSON.parse(text) : {}; } catch { data = { _raw: text }; }
  if (!res.ok) throw new Error(`VAPI ${method} ${path} (${res.status}): ${JSON.stringify(data).slice(0, 600)}`);
  return data;
}

async function main() {
  const all = await vapi('GET', '/tool');
  const apiRequestTools = all.filter(t => t.type === 'apiRequest');
  console.log(`Found ${apiRequestTools.length} apiRequest tools (out of ${all.length} total):\n`);

  let patched = 0, skipped = 0;
  for (const t of apiRequestTools) {
    const fname = (t.function || {}).name || t.name || '(unnamed)';
    if (headersMatch(t.headers)) {
      console.log(`  ✓ ${t.id.slice(0,8)}  ${fname.padEnd(32)} already at target headers, skipping`);
      skipped++;
      continue;
    }

    console.log(`  → ${t.id.slice(0,8)}  ${fname.padEnd(32)} patching...`);
    await vapi('PATCH', `/tool/${t.id}`, { headers: TARGET_HEADERS });

    const after = await vapi('GET', `/tool/${t.id}`);
    if (!headersMatch(after.headers)) {
      throw new Error(`Headers did not stick on ${t.id} (${fname})`);
    }
    patched++;
  }

  console.log(`\n✓ Done. Patched: ${patched}, already-correct: ${skipped}`);
  console.log(`\nTo verify in production, ask Tyler for a header dump of one /api/* call after the next live test.`);
  console.log(`Look for "User-Agent: FarmerBrown-VoiceApp/1.0" in his server log. If VAPI overwrote it, we'll need a different approach.`);
}

main().catch(err => {
  console.error(`✗ FAILED: ${err.message}`);
  process.exit(1);
});
