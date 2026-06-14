# Builders Risk premium calculator — deterministic "hook" for Jennifer

**Why this exists:** gpt-4o cannot reliably compute `coverage × rate ± deductible + fee`. Two real
test calls quoted $1,017 and $875 where the correct totals were $1,214 and $5,215. v2.20 mitigates
this in the prompt (rate-per-$100k + sanity check), but the **only 100%-reliable fix is to take the
math off the LLM**. This is that fix: a tiny stateless endpoint the voice agent calls as a tool.

This is the "hook, not prompt" approach — the premium becomes code output, not something the model
has to "remember to do right."

## Two ways to ship the deterministic calc (pick one)

### Option A — backend (PREFERRED). Pablo computes `annual_premium` in Mission Control.
The backend already has the `annual_premium` column + all inputs (`building_coverage` /
`total_building_coverage`, `construction_type`, `project_type`, `deductible`) but does NOT autocalc
today (verified by PATCH-probe 2026-06-14). If Pablo applies the formula in `scripts/lib/br-premium.js`
on write and returns it, Jennifer just reads it back. No new infra. **This is the ask in
`docs/client-notes-pending.md`.**

### Option B — this endpoint (activatable by José alone, no Pablo).
1. `cd premium-api && vercel deploy --prod`  (needs `vercel login` once)
2. Copy the resulting URL.
3. `CALC_ENDPOINT_URL=<url> node ../scripts/create-tool-calculate-premium.js`  → creates the VAPI
   `calculate_premium` apiRequest tool.
4. Bump Jennifer to v2.21: add the tool id to `REQUIRED_TOOL_IDS` in `update-jennifer.js`, and replace
   the INSTANT QUOTE "compute it yourself" block with "call `calculate_premium`, then speak `total`".
   ⚠ Jennifer already has the max one `transferCall`; `calculate_premium` is apiRequest so it's fine,
   but keep total tools sane.

The formula lives once in `scripts/lib/br-premium.js` (with tests: `node scripts/test-br-premium.js`).
`api/quote.js` inlines the same constants — keep them in sync (the test file is the guard).
