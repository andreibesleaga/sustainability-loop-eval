// SPDX-License-Identifier: GPL-3.0-only
/**
 * Unit tests for the numeric plumbing the simulations stand on: the seeded PRNG and
 * Poisson draws (shared/prng.js), the statistics every reported number is computed
 * with (shared/stats.js), and trace loading + workload generation (simulation/lib.js).
 * If any of these drift, every number in results/ drifts with them.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mulberry32, poisson, randInt, randFloat, pick } from "../shared/prng.js";
import { mean, sd, median, p95, quantile, pearson, sum, r, ms } from "../shared/stats.js";
import { loadWindow, generateWorkload, WORKLOAD } from "./lib.js";

test("mulberry32 is deterministic, seed-dependent, and stays in [0,1)", () => {
  const a = mulberry32(42), b = mulberry32(42), c = mulberry32(43);
  const first = Array.from({ length: 100 }, () => a());
  assert.deepEqual(first, Array.from({ length: 100 }, () => b()));
  assert.notDeepEqual(first, Array.from({ length: 100 }, () => c()));
  assert.ok(first.every((x) => x >= 0 && x < 1));
});

test("randInt/randFloat/pick stay inside their bounds", () => {
  const rng = mulberry32(7);
  for (let i = 0; i < 1000; i++) {
    const n = randInt(rng, 3, 5);
    assert.ok(Number.isInteger(n) && n >= 3 && n <= 5);
    const f = randFloat(rng, -1, 1);
    assert.ok(f >= -1 && f < 1);
    assert.ok(["a", "b"].includes(pick(rng, ["a", "b"])));
  }
});

test("poisson draws are non-negative integers whose mean converges on lambda", () => {
  const rng = mulberry32(11);
  const draws = Array.from({ length: 20000 }, () => poisson(rng, 6));
  assert.ok(draws.every((k) => Number.isInteger(k) && k >= 0));
  assert.ok(Math.abs(mean(draws) - 6) < 0.1, `mean was ${mean(draws)}`);
});

test("mean/sum/sd match hand-computed values and are safe on tiny samples", () => {
  const v = [2, 4, 4, 4, 5, 5, 7, 9];
  assert.equal(sum(v), 40);
  assert.equal(mean(v), 5);
  assert.equal(Number(sd(v).toFixed(6)), Number(Math.sqrt(32 / 7).toFixed(6))); // sample sd (n-1)
  assert.equal(sd([3]), 0);
  assert.equal(mean([]), 0);
});

test("quantile interpolates linearly; median and p95 agree with it", () => {
  assert.equal(median([1, 2, 3]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(quantile([0, 10], 0.25), 2.5);
  const hundred = Array.from({ length: 100 }, (_, i) => i + 1);
  assert.equal(Number(p95(hundred).toFixed(2)), 95.05); // (n-1)*0.95 = 94.05 -> 95 + 0.05
  assert.equal(median([]), 0);
});

test("pearson is +-1 on perfect lines and 0 on a constant series", () => {
  assert.equal(pearson([1, 2, 3], [2, 4, 6]), 1);
  assert.equal(pearson([1, 2, 3], [6, 4, 2]), -1);
  assert.equal(pearson([1, 1, 1], [1, 2, 3]), 0);
});

test("reporting helpers round and reject non-finite values", () => {
  assert.equal(r(1.23456), 1.235);
  assert.equal(r(NaN), null);
  assert.deepEqual(ms([1, 2, 3], 2), { mean: 2, sd: 1 });
});

test("loadWindow yields validated, aligned series and a peer signal between the peers", () => {
  for (const id of ["W1", "W2"]) {
    const W = loadWindow(id);
    assert.equal(W.actual.length, W.slots);
    assert.equal(W.peerMean.length, W.slots);
    assert.ok(W.actual.every((x) => Number.isFinite(x) && x >= 0));
    assert.ok(W.peerMean.every((x, i) => x <= W.peerMax[i] + 1e-9));
    assert.equal(W.provenance.nationalActualGapsCarriedForward, 0);
  }
});

test("generateWorkload is seed-deterministic and never sets an impossible deadline", () => {
  const W = loadWindow("W1");
  const a = generateWorkload(101, W.slots);
  assert.deepEqual(a, generateWorkload(101, W.slots));
  assert.notEqual(a.length, generateWorkload(202, W.slots).length);
  const horizonSlots = (WORKLOAD.deferralHorizonHours * 60) / 30;
  for (const t of a) {
    assert.ok(t.deadline >= t.arrival && t.deadline <= W.slots - 1);
    if (!t.deferrable) assert.equal(t.deadline, t.arrival);
    else assert.ok(t.deadline - t.arrival <= horizonSlots);
  }
});
