/*
 * Validates the canonical BR premium formula against known-good cases, including
 * the two real test calls where Jennifer (gpt-4o) quoted wrong. Run:
 *   node scripts/test-br-premium.js
 */
const { quotePremium } = require('./lib/br-premium');

const CASES = [
  // The two real failures (what Jennifer SHOULD have said):
  { in: { insuredValue: 900000, projectType: 'new', constructionType: 'Masonry Non-Combustible', deductible: 1000 }, total: 1214, note: 'car call — Jennifer said $1,017 (base only)' },
  { in: { insuredValue: 2000000, projectType: 'new', constructionType: 'Frame', deductible: 2500 }, total: 5215, note: 'Romero call — Jennifer said $875 (hallucinated)' },
  // Prompt worked examples — must match exactly:
  { in: { insuredValue: 1000000, projectType: 'new', constructionType: 'Frame', deductible: 2500 }, total: 2705 },
  { in: { insuredValue: 1000000, projectType: 'rehab', constructionType: 'Frame', deductible: 5000 }, total: 4377 },
  { in: { insuredValue: 500000, projectType: 'new', constructionType: 'Brick', deductible: 1000 }, total: 1426 },
  // Fee boundary: premium exactly at 2000 → $195 fee.
  { in: { insuredValue: 796813, projectType: 'new', constructionType: 'Frame', deductible: 2500 }, total: 2195, note: 'premium ≈ $2,000 boundary' },
];

let pass = 0, fail = 0;
for (const c of CASES) {
  const r = quotePremium(c.in);
  const ok = r.total === c.total;
  console.log(`${ok ? '✓' : '✗'} $${c.in.insuredValue.toLocaleString()} ${c.in.projectType} ${c.in.constructionType} $${c.in.deductible} ded → $${r.total} (expected $${c.total})${c.note ? '  // ' + c.note : ''}`);
  if (!ok) { console.log('    ', r.breakdown); fail++; } else pass++;
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
