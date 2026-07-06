// Universal squad-destination name sync.
//
// Bug class this addresses (feedback_squad_name_resolution.md):
//   A squad references its destinations by `assistantName` STRING (NOT by id —
//   destinations have no assistantId field; VAPI validates the string against
//   the live name of the squad-member assistant at call start). If a member
//   assistant has been renamed and the destination string wasn't co-updated,
//   the squad fails to load → caller falls through to the phone number's
//   fallbackDestination. Silent failure, looks like a real handoff.
//
// What this script does:
//   1. Lists all squads in the org.
//   2. For each squad:
//        - Builds the set of CURRENT live names of all squad members
//          (`members[].assistantId` → `/assistant/{id}.name`).
//        - For each destination string, checks if it exactly matches one of
//          those live names. If not, tries to identify which member it
//          "meant" via a first-word match on the agent name (e.g. a
//          destination "Jennifer — Builders Risk v2.3" maps to whichever
//          member's current name starts with "Jennifer — ").
//   3. PATCHes every squad with stale references in one transaction per squad,
//      updating only the stale `assistantName` strings.
//
// Idempotent: re-running with everything in sync is a clean no-op.

const VAPI_KEY = process.env.VAPI_KEY;
if (!VAPI_KEY) {
  console.error('VAPI_KEY env var is not set.');
  process.exit(1);
}

async function vapi(method, path, body) {
  const res = await fetch(`https://api.vapi.ai${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${VAPI_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { _raw: text }; }
  if (!res.ok) {
    throw new Error(`VAPI ${method} ${path} failed (${res.status}): ${JSON.stringify(data).slice(0, 500)}`);
  }
  return data;
}

async function main() {
  console.log('Fetching all squads…');
  const squads = await vapi('GET', '/squad?limit=50');
  console.log(`Found ${squads.length} squads.\n`);

  // Cache assistant lookups so we don't hit the API for the same ID multiple times.
  const assistantCache = new Map();
  async function getAssistantName(id) {
    if (assistantCache.has(id)) return assistantCache.get(id);
    const a = await vapi('GET', `/assistant/${id}`);
    assistantCache.set(id, a.name);
    return a.name;
  }

  // Match a destination's stale name to the right live member name.
  //   Strategy: take everything up to the first ' — ' (em-dash) as the
  //   "agent identity" (e.g. "Jennifer", "Grace", "FB Live Agent Handoff").
  //   Find a unique live name with the same prefix → that's the match.
  function agentKey(name) {
    const idx = name.indexOf(' — ');
    return idx > 0 ? name.slice(0, idx) : name;
  }

  const squadsToFix = [];
  const unmatched = []; // for reporting

  for (const squad of squads) {
    // Build the list of CURRENT names for this squad's members.
    const liveNames = [];
    for (const member of (squad.members || [])) {
      if (!member.assistantId) continue;
      liveNames.push(await getAssistantName(member.assistantId));
    }
    const liveNameSet = new Set(liveNames);

    const staleDests = []; // { memberIdx, destIdx, oldName, newName }
    for (let mi = 0; mi < (squad.members || []).length; mi++) {
      const member = squad.members[mi];
      for (let di = 0; di < (member.assistantDestinations || []).length; di++) {
        const dest = member.assistantDestinations[di];
        if (!dest.assistantName) continue;
        // Already matches a live name? Skip.
        if (liveNameSet.has(dest.assistantName)) continue;

        // Try to find a unique live name with the same agent identity prefix.
        const key = agentKey(dest.assistantName);
        const candidates = liveNames.filter(n => agentKey(n) === key);
        if (candidates.length === 1) {
          staleDests.push({
            memberIdx: mi,
            destIdx: di,
            oldName: dest.assistantName,
            newName: candidates[0],
          });
        } else {
          unmatched.push({
            squad: squad.name,
            squadId: squad.id,
            destName: dest.assistantName,
            candidates,
          });
        }
      }
    }
    if (staleDests.length) {
      squadsToFix.push({ squad, staleDests });
    }
  }

  if (unmatched.length) {
    console.log('\n⚠ Destinations that could not be auto-matched (manual review needed):');
    for (const u of unmatched) {
      console.log(`  [${u.squadId}] ${u.squad}`);
      console.log(`    "${u.destName}"  candidates: ${JSON.stringify(u.candidates)}`);
    }
    console.log();
  }

  if (!squadsToFix.length) {
    console.log('✓ All squad destination names are in sync. Nothing to do.');
    return;
  }

  console.log(`Found ${squadsToFix.length} squad(s) with stale destination names:\n`);
  for (const { squad, staleDests } of squadsToFix) {
    console.log(`  [${squad.id}] ${squad.name}`);
    for (const d of staleDests) {
      console.log(`    • "${d.oldName}"`);
      console.log(`        → "${d.newName}"`);
    }
  }

  console.log('\nApplying fixes…\n');

  for (const { squad, staleDests } of squadsToFix) {
    const newMembers = squad.members.map((m, mi) => {
      const fixForThisMember = staleDests.filter(d => d.memberIdx === mi);
      if (!fixForThisMember.length) return m;
      const newDests = m.assistantDestinations.map((dest, di) => {
        const fix = fixForThisMember.find(f => f.destIdx === di);
        return fix ? { ...dest, assistantName: fix.newName } : dest;
      });
      return { ...m, assistantDestinations: newDests };
    });
    await vapi('PATCH', `/squad/${squad.id}`, { members: newMembers });

    // Verify
    const after = await vapi('GET', `/squad/${squad.id}`);
    let stillStale = 0;
    for (const d of staleDests) {
      const actual = after.members[d.memberIdx].assistantDestinations[d.destIdx].assistantName;
      if (actual !== d.newName) {
        stillStale++;
        console.error(`  ✗ [${squad.id}] member[${d.memberIdx}].dest[${d.destIdx}] did not stick: got "${actual}", expected "${d.newName}"`);
      }
    }
    if (stillStale === 0) {
      console.log(`  ✓ ${squad.name} — ${staleDests.length} destination(s) updated.`);
    } else {
      throw new Error(`Squad ${squad.id} verification failed: ${stillStale} destination(s) still stale.`);
    }
  }

  console.log(`\n✓ Done. ${squadsToFix.length} squad(s) reconciled.`);
}

main().catch(err => {
  console.error(`\n✗ FAILED: ${err.message}`);
  process.exit(1);
});
