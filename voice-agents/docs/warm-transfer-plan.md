# Warm transfer — design notes & implementation plan

**Status:** pending. Client request from 2026-05-08 PM, design notes captured 2026-05-11 (end of session).

When picking this up, read this file first, then `memory/project_pending_warm_transfer.md` for the original ask.

---

## What it is (vs. what we have today)

### Today — blind transfer

When Grace decides to transfer to Pedro:

1. Grace speaks her hand-off line + invokes `transfer_to_specific_person({destination: "+17262334655"})`.
2. VAPI executes a "blind" SIP forwarding — the caller's audio is bridged to Pedro's phone.
3. Pedro's phone rings.
4. Pedro picks up and the caller is already on the line. Pedro has to ask "Who am I speaking to?" / "What can I help with?"

It's fast, but Pedro starts the conversation with zero context. The caller already went through Grace, gave their name, said what they wanted — and now has to repeat everything.

### Warm transfer — VAPI's pattern

VAPI re-choreographs the flow:

1. Grace decides to transfer.
2. VAPI calls Pedro FIRST. The caller is on hold (music / silence / hold message).
3. Pedro picks up. **The caller does not hear him yet.** Instead, VAPI speaks to Pedro: *"You have a caller named Juan on the line, asking about a Builder's Risk quote on a property in Austin. Connecting you now."*
4. Pedro acknowledges (or after a short timeout passes).
5. VAPI now bridges the caller and Pedro into the same call.

Pedro enters knowing what's at the other end. The caller doesn't have to repeat anything.

## The two VAPI modes

| Mode | How the message is generated |
|---|---|
| `warm-transfer-say-message` | **Static** message preconfigured per destination. E.g. *"You have a caller from Builders Risk Dot Net — connecting now."* Same text every time. |
| `warm-transfer-say-summary` | **Dynamic** message: an LLM summarizes the transcript of the call with Grace and reads it out loud. *"Caller Juan Martínez has been speaking with Grace for 90 seconds, looking for a new Builder's Risk quote on a $500K project…"* Whatever you can imagine. |

The `say-summary` mode is the one that feels like magic — VAPI invokes an LLM with the full transcript and a prompt like *"summarize for the recipient in one sentence"*. Extra cost: one LLM call per transfer (~$0.02-0.05). Grace already costs $0.41/min, so this is rounding error.

## Trade-offs

### Pros

- Pedro starts with context → caller doesn't repeat → shorter conversation → less friction.
- More professional: when callers reach a human receptionist, this is what always happens.

### Cons

- **Added latency.** The caller waits an extra 5-15 seconds while Pedro picks up + hears the summary. Where Grace's hand-off takes ~2s today, this becomes 10-15s.
- **Need a fallback if no one picks up.** What does VAPI do if Pedro doesn't answer? Options: bounce back to Grace, send to voicemail, or fall through to the generic live-agent. Has to be configured.
- **Pedro has to tolerate the pattern.** Some phones / extensions handle these pauses poorly — Pedro might think there's silence and hang up. In B2B teams used to human receptionists, not a problem. On old PBXes or mobile-only callees, might be.

## Implementation shape

Each destination in the multi-destination tool carries a `transferPlan`:

```js
{
  type: 'number',
  number: '+17262334655',
  transferPlan: {
    mode: 'warm-transfer-say-summary',
    summaryPlan: {
      enabled: true,
      messages: [
        {
          role: 'system',
          content: 'You are summarizing a call for the person about to receive the transfer. Speak in one short sentence. Include the caller name, the product they asked about, and any key details from the transcript.'
        }
      ]
    }
  }
}
```

For the 19 destinations on `transfer_to_specific_person` (Pedro / Gustavo / etc.), the same `transferPlan` goes on each — the `summaryPlan` applies uniformly. For the dedicated team proxies (Spanish / Existing-Quote / Service), the same shape but probably with a prompt adapted to that line's typical caller intent.

## Recommended rollout

Phase 1 — prototype on ONE destination with the static mode:
- Pick the most context-valuable line: **Existing-Quote** (hot leads, biggest revenue impact).
- Use `warm-transfer-say-message` with a short static line like *"You have a caller following up on a quote we already sent."*
- Make ONE real test call. Listen for: (a) does it sound natural, (b) is the latency tolerable, (c) does the receiver react well.

Phase 2 — escalate to the other 3 routing proxies (Spanish, Service, Live Agent) if Phase 1 sounds good. Same static-mode pattern.

Phase 3 — only after Phase 1+2 are stable, try `warm-transfer-say-summary` on direct-dial. The dynamic summary is more powerful but introduces real latency and LLM cost. Worth doing only if static-mode validates the approach.

## Open questions to ask the client before implementing

1. **Voicemail / no-answer fallback** — if Pedro / the team doesn't pick up in N seconds, where does the call go? Bounce to the generic EN live-agent? Hang up with a message? Voicemail at the destination?
2. **Latency tolerance** — are the receivers OK with the caller hearing ~10s of hold before the bridge? This is the biggest UX delta.
3. **Phrasing of the summary** — for `say-summary`, what tone does John want? Punchy/operational ("BR quote, $500K, in Austin") vs. polite/contextual ("This is Juan, he's been on the line for a minute asking about Builder's Risk")?
4. **Per-proxy or global?** — same warm-transfer config for all 4 routing proxies (Spanish/Existing-Quote/Service/Live Agent) plus direct-dial? Or only the high-value ones (Existing-Quote, direct-dial)?

## Pointers

- VAPI Call Forwarding docs: https://docs.vapi.ai/call-forwarding
- Existing single-destination proxies (good places to prototype Phase 1): `BR Existing-Quote Proxy v1.0` (`db9b7095-…`), tool `transfer_to_existing_quote_team` (`a1644cf7-…`).
- Multi-destination tool (where warm-transfer would land for direct-dial): `transfer_to_specific_person` (`b7c4167b-…`).
- Pattern reference: this is a `transferPlan` on each destination of the transferCall tool, NOT a new tool or a new proxy. Existing scripts can be edited in place + re-run (idempotent).

## Done condition

Warm transfer is "done" when:
- ✅ Phase 1 tested with one real call, sounds natural, latency tolerable.
- ✅ Phase 2 escalated to all 4 routing proxies.
- ✅ John verifies a sample call recording.
- ✅ Memory `project_pending_warm_transfer.md` is deleted (this work is no longer pending).
