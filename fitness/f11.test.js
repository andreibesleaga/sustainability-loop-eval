// SPDX-License-Identifier: GPL-3.0-only
// Fitness function F11 — Governor core invariants — why it matters
// architecturally: every other property rests on the core behaving like a small,
// boring, predictable function. These are the assumptions a reader would otherwise
// have to take on trust: decide() is monotone in the estimate and has no side
// effects, commit() is additive and throws rather than absorbing a bad value,
// reset() clears, rung boundaries are inclusive from below, and the SHIPPED
// severity table still agrees with this package's ladder order.
import test from "node:test";
import assert from "node:assert/strict";
import { f11CoreInvariants } from "./props.js";

test("F11 — governor core invariants", () => {
  const r = f11CoreInvariants();
  console.log(`FITNESS ${r.id} cases=${r.cases} passed=${r.passed} :: ${r.notes}`);
  assert.strictEqual(r.passed, true, r.notes);
});
