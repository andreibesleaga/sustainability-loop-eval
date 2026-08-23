// SPDX-License-Identifier: GPL-3.0-only
// Fitness function F9 — Aggregation equivalence — why it matters
// architecturally: this package's reference core (mostSevere) is only a valid
// stand-in for reasoning about the shipped gate if it actually computes the
// SAME aggregation the shipped gate computes. This is that equivalence check,
// varying both the carbon verdict and the extra-validator verdicts at once.
import test from "node:test";
import assert from "node:assert/strict";
import { f9AggregationEquivalence } from "./props.js";

test("F9 — reference mostSevere() agrees with the shipped gate", async () => {
  const r = await f9AggregationEquivalence();
  console.log(`FITNESS ${r.id} cases=${r.cases} passed=${r.passed} :: ${r.notes}`);
  assert.strictEqual(r.passed, true, r.notes);
});
