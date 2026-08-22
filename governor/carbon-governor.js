/**
 * Carbon-Verdict Governor — the reference core evaluated in this package.
 *
 * One idea: a carbon budget (grams CO2e per period) is paced against consumption,
 * and the pacing ratio maps onto the five-rung verdict ladder of the governance gate:
 *
 *     allow < degrade < escalate < block < terminate
 *
 * The core knows nothing about JSON endpoints, charging protocols or approval boards
 * (hexagonal: those are adapters). It is deliberately tiny so a reader can verify it.
 *
 * Inputs per decision: the estimated emissions of the action (grams CO2e).
 * State: grams spent so far in the current period.
 * Output: a verdict from the ladder plus the ratio that produced it.
 */

export const LADDER = ["allow", "degrade", "escalate", "block", "terminate"];

/** Default rungs, as fractions of the period budget already committed (spent + this action). */
export const DEFAULT_RUNGS = { degrade: 0.8, escalate: 1.0, block: 1.1, terminate: 1.25 };

export function createCarbonGovernor({ budgetG, rungs: overrides } = {}) {
  if (!(Number.isFinite(budgetG) && budgetG > 0)) throw new Error("budgetG must be a positive number");
  // A partial override keeps the defaults for the rungs it does not mention, so a
  // caller can never silently disable a rung by leaving it out.
  const rungs = { ...DEFAULT_RUNGS, ...overrides };
  const ordered = [rungs.degrade, rungs.escalate, rungs.block, rungs.terminate];
  if (!ordered.every((x, i) => Number.isFinite(x) && x >= 0 && (i === 0 || x >= ordered[i - 1]))) {
    throw new Error("rungs must be finite, non-negative and non-decreasing: degrade <= escalate <= block <= terminate");
  }
  let spentG = 0;

  /**
   * Map a committed/budget ratio onto the ladder. Pure function; monotone in ratio.
   * Boundaries are inclusive from below (ratio >= rung), so a ratio of exactly 1.0
   * with the defaults is `escalate`, not `degrade`.
   */
  function verdictFor(ratio) {
    if (!Number.isFinite(ratio) || ratio < 0) return "block"; // fail closed on bad input
    if (ratio >= rungs.terminate) return "terminate";
    if (ratio >= rungs.block) return "block";
    if (ratio >= rungs.escalate) return "escalate";
    if (ratio >= rungs.degrade) return "degrade";
    return "allow";
  }

  return {
    /** Decide on an action that would emit `estimateG` grams. Does not commit. */
    decide(estimateG) {
      if (!Number.isFinite(estimateG) || estimateG < 0) return { action: "block", ratio: NaN, reason: "invalid carbon estimate" };
      const ratio = (spentG + estimateG) / budgetG;
      const action = verdictFor(ratio);
      return { action, ratio, reason: `committed ${(ratio * 100).toFixed(1)}% of carbon budget` };
    },
    /** Record that an action ran and emitted `actualG` grams. */
    commit(actualG) { if (Number.isFinite(actualG) && actualG >= 0) spentG += actualG; },
    /** New period (e.g. a new day): spent resets. */
    reset() { spentG = 0; },
    get spentG() { return spentG; },
    get budgetG() { return budgetG; },
    verdictFor,
  };
}

/** Adapter: the governor as a kaiban-distributed GateValidator (the gate's pluggable check). */
export function carbonValidator(governor, { name = "carbon-verdict-governor" } = {}) {
  return {
    name,
    check(ctx) {
      const estimateG = ctx?.payload?.estimatedGramsCO2e;
      const d = governor.decide(estimateG);
      return { action: d.action, reason: d.reason, validator: name };
    },
  };
}

/** Most-severe-wins aggregation over verdicts — the same rule the real gate applies. */
export function mostSevere(actions) {
  return actions.reduce((worst, a) => (LADDER.indexOf(a) > LADDER.indexOf(worst) ? a : worst), "allow");
}
