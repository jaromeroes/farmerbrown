// Vercel serverless function — deterministic Builders Risk premium.
// Deploy target for the "calc tool" that takes the premium math OFF the LLM.
// Formula kept in sync with ../../scripts/lib/br-premium.js (the canonical source + tests).
//
// VAPI apiRequest tool POSTs { insuredValue, projectType, constructionType, deductible };
// returns { total, premium, fee, breakdown }. The LLM then just SPEAKS total — no math.

const RATES = {
  new:   { frame: 0.00251, brick: 0.00242, masonry: 0.00113 },
  rehab: { frame: 0.00492, brick: 0.00462, masonry: 0.00192 },
};
const DEDUCTIBLE_FACTOR = { 2500: 1.0, 5000: 0.85, 1000: 1.1 };

function normProject(p){ const s=String(p||'').toLowerCase(); return (s.includes('rehab')||s.includes('renov'))?'rehab':'new'; }
function normMaterial(m){ const s=String(m||'').toLowerCase(); if(s.includes('brick'))return'brick'; if(s.includes('mason')||s.includes('non-comb')||s.includes('non comb'))return'masonry'; return'frame'; }
function normDeductible(d){ const n=Number(String(d).replace(/[^0-9]/g,'')); return [1000,2500,5000].includes(n)?n:2500; }

function quote({ insuredValue, projectType, constructionType, deductible }) {
  const value = Number(insuredValue);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`invalid insuredValue: ${insuredValue}`);
  const proj = normProject(projectType), mat = normMaterial(constructionType), ded = normDeductible(deductible);
  const rate = RATES[proj][mat];
  const base = value * rate;
  const premium = Math.round(base * DEDUCTIBLE_FACTOR[ded]);
  const fee = premium < 2000 ? 95 : 195;
  return { base: Math.round(base), premium, fee, total: premium + fee, projectType: proj, constructionType: mat, deductible: ded };
}

module.exports = (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    // VAPI sends tool args; accept either the flat shape or VAPI's message wrapper.
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const args = body.insuredValue !== undefined ? body
      : (body.message?.toolCalls?.[0]?.function?.arguments) || body.arguments || body;
    const a = typeof args === 'string' ? JSON.parse(args) : args;
    const r = quote(a);
    return res.status(200).json({ ...r, spoken_total: r.total });
  } catch (e) {
    return res.status(400).json({ error: String(e.message || e) });
  }
};
