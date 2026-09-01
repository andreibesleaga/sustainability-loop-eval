// SPDX-License-Identifier: GPL-3.0-only
// Fitness function F13 — Self-declared estimates — why it matters architecturally:
// the gate decides on a number the acting agent supplies about itself. This property
// pins down what the architecture can and cannot promise about that: with a trusted
// metering port (commit() charged the grams actually emitted) an under-declaring agent
// is never treated more strictly than an honest one and reaches every rung at most one
// action late; without one, an agent that declares zero is never caught at all. It is
// the executable form of limitation R15 and of the "metering port" the design needs.
import test from "node:test";
import assert from "node:assert/strict";
import { f13AdversarialEstimates } from "./props.js";

test("F13 — self-declared estimates: metering bounds the lie to one action; no metering, no bound", () => {
  const r = f13AdversarialEstimates();
  console.log(`FITNESS ${r.id} cases=${r.cases} passed=${r.passed} :: ${r.notes}`);
  assert.strictEqual(r.passed, true, r.notes);
});
