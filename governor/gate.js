// SPDX-License-Identifier: GPL-3.0-only
/**
 * The real enforcement point: kaiban-distributed's ActionGate (npm kaiban-distributed@2.0.0),
 * with the Carbon-Verdict Governor plugged in as a validator and a hash-chained AuditLog behind it.
 * Nothing here is simulated — this is the shipped gate code running in-process.
 *
 * Two thin things are added on top of the shipped gate, both stated openly:
 *   1. `gated()` NORMALISES the decision onto the five-rung ladder. The shipped gate
 *      passes a validator's action through verbatim AND ranks it with
 *      GATE_ACTION_SEVERITY, which is `undefined` for anything off the ladder; its sort
 *      comparator then yields NaN and the ordering silently degrades to insertion order.
 *      Measured on kaiban-distributed@2.0.0: with verdicts [allow, "not-a-rung",
 *      terminate] the shipped gate returns **allow**. So an off-ladder verdict does not
 *      merely pass through — it can mask a real `terminate`. When ANY verdict (or the
 *      decision itself) is off the ladder, `gated()` therefore re-aggregates with the
 *      reference most-severe rule, under which an unrecognised action ranks as `block`,
 *      and keeps the shipped answer as `rawAction`. When everything is on the ladder the
 *      shipped decision is returned untouched, so F1/F9 still test the shipped rule.
 *      This is an upstream gap, to be reported upstream.
 *   2. `chainAnchor()` / `verifyAnchored()` — an external anchor over the audit chain.
 *      `AuditLog.verify()` re-hashes the chain it is given, so it detects EDITS but not
 *      truncation, deletion of a tail, or a wholesale replay: a shorter valid chain is
 *      still a valid chain. Comparing against an anchor taken earlier closes that gap.
 */
import { createHash } from "node:crypto";
import { ActionGate, AuditLog } from "kaiban-distributed";
import { carbonValidator, mostSevere, LADDER } from "./carbon-governor.js";

export function makeGate(governor, { enabled = true, extraValidators = [], clock } = {}) {
  const audit = new AuditLog();
  let tick = 0;
  const gate = new ActionGate({
    config: { enabled },
    validators: [carbonValidator(governor), ...extraValidators],
    audit,
    clock: clock ?? (() => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++)).toISOString()), // deterministic
  });
  return { gate, audit };
}

/**
 * Ask the gate about one agent action that would emit `estimateG` grams CO2e.
 * The decision is returned exactly as the shipped gate produced it whenever every
 * verdict is on the ladder; otherwise it is re-aggregated fail-closed (see above).
 */
export async function gated(gate, estimateG, { agentId = "agent-1", operation = "tool-call", tool = "run-task" } = {}) {
  const decision = await gate.evaluate({ operation, agentId, payload: { tool, estimatedGramsCO2e: estimateG } });
  const actions = (decision.verdicts ?? []).map((v) => v.action);
  const offLadder = actions.filter((a) => !LADDER.includes(a));
  const decisionOffLadder = !LADDER.includes(decision.action);
  if (!offLadder.length && !decisionOffLadder) return decision;
  const bad = decisionOffLadder ? decision.action : offLadder[0];
  return {
    ...decision,
    action: mostSevere(actions),
    rawAction: decision.action,
    normalisedReason: `non-ladder verdict '${bad}' treated as block (fail closed)`,
  };
}

/**
 * An external anchor over an audit chain: how long it was and what its tip hash was.
 * Written down somewhere the log's own holder cannot rewrite (a receipt, another
 * service, a signed line in a build log), this is what makes truncation detectable.
 */
export function chainAnchor(records) {
  const length = records.length;
  const tipHash = length ? records[length - 1].hash : "";
  return { length, tipHash, anchorHash: createHash("sha256").update(`${length}:${tipHash}`).digest("hex") };
}

/**
 * Verify an audit log against an anchor taken earlier: the chain must still verify,
 * must not have shrunk below the anchored length, and the record at the anchored
 * position must still carry the anchored tip hash.
 */
export function verifyAnchored(audit, anchor) {
  const chain = audit.verify();
  const records = audit.records();
  if (!chain.valid) return { valid: false, reason: "chain broken", brokenAt: chain.brokenAt };
  if (records.length < anchor.length) {
    return { valid: false, reason: "chain shorter than anchor (truncation or deletion)", length: records.length, anchoredLength: anchor.length };
  }
  const atAnchor = anchor.length ? records[anchor.length - 1].hash : "";
  if (atAnchor !== anchor.tipHash) return { valid: false, reason: "anchored tip hash no longer matches" };
  return { valid: true, appendedSince: records.length - anchor.length };
}
