/**
 * Margin math. The ONE place that knows how a raw VAPI cost becomes a customer
 * charge. If you find yourself recomputing margin somewhere else, import this
 * instead.
 *
 * Money is integer cents only. `Math.floor` ensures we never round in the
 * customer's favor by accident — when a fractional cent appears, the customer
 * pays slightly less, José pays slightly more. The opposite would be tiny
 * over-charging that compounds across thousands of calls.
 */

const BPS_BASE = 10_000;

/**
 * Apply a basis-points margin to a cost.
 *
 * @param costCents     Raw cost in integer cents. Must be ≥ 0.
 * @param marginBps     Margin in basis points. 2500 = 25%. Must be ≥ 0.
 * @returns             Charge in integer cents (cost × (1 + bps/10000), floored).
 *
 * Examples:
 *   applyMargin(800, 2500)   → 1000   ($8.00 cost → $10.00 charge)
 *   applyMargin(41, 2500)    → 51     ($0.41 cost → $0.51 charge; 51.25 floored)
 *   applyMargin(0, 2500)     → 0      (free call → free charge)
 *   applyMargin(100, 0)      → 100    (zero margin → pass-through)
 */
export function applyMargin(costCents: number, marginBps: number): number {
  if (!Number.isInteger(costCents) || costCents < 0) {
    throw new Error(`applyMargin: costCents must be a non-negative integer, got ${costCents}`);
  }
  if (!Number.isInteger(marginBps) || marginBps < 0) {
    throw new Error(`applyMargin: marginBps must be a non-negative integer, got ${marginBps}`);
  }
  return Math.floor((costCents * (BPS_BASE + marginBps)) / BPS_BASE);
}

/**
 * Convert a VAPI cost (returned as a USD float) to integer cents.
 * Use at the API boundary; never let the float touch the rest of the system.
 */
export function vapiCostToCents(usdFloat: number): number {
  if (typeof usdFloat !== 'number' || !Number.isFinite(usdFloat) || usdFloat < 0) {
    throw new Error(`vapiCostToCents: expected a finite non-negative number, got ${usdFloat}`);
  }
  return Math.round(usdFloat * 100);
}
