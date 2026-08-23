// SPDX-License-Identifier: GPL-3.0-only
// Fitness function F8 — Determinism — why it matters architecturally: a
// governance decision that can't be reproduced from the same inputs can't be
// replayed, tested, or trusted in an incident review. This proves two
// independent fresh gates given the same estimate sequence produce
// byte-identical decisions AND byte-identical audit chains.
import test from "node:test";
import assert from "node:assert/strict";
import { f8Determinism } from "./props.js";

test("F8 — determinism across two fresh gates", async () => {
  const r = await f8Determinism();
  console.log(`FITNESS ${r.id} cases=${r.cases} passed=${r.passed} :: ${r.notes}`);
  assert.strictEqual(r.passed, true, r.notes);
});
