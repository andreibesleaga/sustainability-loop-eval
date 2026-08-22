/**
 * Unit tests for the two experiments' policy semantics.
 *
 * Two kinds of check:
 *   1. hand-computed micro-scenarios on a 4-slot toy trace, where the expected grams
 *      can be worked out on paper, one per policy (P0, P1, P2 at each interesting rung);
 *   2. conservation invariants on the real W1 trace and real workloads — nothing is
 *      created or lost, every task is audited exactly once, and the counters agree.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { runP0, runP1, runP2 } from "./run.js";
import { schedule, naive, governed, nightsIn, FLEET } from "./charging.js";
import { loadWindow, generateWorkload, WORKLOAD } from "./lib.js";
import { sum, median } from "../shared/stats.js";

/** Toy window: peer signal == actual, so hand computation is unambiguous. */
const TOY = { id: "TOY", slots: 4, actual: [100, 50, 200, 25], peerMean: [100, 50, 200, 25] };
const task = (o) => ({ id: 0, arrival: 0, deferrable: false, deadline: 0, energyKWh: 1, ...o });

test("P0 runs every task on arrival at that slot's actual intensity", () => {
  const m = runP0([task({ id: 0, arrival: 0 }), task({ id: 1, arrival: 2 })], TOY);
  assert.equal(m.totalG, 100 + 200);
  assert.equal(m.completed, 2);
  assert.equal(m.dropped + m.deferred + m.degraded, 0);
});

test("P1 defers to the first slot at or below the threshold, and only deferrable work", () => {
  const threshold = median(TOY.peerMean); // (50 + 100) / 2 = 75
  assert.equal(threshold, 75);
  const deferrable = runP1([task({ deferrable: true, deadline: 3 })], TOY, threshold);
  assert.equal(deferrable.totalG, 50);       // slot 1 is the first <= 75, not the cleanest (slot 3)
  assert.deepEqual(deferrable.delays, [30]);
  const fixed = runP1([task({ arrival: 0 })], TOY, threshold);
  assert.equal(fixed.totalG, 100);           // non-deferrable: runs on arrival regardless
});

test("P2 allow: a small task inside budget runs now, at full energy", async () => {
  const m = await runP2([task({})], TOY, 1000, 0.4);
  assert.equal(m.totalG, 100);
  assert.deepEqual([m.completed, m.degraded, m.dropped, m.humanDecisions], [1, 0, 0, 0]);
});

test("P2 degrade: non-deferrable work at 80% of budget runs at the degraded energy", async () => {
  const m = await runP2([task({})], TOY, 125, 0.4); // ratio 100/125 = 0.8 -> degrade
  assert.equal(m.totalG, 40);                        // 0.4 kWh x 100 gCO2e/kWh
  assert.deepEqual([m.degraded, m.humanDecisions, m.escalations, m.blocks], [1, 0, 0, 0]);
});

test("P2 escalate: deferrable work moves to the cleanest predicted slot, with a human decision", async () => {
  const m = await runP2([task({ deferrable: true, deadline: 3 })], TOY, 100, 0.4); // ratio 1.0
  assert.equal(m.totalG, 25);                        // slot 3 is the cleanest before the deadline
  assert.deepEqual([m.escalations, m.humanDecisions, m.deferred], [1, 1, 1]);
  assert.deepEqual(m.delays, [90]);
});

test("P2 block: still authorised by a human, and counted as one", async () => {
  const m = await runP2([task({})], TOY, 90, 0.4); // ratio 100/90 = 1.11 -> block
  assert.deepEqual([m.blocks, m.humanDecisions, m.completed, m.degraded], [1, 1, 1, 1]);
});

test("P2 terminate: nothing runs, the task is dropped", async () => {
  const m = await runP2([task({})], TOY, 50, 0.4); // ratio 2.0 -> terminate
  assert.deepEqual([m.terminations, m.dropped, m.completed, m.totalG], [1, 1, 0, 0]);
});

test("E2 conservation invariants hold on the real trace at every budget factor", async () => {
  const W = loadWindow("W1");
  const tasks = generateWorkload(101, W.slots);
  const p0 = runP0(tasks, W);
  assert.equal(p0.completed, tasks.length);
  assert.ok(Math.abs(sum(p0.dayG) - p0.totalG) < 1e-6);

  for (const f of [0.6, 1.0]) {
    const m = await runP2(tasks, W, f * median(p0.dayG), WORKLOAD.degradedEnergyFraction);
    assert.equal(m.completed + m.dropped, tasks.length, "every task completes or is dropped");
    assert.equal(m.auditRecords, tasks.length, "exactly one audited gate decision per task");
    assert.equal(m.auditValid, true);
    assert.equal(m.onTime, m.completed, "no completed task ever misses its deadline");
    assert.equal(m.humanDecisions, m.escalations + m.blocks, "human decisions == escalate + block");
    assert.equal(m.terminations, m.dropped);
    assert.equal(m.deferred, m.delays.length);
    assert.ok(Math.abs(sum(m.dayG) - m.totalG) < 1e-6);
    assert.ok(m.totalG < p0.totalG, "the governor never emits more than always-run");
  }
});

test("E3 invariants: every vehicle charges exactly once, in full, inside its window", async () => {
  const W = loadWindow("W2");
  const plan = schedule(W, 303);
  assert.equal(plan.length, nightsIn(W));
  for (const night of plan) {
    assert.equal(night.length, FLEET.vehicles);
    assert.deepEqual(night, [...night].sort((a, b) => a - b), "plug-ins are evaluated in time order");
  }
  const base = naive(W, plan);
  const run = await governed(W, plan, 303, 1.0, FLEET.budgetFactor * median(base.nightly));
  const sessions = plan.length * FLEET.vehicles;
  assert.equal(run.sessions, sessions);
  assert.equal(run.auditRecords, sessions, "one audited gate decision per charging session");
  assert.equal(sum(Object.values(run.actions)), sessions, "every session got exactly one verdict");
  assert.equal(run.approvalsRequested + run.gateRefused, sessions);
  assert.ok(run.shifted <= run.approvalsGranted);
  assert.ok(run.totalG < base.totalG, "shifting can only reduce emissions here");
  assert.equal(run.auditValid, true);
  assert.ok(run.shiftHours.every((h) => h > 0), "a shift never moves a charge earlier than plug-in");
});
