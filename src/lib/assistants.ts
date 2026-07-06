/**
 * VAPI ID → human-readable agent + website mapping.
 *
 * Hardcoded because Farmer Brown only has three websites today (Builders
 * Risk, Contractor's Liability, Farmer Brown). Pulling these names from
 * VAPI live would require a migration plus a per-id sub-call from the cron
 * for marginal value. If the catalogue grows past ~20 mappings or goes
 * multi-tenant, migrate to a Supabase table.
 *
 * Both assistant ids and squad ids share the same map. For a squad-only
 * call where there's no granular assistant, set `name === website` so the
 * renderer dedupes the subtitle into "from <Website>".
 *
 * To roll this out: open the VAPI dashboard, find each assistant/squad's
 * UUID, and fill it in below. Until the real UUIDs are in, `resolveAgent`
 * returns null for every call — the UI just doesn't render the subtitle,
 * which is the same as today's behaviour.
 */

export interface AgentInfo {
  name: string;
  website: string;
}

export const AGENTS_BY_ID: Record<string, AgentInfo> = {
  // Receptionists (assistants):
  'fa2897bb-00ee-4680-af00-0e31abeed228': { name: 'Grace',  website: 'Builders Risk' },
  'b5f88994-e045-4996-9f2c-056516e9cf01': { name: 'Olivia', website: "Contractor's Liability" },
  '71c72af4-b87a-43cb-8f0a-661c3febe8ea': { name: 'Emma',   website: 'Farmer Brown' },

  // Squads: name === website so the renderer dedupes to "from <Website>".
  'ab53f568-82bf-439f-8fda-d04070864632': { name: 'Builders Risk',          website: 'Builders Risk' },
  '3b29fd00-f58a-4282-9cb3-c26c393a7858': { name: "Contractor's Liability", website: "Contractor's Liability" },
  '5cf7afbf-cee7-45cd-8fa1-9ff2989d8e28': { name: 'Farmer Brown',           website: 'Farmer Brown' },
};

/**
 * Pick the best label for a call: prefer the specific assistant (more
 * granular), fall back to the squad. Returns null when neither side has
 * a known mapping — caller renders no subtitle.
 */
export function resolveAgent(
  assistantId: string | null,
  squadId: string | null,
): AgentInfo | null {
  if (assistantId && AGENTS_BY_ID[assistantId]) return AGENTS_BY_ID[assistantId];
  if (squadId && AGENTS_BY_ID[squadId])         return AGENTS_BY_ID[squadId];
  return null;
}

/**
 * Format the curated agent for display. Dedupes when `name === website`
 * so squad-only entries render as "<Website>" rather than
 * "<Website> · <Website>". Caller decides any prefix (e.g. "from ").
 *
 * Returns null for null input — caller renders no subtitle.
 */
export function formatAgentLabel(agent: AgentInfo | null): string | null {
  if (!agent) return null;
  if (agent.name === agent.website) return agent.website;
  return `${agent.website} · ${agent.name}`;
}
