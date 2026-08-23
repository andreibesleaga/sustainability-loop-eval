// SPDX-License-Identifier: GPL-3.0-only
// Fitness function F2 — Fail-closed — why it matters architecturally: a
// governance gate that can be knocked into "allow" by an internal error is
// worse than no gate at all. This proves a throwing validator and a malformed
// carbon estimate can only ever come out as block, and documents the one
// intentional bypass (enabled:false) as an all-or-nothing deployment posture,
// not a per-request escape hatch.
import test from "node:test";
import assert from "node:assert/strict";
import { f2FailClosed } from "./props.js";

test("F2 — fail-closed", async () => {
  const r = await f2FailClosed();
  console.log(`FITNESS ${r.id} cases=${r.cases} passed=${r.passed} :: ${r.notes}`);
  assert.strictEqual(r.passed, true, r.notes);
});
