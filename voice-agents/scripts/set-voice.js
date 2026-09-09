#!/usr/bin/env node
/**
 * Put a Voice Lab pick onto live assistants — and nothing else.
 *
 * Why not the existing `update-<agent>.js` scripts: those PUT the whole
 * assistant (prompt, model, tools, first message) from the repo. The repo is
 * documented as stale on 8 of 12 agents, so using one to change a single
 * field risks reverting live configuration nobody wrote down. This PATCHes
 * `voice` alone, the same way `set-max-duration.js` touches only
 * `maxDurationSeconds`.
 *
 * Voices are resolved from docs/voice-lab-registry.json by their public
 * label, so what ships is exactly what the client starred — no copying voice
 * ids by hand between a mailbox and a config file.
 *
 * A voice is the one change every caller hears on the first syllable, so this
 * script prints its plan and does nothing unless you pass --apply.
 *
 * Run (from voice-agents/):
 *   set -a; source .env; set +a
 *   node scripts/set-voice.js --label FB-07 --match "BR Receptionist EN Unified"
 *   node scripts/set-voice.js --label FB-07 --match Jennifer --match Grace --apply
 *   node scripts/set-voice.js --label FB-07 --all --apply
 */

const fs = require('node:fs');
const path = require('node:path');

const VAPI_KEY = process.env.VAPI_KEY;
if (!VAPI_KEY) {
  console.error('Missing VAPI_KEY. `set -a; source .env; set +a` first.');
  process.exit(1);
}

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const ALL = argv.includes('--all');
const label = valueOf('--label');
const matches = valuesOf('--match');

function valueOf(flag) {
  const i = argv.indexOf(flag);
  return i > -1 ? argv[i + 1] : null;
}
function valuesOf(flag) {
  const out = [];
  argv.forEach((a, i) => { if (a === flag && argv[i + 1]) out.push(argv[i + 1]); });
  return out;
}

if (!label) {
  console.error('Missing --label (e.g. --label FB-07).');
  process.exit(1);
}
if (!ALL && matches.length === 0) {
  console.error('Pass --match <substring> (repeatable) or --all to choose the assistants.');
  process.exit(1);
}

const REGISTRY = path.join(__dirname, '..', 'docs', 'voice-lab-registry.json');
const registry = JSON.parse(fs.readFileSync(REGISTRY, 'utf8'));
const entry = Object.values(registry.voices).find((v) => v.label === label);
if (!entry) {
  console.error(`${label} is not in the registry. Known labels: ` +
    Object.values(registry.voices).map((v) => v.label).sort().join(', '));
  process.exit(1);
}

// Only provider + voiceId are written. `model` is deliberately left off: the
// two assistants already running native voices have it unset, and matching
// what is known to work beats setting a field nobody has tested.
const voice = { provider: entry.provider, voiceId: entry.voiceId };

const api = async (p, init = {}) => {
  const res = await fetch(`https://api.vapi.ai${p}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${VAPI_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`${init.method || 'GET'} ${p} → ${res.status} ${await res.text()}`);
  return res.json();
};

(async () => {
  const assistants = await api('/assistant?limit=100');
  const targets = assistants.filter((a) =>
    ALL || matches.some((m) => (a.name || '').toLowerCase().includes(m.toLowerCase()))
  );

  if (targets.length === 0) {
    console.error(`No assistant matched ${matches.map((m) => `"${m}"`).join(' / ')}.`);
    process.exit(1);
  }

  console.log(`${label} → ${entry.provider}:${entry.voiceId}  (${entry.sourceName})\n`);
  const changing = [];
  for (const a of targets) {
    const cur = a.voice || {};
    const same = cur.provider === voice.provider && cur.voiceId === voice.voiceId;
    console.log(
      `  ${same ? '=' : '→'} ${(a.name || '?').padEnd(44)} ` +
      `${String(cur.provider).padEnd(7)} ${String(cur.voiceId).slice(0, 24)}`
    );
    if (!same) changing.push(a);
  }

  console.log(`\n${targets.length} matched, ${changing.length} to change.`);
  if (changing.length === 0) return;

  if (!APPLY) {
    console.log('\nDry run — nothing written. Re-run with --apply to change what every caller hears.');
    return;
  }

  for (const a of changing) {
    await api(`/assistant/${a.id}`, { method: 'PATCH', body: JSON.stringify({ voice }) });
    console.log(`  ✓ ${a.name}`);
    registry.assignments = registry.assignments || {};
    registry.assignments[a.name] = label;
  }
  registry.assignmentsUpdatedAt = new Date().toISOString();
  fs.writeFileSync(REGISTRY, JSON.stringify(registry, null, 2) + '\n');
  console.log(`\n${changing.length} assistant(s) updated; assignments recorded in the registry.`);
})();
