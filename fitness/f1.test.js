// SPDX-License-Identifier: GPL-3.0-only
// Fitness function F1 — Total order / most-severe-wins — why it matters
// architecturally: the ladder (allow<degrade<escalate<block<terminate) is only
// a meaningful safety contract if the gate ALWAYS resolves conflicting
// validator opinions to the single most severe verdict and exposes it first.
// If aggregation ever picked less than the max, a lenient validator could mask
// one that wants to block or terminate.
import test from "node:test";
import assert from "node:assert/strict";
import { f1TotalOrder } from "./props.js";

test("F1 — total order / most-severe-wins", async () => {
  const r = await f1TotalOrder();
  console.log(`FITNESS ${r.id} cases=${r.cases} passed=${r.passed} :: ${r.notes}`);
  assert.strictEqual(r.passed, true, r.notes);
});
