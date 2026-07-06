const VAPI_KEY = process.env.VAPI_KEY;
if (!VAPI_KEY) { console.error('VAPI_KEY env var is not set. Copy .env.example to .env and export it.'); process.exit(1); }

const API_KEY = process.env.CALFORCE_AGENT_KEY;
if (!API_KEY) { console.error('CALFORCE_AGENT_KEY env var is not set. Copy .env.example to .env and export it.'); process.exit(1); }

// Angie's Calendly event_type_uuid (pinned in URL query so the LLM never sees it)
const ANGIE_UUID = '901112a8-95fa-40bc-8f30-e6c99ae4276c';
const BASE = 'https://farmerbrown-bi.calforce.pro/api/calendly';

const TZ_ENUM = [
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Anchorage',
  'America/Phoenix',
  'America/St_Johns',
  'Pacific/Honolulu',
  'UTC'
];

async function createTool(body, label) {
  const res = await fetch('https://api.vapi.ai/tool', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VAPI_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (data.id) {
    console.log(`${label} created — ID: ${data.id}`);
    return data.id;
  }
  console.error(`${label} failed:`, JSON.stringify(data, null, 2));
  process.exit(1);
}

async function main() {
  // 1. check_availability_angie
  const checkBody = {
    type: 'apiRequest',
    name: 'check_availability_angie',
    url: `${BASE}/available_times?agent_api_key=${API_KEY}&event_type_uuid=${ANGIE_UUID}&timezone={{timezone}}`,
    method: 'GET',
    function: {
      name: 'check_availability_angie',
      description: "Get Angie's specific Calendly availability for the next 6 days. Call this before offering appointment times. Present 2-3 options naturally. Ask the caller their timezone if unsure.",
      parameters: {
        type: 'object',
        properties: {
          timezone: {
            type: 'string',
            description: 'Caller timezone IANA ID. Common US: America/New_York (Eastern), America/Chicago (Central), America/Denver (Mountain), America/Los_Angeles (Pacific). Ask the caller if unsure.',
            enum: TZ_ENUM
          }
        },
        required: ['timezone']
      }
    }
  };

  // 2. book_appointment_angie
  const bookBody = {
    type: 'apiRequest',
    name: 'book_appointment_angie',
    url: `${BASE}/book_event?agent_api_key=${API_KEY}&event_type_uuid=${ANGIE_UUID}`,
    method: 'POST',
    function: {
      name: 'book_appointment_angie',
      description: "Book a Calendly appointment with Angie specifically. Call after the caller picks a time from the available slots returned by check_availability_angie. Confirm the booking with day, time, and email.",
      parameters: {
        type: 'object',
        properties: {
          name:         { type: 'string', description: 'Full name of the caller' },
          email:        { type: 'string', description: 'Email address of the caller' },
          timezone:     { type: 'string', description: 'Caller timezone IANA ID', enum: TZ_ENUM },
          start_time:   { type: 'string', description: 'Selected appointment time in ISO8601 UTC format, e.g. 2026-04-25T14:00:00Z. MUST be one of the times returned by check_availability_angie.' },
          phone_number: { type: 'string', description: 'Phone number of the caller' }
        },
        required: ['name', 'email', 'timezone', 'start_time']
      }
    },
    body: {
      type: 'object',
      required: ['name', 'email', 'start_time'],
      properties: {
        name:         { type: 'string' },
        email:        { type: 'string' },
        timezone:     { type: 'string' },
        start_time:   { type: 'string' },
        phone_number: { type: 'string' }
      }
    }
  };

  console.log('Creating Angie-specific Calendly tools...\n');
  const checkId = await createTool(checkBody, 'check_availability_angie');
  const bookId  = await createTool(bookBody,  'book_appointment_angie');
  console.log('\nDone.');
  console.log('\n>>> Add these to Rachel:');
  console.log(`    check_availability_angie: '${checkId}'`);
  console.log(`    book_appointment_angie:   '${bookId}'`);
}

main();
