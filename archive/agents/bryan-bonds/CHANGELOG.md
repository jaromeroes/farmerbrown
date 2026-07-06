# Bryan — Bonds — Changelog

## v0.1 — 2026-05-19 (TEST build)

Initial test deploy. Built from the Tom Hester Slack Q&A captured in [`docs/bonds-discovery.md`](../../docs/bonds-discovery.md).

**Scope (v0.1):**
- 6 common questions + 3 branched flows (license/permit, bid, payment & performance).
- Hard qualification gates on bid + payment/performance (>1 yr, credit >700, no bankruptcy). No workarounds per Tom.
- SSN over phone for license/permit bonds when amount > $25k or state is AZ/CA/FL/MD/NJ/WA (6 states — NJ added by Tom 2026-05-18).
- Spoken pricing only for bid bonds (free) and payment/performance (3% of contract). License/permit pricing defers to Tom.

**NOT in v0.1:**
- No `submit_bond_form` backend (pending Tyler). Data lives in transcript only.
- No transfer to Tom during test — `transfer_to_bonds_specialist` routes to Pedro Neumann (`+17262334655`) as the safe test destination.
- No Calendly (none needed — Tom calls back directly).

**Open with John before v1.0** (from `docs/bonds-discovery.md` §6):
1. Domain / phone-line strategy — UnitedSuretyBonds.com dedicated line or via existing 3 lines?
2. What to say when caller fails hard qualification — cross-sell other coverage or thank-and-end?
3. Cross-sell at end of Bryan? (default: assume yes per the rest of the call center, except H&A.)
4. Tom-unavailable fallback — voicemail, generic live-agent, or Calendly callback?
