/**
 * Unit tests for src/lib/leadEmail.ts — pure, no network.
 * Run: node scripts/test-lead-email.ts
 */
import {
  extractLead,
  reachedJenniferWithData,
  renderLeadBodyHtml,
  renderLeadText,
  leadSubject,
} from '../src/lib/leadEmail.ts';

let pass = 0;
let fail = 0;
function ok(cond: boolean, msg: string) {
  if (cond) {
    pass++;
  } else {
    fail++;
    console.error('  ✗ ' + msg);
  }
}

function sq(args: Record<string, unknown>, asObject = false) {
  return {
    role: 'tool_calls',
    toolCalls: [
      {
        id: 'tc',
        type: 'function',
        function: { name: 'submit_quote', arguments: asObject ? args : JSON.stringify(args) },
      },
    ],
  };
}

// ── Fixture: full renovation quote across 2 checkpoints (string args) ─────────
const fullQuote = {
  id: 'test-full',
  startedAt: '2026-06-27T10:00:00.000Z',
  endedAt: '2026-06-27T10:06:30.000Z',
  endedReason: 'customer-ended-call',
  customer: { number: '+13125551234' },
  recordingUrl: 'https://storage.vapi.ai/test-full.wav',
  analysis: { summary: 'Michael Donovan requested a renovation quote in Austin TX.' },
  artifact: {
    transcript: 'AI: Hi there. Thanks for calling Builders Risk.\nUser: I need a quote.',
    messages: [
      { role: 'system', message: 'prompt' },
      { role: 'bot', message: 'Hi there.' },
      { role: 'user', message: 'New quote.' },
      sq({
        email: 'michael@example.com',
        builders_risk_submission: {
          first_name: 'Michael',
          last_name: 'Donovan',
          phone: '555-123-4567',
          company_name: 'Donovan Construction LLC',
          sms_consent: true,
        },
      }),
      { role: 'tool_call_result', message: 'ok' },
      sq({
        email: 'michael@example.com',
        builders_risk_submission: {
          first_name: 'Michael',
          last_name: 'Donovan',
          project_type: 'Renovation',
          building_coverage: '630000',
          deductible: '$2,500',
          construction_type: 'Frame',
          near_coast: 'No',
          claims_in_past_2_years: 'No',
          is_high_risk: false,
          existing_structure_age_years: 35,
          annual_premium: 3850,
          weird_custom_field: 'keep me',
          nested_obj: { perils: ['fire', 'flood'] },
        },
      }),
    ],
  },
};

console.log('fullQuote:');
ok(reachedJenniferWithData(fullQuote), 'reachedJenniferWithData true');
const lead = extractLead(fullQuote);
ok(lead.email === 'michael@example.com', 'email merged');
ok(lead.fields.last_name === 'Donovan', 'last_name merged');
ok(lead.fields.company_name === 'Donovan Construction LLC', 'company merged from CP1');
ok(lead.fields.project_type === 'Renovation', 'project_type merged from CP2');
ok(lead.premium === 3850, 'premium parsed as number');
ok(lead.durationSec === 390, 'duration computed (6m30s = 390s)');
ok(lead.callerNumber === '+13125551234', 'caller number');
ok(/C[DS]T/.test(renderLeadBodyHtml(lead)), 'When shown in US Central (CST/CDT)');
const subj = leadSubject(lead);
ok(subj.includes('Michael Donovan'), 'subject has name');
ok(subj.includes('Renovation'), 'subject has project type');
ok(subj.includes('quote $3,850'), 'subject has quote: ' + subj);
const html = renderLeadBodyHtml(lead);
ok(html.includes('Annual premium quoted'), 'html premium banner');
ok(html.includes('$3,850'), 'html premium value');
ok(html.includes('Donovan Construction LLC'), 'html company');
ok(html.includes('keep me'), 'html keeps unknown field (no silent drop)');
ok(html.includes('{&quot;perils&quot;:[&quot;fire&quot;,&quot;flood&quot;]}'), 'object field JSON-serialized + escaped, not [object Object]');
ok(!html.includes('[object Object]'), 'no [object Object] leak');
ok(html.includes('Thanks for calling Builders Risk'), 'html has transcript');
ok(html.includes('Michael Donovan requested'), 'html has summary');
// Recording / platform must NEVER appear (fixture recordingUrl is storage.vapi.ai).
ok(!/vapi/i.test(html), 'html has NO vapi reference anywhere');
ok(!/recording/i.test(html), 'html has NO recording reference');
ok(!/storage\.vapi\.ai/.test(html), 'html has NO recording link');
const text = renderLeadText(lead);
ok(text.includes('NEW BUILDERS RISK LEAD — Michael Donovan'), 'text header');
ok(text.includes('Annual premium quoted: $3,850'), 'text premium');
ok(!/vapi/i.test(text), 'text has NO vapi reference anywhere');
ok(!/recording/i.test(text), 'text has NO recording reference');

// ── Fixture: args passed as object (not stringified) ─────────────────────────
const objArgs = {
  id: 'test-obj',
  artifact: {
    transcript: 'AI: hi',
    messages: [
      sq(
        { email: 'jane@example.com', builders_risk_submission: { first_name: 'Jane', phone: '999' } },
        true
      ),
    ],
  },
};
console.log('objArgs:');
ok(reachedJenniferWithData(objArgs), 'object-args reached true');
ok(extractLead(objArgs).email === 'jane@example.com', 'object-args email');

// ── Fixture: triage hang-up, no submit_quote ─────────────────────────────────
const triage = {
  id: 'test-triage',
  artifact: {
    transcript: 'AI: Are you calling for a new quote?\nUser: [hung up]',
    messages: [
      { role: 'bot', message: 'Are you calling for a new quote?' },
      { role: 'user', message: '' },
    ],
  },
};
console.log('triage:');
ok(!reachedJenniferWithData(triage), 'triage NOT reached (no submit_quote)');

// ── Fixture: submit_quote with empty args only → not "with data" ──────────────
const emptySq = {
  id: 'test-empty',
  artifact: { transcript: 'x', messages: [sq({ email: '', builders_risk_submission: {} })] },
};
console.log('emptySq:');
ok(!reachedJenniferWithData(emptySq), 'empty submit_quote NOT counted as data');

// ── Fixture: hard-to-place (no premium, has details) ─────────────────────────
const htp = {
  id: 'test-htp',
  artifact: {
    transcript: 'x',
    messages: [
      sq({
        email: 'h@example.com',
        builders_risk_submission: {
          first_name: 'Hal',
          last_name: 'Place',
          near_coast: 'Yes',
          is_high_risk: true,
          hard_to_place_details: 'Coastal, hip roof, no shutters.',
        },
      }),
    ],
  },
};
console.log('hardToPlace:');
const htpLead = extractLead(htp);
ok(htpLead.premium === null, 'htp no premium');
ok(leadSubject(htpLead).includes('hard-to-place'), 'htp subject: ' + leadSubject(htpLead));
ok(renderLeadBodyHtml(htpLead).includes('Hard-to-place'), 'htp html banner');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
