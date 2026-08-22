/**
 * Reference actuation harness — the ONLY path in this evaluation package from
 * a gate decision to actually running an action. It encodes the human-binding
 * property tested by F4: allow/degrade run automatically; escalate/block/
 * terminate never run without an explicit, already-obtained human approval.
 */

/** @typedef {{approved: boolean, by?: string}} HumanApproval */

/**
 * @param {{action: string}} decision a GateDecision (or any {action} shape)
 * @param {() => any} task the side-effecting action to run
 * @param {HumanApproval} [approval] a HumanPort approval object, if obtained
 */
export function execute(decision, task, approval) {
  const autoRun = decision.action === "allow" || decision.action === "degrade";
  const humanApproved = !!approval && approval.approved === true;
  if (!autoRun && !humanApproved) {
    return { executed: false, reason: `requires human approval for action: ${decision.action}` };
  }
  return { executed: true, result: task() };
}
