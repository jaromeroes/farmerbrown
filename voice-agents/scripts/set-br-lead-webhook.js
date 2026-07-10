#!/usr/bin/env node
/**
 * Wire the Builders Risk lead-email webhook onto the BR phone number(s).
 *
 * Sets `server.url` + `server.secret` on every VAPI phone number that routes
 * to the BR Unified squad, so VAPI POSTs the end-of-call-report to the billing
 * app's /api/vapi-lead-email. We do NOT touch any assistant or the squad — only
 * the phone number — to avoid the brick-the-line failure modes documented in
 * docs/where-we-left-off.md. server messages are filtered by type in the
 * endpoint, so default-subscription is fine.
 *
 * Auth secret reuses billing's CRON_SECRET (the endpoint compares X-Vapi-Secret
 * against it), so no new env var is needed anywhere.
 *
 * Env required:
 *   VAPI_KEY      (voice-agents/.env)
 *   CRON_SECRET   (../billing/.env)  ← must match the DEPLOYED app's CRON_SECRET
 *
 * Run (from voice-agents/):
 *   set -a; source .env; source ../billing/.env; set +a
 *   node scripts/set-br-lead-webhook.js            # apply
 *   node scripts/set-br-lead-webhook.js --rollback # clear server
 *
 * ⚠ VAPI never returns `server.secret` on GET/PATCH responses, so a wrong
 * secret is INVISIBLE from the API and every webhook 401s silently (zero lead
 * emails, no error anywhere) — exactly the 2026-07-06→10 outage. This script
 * now pre-validates CRON_SECRET against the live endpoint before touching
 * VAPI, and the only true end-to-end check remains a real test call.
 */

const VAPI_KEY = process.env.VAPI_KEY;
const CRON_SECRET = process.env.CRON_SECRET;
const WEBHOOK_URL = 'https://farmerbrown.theb2btinkerers.com/api/vapi-lead-email';
const BR_SQUAD_ID = 'a3269fa7-6229-4bed-817a-c4684878a600';
// Target ONLY the public production BR number — never QA/test numbers that may
// also route to the BR Unified squad, so QA calls can't email leads@.
const PUBLIC_BR_NUMBER = '+18882934492';
const ROLLBACK = process.argv.includes('--rollback');

if (!VAPI_KEY) {
  console.error('Missing VAPI_KEY. `set -a; source .env; set +a` first.');
  process.exit(1);
}
if (!ROLLBACK && !CRON_SECRET) {
  console.error('Missing CRON_SECRET (lives in ../farmerbrown-billing/.env).');
  console.error('Run: set -a; source .env; source ../farmerbrown-billing/.env; set +a');
  process.exit(1);
}

const H = { Authorization: `Bearer ${VAPI_KEY}`, 'Content-Type': 'application/json' };
const api = async (method, path, body) => {
  const r = await fetch(`https://api.vapi.ai${path}`, {
    method,
    headers: H,
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  let d;
  try {
    d = t ? JSON.parse(t) : {};
  } catch {
    d = { _raw: t };
  }
  if (!r.ok) throw new Error(`VAPI ${method} ${path} (${r.status}): ${JSON.stringify(d).slice(0, 500)}`);
  return d;
};

/** Guard against the 2026-07-06 outage class: refuse to arm the webhook with a
 * CRON_SECRET the deployed endpoint does not accept (VAPI would 401 silently
 * on every webhook and no lead email would ever send). */
async function assertSecretMatchesProd() {
  const r = await fetch(`${WEBHOOK_URL}?sinceHours=1&dryRun=true&maxCalls=1`, {
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  });
  if (r.status === 401) {
    throw new Error(
      `CRON_SECRET REJECTED by ${WEBHOOK_URL} (401). The secret you sourced does NOT match ` +
        'the deployed app — arming VAPI with it would silently kill all lead emails. ' +
        'Source ../billing/.env (the monorepo billing folder) and check the Vercel env.'
    );
  }
  if (!r.ok) {
    throw new Error(`Endpoint pre-check failed (${r.status}) — fix the endpoint before arming the webhook.`);
  }
  console.log('Pre-check OK: deployed endpoint accepts this CRON_SECRET.');
}

(async () => {
  if (!ROLLBACK) await assertSecretMatchesProd();

  const numbers = await api('GET', '/phone-number');
  const brNumbers = (numbers || []).filter((n) => n.number === PUBLIC_BR_NUMBER);
  if (brNumbers.length === 0) {
    console.error(`Public BR number ${PUBLIC_BR_NUMBER} not found — nothing to do.`);
    process.exit(1);
  }

  for (const n of brNumbers) {
    const server = ROLLBACK ? null : { url: WEBHOOK_URL, secret: CRON_SECRET };
    const updated = await api('PATCH', `/phone-number/${n.id}`, { server });
    const got = updated.server?.url ?? null;
    console.log(
      `${ROLLBACK ? 'CLEARED' : 'SET'} ${n.number} (${n.name || n.id}) → server.url=${got} ` +
        `secret=sent (VAPI never echoes it back — verify with a test call) | squadId intact: ${updated.squadId === BR_SQUAD_ID}`
    );
  }
  console.log(`\nDone (${brNumbers.length} number(s)). ${ROLLBACK ? 'Webhook removed.' : 'Webhook live.'}`);
})().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
