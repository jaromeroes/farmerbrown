# Voice Lab — how the client picks agent voices

**Live:** <https://farmerbrown.theb2btinkerers.com/portal/voices> (behind the
portal login, nav item **Voices**).

## Why

19 assistants run on **5 voices**, and 11 of them share literally the same one
(`Ne7VRnu9eE7lobTDr8Pw`). "Distinctive voice per agent" is a TODO written into
six deploy scripts. Picking voices is the client's call, not ours — but the
client cannot be handed an API key, a vendor dashboard, or the name of the
stack (see the external-comms rule in the root `CLAUDE.md`).

So: a gallery inside the portal they already log into, with every voice
anonymised behind an `FB-NN` label.

## The two renders

Every voice is published twice, and this is the part that matters:

| Track | What it is |
|---|---|
| **Studio** | Loudness-normalised clean sample, 24 kHz mono |
| **Phone line** | Same sample band-passed to 300–3400 Hz and round-tripped through 8 kHz **G.711 µ-law** — the actual telephony codec |

A browser MP3 flatters every voice. The line does not, and the line is the only
place these agents ever speak. Voices routinely swap places between the two
tracks, which is why the gallery defaults to **Phone line**.

Both tracks are loudness-normalised (`loudnorm=I=-16:TP=-1.5:LRA=11`). Without
it the loudest sample wins the audition rather than the best one.

## The pieces

| Path | Role |
|---|---|
| `voice-agents/scripts/voice-lab-build.js` | Builds everything. Fetches, curates, downloads, transcodes, emits both artefacts. |
| `voice-agents/docs/voice-lab-registry.json` | **Internal.** `FB-NN → provider + voiceId`. Never ships to the browser. |
| `billing/src/lib/voiceCatalog.ts` | **Public.** Generated. Labels, gender, accent, tone, audio paths — no vendor, no voice id. |
| `billing/public/voice-lab/*.mp3` | The audio, 66 files, ~2 MB. |
| `billing/src/pages/portal/voices.astro` | The gallery. Auth-gated, no framework, picks in `localStorage`. |
| `billing/src/pages/api/voice-lab/picks.ts` | Shortlist → email to `OPERATIONS_EMAIL`. Validates labels against the catalogue; nothing persisted. |

## Rebuilding

```sh
cd voice-agents
set -a; source .env; set +a
node scripts/voice-lab-build.js --dry-run   # show the selection, download nothing
node scripts/voice-lab-build.js             # build (skips audio already on disk)
node scripts/voice-lab-build.js --force     # re-transcode everything
```

Requires `ffmpeg` on PATH and `VAPI_KEY`. Labels are **stable across
rebuilds** — the registry is read first and existing `provider:voiceId` pairs
keep their number, so a shortlist the client sent last week still means the
same voices today. Commit the regenerated `voiceCatalog.ts`, the registry, and
any new audio; Vercel serves the MP3s straight from `billing/public/`.

## Wiring a pick onto an agent

1. Look the label up in `docs/voice-lab-registry.json` → `provider` + `voiceId`.
2. Edit that agent's `scripts/update-<agent>.js` `voice` block.
3. Bump the agent version and run the update script.

## Known limits (read before promising anything)

**Only 2 of the 11 voice libraries publish sample audio.** `11labs` (21 voices)
and `vapi` (22, of which 12 have audio) ship a `previewUrl`; `cartesia` (924),
`azure` (781), `rime-ai` (694), `minimax`, `deepgram`, `hume`, `lmnt`,
`neuphonic` and `inworld` return metadata with **no audio at all**, and the
platform exposes no synthesis endpoint (probed: `/voice/synthesize`, `/tts`,
`/voice/test`, `/speech` — all 404). The gallery therefore covers **33 voices
from the two providers we already run**. Auditioning any other vendor needs
that vendor's own API key.

**No Spanish.** Every voice with published audio is English, so Valeria's
Spanish line is not covered by this gallery.

**The samples are the vendors' generic sentences, not our script,** and the
`11labs` ones are short (2–6 s). The client is judging voice character, not how
the voice handles Grace's greeting or a premium figure.

### What unlocks the rest

An **ElevenLabs API key** in `voice-agents/.env` (the account already exists —
Creator plan, ~300k credits/mo, and it is the same account whose key rotation
fixed the August outage). With it the build script could:

- reach the **full** shared voice library instead of the 21 premade voices, and
- render **our actual scripts** — Grace's greeting, Jennifer's quote line — so
  the client auditions the real thing at a real length.

Cartesia, Deepgram and Rime all have free tiers if we want a genuine
multi-vendor comparison. That comparison is not cosmetic: the August 2026
outage took **all 19 assistants down for a month** because they share one voice
vendor, and "add a fallback voice provider" is still an open action.

### What this gallery cannot tell you

Latency, barge-in behaviour, and how a voice holds up across a 7-minute quote
intake. Those only show up on a real call. If a shortlist needs that check, the
next step is a test assistant carrying the candidate voice and an outbound call
to the person deciding.
