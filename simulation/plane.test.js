// SPDX-License-Identifier: GPL-3.0-only
/**
 * simulation/plane.test.js — WP-17 invariants: the documents really are
 * gateway-shaped, the cadence axis is honest, and the member comparison exists.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mandatoryMembers } from "./plane.js";

const doc = JSON.parse(readFileSync(new URL("../results/plane.json", import.meta.url), "utf8"));
const WINDOWS = ["W1", "W2"];

test("plane: the member set is derived from the committed gateway documents, not invented", () => {
  const live = mandatoryMembers();
  assert.deepEqual(doc.mandatoryMembers, live,
    "the committed result must have been produced against the current gateway document shape");
  // The document-identity members must be universal, or the arm is fiction.
  for (const m of ["updated", "reporting-period", "target", "carbon-footprint"]) {
    assert.ok(live.includes(m), `every gateway document must carry ${m}`);
  }
  // And the finding this arm rests on: the member a control loop most wants to read
  // is NOT universal in practice, while the load member is more widely carried.
  const cov = doc.memberCoverage;
  assert.ok(cov["carbon-intensity-gCO2e-per-kWh"].coveragePct < 100,
    "carbon-intensity is optional in practice — if that changes, this finding must be revisited");
  assert.ok(cov["energy-consumption"].coveragePct >= cov["carbon-intensity-gCO2e-per-kWh"].coveragePct,
    "the load member should be at least as widely carried as intensity");
});

test("plane: the signal-member finding survives regeneration", () => {
  const md = readFileSync(new URL("../results/plane.md", import.meta.url), "utf8");
  assert.match(md, /degenerate/i, "the intensity-as-signal finding must be stated");
  assert.match(md, /Publishing load is cheaper/i, "the format recommendation must be stated");
});

test("plane: publishing less often means reading older documents", () => {
  for (const id of WINDOWS) {
    const c = doc.results[id].cadences;
    const labels = Object.keys(c);
    let prevAge = -Infinity;
    let prevDocs = Infinity;
    for (const k of labels) {
      assert.ok(c[k].meanDocumentAgeDays >= prevAge - 1e-9, `${id} ${k}: a slower cadence cannot lower document age`);
      assert.ok(c[k].documentsPublished <= prevDocs, `${id} ${k}: a slower cadence cannot publish more documents`);
      prevAge = c[k].meanDocumentAgeDays;
      prevDocs = c[k].documentsPublished;
      assert.ok(c[k].readsOfDocumentsOlderThanADayPct >= 0 && c[k].readsOfDocumentsOlderThanADayPct <= 100);
      assert.ok(c[k].meanIntensityGPerKWh > 0);
    }
  }
});

test("plane: the member comparison is present and both members are actually read", () => {
  for (const id of WINDOWS) {
    const m = doc.results[id].byMember;
    assert.ok(m["carbon-intensity-gCO2e-per-kWh"], "the intensity member must be tested");
    assert.ok(m["energy-consumption"], "the energy member must be tested");
    for (const v of Object.values(m)) assert.ok(v.meanIntensityGPerKWh > 0 && v.top5PctSlotShare > 0);
  }
});

test("plane: the write-up keeps its two honest halves — format closed, adoption open", () => {
  const md = readFileSync(new URL("../results/plane.md", import.meta.url), "utf8");
  assert.match(md, /R12/, "the limitation this arm closes must be named");
  assert.match(md, /R5/, "the half it does not close (no third-party publishers) must be named");
  assert.match(md, /23 days/, "E1's measured real-world cadence must anchor the table");
});
