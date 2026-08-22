/**
 * The real enforcement point: kaiban-distributed's ActionGate (npm kaiban-distributed@2.0.0),
 * with the Carbon-Verdict Governor plugged in as a validator and a hash-chained AuditLog behind it.
 * Nothing here is simulated — this is the shipped gate code running in-process.
 */
import { ActionGate, AuditLog } from "kaiban-distributed";
import { carbonValidator } from "./carbon-governor.js";

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

/** Ask the gate about one agent action that would emit `estimateG` grams CO2e. */
export function gated(gate, estimateG, { agentId = "agent-1", operation = "tool-call", tool = "run-task" } = {}) {
  return gate.evaluate({ operation, agentId, payload: { tool, estimatedGramsCO2e: estimateG } });
}
