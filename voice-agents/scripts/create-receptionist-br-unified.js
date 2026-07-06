// Creates Grace — BR Receptionist EN Unified v1.0
//
// New v4.0 unified receptionist for buildersrisk.net: handles SALES + SERVICE
// in a single assistant via Step 0 triage. Spanish callers fall back to live
// agent (Spanish branch deferred to v1.1). Silence-timeout proactivity is
// instructed in the system prompt (Rule 13); VAPI defaults are used for
// silenceTimeoutSeconds for now — tune via VAPI dashboard or a follow-up
// update if testing shows the agent is too patient or VAPI cuts too soon.
//
// Tools: empty — same architectural pattern as Grace Sales v1.6+ and Grace
// Service v1.0+. Live-agent escalation and all specialist hand-offs are
// squad destinations, not explicit tools.

const VAPI_KEY = process.env.VAPI_KEY;
if (!VAPI_KEY) { console.error('VAPI_KEY env var is not set. Copy .env.example to .env and export it.'); process.exit(1); }

async function createAssistant() {
  const systemPrompt = require('fs')
    .readFileSync('./agents/receptionist-buildersrisk-unified/system-prompt.md', 'utf8');

  const firstMessage = require('fs')
    .readFileSync('./agents/receptionist-buildersrisk-unified/first-message.md', 'utf8');

  const res = await fetch('https://api.vapi.ai/assistant', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VAPI_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Grace — BR Receptionist EN Unified v1.0',
      firstMessage: firstMessage.trim(),
      model: {
        provider: 'openai',
        model: 'gpt-4o',
        systemPrompt: systemPrompt,
        toolIds: []
      },
      voice: {
        provider: '11labs',
        voiceId: 'WlKo88ukhZlZ4fjsOQFI' // L2 receptionist voice
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
      recordingEnabled: true
    })
  });

  const data = await res.json();
  if (data.id) {
    console.log('Grace BR Unified created successfully!');
    console.log('   Assistant ID:', data.id);
    console.log('   Name:', data.name);
    console.log('\nNext steps:');
    console.log('   1. Update CLAUDE.md with the new Assistant ID under the BR Unified section');
    console.log('   2. Run scripts/create-squad-br-unified.js to wire the squad');
    console.log('   3. Run scripts/update-squad-test-add-br-unified.js to add to Test Dispatcher');
  } else {
    console.error('Error creating assistant:', JSON.stringify(data, null, 2));
    process.exit(1);
  }
}

createAssistant();
