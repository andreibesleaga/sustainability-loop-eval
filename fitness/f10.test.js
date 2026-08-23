// SPDX-License-Identifier: GPL-3.0-only
// Fitness function F10 — Audit anchoring — why it matters architecturally: F6
// shows the hash chain is tamper-EVIDENT for edits. That is not the same as
// tamper-RESISTANT, and anyone who would rely on the log as evidence needs the
// difference stated. A chain whose tail has been dropped re-hashes perfectly, so
// verify() alone calls it valid; only an external anchor — the {length, tipHash}
// written down before the fact — catches truncation, deletion or a replay.
import test from "node:test";
import assert from "node:assert/strict";
import { f10AuditAnchoring } from "./props.js";

test("F10 — audit anchoring: edits caught by verify(), truncation only by an anchor", async () => {
  const r = await f10AuditAnchoring();
  console.log(`FITNESS ${r.id} cases=${r.cases} passed=${r.passed} :: ${r.notes}`);
  assert.strictEqual(r.passed, true, r.notes);
});
