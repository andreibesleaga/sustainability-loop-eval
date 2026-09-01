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
