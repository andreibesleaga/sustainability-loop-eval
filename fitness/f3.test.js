// Fitness function F3 — Monotonicity — why it matters architecturally:
// operators reason about the ladder as "worse consumption -> never a
// lighter-touch verdict". If severity could dip as commitment rose, the
// budget pacing would be unpredictable and untrustable under review. This
// also pins the default rung boundaries (0.8/1.0/1.1/1.25) to exact values.
import test from "node:test";
import assert from "node:assert/strict";
import { f3Monotonicity } from "./props.js";

test("F3 — monotonicity + rung boundaries", () => {
  const r = f3Monotonicity();
  console.log(`FITNESS ${r.id} cases=${r.cases} passed=${r.passed} :: ${r.notes}`);
  assert.strictEqual(r.passed, true, r.notes);
});
