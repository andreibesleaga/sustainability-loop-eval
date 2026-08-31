// SPDX-License-Identifier: GPL-3.0-only
/**
 * governor/harness.js — the reference actuation harness: the ONLY path in this
 * evaluation package from a gate decision to actually running an action.
 *
 * It encodes the authority half of the five-rung ladder (ADR-006):
 *
 *   allow      runs automatically
 *   degrade    runs automatically, in reduced form (the caller decides what
 *              "reduced" means for its own domain)
 *   escalate   runs ONLY with approval.approved === true
 *   block      runs ONLY with approval.approved === true, and then only the
 *              reduced/deferred fallback the caller passes as `task`
 *   terminate  NEVER runs — not with an approval, not with any approval
 *
 * Precondition: `decision` comes from gated(), so `action` is on the ladder. An action
 * that is not is treated exactly like `block` (it runs only with an approval), which
 * matches how the core ranks an unknown verdict. Imports nothing; F7 checks that.
 */

/** @typedef {{approved: boolean, by?: string}} HumanApproval */

/** The two rungs that are authorised automatically, with no human involved. */
const AUTO_RUN = new Set(["allow", "degrade"]);

/**
 * @param {{action: string}} decision a GateDecision (or any {action} shape)
 * @param {() => any} task the side-effecting action to run
 * @param {HumanApproval} [approval] a HumanPort approval object, if obtained
 * @returns {{executed: boolean, reason?: string, result?: any}}
 */
export function execute(decision, task, approval) {
  const action = decision?.action;
  // terminate is the one rung nobody can authorise: checked FIRST, so no approval
  // object — however well-formed — can ever reach the task.
  if (action === "terminate") {
    return { executed: false, reason: "terminate is not overridable" };
  }
  const autoRun = AUTO_RUN.has(action);
  const humanApproved = !!approval && approval.approved === true;
  if (!autoRun && !humanApproved) {
    return { executed: false, reason: `requires human approval for action: ${action}` };
  }
  return { executed: true, result: task() };
}
