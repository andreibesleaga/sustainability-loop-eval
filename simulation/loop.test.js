// SPDX-License-Identifier: GPL-3.0-only
/**
 * simulation/loop.test.js — invariants of E5 (the closed loop), against the
 * committed results/loop.json. The assertions pin the structure that makes the
 * cells comparable and the three findings the write-up rests on; each test covers
 * both windows.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const doc = JSON.parse(readFileSync(new URL("../results/loop.json", import.meta.url), "utf8"));
const WINDOWS = ["W1", "W2"];
const { Ns, alphas, stalenessDays } = doc.model;

test("loop: alpha=0 is signal-blind — staleness cannot change a herd that reads nothing", () => {
  for (const id of WINDOWS) {
    const c = doc.results[id].cells;
    for (const N of Ns) {
      const fresh = c[`N${N}_a0_s${stalenessDays[0]}`];
      for (const st of stalenessDays.slice(1)) {
        assert.deepEqual(c[`N${N}_a0_s${st}`], fresh, `${id} N${N}: alpha=0 cells must be identical across staleness`);
      }
    }
  }
});

test("loop: the herd pays the least grams — heeding the crowd always costs intensity here", () => {
  // The blind herd pure-argmins the real signal, so every alpha>0 cell pays >= its
  // alpha=0 counterpart. This is the measured trade-off the write-up states: the
  // plane spreads the crowd only by paying grams.
  for (const id of WINDOWS) {
    const c = doc.results[id].cells;
    for (const N of Ns) for (const st of stalenessDays) {
      const herd = c[`N${N}_a0_s${st}`].meanIntensityGPerKWh;
      for (const a of alphas) {
        assert.ok(c[`N${N}_a${a}_s${st}`].meanIntensityGPerKWh >= herd - 1e-9,
          `${id} N${N} a${a} s${st}: no cell may pay less than the blind argmin herd`);
      }
    }
  }
});

test("loop: the plane can spread a small crowd — and the finding rows exist as written", () => {
  for (const id of WINDOWS) {
    const c = doc.results[id].cells;
    // At N=2, strong heed + weekly cadence: the top-5% share drops well below the
    // herd's — the one regime where the documents alone visibly spread the crowd.
    const herdShare = c[`N2_a0_s1`].top5PctSlotShare;
    assert.ok(c[`N2_a2_s7`].top5PctSlotShare < herdShare - 5,
      `${id}: N=2 a=2 s=7 must spread the crowd vs the herd (got ${c["N2_a2_s7"].top5PctSlotShare} vs ${herdShare})`);
    // At the largest N with fresh signals and strong heed, the dynamic hops daily:
    // oscillation at (or near) the theoretical maximum of 2 — the cobweb.
    assert.ok(c[`N${Ns[Ns.length - 1]}_a2_s1`].oscillationL1 >= 1.9,
      `${id}: large-N fresh strong-heed must oscillate (cobweb)`);
  }
});

test("loop: metric sanity — shares are shares, ratios are ratios, oscillation is bounded", () => {
  for (const id of WINDOWS) {
    for (const cell of Object.values(doc.results[id].cells)) {
      assert.ok(cell.top5PctSlotShare > 0 && cell.top5PctSlotShare <= 100);
      assert.ok(cell.peakConcurrencyRatio >= 1 - 1e-9, "peak cannot be below the ideal spread");
      assert.ok(cell.oscillationL1 >= 0 && cell.oscillationL1 <= 2 + 1e-9,
        "L1/unit between consecutive days is at most 2 (complete swap)");
      assert.ok(cell.meanIntensityGPerKWh > 0);
    }
  }
});

test("loop: the write-up's honesty markers survive regeneration", () => {
  const md = readFileSync(new URL("../results/loop.md", import.meta.url), "utf8");
  assert.match(md, /cobweb/i);
  assert.match(md, /pay(s|ing) .*grams|trades? carbon/i);
  assert.match(md, /23 days/, "the E1 staleness contrast must stay in the reading notes");
});


test("WP-12: the anti-herd arms behave as the verdict states — binding budget sheds, defer reshuffles, alpha=0 is N-independent", () => {
  for (const id of ["W1", "W2"]) {
    const x = doc.results[id].wp12;
    assert.ok(x, `${id}: the WP-12 comparison must exist`);
    // The calibrated budget BINDS: the skip-k paced arm drops real work at alpha=0.
    assert.ok(x["paced_N25_a0_s1"].droppedUnitsPct > 1,
      `${id}: a binding budget must shed units in the skip-k arm`);
    // Shedding does not spread: the top-5% share is no lower than the blind herd's.
    assert.ok(x["paced_N25_a0_s1"].top5PctSlotShare >= doc.results[id].cells["N25_a0_s1"].top5PctSlotShare - 0.1,
      `${id}: skip-k pacing must not be credited with spreading it did not do`);
    // Defer semantics keeps the work (few or no drops) and still does not spread.
    assert.ok(x["paced_defer_N25_a0_s1"].droppedUnitsPct !== undefined);
    assert.ok(x["paced_defer_N25_a0_s1"].top5PctSlotShare >= doc.results[id].cells["N25_a0_s1"].top5PctSlotShare - 0.1,
      `${id}: defer pacing reshuffles within the cheap band, it does not spread`);
    // Stagger is inert at slot resolution: within noise of the blind herd.
    assert.ok(Math.abs(x["stagger_N25_a0_s1"].top5PctSlotShare - doc.results[id].cells["N25_a0_s1"].top5PctSlotShare) < 0.5,
      `${id}: the stagger arm must be inert on real intensity data`);
    // alpha=0 systems are independent and identical, so N cannot matter.
    assert.deepEqual(x["paced_N5_a0_s1"], x["paced_N25_a0_s1"], `${id}: alpha=0 paced cells must be N-independent`);
    assert.deepEqual(x["paced_defer_N5_a0_s1"], x["paced_defer_N25_a0_s1"], `${id}: alpha=0 defer cells must be N-independent`);
  }
  const md = readFileSync(new URL("../results/loop.md", import.meta.url), "utf8");
  assert.match(md, /FALSIFIED/, "the falsification must be stated, not softened");
  assert.match(md, /WP-12b/, "the redirect to capacity rungs must be named");
});
