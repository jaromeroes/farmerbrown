#!/usr/bin/env node
/*
 * Add a warm-transfer plan to `transfer_to_live_agent_builders_risk` (7eb304a7-…).
 *
 * Context (2026-06-11, Jennifer v2.19): post-quote appointments are gone — after the
 * instant quote Jennifer transfers the caller straight to the BR live-agent line
 * (+18775131573). John's ask: "how does the person see questions already answered so
 * they don't have to repeat". Two halves:
 *   1. Data: CP4 lands the full record (incl. quoted_premium) in mission-control
 *      right before the transfer — the agent can open the lead by caller email.
 *   2. Audio: THIS script — the receiving agent hears a spoken summary of the call
 *      before being bridged to the caller.
 *
 * Mode: warm-transfer-wait-for-operator-to-speak-first-and-then-say-summary.
 * The wait-for-operator variant is deliberate: +18775131573 is a hunt-group, and
 * we don't want the summary playing into ringing/IVR — VAPI waits until a human
 * says something ("hello?") before reading the summary, then bridges.
 *
 * ⚠ SHARED TOOL: this tool is held by Jennifer AND by `BR Live Agent Proxy v1.0`
 * (Grace's Mechanism B). Both paths get the warm transfer. That's desirable — the
 * proxy path also benefits — but remember it when debugging either path.
 *
 * Caller UX cost: the caller waits on the bridge a few extra seconds while the
 * agent picks up + hears the summary. Validate with a real test call.
 *
 * Idempotent: PATCHes destinations[] in place; re-running applies the same plan.
 * Rollback: run with --rollback to restore a blind transfer.
 */

const VAPI_KEY = process.env.VAPI_KEY;
if (!VAPI_KEY) {
  console.error('Missing VAPI_KEY. Run: export $(grep -v "^#" .env | xargs)');
  process.exit(1);
}

const TOOL_ID = '7eb304a7-ee98-4076-be2f-2d1c5fd6645e'; // transfer_to_live_agent_builders_risk
const ROLLBACK = process.argv.includes('--rollback');

const SUMMARY_PLAN = {
  enabled: true,
  messages: [
    {
      role: 'system',
      content:
        'You are briefing the insurance agent who is about to take over this call. ' +
        'In at most two short sentences, state: the caller\'s name, whether it is new construction or a renovation, ' +
        'the property city and state, the coverage amount, and the quoted total annual premium if one was given ' +
        '(or say "flagged hard to place — no instant quote" if none was). ' +
        'Do not greet, do not add pleasantries, do not mention being an AI. Start directly with the caller\'s name.',
    },
    {
      role: 'user',
      content: 'Here is the transcript of the call so far:\n\n{{transcript}}',
    },
  ],
};

const TRANSFER_PLAN = {
  mode: 'warm-transfer-wait-for-operator-to-speak-first-and-then-say-summary',
  summaryPlan: SUMMARY_PLAN,
};

async function vapi(method, path, body) {
  const res = await fetch('https://api.vapi.ai' + path, {
    method,
    headers: { Authorization: 'Bearer ' + VAPI_KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { _raw: text }; }
  if (!res.ok) {
    // Surface the full validation error — VAPI enumerates valid enum values on 400s,
    // which is exactly what we need if a transferPlan mode name is wrong.
    throw new Error(`VAPI ${method} ${path} (${res.status}): ${JSON.stringify(data)}`);
  }
  return data;
}

(async () => {
  const tool = await vapi('GET', '/tool/' + TOOL_ID);
  if (tool.type !== 'transferCall') throw new Error(`Tool ${TOOL_ID} is ${tool.type}, expected transferCall`);
  if (!Array.isArray(tool.destinations) || tool.destinations.length === 0) {
    throw new Error('Tool has no destinations — aborting.');
  }

  console.log(`Tool: ${tool.function?.name} — ${tool.destinations.length} destination(s)`);
  for (const d of tool.destinations) {
    console.log(`  ${d.number} (current mode: ${d.transferPlan?.mode || 'blind (default)'})`);
  }

  const newDestinations = tool.destinations.map(d =>
    ROLLBACK
      ? { ...d, transferPlan: { mode: 'blind-transfer' } }
      : { ...d, transferPlan: TRANSFER_PLAN }
  );

  await vapi('PATCH', '/tool/' + TOOL_ID, { destinations: newDestinations });

  const after = await vapi('GET', '/tool/' + TOOL_ID);
  for (const d of after.destinations) {
    console.log(`✓ ${d.number} → mode: ${d.transferPlan?.mode}` +
      (d.transferPlan?.summaryPlan?.enabled ? ' (summary enabled)' : ''));
  }
  console.log(ROLLBACK ? '\n✓ Rolled back to blind transfer.' : '\n✓ Warm transfer active. Make a real test call before telling the client.');
})().catch(err => {
  console.error('\n✗ FAILED: ' + err.message);
  process.exit(1);
});
