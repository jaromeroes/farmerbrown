#!/usr/bin/env node
/*
 * Creates/updates the VAPI `calculate_premium` apiRequest tool — the deterministic
 * premium "hook" for Jennifer (Option B in premium-api/README.md).
 *
 * DOES NOT RUN without a deployed endpoint. Set CALC_ENDPOINT_URL first:
 *   CALC_ENDPOINT_URL=https://<your-vercel>.vercel.app/api/quote node scripts/create-tool-calculate-premium.js
 *
 * Idempotent: matches by function.name and PATCHes in place.
 * ⚠ Before running, eyeball the `body` templating against an existing apiRequest tool
 *   (e.g. submit_quote da21631c) — VAPI's body-variable shape has bitten us before.
 */
const VAPI_KEY = process.env.VAPI_KEY;
const URL = process.env.CALC_ENDPOINT_URL;
if (!VAPI_KEY) { console.error('Missing VAPI_KEY'); process.exit(1); }
if (!URL) { console.error('Missing CALC_ENDPOINT_URL — deploy premium-api first (see its README).'); process.exit(1); }

const TOOL = {
  type: 'apiRequest',
  name: 'calculate_premium',
  function: {
    name: 'calculate_premium',
    description: 'Compute the exact Builders Risk annual premium total (premium + fee). Call this AFTER the summary is confirmed and no risk flags fired, then speak the returned `total`. Never do this math yourself.',
    parameters: {
      type: 'object',
      properties: {
        insuredValue: { type: 'number', description: 'Total amount being insured (building coverage; combined total if multiple structures).' },
        projectType: { type: 'string', enum: ['new construction', 'renovation'], description: 'Q4.' },
        constructionType: { type: 'string', enum: ['Frame', 'Brick', 'Masonry Non-Combustible'], description: 'Q12.' },
        deductible: { type: 'string', enum: ['$1,000', '$2,500', '$5,000'], description: 'Q14.' },
      },
      required: ['insuredValue', 'projectType', 'constructionType', 'deductible'],
    },
  },
  url: URL,
  method: 'POST',
  headers: { type: 'object', properties: { 'Content-Type': { type: 'string', value: 'application/json' } } },
  body: {
    type: 'object',
    properties: {
      insuredValue: { type: 'number', value: '{{insuredValue}}' },
      projectType: { type: 'string', value: '{{projectType}}' },
      constructionType: { type: 'string', value: '{{constructionType}}' },
      deductible: { type: 'string', value: '{{deductible}}' },
    },
  },
};

async function vapi(method, path, b) {
  const r = await fetch('https://api.vapi.ai' + path, {
    method, headers: { Authorization: 'Bearer ' + VAPI_KEY, 'Content-Type': 'application/json' },
    body: b ? JSON.stringify(b) : undefined,
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status}: ${t.slice(0, 400)}`);
  return t ? JSON.parse(t) : {};
}

(async () => {
  const tools = await vapi('GET', '/tool');
  const existing = (Array.isArray(tools) ? tools : []).find(t => t.function?.name === 'calculate_premium');
  if (existing) {
    await vapi('PATCH', '/tool/' + existing.id, TOOL);
    console.log('✓ updated calculate_premium', existing.id, '->', URL);
  } else {
    const created = await vapi('POST', '/tool', TOOL);
    console.log('✓ created calculate_premium', created.id, '->', URL);
    console.log('Next: add this id to REQUIRED_TOOL_IDS in update-jennifer.js + bump Jennifer to v2.21.');
  }
})().catch(e => { console.error('✗', e.message); process.exit(1); });
