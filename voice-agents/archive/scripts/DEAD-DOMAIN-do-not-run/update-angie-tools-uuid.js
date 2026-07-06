const VAPI_KEY = process.env.VAPI_KEY;
if (!VAPI_KEY) { console.error('VAPI_KEY env var is not set. Copy .env.example to .env and export it.'); process.exit(1); }

const TOOLS = {
  check_availability_angie: '253df17f-2b43-4880-ad51-d5a3f2a4e655',
  book_appointment_angie:   '35ff8b09-0a1f-4694-adb7-208f2a893434'
};

const API_KEY = process.env.CALFORCE_AGENT_KEY;
if (!API_KEY) { console.error('CALFORCE_AGENT_KEY env var is not set. Copy .env.example to .env and export it.'); process.exit(1); }

const BASE = 'https://farmerbrown-bi.calforce.pro/api/calendly';
const ANGIE_UUID = '901112a8-95fa-40bc-8f30-e6c99ae4276c';

async function patchTool(id, url, label) {
  const res = await fetch(`https://api.vapi.ai/tool/${id}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${VAPI_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ url })
  });
  const data = await res.json();
  if (data.id) {
    console.log(`${label} — SUCCESS`);
    console.log(`  URL: ${data.url}`);
  } else {
    console.error(`${label} — FAILED:`, JSON.stringify(data, null, 2));
    process.exit(1);
  }
}

async function main() {
  console.log(`Updating Angie tools to new event_type_uuid: ${ANGIE_UUID}\n`);

  await patchTool(
    TOOLS.check_availability_angie,
    `${BASE}/available_times?agent_api_key=${API_KEY}&event_type_uuid=${ANGIE_UUID}&timezone={{timezone}}`,
    'check_availability_angie'
  );

  await patchTool(
    TOOLS.book_appointment_angie,
    `${BASE}/book_event?agent_api_key=${API_KEY}&event_type_uuid=${ANGIE_UUID}`,
    'book_appointment_angie'
  );

  console.log('\nDone.');
}

main();
