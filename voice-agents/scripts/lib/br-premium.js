/*
 * Builders Risk premium — CANONICAL formula (single source of truth).
 *
 * This is the deterministic calculation that gpt-4o keeps getting wrong inside
 * Jennifer's prompt (two real test calls quoted $1,017 and $875 where the correct
 * totals were $1,214 and $5,215). The robust fix is to compute the premium HERE,
 * not in the LLM. This module is:
 *   - the exact spec to hand Pablo so the backend can populate `annual_premium`;
 *   - the core of the optional VAPI calc tool (see ../../premium-api/);
 *   - the validator behind scripts/test-br-premium.js.
 *
 * Source: John's rate sheet (2026-06-06) + clarifications (2026-06-10, −15% on $5k
 * confirmed by José as the intended figure over John's −10% example miscalc).
 * Rates are quoted at the $2,500 deductible. No other multipliers/loads exist.
 */

// Rate per $1 of insured value, keyed by project type + construction material.
const RATES = {
  new:   { frame: 0.00251, brick: 0.00242, masonry: 0.00113 },
  rehab: { frame: 0.00492, brick: 0.00462, masonry: 0.00192 },
};

const DEDUCTIBLE_FACTOR = {
  2500: 1.00,   // base — rates are quoted here
  5000: 0.85,   // −15%
  1000: 1.10,   // +10%
};

function normProject(p) {
  const s = String(p || '').toLowerCase();
  if (s.includes('rehab') || s.includes('renov')) return 'rehab';
  return 'new'; // default to new construction
}
function normMaterial(m) {
  const s = String(m || '').toLowerCase();
  if (s.includes('brick')) return 'brick';
  if (s.includes('mason') || s.includes('non-comb') || s.includes('non comb')) return 'masonry';
  return 'frame';
}
function normDeductible(d) {
  const n = Number(String(d).replace(/[^0-9]/g, '')); // "$2,500" -> 2500
  return [1000, 2500, 5000].includes(n) ? n : 2500;
}

/**
 * @param {object} input
 * @param {number} input.insuredValue  total amount being insured (combined value if multi-structure)
 * @param {string} input.projectType   "new construction" | "renovation"/"rehab"
 * @param {string} input.constructionType "Frame" | "Brick" | "Masonry Non-Combustible"
 * @param {string|number} input.deductible  1000 | 2500 | 5000 (or "$2,500")
 * @returns {{base:number, premium:number, fee:number, total:number, breakdown:string}}
 */
function quotePremium({ insuredValue, projectType, constructionType, deductible }) {
  const value = Number(insuredValue);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`invalid insuredValue: ${insuredValue}`);

  const proj = normProject(projectType);
  const mat = normMaterial(constructionType);
  const ded = normDeductible(deductible);
  const rate = RATES[proj][mat];

  const base = value * rate;
  const adjusted = base * DEDUCTIBLE_FACTOR[ded];
  const premium = Math.round(adjusted);          // whole dollars, no pennies
  const fee = premium < 2000 ? 95 : 195;
  const total = premium + fee;

  return {
    base: Math.round(base),
    premium,
    fee,
    total,
    breakdown: `${proj}/${mat} @ ${rate} × $${value.toLocaleString()} = $${Math.round(base).toLocaleString()} ` +
               `→ ×${DEDUCTIBLE_FACTOR[ded]} (${ded} ded) = $${premium.toLocaleString()} + $${fee} fee = $${total.toLocaleString()}`,
  };
}

module.exports = { quotePremium, RATES, DEDUCTIBLE_FACTOR };
