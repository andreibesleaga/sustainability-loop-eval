// SPDX-License-Identifier: GPL-3.0-only
// Fitness function F5 — Gate-on-path — why it matters architecturally: a
// governance gate that some code paths can skip is decorative. For each of the
// three operation types the gate's contract names (tool-call, outbound-message,
// memory-write), this checks that every attempt left exactly one audit record,
// in order, carrying that operation and that verdict — so nothing can execute
// unaudited and no code path can quietly route around gate.evaluate.
import test from "node:test";
import assert from "node:assert/strict";
import { f5GateOnPath } from "./props.js";

test("F5 — gate-on-path for every operation type", async () => {
  const r = await f5GateOnPath();
  console.log(`FITNESS ${r.id} cases=${r.cases} passed=${r.passed} :: ${r.notes}`);
  assert.strictEqual(r.passed, true, r.notes);
});
