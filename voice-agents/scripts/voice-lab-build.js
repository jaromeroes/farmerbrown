#!/usr/bin/env node
/**
 * Build the Voice Lab gallery — a curated, vendor-anonymised catalogue of
 * candidate agent voices the client can audition from the billing portal
 * (`/portal/voices`).
 *
 * Why this exists: 19 assistants share 5 voices, 11 of them literally the same
 * one. "Distinctive voice per agent" is a TODO in six deploy scripts. Picking
 * voices needs the client's ear, and the client cannot be handed an API key or
 * a vendor dashboard.
 *
 * What it does:
 *   1. Pulls every provider library from VAPI's `/voice-library/{provider}`
 *      (~727 voices across 11 providers — no TTS cost, no extra credentials).
 *   2. Curates them down to a listenable gallery: English + Spanish, female
 *      first, capped per provider so no single vendor dominates the grid.
 *   3. Downloads each voice's sample and transcodes it TWICE with ffmpeg:
 *        • studio  — loudness-normalised, what a laptop speaker gives you
 *        • phone   — 300–3400 Hz band-pass through a G.711 µ-law round-trip,
 *                    i.e. what the caller ACTUALLY hears on the line
 *      Loudness normalisation matters: without it the loudest sample wins,
 *      not the best one.
 *   4. Emits two artefacts, deliberately split:
 *        • billing/src/lib/voiceCatalog.ts     → ships to the browser.
 *          Labels (FB-01…), tone, gender, accent, audio paths. NO vendor
 *          name, NO voice id — the client must not learn the stack.
 *        • docs/voice-lab-registry.json        → stays here. Maps each label
 *          back to provider + voiceId so we can wire the winner into the
 *          agent's deploy script.
 *
 * Labels are stable across rebuilds: the registry is read first and existing
 * `provider:voiceId` pairs keep the number they were given, so a shortlist the
 * client sent last week still means the same voices today.
 *
 * Requires: ffmpeg on PATH, VAPI_KEY in the environment.
 *
 * Run (from voice-agents/):
 *   set -a; source .env; set +a
 *   node scripts/voice-lab-build.js --dry-run   # print the selection, download nothing
 *   node scripts/voice-lab-build.js             # build the gallery
 *   node scripts/voice-lab-build.js --force     # re-transcode audio already on disk
 */

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const VAPI_KEY = process.env.VAPI_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');

if (!VAPI_KEY) {
  console.error('Missing VAPI_KEY. `set -a; source .env; set +a` first.');
  process.exit(1);
}

// ── Paths ──────────────────────────────────────────────────────────────────
const ROOT = path.resolve(__dirname, '..');            // voice-agents/
const MONO = path.resolve(ROOT, '..');                 // repo root
const AUDIO_DIR = path.join(MONO, 'billing', 'public', 'voice-lab');
const CATALOG_TS = path.join(MONO, 'billing', 'src', 'lib', 'voiceCatalog.ts');
const REGISTRY = path.join(ROOT, 'docs', 'voice-lab-registry.json');
const TMP = path.join(require('node:os').tmpdir(), 'voice-lab-src');

// ── Curation ───────────────────────────────────────────────────────────────
// Only two of the eleven libraries publish sample audio (`previewUrl`):
// 11labs and vapi — which happen to be the two providers we already run. The
// other nine (cartesia, azure, deepgram, minimax, lmnt, hume, rime-ai,
// neuphonic, inworld) return metadata with no audio at all, and VAPI exposes
// no synthesis endpoint, so there is no way to voice them from here. Auditioning
// them needs that vendor's own API key — see docs/voice-lab.md. The script
// keeps them in the list and reports the gap rather than hiding it.
//
// Caps are wide open: the client asked for the full catalogue and the gallery
// has gender/language filters. `assumeEnglish` marks libraries that are
// English-only but ship no language field.
const PROVIDERS = [
  { provider: '11labs',   en: 99, es: 99, assumeEnglish: true  },
  { provider: 'vapi',     en: 99, es: 99, assumeEnglish: false },
  { provider: 'cartesia', en: 99, es: 99, assumeEnglish: false },
  { provider: 'azure',    en: 99, es: 99, assumeEnglish: false },
  { provider: 'deepgram', en: 99, es: 99, assumeEnglish: true  },
  { provider: 'minimax',  en: 99, es: 99, assumeEnglish: false },
  { provider: 'lmnt',     en: 99, es: 99, assumeEnglish: true  },
  { provider: 'hume',     en: 99, es: 99, assumeEnglish: true  },
  { provider: 'rime-ai',  en: 99, es: 99, assumeEnglish: true  },
];

const SAMPLE_SECONDS = 14;

// Every persona we run is female (Emma, Olivia, Grace, Jennifer, Sarah, Wendy,
// Rachel, Nora, Valeria) and the client wants it kept that way, so male and
// unlabelled-gender voices never enter the gallery. A library that doesn't
// label gender at all therefore contributes nothing — that is intentional.
const FEMALE_ONLY = true;

// American only. Farmer Brown sells US insurance to US callers, so a British
// or Australian voice is a distraction however good it sounds. The match is
// deliberately loose (`/american/i`) so American variants — "Indian American"
// and the like — stay in and the gallery's accent filter can tell them apart.
const AMERICAN_ONLY = true;

// Anything in here is scrubbed from the tone text before it reaches the
// browser. External comms rule: the client never learns which vendors we run.
const VENDOR_WORDS = /\b(eleven ?labs|elevenlabs|eleven|vapi|cartesia|deepgram|azure|microsoft|openai|open ai|rime|neuphonic|hume|lmnt|inworld|minimax|play\.?ht|playht|google|amazon|aws|polly|sonic|aura|nova)\b/gi;

// ── VAPI ───────────────────────────────────────────────────────────────────
async function fetchLibrary(provider) {
  const out = [];
  for (let page = 1; page <= 6; page++) {
    const res = await fetch(
      `https://api.vapi.ai/voice-library/${provider}?limit=200&page=${page}`,
      { headers: { Authorization: `Bearer ${VAPI_KEY}` } }
    );
    if (!res.ok) throw new Error(`${provider} page ${page}: HTTP ${res.status}`);
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    out.push(...batch);
    if (batch.length < 200) break;
  }
  // The library paginates by offset and can repeat rows across pages.
  const seen = new Set();
  return out.filter((r) => {
    const k = `${r.provider}:${r.providerId}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ── Classification ─────────────────────────────────────────────────────────
function langOf(rec, assumeEnglish) {
  const lc = String(rec.languageCode || rec.language || '').toLowerCase();
  if (lc.startsWith('en')) return 'en';
  if (lc.startsWith('es')) return 'es';
  if (lc) return 'other';

  const acc = String(rec.accent || '').toLowerCase();
  if (/american|british|australian|canadian|irish|scottish|texas/.test(acc)) return 'en';
  if (/mexican|latin|peninsular|colombian|spanish|castilian/.test(acc)) return 'es';
  if (acc && acc !== 'none') return 'other';
  return assumeEnglish ? 'en' : 'unknown';
}

function genderOf(rec) {
  const g = String(rec.gender || '').toLowerCase();
  return g === 'female' || g === 'male' ? g : null;
}

function accentOf(rec, lang) {
  const a = String(rec.accent || '').trim();
  if (a && a.toLowerCase() !== 'none') {
    return a.charAt(0).toUpperCase() + a.slice(1);
  }
  const lc = String(rec.languageCode || '').toLowerCase();
  if (lc === 'en-us') return 'American';
  if (lc === 'en-gb') return 'British';
  if (lc === 'es-mx') return 'Mexican';
  if (lc === 'es-es') return 'Peninsular';
  return lang === 'es' ? 'Spanish' : 'Unlabelled';
}

/** Vendor-scrubbed, length-capped description. Empty string if nothing usable. */
function toneOf(rec) {
  let t = String(rec.description || '').replace(/\s+/g, ' ').trim();
  t = t.replace(VENDOR_WORDS, '').replace(/\s{2,}/g, ' ').replace(/\s+([,.])/g, '$1').trim();
  if (t.length > 180) {
    const cut = t.slice(0, 180);
    t = cut.slice(0, Math.max(cut.lastIndexOf('. '), cut.lastIndexOf(', '), 140)).trim();
  }
  if (t && !/[.!?]$/.test(t)) t += '.';
  return t;
}

/**
 * Rank inside a provider+language bucket: a labelled American accent first,
 * then a written description, then alphabetical so the order — and therefore
 * the labels — is stable.
 */
function rank(a, b) {
  const score = (v) =>
    (/american/i.test(v.accent) ? 0 : 10) +
    (v.tone ? 0 : 5);
  return score(a) - score(b) || String(a.srcName).localeCompare(String(b.srcName));
}

function select(records, cfg) {
  const pools = { en: [], es: [] };
  for (const rec of records) {
    if (!rec.previewUrl) continue;
    const lang = langOf(rec, cfg.assumeEnglish);
    if (lang !== 'en' && lang !== 'es') continue;
    if (FEMALE_ONLY && genderOf(rec) !== 'female') continue;
    if (AMERICAN_ONLY && lang === 'en' && !/american/i.test(accentOf(rec, lang))) continue;
    pools[lang].push({
      key: `${rec.provider}:${rec.providerId}`,
      provider: rec.provider,
      voiceId: rec.providerId,
      srcName: rec.name || rec.providerId,
      lang,
      gender: genderOf(rec),
      accent: accentOf(rec, lang),
      tone: toneOf(rec),
      previewUrl: rec.previewUrl,
      model: rec.model || null,
    });
  }
  return [
    ...pools.en.sort(rank).slice(0, cfg.en),
    ...pools.es.sort(rank).slice(0, cfg.es),
  ];
}

// ── Audio ──────────────────────────────────────────────────────────────────
function ffmpeg(args) {
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], {
    stdio: ['ignore', 'ignore', 'pipe'],
  });
}

// Trim leading silence, cap the length, normalise loudness. `-map_metadata -1`
// strips the source ID3 tags, which name the vendor.
const CLEAN =
  'silenceremove=start_periods=1:start_threshold=-50dB:start_duration=0.05,' +
  'loudnorm=I=-16:TP=-1.5:LRA=11';

function renderStudio(src, dest) {
  ffmpeg(['-i', src, '-map_metadata', '-1', '-t', String(SAMPLE_SECONDS),
          '-af', CLEAN, '-ac', '1', '-ar', '24000',
          '-c:a', 'libmp3lame', '-b:a', '48k', dest]);
}

/**
 * The phone render is the point of this whole gallery. A browser MP3 at 24 kHz
 * flatters every voice; the line does not. Band-pass to the 300–3400 Hz voice
 * channel, then round-trip through 8 kHz G.711 µ-law — the actual telephony
 * codec — before re-encoding.
 */
function renderPhone(src, dest, scratch) {
  ffmpeg(['-i', src, '-map_metadata', '-1', '-t', String(SAMPLE_SECONDS),
          '-af', `highpass=f=300,lowpass=f=3400,${CLEAN}`,
          '-ac', '1', '-ar', '8000', '-c:a', 'pcm_mulaw', '-f', 'wav', scratch]);
  ffmpeg(['-i', scratch, '-map_metadata', '-1', '-ac', '1', '-ar', '8000',
          '-c:a', 'libmp3lame', '-b:a', '32k', dest]);
}

// ── Registry (stable labels) ───────────────────────────────────────────────
function loadRegistry() {
  if (!fs.existsSync(REGISTRY)) return { nextIndex: 1, voices: {} };
  return JSON.parse(fs.readFileSync(REGISTRY, 'utf8'));
}

function labelFor(registry, voice) {
  const existing = registry.voices[voice.key];
  if (existing) return existing.label;
  const label = `FB-${String(registry.nextIndex).padStart(2, '0')}`;
  registry.nextIndex += 1;
  return label;
}

// ── Main ───────────────────────────────────────────────────────────────────
(async () => {
  const registry = loadRegistry();
  const selected = [];

  for (const cfg of PROVIDERS) {
    let records;
    try {
      records = await fetchLibrary(cfg.provider);
    } catch (err) {
      console.warn(`  ! ${cfg.provider}: ${err.message} — skipped`);
      continue;
    }
    const withAudio = records.filter((r) => r.previewUrl).length;
    if (records.length > 0 && withAudio === 0) {
      console.log(
        `  ${cfg.provider.padEnd(9)} ${String(records.length).padStart(4)} available → ` +
        `SKIPPED: library publishes no sample audio (needs this vendor's own API key)`
      );
      continue;
    }
    const picks = select(records, cfg);
    console.log(
      `  ${cfg.provider.padEnd(9)} ${String(records.length).padStart(4)} available → ` +
      `${picks.filter((p) => p.lang === 'en').length} EN + ${picks.filter((p) => p.lang === 'es').length} ES`
    );
    selected.push(...picks);
  }

  // Assign labels in a deterministic order so a fresh registry numbers the
  // gallery the same way every time.
  selected.sort((a, b) => a.lang.localeCompare(b.lang) || a.provider.localeCompare(b.provider) || String(a.voiceId).localeCompare(String(b.voiceId)));
  for (const v of selected) v.label = labelFor(registry, v);

  console.log(`\n${selected.length} voices selected.\n`);

  if (DRY_RUN) {
    for (const v of selected) {
      console.log(
        `${v.label}  ${v.lang}  ${(v.gender || '—').padEnd(6)} ${v.accent.padEnd(14)} ` +
        `${v.provider.padEnd(9)} ${String(v.srcName).slice(0, 34)}`
      );
    }
    console.log('\n--dry-run: nothing downloaded, nothing written.');
    return;
  }

  fs.mkdirSync(AUDIO_DIR, { recursive: true });
  fs.mkdirSync(TMP, { recursive: true });

  const built = [];
  for (const v of selected) {
    const studio = path.join(AUDIO_DIR, `${v.label.toLowerCase()}-studio.mp3`);
    const phone = path.join(AUDIO_DIR, `${v.label.toLowerCase()}-phone.mp3`);

    if (!FORCE && fs.existsSync(studio) && fs.existsSync(phone)) {
      built.push(v);
      continue;
    }
    try {
      const res = await fetch(v.previewUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const src = path.join(TMP, `${v.label}.src`);
      fs.writeFileSync(src, Buffer.from(await res.arrayBuffer()));
      renderStudio(src, studio);
      renderPhone(src, phone, path.join(TMP, `${v.label}.wav`));
      built.push(v);
      process.stdout.write(`  ${v.label} ✓\n`);
    } catch (err) {
      console.warn(`  ${v.label} ✗ ${v.provider}:${v.voiceId} — ${err.message}`);
    }
  }

  // Registry — ours, with the vendor mapping.
  for (const v of built) {
    registry.voices[v.key] = {
      label: v.label,
      provider: v.provider,
      voiceId: v.voiceId,
      model: v.model,
      sourceName: v.srcName,
      lang: v.lang,
    };
  }
  registry.generatedAt = new Date().toISOString();
  fs.writeFileSync(REGISTRY, JSON.stringify(registry, null, 2) + '\n');

  // Catalogue — theirs, anonymised.
  const rows = built
    .slice()
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((v) => ({
      label: v.label,
      lang: v.lang,
      gender: v.gender,
      accent: v.accent,
      tone: v.tone,
      studio: `/voice-lab/${v.label.toLowerCase()}-studio.mp3`,
      phone: `/voice-lab/${v.label.toLowerCase()}-phone.mp3`,
    }));

  const ts = `/**
 * Voice Lab catalogue — GENERATED by voice-agents/scripts/voice-lab-build.js.
 * Do not edit by hand; re-run the script instead.
 *
 * This module ships to the browser, so it carries NO provider name and NO
 * voice id. The label → vendor mapping lives in
 * voice-agents/docs/voice-lab-registry.json and stays out of the app.
 *
 * Generated: ${registry.generatedAt}
 */

export interface VoiceSample {
  /** Neutral public identifier, e.g. "FB-07". Stable across rebuilds. */
  label: string;
  lang: 'en' | 'es';
  /** null when the source library does not label it. */
  gender: 'female' | 'male' | null;
  accent: string;
  /** Short character description. Empty when the library ships none. */
  tone: string;
  /** Clean render. */
  studio: string;
  /** 8 kHz G.711 render — how the voice sounds on an actual phone call. */
  phone: string;
}

export const VOICE_SAMPLES: VoiceSample[] = ${JSON.stringify(rows, null, 2)};
`;
  fs.writeFileSync(CATALOG_TS, ts);

  const bytes = fs
    .readdirSync(AUDIO_DIR)
    .reduce((n, f) => n + fs.statSync(path.join(AUDIO_DIR, f)).size, 0);

  console.log(`\n${built.length} voices built (${(bytes / 1024 / 1024).toFixed(1)} MB of audio)`);
  console.log(`  audio     → billing/public/voice-lab/`);
  console.log(`  catalogue → billing/src/lib/voiceCatalog.ts   (public, anonymised)`);
  console.log(`  registry  → voice-agents/docs/voice-lab-registry.json   (internal)`);
})();
