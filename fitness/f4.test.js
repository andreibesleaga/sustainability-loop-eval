// Fitness function F4 — Human binding on top rungs — why it matters
// architecturally: the whole point of escalate/block/terminate is that a
// human stays in the loop. This proves the reference actuation harness
// (fitness/harness.js) never runs a task for those rungs unless an approved
// HumanPort object was actually supplied — closing the loop from verdict to
// actuation, not just to a printed decision.
import test from "node:test";
import assert from "node:assert/strict";
import { f4HumanBinding } from "./props.js";

test("F4 — human binding on escalate/block/terminate", () => {
  const r = f4HumanBinding();
  console.log(`FITNESS ${r.id} cases=${r.cases} passed=${r.passed} :: ${r.notes}`);
  assert.strictEqual(r.passed, true, r.notes);
});
