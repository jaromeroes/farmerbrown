// Updates Grace — BR Receptionist EN Unified to the latest version.
// Reads prompt + first message from agents/receptionist-buildersrisk-unified/.
// Mirrors scripts/update-receptionist-br-sales.js — PATCH on the assistant ID,
// replaces name + firstMessage + model.systemPrompt + transcriber config.

const VAPI_KEY = process.env.VAPI_KEY;
if (!VAPI_KEY) { console.error('VAPI_KEY env var is not set. Copy .env.example to .env and export it.'); process.exit(1); }
const ASSISTANT_ID = '52bda5c2-65c0-4604-b988-f56b9f1d98f3'; // Grace BR Unified

async function updateAssistant() {
  const systemPrompt = require('fs')
    .readFileSync('./agents/receptionist-buildersrisk-unified/system-prompt.md', 'utf8');

  const firstMessage = require('fs')
    .readFileSync('./agents/receptionist-buildersrisk-unified/first-message.md', 'utf8');

  const res = await fetch(`https://api.vapi.ai/assistant/${ASSISTANT_ID}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${VAPI_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Grace — BR Receptionist EN Unified v1.10',
      firstMessage: firstMessage.trim(),
      model: {
        provider: 'openai',
        model: 'gpt-4o',
        systemPrompt: systemPrompt,
        // v1.7 — tool REMOVED. Production calls (2026-05-01) showed gpt-4o
        // had a strong bias toward the function-call tool over the destination
        // string match: when caller said "Builders Risk" cleanly, Grace still
        // invoked transfer_to_live_agent_builders_risk while saying "I'll
        // connect you with Jennifer". Said one thing, did another. No prompt
        // rule could overcome the structural function-calling bias. Removing
        // the tool entirely forces the LLM to use squad destinations for ALL
        // transfers (specialists AND live agent). The proxy was reconfigured
        // with a non-empty firstMessage to make it actually invoke its own
        // tool when reached.
        toolIds: []
      },
      voice: {
        provider: '11labs',
        // v1.8 — Grace-specific voice. Replaces the L2 common voice
        // (WlKo88ukhZlZ4fjsOQFI) shared with Emma/Olivia. Selected to be
        // audibly distinct from the L3 specialist voice so callers notice
        // the handoff. Emma/Olivia still use the old L2 voice for now.
        voiceId: 'I5gP2xcJJRbiVkFuanfS',
        // v1.9 — pushed to extremes for prosodic distinctness from Jennifer.
        // Jennifer uses ElevenLabs defaults (stability ~0.5, style 0). Grace
        // is now intentionally more expressive: lower stability = more
        // emotional variation, higher style = more personality. Goal: caller
        // perceives a real persona shift on handoff.
        stability: 0.20,
        similarityBoost: 0.75,
        style: 0.70,
        useSpeakerBoost: true
      },
      transcriber: {
        provider: 'deepgram',
        model: 'nova-3',
        language: 'en',
        keyterm: [
          // Sales product names
          'Home and Auto',
          'Builders Risk',
          "Builder's Risk",
          'General Liability',
          'Workers Compensation',
          "Workers' Compensation",
          'Commercial Auto',
          // Service intents
          'Certificate of insurance',
          'COI',
          'additional insured',
          'waiver of subrogation',
          'primary and non-contributory',
          'products and completed operations',
          'live agent',
          // Brand + specialist names
          'Farmer Brown',
          'Builders Risk Net',
          'Contractors Liability',
          'Jennifer',
          'Sarah',
          'Nora',
          'Rachel',
          'Wendy',
          'Grace'
        ]
      },
      backgroundSound: 'off',
      recordingEnabled: true,
      // v1.10 — VAPI plays this line before terminating, even if the LLM
      // forgets to say goodbye. Safety net so callers never hear a hard cut.
      endCallMessage: 'Thanks for calling — have a great day!',
      // v1.2 — proactive silence-timeout. VAPI fires idleMessages after
      // idleTimeoutSeconds of silence. Rule 13 in the prompt described this
      // behavior but a pure prompt rule cannot fire without input — this is
      // the engine-level configuration that actually does it.
      messagePlan: {
        idleMessages: [
          'Are you still there? Would you like me to connect you with a live agent?'
        ],
        idleMessageMaxSpokenCount: 2,
        idleTimeoutSeconds: 7
      },
      silenceTimeoutSeconds: 30
    })
  });

  const data = await res.json();
  if (data.id) {
    console.log('Grace BR Unified updated successfully!');
    console.log('   Assistant ID:', data.id);
    console.log('   Name:', data.name);
  } else {
    console.error('Error updating assistant:', JSON.stringify(data, null, 2));
    process.exit(1);
  }
}

updateAssistant();
