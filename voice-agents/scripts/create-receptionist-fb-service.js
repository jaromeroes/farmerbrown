const VAPI_KEY = process.env.VAPI_KEY;
if (!VAPI_KEY) { console.error('VAPI_KEY env var is not set. Copy .env.example to .env and export it.'); process.exit(1); }

// Emma Service receptionist — farmerbrown.com English Service line
//
// Design: no explicit transfer tools (empty toolIds). Every transfer goes
// through the FB Live Agent Proxy as a squad destination. See
// docs/squads-and-handoffs.md §2 for the rationale — same fix as
// Emma Sales v1.8+, Olivia Sales v1.6+, Grace Sales v1.6+.
//
// Voice: L2 receptionist voice (WlKo88ukhZlZ4fjsOQFI), same as Emma Sales.
// Transcriber: Deepgram nova-3 with COI-specific keyterms + product names
// (to catch sales-misroute callers on the Service line).

async function createAssistant() {
  const systemPrompt = require('fs')
    .readFileSync('./agents/receptionist-farmerbrown-service/system-prompt.md', 'utf8');

  const firstMessage = require('fs')
    .readFileSync('./agents/receptionist-farmerbrown-service/first-message.md', 'utf8');

  const res = await fetch('https://api.vapi.ai/assistant', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VAPI_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Emma — FB Receptionist EN Service v1.0',
      firstMessage: firstMessage.trim(),
      model: {
        provider: 'openai',
        model: 'gpt-4o',
        systemPrompt: systemPrompt,
        toolIds: []
      },
      voice: {
        provider: '11labs',
        voiceId: 'WlKo88ukhZlZ4fjsOQFI'
      },
      transcriber: {
        provider: 'deepgram',
        model: 'nova-3',
        language: 'en',
        keyterm: [
          'Certificate of Insurance',
          'COI',
          'Certificate',
          'Additional Insured',
          'Waiver of Subrogation',
          'Primary and Non-Contributory',
          'Products and Completed Operations',
          'Endorsement',
          'Farmer Brown',
          'Payment',
          'Claim',
          'Quote',
          'Builders Risk',
          "Builder's Risk",
          'General Liability',
          'Commercial Auto',
          'Home and Auto',
          'Workers Compensation',
          "Workers' Compensation"
        ]
      },
      backgroundSound: 'off',
      recordingEnabled: true
    })
  });

  const data = await res.json();
  if (data.id) {
    console.log('Emma Service (FB) created successfully!');
    console.log('   Assistant ID:', data.id);
    console.log('   Name:', data.name);
    console.log('\nNext step: add this ID to scripts/create-squad-fb-service.js and run it.');
  } else {
    console.error('Error creating assistant:', JSON.stringify(data, null, 2));
  }
}

createAssistant();
