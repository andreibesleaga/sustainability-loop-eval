// SPDX-License-Identifier: GPL-3.0-only
/**
 * simulation/bounds.test.js — invariants of the maximum-optimisation calculus.
 *
 * bounds.js produces CEILINGS, and a ceiling that can be ordered wrongly is worse
 * than no ceiling: every later experiment is checked against these numbers. So the
 * orderings that make them ceilings are asserted here, against the committed
 * results/bounds.json (each test covers both windows).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const doc = JSON.parse(readFileSync(new URL("../results/bounds.json", import.meta.url), "utf8"));
const WINDOWS = ["W1", "W2"];
const HORIZONS = [6, 12, 24, 48];

test("bounds: E2 ceilings — oracle never below peer, saving monotone in horizon and fraction", () => {
  for (const id of WINDOWS) {
    const b = doc.results[id];
    let prevOracle = -Infinity;
    let prevPeer = -Infinity;
    for (const h of HORIZONS) {
      const e = b.e2Potential[`h${h}`];
      for (const f of ["f0.5", "f1"]) {
        assert.ok(e.oracle.byFraction[f].pctSavedVsArrival >= e.peer.byFraction[f].pctSavedVsArrival,
          `${id} h${h} ${f}: deciding on the actual can never do worse than deciding on the peer signal`);
        assert.ok(e.oracle.byFraction[f].pctSavedVsArrival >= 0, `${id} h${h} ${f}: a ceiling cannot be negative`);
      }
      assert.ok(e.oracle.byFraction["f1"].pctSavedVsArrival >= e.oracle.byFraction["f0.5"].pctSavedVsArrival,
        `${id} h${h}: more deferrable work cannot save less`);
      assert.ok(e.oracle.byFraction["f1"].pctSavedVsArrival >= prevOracle, `${id} h${h}: a longer horizon cannot save less (oracle)`);
      assert.ok(e.peer.byFraction["f1"].pctSavedVsArrival >= prevPeer, `${id} h${h}: a longer horizon cannot save less (peer)`);
      prevOracle = e.oracle.byFraction["f1"].pctSavedVsArrival;
      prevPeer = e.peer.byFraction["f1"].pctSavedVsArrival;
    }
  }
});

test("bounds: E3 arm orderings that make these bounds, and a decomposition that reassembles", () => {
  for (const id of WINDOWS) {
    const b = doc.results[id];
    const a = b.e3.arms;
    // Relaxing the contiguity constraint can only help, on the signal it optimises.
    assert.ok(a.interruptible_actual.pctAvoidedVsNaive >= a.argmin_actual.pctAvoidedVsNaive - 1e-9,
      `${id}: interruptible on the actual is the floor of floors`);
    assert.ok(a.interruptible_peer.pctAvoidedVsNaive >= a.argmin_peer.pctAvoidedVsNaive - 1e-9,
      `${id}: interruptible on the peer signal beats contiguous on the peer signal`);
    // A perfect signal can only help, within the same contiguity constraint.
    assert.ok(a.argmin_actual.pctAvoidedVsNaive >= a.argmin_peer.pctAvoidedVsNaive - 1e-9,
      `${id}: the oracle signal beats the peer signal`);
    assert.equal(a.naive.pctAvoidedVsNaive, 0);
    assert.equal(a.naive.meanStartDelayHours, 0);
    // The decomposition must reassemble into the total for every non-naive arm.
    for (const [name, arm] of Object.entries(a)) {
      if (!arm.decomposition) continue;
      const total = arm.decomposition.peakAvoidancePp + arm.decomposition.cleanSeekingPp;
      assert.ok(Math.abs(total - arm.pctAvoidedVsNaive) < 0.05,
        `${id} ${name}: peak-avoidance + clean-seeking must equal the total saving (got ${total} vs ${arm.pctAvoidedVsNaive})`);
    }
    // Shifting cannot put MORE charge energy into the evening peak than plugging in during it.
    assert.ok(a.argmin_peer.peakEnergySharePct <= a.naive.peakEnergySharePct,
      `${id}: the argmin cannot move energy INTO the evening peak`);
    assert.ok(b.e3.peakKWhMovedPerNight_argmin_peer >= 0);
  }
});

test("bounds: spatial — a minimum is a minimum, and the argmin shares account for every slot", () => {
  for (const id of WINDOWS) {
    const s = doc.results[id].spatial;
    assert.ok(s.meanCheapestPeerGPerKWh <= s.meanPeerSignalGPerKWh,
      `${id}: the per-slot cheapest peer cannot average above the peer mean`);
    assert.ok(s.pctBelowPeerSignal >= 0);
    const shares = Object.values(s.argminShareOfSlotsPct);
    assert.ok(Math.abs(shares.reduce((x, y) => x + y, 0) - 100) < 0.1, `${id}: argmin shares must sum to 100%`);
  }
});

test("bounds: the calculus agrees with the seeded E3 simulation within sampling noise", () => {
  // The seeded argmin_ungated arm and bounds.js's argmin_peer expectation are the same
  // policy under the same model; they may differ only by the simulation's plug-in
  // sampling. A gap beyond half a point would mean the two models have diverged.
  const charging = JSON.parse(readFileSync(new URL("../results/charging.json", import.meta.url), "utf8"));
  for (const id of WINDOWS) {
    const seeded = charging.results[id].argmin_ungated.pctAvoidedVsNaive.mean;
    const expectation = doc.results[id].e3.arms.argmin_peer.pctAvoidedVsNaive;
    assert.ok(Math.abs(seeded - expectation) < 0.5,
      `${id}: seeded ${seeded}% vs expectation ${expectation}% — models diverged`);
  }
});
