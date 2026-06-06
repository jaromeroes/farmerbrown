#!/usr/bin/env node
/*
 * Migrate the Calforce backend VAPI tools off the now-dead farmerbrown-bi.calforce.pro
 * domain onto mission-control.farmerbrown.com (domain change shipped 2026-06 by the
 * backend dev), swap the stale agent_api_key for the rotated one, and add &slim=true to
 * the two availability tools (LLM-context cost optimization — slim response is now live
 * on /api/calendly/available_times).
 *
 * The old domains (farmerbrown-bi.calforce.pro AND farmerbrown.calforce.pro) no longer
 * resolve, so every tool below was effectively broken until this runs.
 *
 * Idempotent: re-running on an already-migrated tool is a no-op (URL is rewritten by
 * host/key substitution; slim is only appended if absent).
 *
 * NOTE: submit_gl_form (5d723598-…) is intentionally EXCLUDED. Its endpoint /api/submit
 * was removed in the migration (404 on the new domain); the replacement is
 * POST /api/insurance_quote_submissions with a different payload contract. That tool has
 * body=null today and must be rebuilt separately, not reapointed here.
 */

const VAPI_KEY = process.env.VAPI_KEY;
const CALFORCE = process.env.CALFORCE_AGENT_KEY;
if (!VAPI_KEY || !CALFORCE) {
  console.error('Missing env. Run: export $(grep -v "^#" .env | xargs)');
  console.error(`  VAPI_KEY: ${VAPI_KEY ? 'set' : 'MISSING'}  CALFORCE_AGENT_KEY: ${CALFORCE ? 'set' : 'MISSING'}`);
  process.exit(1);
}

const OLD_HOST = 'farmerbrown-bi.calforce.pro';
const NEW_HOST = 'mission-control.farmerbrown.com';
const OLD_KEY = '3a8c4681-8dbe-4cdb-a8fb-20477cfdef88';

const TOOLS = [
  { id: 'da21631c-4ba2-4b41-9c06-cb7ffc1c8428', name: 'submit_quote',             slim: false },
  { id: 'dd2504ab-c665-493f-915d-345b0696017f', name: 'check_availability',       slim: true  },
  { id: '642280ea-5ea0-4d1e-a7fe-35439016de10', name: 'book_appointment',         slim: false },
  { id: '253df17f-2b43-4880-ad51-d5a3f2a4e655', name: 'check_availability_angie',  slim: true  },
  { id: '35ff8b09-0a1f-4694-adb7-208f2a893434', name: 'book_appointment_angie',    slim: false },
];

function migrateUrl(url, slim) {
  let u = url.split(OLD_HOST).join(NEW_HOST);
  u = u.split(OLD_KEY).join(CALFORCE);
  if (slim && !/[?&]slim=true/.test(u)) u += (u.includes('?') ? '&' : '?') + 'slim=true';
  return u;
}

async function vapi(method, path, body) {
  const r = await fetch('https://api.vapi.ai' + path, {
    method,
    headers: { Authorization: 'Bearer ' + VAPI_KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status}: ${txt.slice(0, 400)}`);
  return txt ? JSON.parse(txt) : {};
}

(async () => {
  for (const t of TOOLS) {
    const tool = await vapi('GET', '/tool/' + t.id);
    const oldUrl = tool.url;
    if (!oldUrl) { console.log(`! ${t.name}: no url field — skipped`); continue; }
    const newUrl = migrateUrl(oldUrl, t.slim);

    if (oldUrl === newUrl) {
      console.log(`= ${t.name}: already on ${NEW_HOST}${t.slim ? ' (+slim)' : ''}`);
      continue;
    }

    await vapi('PATCH', '/tool/' + t.id, { url: newUrl });

    // verify: re-GET and confirm url changed AND function spec survived (function.parameters
    // must exist or the tool bricks its squad — see memory feedback_vapi_tool_parameters_required)
    const after = await vapi('GET', '/tool/' + t.id);
    const fnOk = after.function && after.function.parameters !== undefined;
    console.log(`✔ ${t.name}`);
    console.log(`    was: ${oldUrl}`);
    console.log(`    now: ${after.url}`);
    console.log(`    function.parameters present: ${fnOk ? 'yes' : 'NO — INVESTIGATE'}`);
  }
  console.log('\nDone. Old key 3a8c4681… and old host farmerbrown-bi.calforce.pro should no longer appear above.');
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
