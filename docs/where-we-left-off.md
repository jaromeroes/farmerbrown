# Where we left off — Farmer Brown
**Last touched:** 2026-05-01 (end of day — BR launch shipped, Twilio cleanup completed, Grace stabilized at v1.9)

This is a session-resumption checkpoint: enough context to pick the project back up cold without re-reading the full conversation history.

---

## SHIPPED TODAY (2026-05-01)

Three things closed today, all live in production:

1. **Builders Risk Phase 3 cut-over DONE.** `+18882934492` (the BR public toll-free) now routes to the BR Unified Squad with **Grace v1.9** as entry point. Real callers are going through the Sales/Service triage instead of landing directly on Jennifer.
2. **Grace stabilized at v1.9** after a long iteration day (v1.3 → v1.9) chasing two non-obvious bugs: prompt verbalization and gpt-4o tool bias. Lessons saved to memory.
3. **Twilio cleanup complete.** 15 numbers deleted, 134,628 audio recordings purged. Estimated savings: **~$3,915/year (~80% off the previous bill)**.

---

## What's live in production

### Builders Risk — buildersrisk.net (FULLY MIGRATED to v4.0)

- Public toll-free: `+18882934492` → BR Unified Squad (`a3269fa7-6229-4bed-817a-c4684878a600`) → **Grace v1.9** as entry point.
- QA test line: `+17027108075` → same squad (parallel; OK to keep both pointed at the same squad).
- Squad members (7): Grace + Jennifer + Sarah + Wendy + Nora + Rachel + BR Live Agent Proxy.
- **Grace has NO tools (`toolIds: []`).** All transfers — including live agent — go through `transferCall` with squad destination strings. Reason: gpt-4o structurally biases toward function-call tools and would skip the specialist routing. See `memory/feedback_vapi_function_call_bias.md`.
- BR Live Agent Proxy (`180a9367-df40-4e46-91c8-a28b13901e53`) reconfigured with `firstMessage: "One moment."` to actually fire its forwarding tool when reached as a squad destination. SIP forwards to `+18779600221`.
- Voice: Grace on a Grace-specific voiceId `I5gP2xcJJRbiVkFuanfS` (different from Emma/Olivia, who still share `WlKo88ukhZlZ4fjsOQFI`). Settings tuned for prosodic distinctness from Jennifer: `stability: 0.20`, `style: 0.70`, `similarityBoost: 0.75`, `useSpeakerBoost: true`.
- Silence-timeout configured engine-side on Grace AND all 5 specialists (Jennifer/Sarah/Wendy/Nora/Rachel): `idleTimeoutSeconds: 7`, idle message "Are you still there? Would you like me to connect you with a live agent?", `silenceTimeoutSeconds: 30`.

### Contractors Liability — contractorsliability.com (UNCHANGED)

- Public toll-free: `+18884356365` → Test Dispatcher Sales squad (`2ae25a8b-…`). Still on v3.6 architecture. Migration to v4.0 (CL Unified) is a future workstream.

### Farmer Brown — farmerbrown.com (UNCHANGED)

- No dedicated VAPI line on the website yet. Cross-brand intake numbers route to FB internal teams via TwiML Bin.

---

## Grace iteration log today (v1.3 → v1.9)

For context if you need to iterate again:

| Version | Trigger | Change |
|---|---|---|
| v1.4 | Grace was verbalizing prompt guidance: *"Text calling transfer call with Tony…"* | Reformatted HAND-OFF SCRIPTS with `[mechanics — never spoken]` labels |
| v1.5 | v1.4 made it WORSE — Grace literally read the label: *"…mechanics, never spoken, specialist handoff via transfer call to…"* | Stripped HAND-OFF SCRIPTS to bare quoted lines only — no headers, no labels, nothing but speech |
| v1.6 | Grace skipping to live agent on first ambiguous user input | Rewrote Rule 4 + Rule 9 with anti-bias rules and per-product phonetic triggers |
| v1.7 | The bias bug couldn't be fixed via prompt: Grace said *"I'll connect you with Jennifer"* while simultaneously invoking the live-agent tool. Said one thing, did another. | **Removed the live-agent tool from Grace entirely.** All transfers now use squad destinations. Reconfigured the BR Live Agent Proxy with `firstMessage: "One moment."` so its LLM actually invokes the forwarding tool. |
| v1.8 | Voice was the L2-shared one, no Grace identity | New voice `I5gP2xcJJRbiVkFuanfS` specific to Grace |
| v1.9 | Timbre was new but cadence still matched Jennifer | Voice settings pushed to extremes: stability 0.35→0.20, style 0.55→0.70 |

---

## Architecture lessons today (also in memory)

1. **VAPI/gpt-4o function-call bias.** When a receptionist has both a function-call tool AND squad destinations, gpt-4o picks the tool — even when the destination match is unambiguous and the prompt explicitly forbids it. No prompt can fix this. **Remediation: remove the tool**, force everything through squad destinations. See `memory/feedback_vapi_function_call_bias.md`.

2. **Silent SIP proxy needs a non-empty `firstMessage`.** A proxy assistant reached as squad destination won't invoke its forwarding tool if its `firstMessage` is empty — the LLM never starts the turn. With even a tiny line like `"One moment."` it activates and fires the tool right after. This is the missing piece from the failed v1.3 attempt — `forwardingPhoneNumber` is also LLM-dependent in this context.

3. **Anything in the speech section can be verbalized.** The LLM doesn't reliably distinguish `[labels]`, `(parentheticals)`, even explicit "never spoken" tags, from actual speech. The only safe pattern is: speech sections contain ONLY quoted speech, nothing else. Mechanics live in separate Rule sections.

4. **Voice distinctness needs more than a different voiceId.** Two ElevenLabs voices with default settings prosody-match each other (same warm/varied baseline). To get an audible persona shift between L2 (receptionist) and L3 (specialist), push voice settings to opposite extremes — Grace: low stability + high style; Jennifer/specialists: defaults.

---

## Twilio cleanup — done

### Numbers
- Account went from 28 → **13 phone numbers**.
- Deleted 15: 3 toll-free + 11 local + 1 international.
- Kept 13:
  - **3 production VAPI lines:** `+18884356365` (CL), `+18882934492` (BR — now on BR Unified Squad), `+17027108075` (test).
  - **1 reserved for future migration:** `+18884962029` (Farmerbrown Builders Risk — currently a TwiML Bin forwarding to Chicago, kept for a future VAPI migration).
  - **9 internal FB lines** pending John's confirmation of owner/use case (Camila, Laura, Razelle, AUTO, Condo, videos lines, Luis & Nicole pair).

### Recordings
- **134,628 audio recordings** (~9,644 hours, dating back to 2018) deleted in 44.7 minutes via parallel API.
- Verified: `/Recordings` endpoint returns 0 after the cleanup.

### Estimated annual savings
- Phone-number rentals: ~$265/yr (15 deleted × monthly rates × 12).
- Recording storage: ~$3,650/yr (the previous ~$304/mo line should drop to near-zero from June onwards).
- **Total: ~$3,915/yr (~80% off the previous ~$4,900/yr run rate).**
- New baseline expected: ~$80-100/mo (rentals on the 13 kept numbers + voice traffic + A2P fees).

---

## Open / pending after today

1. **CL + FB still on v3.6 architecture.** When you migrate them to v4.0 (CL Unified, FB Unified), reuse the Grace pattern. **Crucial: start with `toolIds: []` from day one.** Do NOT add a function-call live-agent tool to a receptionist that also has squad destinations — you'll repeat the v1.3 → v1.7 thrash. Live-agent goes through a squad destination + non-empty-firstMessage proxy. The pattern is proven now.

2. **Emma + Olivia still share the old L2 voice** (`WlKo88ukhZlZ4fjsOQFI`). When their sites migrate, give each receptionist its own distinct voice via the in-repo voice designer (`index.html`).

3. **9 internal Twilio numbers under review** — see Slack summary sent today. Pending John's confirmation of owner/use for each. Once he replies, decide keep/delete one by one.

4. **`+18884962029` reserved for future VAPI** — currently a TwiML Bin to Chicago. When you migrate it, decide if it joins BR Unified Squad or becomes its own line.

5. **Bill validation in late May / early June.** Pull `/Usage/Records` to confirm the savings landed. The "Recording Storage" line should drop from ~$304/mo to near-zero. Phone-number rentals from ~$64/mo to ~$48/mo.

6. **Documentation pass needed.** `docs/call-center-architecture.md` still describes the v3.6 production state for CL + FB. `docs/squads-and-handoffs.md` and `CLAUDE.md` still describe the 2026-04-18 architecture (silent SIP proxy via squad destination, no tool on receptionist). Grace BR Unified follows that pattern again from v1.7 onward — but with the new "proxy needs non-empty firstMessage" addendum. Worth a doc update when you pick this up next.

---

## How to resume

1. Read this file (you are here).
2. If picking up the BR project: open `agents/receptionist-buildersrisk-unified/system-prompt.md` for the current Grace prompt; deploy via `scripts/update-receptionist-br-unified.js`.
3. **Before adding any tool to a receptionist that has squad destinations**, read `memory/feedback_vapi_function_call_bias.md`. That's the most expensive lesson of this project — don't pay it twice.
4. Twilio cleanup is closed. Only reopen if the bill doesn't drop as expected, or if John replies on the 9 internal numbers.
5. The deploy scripts for the 5 specialists (Jennifer / Sarah / Wendy / Nora / Rachel) don't exist as files — patches were direct API curl calls. If you need to re-apply the `messagePlan` (silence-timeout) configuration to them, the curl loop is in the conversation history of 2026-04-29 / 2026-04-30.
