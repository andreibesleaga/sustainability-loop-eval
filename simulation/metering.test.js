// SPDX-License-Identifier: GPL-3.0-only
/**
 * simulation/metering.test.js — conformance suite for the metering port
 * (docs/ports/METERING.md): commit() must reconcile spent-actuals to the
 * MEASURED actual, never the agent's declared estimate; that reconciliation
 * must land before the next gated decision touches the same budget, so an
 * under-declared estimate can mislead at most the one decision it gated;
 * and a bad reading must be refused loudly (a thrown error, ADR-005), never
 * absorbed as a silent zero — this port has no `null`-refusal like forecast's,
 * because a meter either produces a valid finite non-negative reading or the
 * adapter has nothing legitimate to report at all. Offline, deterministic,
 * fixed inputs throughout — no randomness, no network, no wall clock. Tests
 * run against the real governor core and the real `simulation/run.js` policy,
 * not mocks.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createCarbonGovernor } from "../governor/carbon-governor.js";
import { runP2 } from "./run.js";

test("metering port: commit() reconciles spent-actuals to the measured actual, not the declared estimate", () => {
  const gov = createCarbonGovernor({ budgetG: 100 });
  const estimateG = 1; // the acting agent's self-declared claim about itself
  const decision = gov.decide(estimateG);
  assert.equal(decision.action, "allow", "a small declared estimate must gate as allow");

  const actualG = 90; // the meter reading, taken AFTER the action ran
  gov.commit(actualG); // metering: charge what was measured, never what was declared
  assert.equal(gov.spentG, actualG, "spent-actuals must equal the measured actual");
  assert.notEqual(gov.spentG, estimateG, "spent-actuals must never equal the declared estimate once metered");
});

test("metering port: an under-declared estimate can mislead at most the one decision it gated", () => {
  const budgetG = 100;
  const honest = createCarbonGovernor({ budgetG });
  const liar = createCarbonGovernor({ budgetG });
  const trueG = 90; // both agents actually emit the same, whatever they declared

  // Step 1: the liar under-declares almost to nothing; the honest agent declares the truth.
  const dHonest1 = honest.decide(trueG);
  const dLiar1 = liar.decide(1);
  assert.equal(dHonest1.action, "degrade", "ratio 0.9 of budget is the degrade rung");
  assert.equal(dLiar1.action, "allow", "the lie buys a lighter verdict for exactly this one action");

  // Metering: both are charged what was ACTUALLY emitted, regardless of what was declared.
  honest.commit(trueG);
  liar.commit(trueG);
  assert.equal(liar.spentG, honest.spentG, "the liar's spent-actuals are corrected to the true grams");

  // Step 2: the next decision, for both agents, is measured against the corrected budget —
  // the liar gets no further slack from the first lie.
  const dHonest2 = honest.decide(trueG);
  const dLiar2 = liar.decide(trueG);
  assert.equal(dHonest2.action, dLiar2.action, "the next decision is identical: reconciliation caught up in one action");
  assert.equal(dLiar2.action, "terminate", "committed 180/100 of budget is past the terminate rung");
});

test("metering port: simulation/run.js commits the national-actual trace, never the peer-signal estimate a task was gated on", async () => {
  // A 2-slot window where the peer signal (what the agent sees and is gated on) is far
  // cleaner than the national actual (what the meter reads after the work runs).
  const W = {
    slots: 2,
    actual: [500, 500], // ground truth: the meter's reading
    peerMean: [5, 5],   // the agent's self-declared basis: far lower
    slotStarts: ["2024-01-01T00:00:00.000Z", "2024-01-01T00:30:00.000Z"],
  };
  const tasks = [
    { arrival: 0, deadline: 0, energyKWh: 1, deferrable: false },
    { arrival: 1, deadline: 1, energyKWh: 1, deferrable: false },
  ];
  const budgetG = 600; // chosen so task 1's declared estimate reads "allow" but its
                        // METERED actual (500) pushes task 2's decision into "degrade"

  const m = await runP2(tasks, W, budgetG, /* degradedFraction */ 0.4);

  assert.equal(m.terminations, 0);
  assert.equal(m.blocks, 0);
  assert.equal(m.escalations, 0);
  assert.equal(m.degraded, 1, "only the second task should have been forced smaller");
  // Task 1 ran at full energy against the ACTUAL trace (1 * 500), never the peer
  // estimate (1 * 5) it was gated on. Task 2 ran degraded (0.4 * 500), because the
  // budget it was measured against already carried task 1's metered actual, not its
  // declared estimate.
  const expectedG = 1 * 500 + 0.4 * 500;
  assert.equal(m.totalG, expectedG,
    "the committed total must reflect the metered actuals of both tasks, not either task's declared estimate");
});

test("metering port: a bad meter reading is refused loudly, never absorbed as a silent zero", () => {
  const gov = createCarbonGovernor({ budgetG: 100 });
  assert.throws(() => gov.commit(NaN), /finite, non-negative number/,
    "a non-finite reading must throw, not silently commit as zero (ADR-005)");
  assert.throws(() => gov.commit(-5), /finite, non-negative number/,
    "a negative reading must throw, not silently commit as zero (ADR-005)");
  assert.equal(gov.spentG, 0, "a refused reading must leave spent-actuals untouched");
});
