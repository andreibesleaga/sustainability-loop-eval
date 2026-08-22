// Fitness function F7 — Port isolation (hexagonal) — why it matters
// architecturally: the paper's architectural claim is that the governance core
// is a pure, portable hexagon with adapters at the edges. This is a static
// check of that claim against the actual import graph as it stands today:
// carbon-governor.js imports nothing, gate.js imports only kaiban-distributed
// and the core, shared/ modules are leaves, and the adapters (simulation/,
// dataplane/, demo/) import only governor/, shared/ and their own folder.
import test from "node:test";
import assert from "node:assert/strict";
import { f7PortIsolation } from "./props.js";

test("F7 — port isolation via import graph", () => {
  const r = f7PortIsolation();
  console.log(`FITNESS ${r.id} cases=${r.cases} passed=${r.passed} :: ${r.notes}`);
  assert.strictEqual(r.passed, true, r.notes);
});
