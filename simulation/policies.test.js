// SPDX-License-Identifier: GPL-3.0-only
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
import { loadWindow, generateWorkload, trailingMedians, WORKLOAD } from "./lib.js";
import { createCarbonGovernor } from "../governor/carbon-governor.js";
import { execute } from "../governor/harness.js";
import { sum, median } from "../shared/stats.js";

/** Toy window: peer signal == actual, so hand computation is unambiguous. */
const TOY = {
  id: "TOY", slots: 4, actual: [100, 50, 200, 25], peerMean: [100, 50, 200, 25],
  slotStarts: ["2026-01-01T00:00Z", "2026-01-01T00:30Z", "2026-01-01T01:00Z", "2026-01-01T01:30Z"],
};
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
    // Empirical on the committed traces, not structural: deferral targets are chosen on
    // the peer FORECAST and charged on the national ACTUAL, and about 12% of deferred
    // tasks land on a slot that is dirtier on the actual than their arrival slot. The
    // aggregate still held on every committed seed and window; a regenerated trace could
    // legitimately flip it. The perfect-signal test below is the structural version.
    assert.ok(m.totalG < p0.totalG, "on the committed traces, the governor emits less than always-run");
  }
});

test("perfect signal (peer == actual): P2 never exceeds P0 and shifting never exceeds naive, by construction", async () => {
  // The structural version of the two trace-bound assertions above. When the signal the
  // scheduler sees IS the series it is charged on, every deferral target is the argmin of
  // a range that contains the arrival slot, degraded work costs 0.4x, and a terminated
  // task costs nothing — so each task and each session emits no more than its baseline.
  for (const id of ["W1", "W2"]) {
    const real = loadWindow(id);
    const W = { ...real, peerMean: real.actual, peerMax: real.actual };
    const tasks = generateWorkload(101, W.slots);
    const p0 = runP0(tasks, W);
    for (const f of [0.6, 0.8, 1.0]) {
      const m = await runP2(tasks, W, f * median(p0.dayG), WORKLOAD.degradedEnergyFraction);
      assert.ok(m.totalG <= p0.totalG, `${id} f=${f}: governor ${m.totalG} > always-run ${p0.totalG}`);
    }
    const plan = schedule(W, 303);
    const base = naive(W, plan);
    const run = await governed(W, plan, 303, 1.0, FLEET.budgetFactor * median(base.nightly));
    assert.ok(run.totalG <= base.totalG, `${id}: governed ${run.totalG} > naive ${base.totalG}`);
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
  // Empirical on the committed traces (4.44% of W1 and 2.34% of W2 sessions have a
  // peer-chosen window that is dirtier on the actual series than charging at plug-in;
  // the aggregate still held on every seed and approval rate). See the perfect-signal test.
  assert.ok(run.totalG < base.totalG, "on the committed traces, shifting reduces emissions");
  assert.equal(run.auditValid, true);
  assert.ok(run.shiftHours.every((h) => h > 0), "a shift never moves a charge earlier than plug-in");
});

// ── The harness rule, as the simulations rely on it (ADR-006, governor/harness.js) ──

test("execute() never runs a terminate task, with or without an approved approval", () => {
  for (const approval of [undefined, { approved: false }, { approved: true, by: "someone" }, { approved: true }]) {
    let ran = false;
    const r = execute({ action: "terminate" }, () => { ran = true; }, approval);
    assert.equal(ran, false, `terminate ran with approval ${JSON.stringify(approval)}`);
    assert.equal(r.executed, false);
    assert.equal(r.reason, "terminate is not overridable");
  }
});

test("execute() runs allow/degrade unasked, and escalate/block only when approved", () => {
  for (const action of ["allow", "degrade"]) {
    assert.equal(execute({ action }, () => "done").executed, true, action);
  }
  for (const action of ["escalate", "block"]) {
    assert.equal(execute({ action }, () => "done").executed, false, action);
    assert.equal(execute({ action }, () => "done", { approved: false }).executed, false, action);
    assert.equal(execute({ action }, () => "done", { approved: "yes" }).executed, false, `${action}: only === true counts`);
    assert.equal(execute({ action }, () => "done", { approved: true }).executed, true, action);
  }
});

test("commit() throws on a bad value rather than absorbing a silent zero", () => {
  const gov = createCarbonGovernor({ budgetG: 1000 });
  gov.commit(10);
  for (const bad of [NaN, -1, Infinity, undefined, null, "5", {}]) {
    assert.throws(() => gov.commit(bad), /finite, non-negative/, `commit(${String(bad)}) should throw`);
  }
  assert.equal(gov.spentG, 10, "a refused commit leaves the budget untouched");
  gov.commit(0);
  assert.equal(gov.spentG, 10, "zero is a legal commit");
  gov.reset();
  assert.equal(gov.spentG, 0);
});

test("P2 counts block verdicts on deferrable work separately, for the sensitivity number", async () => {
  // ratio 100/90 = 1.11 -> block; the task is deferrable, so the outcome is a deferral.
  const m = await runP2([task({ deferrable: true, deadline: 3 })], TOY, 90, 0.4);
  assert.deepEqual([m.blocks, m.blocksDeferrable, m.humanDecisions, m.deferred], [1, 1, 1, 1]);
  // Non-deferrable block: still a human decision, but not a deferral.
  const n = await runP2([task({})], TOY, 90, 0.4);
  assert.deepEqual([n.blocks, n.blocksDeferrable, n.humanDecisions], [1, 0, 1]);
});

test("P1t defers on a trailing median and never looks ahead", () => {
  // Trailing window of 2 slots: at slot 2 the threshold is median(100, 50) = 75, and the
  // peer signal there is 200, so a deferrable task arriving at slot 2 waits for slot 3.
  const trailing = trailingMedians(TOY.peerMean, 2);
  assert.deepEqual(trailing, [Infinity, 100, 75, 125]);
  const m = runP1([task({ arrival: 2, deferrable: true, deadline: 3 })], TOY, (slot) => trailing[slot]);
  assert.equal(m.totalG, 25);
  assert.deepEqual(m.delays, [30]);
  // At slot 0 there is no history at all, so nothing defers: the honest cold start.
  const cold = runP1([task({ arrival: 0, deferrable: true, deadline: 3 })], TOY, (slot) => trailing[slot]);
  assert.equal(cold.totalG, 100);
  assert.deepEqual(cold.delays, []);
});


// ── E2b sweep invariants (WP-1) — read from the committed results ─────────────
// The sweep's two comparisons are load-bearing: the peer-column expectation is the
// calculus for the very policy the seeds run (agreement is a cross-validation, like
// E3's argmin_ungated vs bounds), and the oracle column is a true ceiling. Both are
// asserted here against results/simulation.json so a regression cannot ship quietly.
import { readFileSync } from "node:fs";

test("E2b sweep: seeded runs agree with the analytic expectation and respect the oracle ceiling", () => {
  const doc = JSON.parse(readFileSync(new URL("../results/simulation.json", import.meta.url), "utf8"));
  for (const id of ["W1", "W2"]) {
    for (const [k, a] of Object.entries(doc.results[id].sweep.arms)) {
      assert.ok(Math.abs(a.agreementPct - 100) <= 2,
        `${id} ${k}: seeded mean must agree with the expectation within 2% (got ${a.agreementPct}%)`);
      assert.ok(-a.pctVsP0.mean <= a.ceilingPctOracle + 0.5,
        `${id} ${k}: a peer-deciding policy cannot beat the oracle beyond noise`);
      assert.ok(a.headroomToOraclePp >= -0.5, `${id} ${k}: headroom to oracle cannot be meaningfully negative`);
    }
  }
});

test("E2b sweep: more room never saves less — monotone in horizon and in deferrable fraction", () => {
  const doc = JSON.parse(readFileSync(new URL("../results/simulation.json", import.meta.url), "utf8"));
  const TOL = 0.5; // seeded noise
  for (const id of ["W1", "W2"]) {
    const arms = doc.results[id].sweep.arms;
    for (const f of ["0.5", "1"]) {
      let prev = -Infinity;
      for (const h of [6, 12, 24, 48]) {
        const saving = -arms[`h${h}_f${f}`].pctVsP0.mean;
        assert.ok(saving >= prev - TOL, `${id} f=${f} h=${h}: a longer horizon cannot save less`);
        prev = saving;
      }
    }
    for (const h of [6, 12, 24, 48]) {
      assert.ok(-arms[`h${h}_f1`].pctVsP0.mean >= -arms[`h${h}_f0.5`].pctVsP0.mean - TOL,
        `${id} h=${h}: more deferrable work cannot save less`);
    }
  }
});

test("E2b sweep: the argmin objective dominates the threshold at the same settings", () => {
  const doc = JSON.parse(readFileSync(new URL("../results/simulation.json", import.meta.url), "utf8"));
  for (const id of ["W1", "W2"]) {
    const p1 = -doc.results[id].policies.P1.pctVsP0.mean;
    const p3 = -doc.results[id].sweep.arms["h6_f0.5"].pctVsP0.mean;
    assert.ok(p3 > p1, `${id}: argmin at P1's own horizon/fraction must beat the threshold (P3 ${p3} vs P1 ${p1})`);
  }
});


test("WP-2 decomposition: the three exact shares reassemble the whole saving", () => {
  const doc = JSON.parse(readFileSync(new URL("../results/simulation.json", import.meta.url), "utf8"));
  for (const id of ["W1", "W2"]) {
    for (const [name, pol] of Object.entries(doc.results[id].policies)) {
      if (!pol.dropShareOfSavingPct) continue;
      const total = pol.dropShareOfSavingPct.mean + pol.degradeShareOfSavingPct.mean + pol.timingShareOfSavingPct.mean;
      assert.ok(Math.abs(total - 100) < 0.5,
        `${id} ${name}: drop+degrade+timing shares must sum to 100% (got ${total})`);
      assert.ok(pol.savingVsP0G.mean > 0, `${id} ${name}: the governor must save something to decompose`);
    }
  }
});


test("WP-14 tiering: same carbon, fewer humans — the rule moves authorisation, nothing else", () => {
  const doc = JSON.parse(readFileSync(new URL("../results/simulation.json", import.meta.url), "utf8"));
  for (const id of ["W1", "W2"]) {
    const p2 = doc.results[id].policies["P2_f0.8"];
    const t = doc.results[id].policies["P2tiered_f0.8"];
    // The rule changes WHO authorises, never WHAT happens: emissions, completions,
    // drops and degradations must be identical to the untired run, exactly.
    for (const k of ["totalGCO2e", "tasksCompleted", "dropped", "degraded", "deferred"]) {
      assert.deepEqual(t[k], p2[k], `${id}: ${k} must be identical under tiering`);
    }
    // The human count under the rule equals the untired run's own sensitivity
    // prediction, exactly — the mechanism delivers the number it promised.
    assert.deepEqual(t.humanDecisions, p2.humanDecisionsIfDeferralAutomatic,
      `${id}: tiered human decisions must equal the predicted sensitivity`);
    // Everything the rule authorised is exactly the blocked-deferrable set.
    assert.deepEqual(t.ruleApplied, p2.blocksDeferrable,
      `${id}: the rule covers blocked-deferrable work and nothing else`);
    // Terminate stays absolute: same drops, and no rule ever authorised one.
    assert.deepEqual(t.terminations, p2.terminations, `${id}: terminate is untouchable by rules`);
  }
});
