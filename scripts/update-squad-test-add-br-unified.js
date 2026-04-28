// Patches the existing Sales Test Dispatcher Squad to route the "Builders Risk"
// test path to the new Grace BR Unified v1.0 agent (instead of the legacy
// Grace Sales v1.7). This lets QA on the LasVegas test number (+17027108075)
// exercise the v4.0 unified flow end-to-end (sales + service + spanish
// fallback) without touching the production BR Sales Squad still attached
// to +18882934492.
//
// Emma (FB Sales v1.9) and Olivia (CL Sales v1.7) routes remain unchanged —
// only the BR test path moves to the unified agent. The legacy Grace Sales
// v1.7 stays alive in the BR Sales Squad attached to the prod toll-free
// until Phase 3 cut-over.
//
// PATCH replaces the squad members[] entirely, so this script re-emits the
// full membership and full dispatcher destinations.

const VAPI_KEY = process.env.VAPI_KEY;
if (!VAPI_KEY) { console.error('VAPI_KEY env var is not set. Copy .env.example to .env and export it.'); process.exit(1); }

// ─── Squad ID ─────────────────────────────────────────────────────────
const TEST_SQUAD_ID = '2ae25a8b-6ff0-49db-abfc-197b751f533a';

// ─── Assistant IDs ────────────────────────────────────────────────────
const DISPATCHER_ID    = '753657c6-3ed4-487c-8c39-1f65fa4f8287';
const EMMA_ID          = '71c72af4-b87a-43cb-8f0a-661c3febe8ea';
const OLIVIA_ID        = 'b5f88994-e045-4996-9f2c-056516e9cf01';
const GRACE_UNIFIED_ID = '52bda5c2-65c0-4604-b988-f56b9f1d98f3'; // NEW v4.0 agent
const JENNIFER_ID      = '273d2d5a-27e0-40aa-b817-76a51d1c302d';
const SARAH_ID         = '1364ed31-51fa-41a4-8831-491b2ee3ef77';
const NORA_ID          = 'd1055f89-7175-4a51-8f03-a3332d1764ff';
const RACHEL_ID        = 'b4957315-f53f-4296-9ca6-58748f4a4041';
const WENDY_ID         = 'bc789a3e-9e2b-4c60-9778-9e33d0cd826d';
const FB_PROXY_ID      = 'fb1e7022-e4ee-42d1-b1db-0977a4e05aad';
const CL_PROXY_ID      = 'f06c2ad0-1a21-491d-916d-cbbf09e1118e';
const BR_PROXY_ID      = '180a9367-df40-4e46-91c8-a28b13901e53';

// ─── VAPI assistant names ─────────────────────────────────────────────
const EMMA_NAME          = 'Emma — FB Receptionist EN Sales v1.9';
const OLIVIA_NAME        = 'Olivia — CL Receptionist EN Sales v1.7';
const GRACE_UNIFIED_NAME = 'Grace — BR Receptionist EN Unified v1.0';
const JENNIFER_NAME      = 'Jennifer — Builders Risk v2.3';
const SARAH_NAME         = 'Sarah — GL Quote Agent v1.1';
const NORA_NAME          = 'Nora — Commercial Auto v1.0';
const RACHEL_NAME        = 'Rachel — FB Home & Auto Intake v2.3';
const WENDY_NAME         = "Wendy — Workers' Comp v1.0";
const FB_PROXY_NAME      = 'FB Live Agent Handoff v1.0';
const CL_PROXY_NAME      = 'CL Live Agent Handoff v1.0';
const BR_PROXY_NAME      = 'BR Live Agent Handoff v1.0';

// ─── Dispatcher destinations (BR row now points to Grace BR Unified) ─
const dispatcherDestinations = [
  {
    type: 'assistant',
    assistantName: EMMA_NAME,
    message: "Got it — connecting you to Farmer Brown sales now.",
    description: "John picked Farmer Brown / FB / farmerbrown.com / the main site."
  },
  {
    type: 'assistant',
    assistantName: OLIVIA_NAME,
    message: "Got it — connecting you to Contractors Liability sales now.",
    description: "John picked Contractors Liability / CL / contractorsliability / contractors."
  },
  {
    type: 'assistant',
    assistantName: GRACE_UNIFIED_NAME, // CHANGED: was Grace v1.7 sales-only
    message: "Got it — connecting you to the new Builders Risk unified agent now.",
    description: "John picked Builders Risk / BR / buildersrisk.net / construction. NOTE: routes to the v4.0 unified agent that handles sales + service + spanish-fallback in a single conversation. After Grace picks up, John can test any path by saying the matching first answer (new quote / existing policy / payment / claim / certificate / Spanish)."
  }
];

// ─── Sales destinations Emma + Olivia use (unchanged from v3.6) ──────
const brDestination = {
  type: 'assistant',
  assistantName: JENNIFER_NAME,
  message: "Great — I'll connect you with Jennifer, our Builder's Risk specialist. She'll get you an instant quote in under five minutes. One moment.",
  description: "Transfer when the caller is looking for a NEW Builder's Risk quote (course of construction, new construction coverage, renovation coverage). Do NOT transfer here if the caller has an existing quote."
};
const glDestination = {
  type: 'assistant',
  assistantName: SARAH_NAME,
  message: "Perfect — I'll connect you with Sarah, our General Liability specialist. She'll pull up real-time pricing for you. One moment.",
  description: "Transfer when the caller is looking for a NEW General Liability quote (contractor liability, GL, business liability). Do NOT transfer here if the caller has an existing quote."
};
const caDestination = {
  type: 'assistant',
  assistantName: NORA_NAME,
  message: "Great — I'll connect you with Nora, our Commercial Auto specialist. She'll collect your fleet details in about eight to ten minutes and hand you off to a licensed agent for pricing. One moment.",
  description: "Transfer when the caller is looking for a NEW Commercial Auto quote (business auto, commercial vehicle, fleet coverage, delivery, livery, black car). Do NOT transfer here if the caller has an existing quote."
};
const haDestination = {
  type: 'assistant',
  assistantName: RACHEL_NAME,
  message: "Perfect — I'll connect you with Rachel, our Home and Auto specialist. She'll get your details and set you up with one of our agents. One moment.",
  description: "Transfer when the caller is looking for a NEW Home, Auto, or Home & Auto quote. Do NOT transfer here if the caller has an existing quote."
};
const wcDestination = {
  type: 'assistant',
  assistantName: WENDY_NAME,
  message: "Perfect — I'll connect you with Wendy, our Workers' Comp specialist. She'll walk you through a few quick questions and set you up with one of our pros. One moment.",
  description: "Transfer when the caller is looking for a NEW Workers' Compensation quote (workers comp, workman's comp, WC, employee coverage). Do NOT transfer here if the caller has an existing quote."
};

const fbLiveAgentDestination = {
  type: 'assistant',
  assistantName: FB_PROXY_NAME,
  message: "Connecting you to a licensed agent now, one moment.",
  description: "Transfer when caller has an EXISTING quote (winner), is an existing policyholder on the wrong line, asks for a person, or fallback after two unclear routing attempts."
};
const clLiveAgentDestination = { ...fbLiveAgentDestination, assistantName: CL_PROXY_NAME };
const brLiveAgentDestination = { ...fbLiveAgentDestination, assistantName: BR_PROXY_NAME };

const emmaDestinations = [brDestination, glDestination, caDestination, haDestination, wcDestination, fbLiveAgentDestination];
const oliviaDestinations = [brDestination, glDestination, caDestination, haDestination, wcDestination, clLiveAgentDestination];

// ─── Grace BR Unified's destinations (5 specialists + BR Live Agent Proxy) ─
const graceUnifiedDestinations = [
  {
    type: 'assistant',
    assistantName: JENNIFER_NAME,
    message: "Great — I'll connect you with Jennifer, our Builder's Risk specialist. She'll get you an instant quote in under five minutes. One moment.",
    description: "DEFAULT SALES PATH on the buildersrisk.net line. Transfer when caller confirms Builder's Risk at Step S2, or directly mentions BR / construction / course of construction at triage. Do NOT transfer here for existing-quote winners or for service intents — those go to the BR Live Agent Proxy."
  },
  {
    type: 'assistant',
    assistantName: SARAH_NAME,
    message: "Perfect — I'll connect you with Sarah, our General Liability specialist. She'll pull up real-time pricing for you. One moment.",
    description: "Transfer when the caller picks General Liability at Step S3 (alt menu) after saying 'something else' at S2. Sarah runs the GL Buy-Now close (Contractors Liability product) internally."
  },
  {
    type: 'assistant',
    assistantName: WENDY_NAME,
    message: "Perfect — I'll connect you with Wendy, our Workers' Comp specialist. She'll walk you through a few quick questions and set you up with one of our pros. One moment.",
    description: "Transfer when the caller picks Workers' Compensation at Step S3 (alt menu)."
  },
  {
    type: 'assistant',
    assistantName: NORA_NAME,
    message: "Great — I'll connect you with Nora, our Commercial Auto specialist. She'll collect your fleet details in about eight to ten minutes and hand you off to a licensed agent for pricing. One moment.",
    description: "Transfer when the caller picks Commercial Auto at Step S3 (alt menu)."
  },
  {
    type: 'assistant',
    assistantName: RACHEL_NAME,
    message: "Perfect — I'll connect you with Rachel, our Home and Auto specialist. She'll get your details and set you up with one of our agents. One moment.",
    description: "Transfer when the caller picks Home and Auto at Step S3 (alt menu)."
  },
  {
    type: 'assistant',
    assistantName: BR_PROXY_NAME,
    message: "Connecting you to a licensed agent now, one moment.",
    description: "Transfer here when ANY of: caller has an EXISTING quote (winner), caller's intent is a Service action (payment, claim, other-service, explicit 'live agent' request), caller speaks Spanish (Spanish branch deferred), or fallback after two unclear routing attempts."
  }
];

// ─── Full squad membership (PATCH replaces, so emit everything) ──────
const squadBody = {
  name: 'Test Squad — Sales EN (all sites)',
  members: [
    { assistantId: DISPATCHER_ID,    assistantDestinations: dispatcherDestinations },
    { assistantId: EMMA_ID,          assistantDestinations: emmaDestinations },
    { assistantId: OLIVIA_ID,        assistantDestinations: oliviaDestinations },
    { assistantId: GRACE_UNIFIED_ID, assistantDestinations: graceUnifiedDestinations },
    { assistantId: JENNIFER_ID },
    { assistantId: SARAH_ID },
    { assistantId: NORA_ID },
    { assistantId: RACHEL_ID },
    { assistantId: WENDY_ID },
    { assistantId: FB_PROXY_ID },
    { assistantId: CL_PROXY_ID },
    { assistantId: BR_PROXY_ID }
  ]
};

async function updateSquad() {
  const res = await fetch(`https://api.vapi.ai/squad/${TEST_SQUAD_ID}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${VAPI_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(squadBody)
  });

  const data = await res.json();
  if (data.id) {
    console.log('Test Dispatcher Squad updated successfully!');
    console.log('   Squad ID:', data.id);
    console.log('   Members:', data.members.length);
    console.log('\nWhat changed:');
    console.log('   - Removed legacy Grace Sales v1.7 from squad (still alive in BR Sales Squad on prod toll-free)');
    console.log('   - Added Grace BR Unified v1.0');
    console.log('   - Dispatcher\'s "Builders Risk" route now points to Grace BR Unified v1.0');
    console.log('\nQA via LasVegas test number +17027108075:');
    console.log('   - Call → Dispatcher asks "which site?"');
    console.log('   - Say "Builders Risk" → routes to Grace BR Unified');
    console.log('   - Then say "new quote" or "existing policy" or "Spanish" to test each path');
  } else {
    console.error('Error updating squad:', JSON.stringify(data, null, 2));
    process.exit(1);
  }
}

updateSquad();
