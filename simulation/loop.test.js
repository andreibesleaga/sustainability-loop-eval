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
import { renderMd } from "./loop.js";
// WP-12b drives the model directly as well as reading its committed output, so the
// "nothing drops below terminate" property is a property of the CODE, not of a table.
import { run } from "./loop.js";
import { loadWindow } from "./lib.js";

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
  assert.match(md, /conjecture is disproven/i, "the negative verdict must be stated plainly, not softened");
  assert.match(md, /WP-12b/, "the redirect to capacity rungs must be named");
});

test("WP-12b: the capacity arm exists at every WP-12 corner, and the plane cells it is compared against are untouched", () => {
  for (const id of WINDOWS) {
    const b = doc.results[id].wp12b;
    assert.ok(b, `${id}: the WP-12b capacity comparison must exist`);
    for (const N of [5, 25]) for (const a of [0, 2]) for (const st of [1, 7]) {
      const c = b[`capacity_N${N}_a${a}_s${st}`];
      assert.ok(c, `${id}: capacity_N${N}_a${a}_s${st} must be recorded`);
      assert.equal(typeof c.terminateFired, "boolean", "every capacity cell carries the terminate flag");
      assert.equal(typeof c.droppedUnitsPct, "number", "every capacity cell reports what it lost");
    }
    // alpha=0 systems are independent and identical, so N cannot matter here either.
    assert.deepEqual(b["capacity_N5_a0_s1"], b["capacity_N25_a0_s1"], `${id}: alpha=0 capacity cells must be N-independent`);
    assert.deepEqual(b["capacity_N5_a0_s7"], b["capacity_N25_a0_s1"], `${id}: alpha=0 capacity cells cannot see staleness`);
  }
  // APPEND-ONLY: WP-12b may add cells, never move the ground it is measured against.
  // The blind-herd row is pinned by value in both windows; if adding an arm changed
  // it, the arm changed the shared machinery and the addition was not append-only.
  const HERD = { W1: { meanIntensityGPerKWh: 76.55, peakConcurrencyRatio: 1, top5PctSlotShare: 33.33, oscillationL1: 1.359 },
                 W2: { meanIntensityGPerKWh: 71.46, peakConcurrencyRatio: 1, top5PctSlotShare: 33.33, oscillationL1: 0.872 } };
  for (const id of WINDOWS) for (const N of Ns) for (const st of stalenessDays) {
    assert.deepEqual(doc.results[id].cells[`N${N}_a0_s${st}`], HERD[id],
      `${id} N${N} s${st}: the committed alpha=0 plane cell must be unchanged`);
  }
});

test("WP-12b: metric sanity — the capacity cells are cells like any other", () => {
  for (const id of WINDOWS) {
    for (const [k, c] of Object.entries(doc.results[id].wp12b)) {
      assert.ok(c.top5PctSlotShare > 0 && c.top5PctSlotShare <= 100, `${id} ${k}: share is a share`);
      assert.ok(c.peakConcurrencyRatio >= 1 - 1e-9, `${id} ${k}: peak cannot be below the ideal spread`);
      // The complete-swap bound of 2 is exact only when both days placed the same
      // number of units; an arm that drops work normalises by the LATER day's units,
      // so the bound relaxes by exactly that shortfall (the WP-12 paced rows show the
      // same slight overshoot). Anything beyond it would be an accounting bug.
      assert.ok(c.oscillationL1 >= 0 && c.oscillationL1 <= 2 * (1 + c.droppedUnitsPct / 100) + 1e-9,
        `${id} ${k}: L1/unit is at most a complete swap, allowing for the units this arm dropped`);
      assert.ok(c.meanIntensityGPerKWh > 0, `${id} ${k}: something was paid`);
      assert.ok(c.droppedUnitsPct >= 0 && c.droppedUnitsPct < 100, `${id} ${k}: drops are a percentage of the work`);
    }
  }
});

test("WP-12b: nothing is lost below the terminate rung — halving a cap spills work, it never refuses it", () => {
  // (a) From the committed cells, by CAUSE this time (the earlier implication-only
  // form was vacuous while terminateFired was true in every cell): every drop in
  // every committed capacity cell must be attributed to the terminate rung — the
  // no-feasible-slot spill counter, the one way work could be lost BELOW
  // terminate, must be exactly zero everywhere.
  for (const id of WINDOWS) {
    for (const [k, c] of Object.entries(doc.results[id].wp12b)) {
      assert.equal(c.droppedNoFeasibleSlot, 0, `${id} ${k}: a unit was lost below the terminate rung (spill found no slot)`);
      if (!c.terminateFired) assert.equal(c.droppedUnitsPct, 0, `${id} ${k}: no terminate, so nothing may drop`);
    }
  }
  // (b) Driven directly, so the property is checked and not merely observed: under a
  // budget too large to bind, no rung fires, nothing drops, and the capacity arm
  // REDUCES to the plane cell exactly — the ladder is inert when there is headroom.
  for (const id of WINDOWS) {
    const W = loadWindow(id);
    for (const [N, a, st] of [[25, 0, 1], [5, 2, 7]]) {
      const loose = run(W, N, a, st, "capacity", { paceF: 50 });
      assert.equal(loose.terminateFired, false, `${id} N${N} a${a} s${st}: a non-binding budget must fire no rung`);
      assert.equal(loose.droppedUnitsPct, 0, `${id} N${N} a${a} s${st}: below terminate, no unit may be lost`);
      assert.equal(loose.droppedNoFeasibleSlot, 0, `${id} N${N} a${a} s${st}: no unit may be lost below terminate`);
      const { droppedUnitsPct, terminateFired, droppedNoFeasibleSlot, ...metrics } = loose;
      assert.deepEqual(metrics, doc.results[id].cells[`N${N}_a${a}_s${st}`],
        `${id} N${N} a${a} s${st}: an unbound capacity arm must be the plane arm`);
    }
    // And the committed cells are reproducible from the committed inputs.
    assert.deepEqual(run(W, 25, 2, 7, "capacity"), doc.results[id].wp12b["capacity_N25_a2_s7"],
      `${id}: the capacity cell must regenerate byte-for-byte from the committed trace`);
  }
});

test("WP-12b: the verdict sentence in loop.md states the direction the numbers actually took", () => {
  const md = readFileSync(new URL("../results/loop.md", import.meta.url), "utf8");
  // The write-up's word is not allowed to drift from the measurement: recompute the
  // test the renderer applies (blind-herd corner, >= 2 points of top-5% share) and
  // require the prose to match it in both directions.
  const spreads = WINDOWS.every((id) =>
    doc.results[id].cells["N25_a0_s1"].top5PctSlotShare - doc.results[id].wp12b["capacity_N25_a0_s1"].top5PctSlotShare >= 2);
  if (spreads) {
    assert.match(md, /WP-12b verdict — SPREADS/, "a spreading result must be claimed as one");
    assert.doesNotMatch(md, /WP-12b verdict — DISPROVEN AGAIN/);
  } else {
    assert.match(md, /WP-12b verdict — DISPROVEN AGAIN/, "a second negative result must be stated, not softened");
    assert.match(md, /not established by this model either/, "the consequence for the corrected §2h.2 claim must be spelled out");
    assert.doesNotMatch(md, /WP-12b verdict — SPREADS/);
  }
  // The table itself must be there, with the honest per-cell columns.
  assert.match(md, /capacity rungs: does halving the cap spread/i);
  assert.match(md, /terminate fired/i, "the drops-only-at-terminate column belongs in the table");
  for (const id of WINDOWS) {
    const c = doc.results[id].wp12b["capacity_N25_a0_s1"];
    assert.ok(md.includes(`${c.top5PctSlotShare}%`), `${id}: the blind-herd capacity share must appear in the write-up`);
  }
});

test("loop: the committed write-up IS the renderer's output — generator drift is impossible to hide", () => {
  // F6 (audit): every prose assertion above reads results/loop.md; this one closes
  // the loop by proving the committed .md is byte-identical to rendering the
  // committed .json with the current renderer, so the two cannot drift silently.
  const md = readFileSync(new URL("../results/loop.md", import.meta.url), "utf8");
  assert.equal(md, renderMd(doc), "results/loop.md must equal renderMd(results/loop.json) byte for byte — regenerate with `npm run loop`");
});
