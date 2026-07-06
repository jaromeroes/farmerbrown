/**
 * Site catalogue + customer-facing architecture data for /portal/system.
 *
 * Two consumers:
 *   1. `resolveSite()` + `SiteInfo` — used by CallsTable / CallDetailHeader
 *      to look up the BR/CL/FB code for a call based on its website name.
 *   2. Everything below — feeds the /portal/system page rendering.
 *
 * Why we hard-code the universe: 3 sites + a handful of specialists. The data
 * doesn't churn week to week; a TS module beats a CMS for this.
 */

/* ───────── Sites — kept stable for callers outside this file ───────── */

export interface SiteInfo {
  code: 'BR' | 'CL' | 'FB';
  website: string;
}

export interface SystemSite {
  code: 'BR' | 'CL' | 'FB';
  websiteName: string;
  websiteDomain: string;
  phoneNumber: string;       // E.164
  phoneDisplay: string;      // human-formatted
  agentName: string;
  status: 'live' | 'imminent' | 'planning';
}

export const SYSTEM_SITES: readonly SystemSite[] = [
  {
    code: 'BR',
    websiteName: 'Builders Risk',
    websiteDomain: 'buildersrisk.net',
    phoneNumber: '+18882934492',
    phoneDisplay: '+1 (888) 293-4492',
    agentName: 'Grace',
    status: 'live',
  },
  {
    code: 'CL',
    websiteName: "Contractor's Liability",
    websiteDomain: 'contractorsliability.com',
    phoneNumber: '+18884356365',
    phoneDisplay: '+1 (888) 435-6365',
    agentName: 'Olivia',
    status: 'live',
  },
  {
    code: 'FB',
    websiteName: 'Farmer Brown',
    websiteDomain: 'farmerbrown.com',
    phoneNumber: '+18884962029',
    phoneDisplay: '+1 (888) 496-2029',
    agentName: 'Emma',
    status: 'imminent',
  },
];

const SITES_BY_WEBSITE_NAME: Record<string, SiteInfo> = Object.fromEntries(
  SYSTEM_SITES.map((s) => [
    s.websiteName,
    { code: s.code, website: s.websiteDomain },
  ]),
);

export function resolveSite(websiteName: string | null | undefined): SiteInfo | null {
  if (!websiteName) return null;
  return SITES_BY_WEBSITE_NAME[websiteName] ?? null;
}

/* ───────── Hero ───────── */

export const HERO = {
  eyebrow: 'Call Center Architecture · As of 2026-05-19',
  title: 'AI-powered call center',
  subtitle:
    'Three customer-facing sites, three toll-free numbers, and a tiered roster of specialist agents that qualify, quote, schedule, and now also collect underwriting data — keeping live agents focused on closing.',
} as const;

export const HERO_STATS: ReadonlyArray<{ num: string; label: string }> = [
  { num: '3', label: 'Sites / Lines' },
  { num: '4', label: 'Agent tiers' },
  { num: '6', label: 'Coverage lines' },
  { num: 'EN+ES', label: 'Languages' },
];

/* ───────── 02 · Tiers ───────── */

export interface Tier {
  tier: string;
  name: string;
  description: string;
  variant: 'l2' | 'l3' | 'l4' | 'escape';
}

export const TIERS: readonly Tier[] = [
  {
    tier: 'Tier L2',
    name: 'Receptionist',
    description:
      'Greets the caller, identifies brand, triages intent (new quote / existing policy / specific person / Spanish), and routes.',
    variant: 'l2',
  },
  {
    tier: 'Tier L3',
    name: 'Specialist',
    description:
      'Owns one coverage line. Qualifies the lead, asks underwriting questions, delivers a price in-call when possible, books an appointment.',
    variant: 'l3',
  },
  {
    tier: 'Tier L4 · New',
    name: 'Binding info',
    description:
      'Runs after the price is delivered. Collects the additional underwriting data needed to firm up pricing and bind the policy. Ends with a payment appointment.',
    variant: 'l4',
  },
  {
    tier: 'Always on',
    name: 'Live agent',
    description:
      'At any moment, the caller can ask for a live agent (or trigger a fallback by being silent). The call is transferred immediately — no menu loops.',
    variant: 'escape',
  },
];

/* ───────── 03 · Receptionist triage ───────── */

export interface TriageIntent {
  saying: string;
  doing: string;
}

export const TRIAGE_INTENTS: readonly TriageIntent[] = [
  {
    saying: '"I\'m looking for a new quote"',
    doing:
      'Asks what coverage and routes to the matching specialist (Jennifer, Sarah, Nora, Rachel, or Wendy).',
  },
  {
    saying: '"I already have a quote from you"',
    doing:
      'Hot-lead path — forwards to the dedicated existing-quote team (5× higher conversion than service calls).',
  },
  {
    saying:
      '"I\'m an existing policy holder" or asks about payment, claim, certificate',
    doing:
      'Service path — forwards to the dedicated service team or, for certificates of insurance, runs the conversational COI flow.',
  },
  {
    saying: "A specific person's name (Pedro, Gustavo, …)",
    doing:
      "Internal directory — looks up the person's direct number (currently 18 of 20 wired) and dials them. Falls back to live agent if the name doesn't match.",
  },
  {
    saying: '"En español, por favor"',
    doing:
      'Forwards to the Spanish-speaking team line (cross-site, shared by all three brands).',
  },
  {
    saying: '"I want to talk to a live agent"',
    doing:
      "Immediate transfer to the brand's live-agent line — no menu, no follow-up.",
  },
];

/* ───────── 04 · Specialists ───────── */

export interface SpecialistV5 {
  name: string;
  coverage: string;
  language: 'English' | 'Spanish';
  quoteInCall: { kind: 'yes' | 'no' | 'na'; note: string };
  booksAppointment: string;
  status: 'live' | 'in-test';
}

export const SPECIALISTS_V5: readonly SpecialistV5[] = [
  {
    name: 'Jennifer',
    coverage: "Builder's Risk",
    language: 'English',
    quoteInCall: { kind: 'yes', note: 'instant' },
    booksAppointment: 'Yes · round-robin',
    status: 'live',
  },
  {
    name: 'Sarah',
    coverage: 'General Liability',
    language: 'English',
    quoteInCall: { kind: 'yes', note: 'instant' },
    booksAppointment: 'Yes · round-robin',
    status: 'live',
  },
  {
    name: 'Valeria',
    coverage: 'General Liability',
    language: 'Spanish',
    quoteInCall: { kind: 'yes', note: 'instant' },
    booksAppointment: 'Yes · round-robin',
    status: 'live',
  },
  {
    name: 'Nora',
    coverage: 'Commercial Auto',
    language: 'English',
    quoteInCall: { kind: 'no', note: 'transfer for pricing' },
    booksAppointment: '—',
    status: 'live',
  },
  {
    name: 'Rachel',
    coverage: 'Home & Auto',
    language: 'English',
    quoteInCall: { kind: 'no', note: 'short intake' },
    booksAppointment: 'Yes · with our pros',
    status: 'live',
  },
  {
    name: 'Wendy',
    coverage: "Workers' Compensation",
    language: 'English',
    quoteInCall: { kind: 'yes', note: 'when zero W-2 employees' },
    booksAppointment: 'Yes · round-robin',
    status: 'live',
  },
  {
    name: 'Rebecca · GL',
    coverage: 'Binding Info (post-quote)',
    language: 'English',
    quoteInCall: { kind: 'na', note: 'binding-only' },
    booksAppointment: 'Yes · service rep',
    status: 'in-test',
  },
  {
    name: 'Bryan',
    coverage: 'Surety Bonds (license/permit · bid · payment & performance)',
    language: 'English',
    quoteInCall: { kind: 'no', note: 'Tom calls back with pricing' },
    booksAppointment: 'No · direct callback',
    status: 'in-test',
  },
];

export const SPECIALISTS_TEST_LINE = {
  phone: '+1 (702) 710-8075',
  note:
    'Both Rebecca and Bryan are deployed in a test environment and callable on the QA line. The test line opens with a dispatcher that asks "Rebecca for binding questions, or Bryan for bonds — which one are you here for?", so a single number covers both for demo purposes.',
} as const;

/* ───────── 05 · Sales flow ───────── */

export interface FlowStage {
  tag: string;
  variant: 'l2' | 'l3' | 'l4' | 'gate' | 'cs' | 'escape';
  who: string;
  what: string;
}

export const SALES_FLOW: readonly FlowStage[] = [
  {
    tag: 'L2',
    variant: 'l2',
    who: 'Receptionist (Grace · Olivia · Emma)',
    what:
      'Greets brand-specifically. Offers four branches: new quote, existing quote, existing policy, specific person — plus a Spanish offer at the end.',
  },
  {
    tag: 'L3',
    variant: 'l3',
    who: 'Specialist (Jennifer · Sarah · Nora · Rachel · Wendy · Valeria)',
    what:
      'Qualifies, asks the coverage-specific underwriting questions, delivers a price in-call where possible. For Commercial Auto and Home & Auto, transfers or schedules with our team instead.',
  },
  {
    tag: 'GATE',
    variant: 'gate',
    who: 'Post-price gate question (NEW — GL first)',
    what:
      '"Would you like to answer a few additional questions to qualify for this price along with monthly payment options?"',
  },
];

export const SALES_GATE_BRANCHES = {
  yes: {
    label: 'Yes — continue to L4',
    text: 'Specialist hands off to Rebecca and steps out.',
  },
  no: {
    label: 'No — cordial close',
    text:
      '"No problem — be on the lookout for more quotes in your email. Call back anytime and ask for \'existing quote\'."',
  },
} as const;

export const SALES_FLOW_POST_GATE: readonly FlowStage[] = [
  {
    tag: 'L4',
    variant: 'l4',
    who: 'Rebecca — Binding Info Specialist (one per product line)',
    what:
      'Collects ~22 binding questions (effective date, payment preference, operational exposure Y/N, business history Y/N). No re-quoting, no cross-sell.',
  },
  {
    tag: 'CLOSE',
    variant: 'cs',
    who: 'Service rep appointment',
    what:
      'Round-robin booking with the service-rep team to take payment and finalize the policy. Closing line: "We\'ll be firming up pricing with underwriting and emailing you an application to sign within the hour."',
  },
];

export const ALT_ENTRY_CS_FORWARD = {
  eyebrow: 'Alternate entry · CS forward',
  title: 'A returning caller can be dropped into Rebecca directly',
  body:
    'If a Customer Service agent is on the phone with someone who already received a quote, they can forward the caller straight into Rebecca via a dedicated public number — bypassing the receptionist and the specialist. The caller picks up the binding flow exactly where Rebecca starts.',
} as const;

/* ───────── 06 · Service flow ───────── */

export interface ServiceIntent {
  intent: string;
  outcome: string;
}

export const SERVICE_INTENTS: readonly ServiceIntent[] = [
  {
    intent: 'Certificate of insurance',
    outcome:
      'Conversational COI flow — identifies policyholder, collects additional-insured details, asks about endorsements, offers expedited (1-hour) turnaround in exchange for a review, cross-sells Home & Auto at the end.',
  },
  {
    intent: 'Payment',
    outcome: 'Routed to the dedicated service team line for billing handling.',
  },
  {
    intent: 'Claim',
    outcome:
      'Routed to the dedicated service team line with a claim-specific opener.',
  },
  {
    intent: '"Live agent"',
    outcome: 'Immediate transfer — no menu repeat, no follow-up question.',
  },
];

/* ───────── 07 · Bonds ───────── */

export interface BondType {
  name: string;
  meta: string;
  bullets: readonly string[];
}

export const BOND_TYPES: readonly BondType[] = [
  {
    name: 'License or permit bond',
    meta: 'Most common · variable price',
    bullets: [
      'Required by state/city/town to register as a contractor (general, roofing, HVAC, etc.).',
      'Pricing: ~$100–250/year for permit bonds, $150–$3,000+ for state license bonds depending on credit.',
      'SSN/ITIN required if bond > $25k or in AZ, CA, FL, MD, NJ, WA.',
    ],
  },
  {
    name: 'Bid bond',
    meta: 'Free · hard qualification',
    bullets: [
      'Required by the project owner when a contractor bids on a contract.',
      'Cost: free (supplied at no cost).',
      'Hard requirements: more than 1 year in business · credit score > 700 · no bankruptcy. No workarounds.',
    ],
  },
  {
    name: 'Payment & performance bond',
    meta: '3% of contract · hard qualification',
    bullets: [
      'Required by the project owner once a contract is awarded.',
      'Cost: 3% of contract price (e.g. $150k contract → $4,500 bond).',
      'Same hard requirements as bid bond.',
    ],
  },
];

export const BONDS_FLOW: readonly FlowStage[] = [
  {
    tag: 'L3',
    variant: 'l3',
    who: 'Bryan — Bonds intake specialist',
    what:
      'Asks 6 common questions (business name, address, owner, email, phone, bond type) then branches based on bond type. Reads the bond category, runs hard-qualification gate where applicable, collects the rest of the data.',
  },
  {
    tag: 'CLOSE',
    variant: 'cs',
    who: 'Email to Bonding Specialist · direct callback',
    what:
      'Bryan promises a callback from the Bonding Specialist with final pricing. No CRM, no Calendly — the Bonding Specialist calls back manually within the hour. Callers who ask for a live agent at any point are transferred directly.',
  },
];

export const BONDS_HARD_QUAL_FAIL: FlowStage = {
  tag: 'ALT',
  variant: 'escape',
  who: 'Hard-qualification failure (bid · payment & performance)',
  what:
    "If the caller fails any of the three hard requirements (under 1 year in business, credit < 700, prior bankruptcy), Bryan politely declines and offers to refer them to other coverage we sell (General Liability, Workers' Comp, etc.) — or closes the call cordially. No workaround per our Bonding Specialist's policy.",
};

export const BONDS_OPEN_DECISION = {
  eyebrow: 'Biggest open decision · needs John',
  title:
    'Does Bonds get its own toll-free number under UnitedSuretyBonds.com?',
  body:
    'The single biggest architectural decision for Bonds is whether the product gets a dedicated public number (like buildersrisk.net has +1 888 293-4492) or whether "Bonds" becomes another option in the receptionist menu of the existing three brand lines. The first option preserves brand separation; the second concentrates traffic on three numbers. We need this answered before wiring Bryan into production.',
} as const;

/* ───────── 08 · Spanish ───────── */

export const SPANISH_FLOW: readonly FlowStage[] = [
  {
    tag: 'L2',
    variant: 'l2',
    who: 'English receptionist (Grace / Olivia / Emma)',
    what:
      'Ends the greeting with: "If you\'d prefer to be helped in Spanish, just let me know."',
  },
  {
    tag: '→',
    variant: 'cs',
    who: 'Spanish-speaking team line (shared)',
    what:
      'Cross-site — receives Spanish callers from all three brands. A Spanish-speaking team member picks up.',
  },
];

/* ───────── 09 · Architectural decision ───────── */

export const ARCH_DECISION = {
  eyebrow: 'Decided · 2026-05-19',
  title:
    'Per-product Binding Info agent, not one shared multi-product agent',
  intro:
    'Each coverage line that adopts the Binding stage will have its own Rebecca with its own product-specific question list. Rebecca-GL ships first; Rebecca-BR is next per John\'s note. The alternative — one Rebecca with branches for all five products — was rejected because:',
  reasons: [
    {
      title: 'Cost efficiency.',
      text:
        'The conversational model reloads its full instruction set on every turn. A focused 22-question Rebecca is cheaper per call than a multi-line agent carrying all five products\' branches — and the saving compounds over the entire L4 leg.',
    },
    {
      title: 'Operational clarity.',
      text:
        'Specialists today (Jennifer, Sarah, Nora, Wendy, Rachel) are each one agent per product. Rebecca follows the same pattern — no new mental model.',
    },
    {
      title: 'Independent iteration.',
      text:
        'John tweaks binding questions per product. Per-product agents mean no regression risk to other lines on every change.',
    },
  ],
} as const;

/* ───────── 10 · Roadmap ───────── */

export interface RoadmapItem {
  bucket: 'in-test' | 'near-term' | 'future';
  status: 'In test' | 'Imminent' | 'Planning' | 'Future';
  title: string;
  desc: string;
}

export const ROADMAP: readonly RoadmapItem[] = [
  {
    bucket: 'in-test',
    status: 'In test',
    title: 'Rebecca-GL · post-price Binding Info flow',
    desc:
      'A 22-question post-quote stage for General Liability. Already deployed in test and callable on the QA line. Seven open items pending with you before production deploy (see §12 below). Backend endpoint and service-rep round-robin calendar still to be built.',
  },
  {
    bucket: 'in-test',
    status: 'In test',
    title: 'Bryan · surety bonds intake under UnitedSuretyBonds.com',
    desc:
      'First-contact bonds agent — 6 common questions + branches for license/permit, bid, payment & performance. Already deployed in test and callable on the QA line. Four open items pending with you before production deploy (see §12 below). Backend endpoint to email the Bonding Specialist still to be built.',
  },
  {
    bucket: 'near-term',
    status: 'Imminent',
    title: 'Activate the farmerbrown.com toll-free',
    desc:
      "+1 (888) 496-2029 ready on Emma's side; needs to be re-pointed from its current legacy destination. Becomes the third active brand line.",
  },
  {
    bucket: 'near-term',
    status: 'Planning',
    title: "Rebecca-BR · Builder's Risk binding (next Rebecca)",
    desc:
      "You have signaled a shorter Builder's Risk binding question list to follow Rebecca-GL. List pending — once we have it, Rebecca-BR ships in the same shape as Rebecca-GL.",
  },
  {
    bucket: 'near-term',
    status: 'Planning',
    title: 'Warm transfer with context (specific-person hand-offs)',
    desc:
      'When the receptionist transfers a caller to a specific person internally, the receiver should hear a brief context summary first ("you have a caller asking about a Builder\'s Risk quote, name…"). Specced; pending implementation.',
  },
  {
    bucket: 'future',
    status: 'Future',
    title: 'Spanish specialists beyond Valeria',
    desc:
      'Today Spanish callers on non-GL lines are routed to a human Spanish team. A natural next step is Spanish-speaking equivalents of Jennifer, Nora, Wendy, and Rachel.',
  },
  {
    bucket: 'future',
    status: 'Future',
    title: 'Service flow expansion — payment + claim handled in-call',
    desc:
      'Today only COI is handled conversationally on the service side. Payment and claim could follow similar patterns once backend integrations exist.',
  },
];

/* ───────── 11 · Backend integrations pending ───────── */

export interface BackendDep {
  title: string;
  desc: string;
}

export const BACKEND_DEPS: readonly BackendDep[] = [
  {
    title: 'Service-rep round-robin calendar',
    desc:
      'New scheduling pool for service reps that take payment and bind policies — used by Rebecca at the end of the binding flow. Separate pool from the Home & Auto schedulers and the existing General Liability buy-now appointments.',
  },
  {
    title: 'Binding info data endpoint',
    desc:
      "Receives Rebecca's 22-field payload at the end of the binding flow. Same data-pattern as today's quote submissions.",
  },
  {
    title: 'Certificate-of-insurance data endpoint',
    desc:
      'Receives the captured COI data from the conversational COI flow. Currently the data lives only in the call transcript until manually processed.',
  },
  {
    title: 'Expedited-COI urgent alert',
    desc:
      'When a caller opts into the 1-hour expedited COI in exchange for a review, the ops team needs an immediate notification (email + Slack proposed).',
  },
  {
    title: 'Review-link and Home & Auto application SMS triggers',
    desc:
      'Sent at the end of the COI flow when the caller agrees to the expedited quid-pro-quo, and when the caller accepts the Home & Auto cross-sell.',
  },
  {
    title: 'Bonds data endpoint',
    desc:
      'Emails Tom Hester (Bonding Specialist) with the captured bond information at the end of the future Bonds flow. No CRM integration needed — Tom calls and closes manually.',
  },
  {
    title: 'Final lead destination — Hawksoft',
    desc:
      'All qualified leads ultimately need to land in Hawksoft. Today they reach the team via transcripts and per-flow submissions. Direct Hawksoft integration is the medium-term destination.',
  },
];

/* ───────── 12 · Open decisions ───────── */

export interface OpenDecision {
  group: 'rebecca-gl' | 'bryan';
  num: string;
  title: string;
  desc: string;
}

export const OPEN_DECISIONS: readonly OpenDecision[] = [
  // Rebecca-GL (7)
  {
    group: 'rebecca-gl',
    num: '01',
    title: 'Real existing-quote phone number for the gate-No close',
    desc:
      'When a caller declines the gate question, Sarah says "call us back and ask for an existing quote." What\'s the public number we direct them to?',
  },
  {
    group: 'rebecca-gl',
    num: '02',
    title: 'Calendly setup for the service-rep team',
    desc:
      'Rebecca needs a Calendly event type to book the payment-and-binding appointment. Is it round-robin across a service-rep team, or a single person? Separate pool from Angie/Andrés and from the GL Buy Now appointments.',
  },
  {
    group: 'rebecca-gl',
    num: '03',
    title: 'Confirm the "AI in RED" annotation',
    desc:
      "Your binding doc has a stray duplicate \"Do you use heavy equipment\" question marked in red. We're reading that as a removal flag — confirm before we deploy.",
  },
  {
    group: 'rebecca-gl',
    num: '04',
    title: 'Gate vs current Sarah cross-sell',
    desc:
      "Sarah currently cross-sells right after the quote. We're assuming the gate REPLACES that cross-sell on GL (binding is a higher-value path and the combined flow would lose callers). Confirm.",
  },
  {
    group: 'rebecca-gl',
    num: '05',
    title: '"Qualify for this price" — literal or psychological?',
    desc:
      'Does the price actually require the binding answers to hold (underwriting could modify), or is the framing a pure conversion device? Affects what we say if a caller bails mid-Rebecca.',
  },
  {
    group: 'rebecca-gl',
    num: '06',
    title: 'CS-to-Rebecca transfer mechanics',
    desc:
      'When a CS agent has a returning caller with a quote on file, how do they get the caller into Rebecca? Dedicated public number that drops them straight into Rebecca? Warm transfer with context? For v1 the dedicated-number option is simplest.',
  },
  {
    group: 'rebecca-gl',
    num: '07',
    title: 'Cross-sell at the end of Rebecca',
    desc:
      "Your closing line doesn't mention cross-sell. Default assumption: no cross-sell on Rebecca (caller is moving to bind, not compare). Confirm.",
  },
  // Bryan (4)
  {
    group: 'bryan',
    num: '08',
    title: 'Domain and phone-line strategy for Bonds',
    desc:
      'Biggest open decision. Does UnitedSuretyBonds.com get its own dedicated toll-free, or does "Bonds" become a menu option on the existing three brand lines? Changes the whole routing architecture.',
  },
  {
    group: 'bryan',
    num: '09',
    title: 'What to say when a caller fails the hard qualification',
    desc:
      'For bid and payment & performance bonds, the hard requirements (>1 yr in business, credit >700, no bankruptcy) have no workaround. If a caller fails, do we (a) thank-and-end politely, (b) cross-sell other coverage we sell (GL, WC, etc.), or (c) transfer to our Bonding Specialist anyway in case there\'s a workaround we don\'t know about?',
  },
  {
    group: 'bryan',
    num: '10',
    title: 'Cross-sell at the end of Bryan',
    desc:
      'Every other line in the call center does end-of-call cross-sell except Home & Auto. Default assumption: Bonds inherits the standard cross-sell. Confirm.',
  },
  {
    group: 'bryan',
    num: '11',
    title: 'Bonding Specialist unavailable — what\'s the fallback?',
    desc:
      "Today the Bonding Specialist is a single destination. If he's out, on another call, or after-hours, what should Bryan do? Voicemail at his line, fallback to the generic live-agent number, offer a Calendly callback, or email-only and rely on the Bonding Specialist to call back?",
  },
];
