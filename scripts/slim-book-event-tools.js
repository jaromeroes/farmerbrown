#!/usr/bin/env node
/*
 * Add &slim=true to the two book_event VAPI tools (book_appointment + book_appointment_angie).
 *
 * Context: the slim response was first shipped on /api/calendly/available_times (the two
 * check_availability tools were slimmed in migrate-tools-to-mission-control.js). On 2026-06-09
 * Pablo confirmed the slim option is ALSO live on /api/calendly/book_event — so we adopt it here
 * to shave ~3kb of LLM context per booking call. Pure query-param change, response stays
 * compatible (booking still returns confirmation; just trimmed).
 *
 * Idempotent: re-running on an already-slimmed tool is a no-op (slim is only appended if absent).
 */

const VAPI_KEY = process.env.VAPI_KEY;
if (!VAPI_KEY) {
  console.error('Missing VAPI_KEY. Run: export $(grep -v "^#" .env | xargs)');
  process.exit(1);
}

const TOOLS = [
  { id: '642280ea-5ea0-4d1e-a7fe-35439016de10', name: 'book_appointment' },
  { id: '35ff8b09-0a1f-4694-adb7-208f2a893434', name: 'book_appointment_angie' },
];

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
    if (/[?&]slim=true/.test(oldUrl)) {
      console.log(`= ${t.name}: already slim`);
      continue;
    }
    const newUrl = oldUrl + (oldUrl.includes('?') ? '&' : '?') + 'slim=true';
    await vapi('PATCH', '/tool/' + t.id, { url: newUrl });

    const after = await vapi('GET', '/tool/' + t.id);
    const slimOk = /[?&]slim=true/.test(after.url);
    const fnOk = after.function && after.function.parameters !== undefined; // squad-load guard
    console.log(`✔ ${t.name}`);
    console.log(`    was: ${oldUrl}`);
    console.log(`    now: ${after.url}`);
    console.log(`    slim applied: ${slimOk ? 'yes' : 'NO — INVESTIGATE'} | function.parameters present: ${fnOk ? 'yes' : 'NO — INVESTIGATE'}`);
  }
  console.log('\nDone.');
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
