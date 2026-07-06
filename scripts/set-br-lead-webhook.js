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
 *   VAPI_KEY      (farmerbrown/.env)
 *   CRON_SECRET   (farmerbrown-billing/.env)  ← must match the deployed app
 *
 * Run:
 *   set -a; source .env; source ../farmerbrown-billing/.env; set +a
 *   node scripts/set-br-lead-webhook.js            # apply
 *   node scripts/set-br-lead-webhook.js --rollback # clear server
 */

const VAPI_KEY = process.env.VAPI_KEY;
const CRON_SECRET = process.env.CRON_SECRET;
const WEBHOOK_URL = 'https://farmerbrown.theb2btinkerers.com/api/vapi-lead-email';
const BR_SQUAD_ID = 'a3269fa7-6229-4bed-817a-c4684878a600';
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

(async () => {
  const numbers = await api('GET', '/phone-number');
  const brNumbers = (numbers || []).filter((n) => n.squadId === BR_SQUAD_ID);
  if (brNumbers.length === 0) {
    console.error('No phone numbers route to the BR Unified squad — nothing to do.');
    process.exit(1);
  }

  for (const n of brNumbers) {
    const server = ROLLBACK ? null : { url: WEBHOOK_URL, secret: CRON_SECRET };
    const updated = await api('PATCH', `/phone-number/${n.id}`, { server });
    const got = updated.server?.url ?? null;
    console.log(
      `${ROLLBACK ? 'CLEARED' : 'SET'} ${n.number} (${n.name || n.id}) → server.url=${got} ` +
        `secret=${updated.server?.url ? 'set' : '-'} | squadId intact: ${updated.squadId === BR_SQUAD_ID}`
    );
  }
  console.log(`\nDone (${brNumbers.length} number(s)). ${ROLLBACK ? 'Webhook removed.' : 'Webhook live.'}`);
})().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
