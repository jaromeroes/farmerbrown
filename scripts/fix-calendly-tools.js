const VAPI_KEY = '7ce0a320-9cbf-4d1c-9c5a-d00dfcace63c';

const TOOLS = {
  check_availability: 'dd2504ab-c665-493f-915d-345b0696017f',
  book_appointment: '642280ea-5ea0-4d1e-a7fe-35439016de10'
};

async function fixCheckAvailability() {
  // Fix: add {{timezone}} Liquid template to URL so VAPI sends it as query param
  const res = await fetch(`https://api.vapi.ai/tool/${TOOLS.check_availability}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${VAPI_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      url: 'https://farmerbrown-bi.calforce.pro/api/calendly/available_times?agent_api_key=3a8c4681-8dbe-4cdb-a8fb-20477cfdef88&timezone={{timezone}}'
    })
  });

  const data = await res.json();
  console.log('check_availability update:', data.id ? 'SUCCESS' : 'FAILED');
  console.log('  URL:', data.url || JSON.stringify(data));
}

async function fixBookAppointment() {
  // Fix: add body JsonSchema so VAPI sends function params as POST body
  const res = await fetch(`https://api.vapi.ai/tool/${TOOLS.book_appointment}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${VAPI_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      body: {
        type: 'object',
        required: ['name', 'email', 'start_time'],
        properties: {
          name: { type: 'string', description: 'Full name of the caller' },
          email: { type: 'string', description: 'Email address of the caller' },
          timezone: { type: 'string', description: 'Caller timezone IANA ID (e.g. America/Chicago)' },
          start_time: { type: 'string', description: 'Selected appointment time in ISO8601 format e.g. 2026-03-25T14:00:00Z' },
          phone_number: { type: 'string', description: 'Phone number of the caller' }
        }
      }
    })
  });

  const data = await res.json();
  console.log('book_appointment update:', data.id ? 'SUCCESS' : 'FAILED');
  console.log('  Body schema:', data.body ? 'SET' : JSON.stringify(data));
}

async function main() {
  console.log('Fixing Calendly tools parameter mapping...\n');
  await fixCheckAvailability();
  console.log('');
  await fixBookAppointment();
  console.log('\nDone! Both tools now send parameters to the Calendly API.');
}

main();
