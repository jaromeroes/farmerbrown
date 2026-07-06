// Creates "Builders Risk — Unified EN Squad" — the v4.0 squad for buildersrisk.net.
//
// Single per-site receptionist (Grace BR Unified) handles SALES and SERVICE
// internally via Step 0 triage. Squad members include all 5 specialists plus
// the BR Live Agent Proxy. Spanish callers fall back to BR Live Agent Proxy
// (no ES specialist this version).
//
// This squad is intended to receive the toll-free +18882934492 once cut-over
// happens (Phase 3). Until then, Grace BR Unified is also added to the Test
// Dispatcher Squad for QA via the Las Vegas test number.

const VAPI_KEY = process.env.VAPI_KEY;
if (!VAPI_KEY) { console.error('VAPI_KEY env var is not set. Copy .env.example to .env and export it.'); process.exit(1); }

// ─── Assistant IDs ────────────────────────────────────────────────────
const GRACE_UNIFIED_ID = '52bda5c2-65c0-4604-b988-f56b9f1d98f3';
const JENNIFER_ID      = '273d2d5a-27e0-40aa-b817-76a51d1c302d';
const SARAH_ID         = '1364ed31-51fa-41a4-8831-491b2ee3ef77';
const WENDY_ID         = 'bc789a3e-9e2b-4c60-9778-9e33d0cd826d';
const NORA_ID          = 'd1055f89-7175-4a51-8f03-a3332d1764ff';
const RACHEL_ID        = 'b4957315-f53f-4296-9ca6-58748f4a4041';
const BR_PROXY_ID      = '180a9367-df40-4e46-91c8-a28b13901e53';

// ─── VAPI assistant names (must match the names used at registration) ─
const GRACE_UNIFIED_NAME = 'Grace — BR Receptionist EN Unified v1.0';
const JENNIFER_NAME      = 'Jennifer — Builders Risk v2.3';
const SARAH_NAME         = 'Sarah — GL Quote Agent v1.1';
const WENDY_NAME         = "Wendy — Workers' Comp v1.0";
const NORA_NAME          = 'Nora — Commercial Auto v1.0';
const RACHEL_NAME        = 'Rachel — FB Home & Auto Intake v2.3';
const BR_PROXY_NAME      = 'BR Live Agent Handoff v1.0';

// ─── Grace's destinations (5 specialists + BR Live Agent Proxy) ───────
// Descriptions tuned for the unified context: triage already happened, so
// the routing decision is "which specialist matches the caller's product"
// for sales, OR "live agent" for everything else (service intents,
// existing-quote winners, Spanish, confusion).

const graceDestinations = [
  {
    type: 'assistant',
    assistantName: JENNIFER_NAME,
    message: "Great — I'll connect you with Jennifer, our Builder's Risk specialist. She'll get you an instant quote in under five minutes. One moment.",
    description: "DEFAULT SALES PATH on the buildersrisk.net line. Transfer when caller confirms Builder's Risk at Step S2 (the BR-or-something-else question), or directly mentions BR / construction / course of construction at triage. Do NOT transfer here for existing-quote winners or for service intents — those go to the BR Live Agent Proxy."
  },
  {
    type: 'assistant',
    assistantName: SARAH_NAME,
    message: "Perfect — I'll connect you with Sarah, our General Liability specialist. She'll pull up real-time pricing for you. One moment.",
    description: "Transfer when the caller picks General Liability at Step S3 (the alternate menu) after saying 'something else' at S2. Sarah also runs the GL Buy-Now close (Contractors Liability product) after delivering the premium — that flow is internal to Sarah."
  },
  {
    type: 'assistant',
    assistantName: WENDY_NAME,
    message: "Perfect — I'll connect you with Wendy, our Workers' Comp specialist. She'll walk you through a few quick questions and set you up with one of our pros. One moment.",
    description: "Transfer when the caller picks Workers' Compensation at Step S3 (alt menu) — keywords: workers' comp, workman's comp, WC, employee coverage."
  },
  {
    type: 'assistant',
    assistantName: NORA_NAME,
    message: "Great — I'll connect you with Nora, our Commercial Auto specialist. She'll collect your fleet details in about eight to ten minutes and hand you off to a licensed agent for pricing. One moment.",
    description: "Transfer when the caller picks Commercial Auto at Step S3 (alt menu) — keywords: business auto, commercial vehicle, fleet, delivery, livery, black car."
  },
  {
    type: 'assistant',
    assistantName: RACHEL_NAME,
    message: "Perfect — I'll connect you with Rachel, our Home and Auto specialist. She'll get your details and set you up with one of our agents. One moment.",
    description: "Transfer when the caller picks Home and Auto at Step S3 (alt menu) — keywords: homeowners, home insurance, personal auto, car insurance, home and auto bundle."
  },
  {
    type: 'assistant',
    assistantName: BR_PROXY_NAME,
    message: "Connecting you to a licensed agent now, one moment.",
    description: "Transfer here when ANY of: caller has an EXISTING quote (hot lead / winner — winners must reach a person fast), caller's intent is a Service action (payment, claim, other-service, explicit 'live agent' request, or any service request the AI can't handle), caller speaks Spanish (Spanish branch deferred to v1.1 — fallback to live agent), or fallback after two unclear routing attempts."
  }
];

async function createSquad() {
  const res = await fetch('https://api.vapi.ai/squad', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VAPI_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Builders Risk — Unified EN Squad',
      members: [
        { assistantId: GRACE_UNIFIED_ID, assistantDestinations: graceDestinations },
        { assistantId: JENNIFER_ID },
        { assistantId: SARAH_ID },
        { assistantId: WENDY_ID },
        { assistantId: NORA_ID },
        { assistantId: RACHEL_ID },
        { assistantId: BR_PROXY_ID }
      ]
    })
  });

  const data = await res.json();
  if (data.id) {
    console.log('BR Unified Squad created successfully!');
    console.log('   Squad ID:', data.id);
    console.log('   Name:', data.name);
    console.log('   Members:', data.members.length);
    console.log('\nNext step:');
    console.log('   Run scripts/update-squad-test-add-br-unified.js to add Grace BR Unified to the Test Dispatcher Squad for QA.');
    console.log('\nDO NOT attach phone number +18882934492 to this squad until Phase 3 cut-over.');
  } else {
    console.error('Error creating squad:', JSON.stringify(data, null, 2));
    process.exit(1);
  }
}

createSquad();
