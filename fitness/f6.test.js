// Fitness function F6 — Audit-chain integrity — why it matters
// architecturally: an audit trail an operator (or attacker) can silently edit
// after the fact is not evidence. This proves verify() reports valid over a
// real run of decisions, and that mutating even one field of one record is
// detected and localized by verify().
import test from "node:test";
import assert from "node:assert/strict";
import { f6AuditChainIntegrity } from "./props.js";

test("F6 — audit-chain integrity + tamper detection", async () => {
  const r = await f6AuditChainIntegrity();
  console.log(`FITNESS ${r.id} cases=${r.cases} passed=${r.passed} :: ${r.notes}`);
  assert.strictEqual(r.passed, true, r.notes);
});
