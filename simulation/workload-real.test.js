// SPDX-License-Identifier: GPL-3.0-only
/**
 * simulation/workload-real.test.js — WP-15 invariants: the committed trace is
 * internally consistent, the split conserves energy exactly, the equal-share
 * control brackets what the measured shares contribute, and the write-up claims
 * granularity-invariance — no more. Offline only.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadRealTemplate, realizeWorkload } from "./workload-real.js";
import { generateWorkload } from "./lib.js";
import { renderSimulationMd } from "./report.js";

const doc = JSON.parse(readFileSync(new URL("../results/simulation.json", import.meta.url), "utf8"));
const WINDOWS = ["W1", "W2"];

test("real trace: the committed template is the captured run, not an invention", () => {
  const t = loadRealTemplate();
  assert.equal(t.tasks.length, 6, "extract + 4 composers + aggregate");
  assert.ok(Math.abs(t.tasks.reduce((a, x) => a + x.share, 0) - 1) < 1e-12, "token shares must sum to 1");
  const byId = Object.fromEntries(t.tasks.map((x) => [x.id, x]));
  assert.deepEqual(byId["extract"].dependsOn, [], "extract starts the pipeline");
  for (const c of ["compose-tweet", "compose-linkedin", "compose-discord", "compose-blog"]) {
    assert.deepEqual(byId[c].dependsOn, ["extract"], `${c} depends only on extract (fan-out)`);
  }
  assert.equal(byId["aggregate"].dependsOn.length, 4, "aggregate fans in all four composers");
  // The provenance the replay's honesty rests on.
  const raw = JSON.parse(readFileSync(new URL("../data/workloads/real-trace.json", import.meta.url), "utf8"));
  assert.match(raw.provenance.liveOnce, /once/i, "network/money spent once, at capture");
  assert.match(raw.provenance.anonymisation, /stripped/i, "content must be stripped, structure kept");
  assert.ok(raw.provenance.runDurationMs < 30 * 60 * 1000, "the run is sub-slot — the stated reason timing is not replayed");
});

test("real trace: the split conserves every parent's energy exactly and inherits its constraints", () => {
  const tasks = generateWorkload(101, 96);
  const real = realizeWorkload(tasks);
  assert.equal(real.length, tasks.length * 6);
  for (let i = 0; i < tasks.length; i++) {
    const parts = real.slice(i * 6, i * 6 + 6);
    const sum = parts.reduce((a, x) => a + x.energyKWh, 0);
    assert.ok(Math.abs(sum - tasks[i].energyKWh) < 1e-12 * Math.max(1, tasks[i].energyKWh),
      `parent ${i}: energy must be conserved (${sum} vs ${tasks[i].energyKWh})`);
    for (const x of parts) {
      assert.equal(x.arrival, tasks[i].arrival);
      assert.equal(x.deadline, tasks[i].deadline);
      assert.equal(x.deferrable, tasks[i].deferrable);
    }
  }
});

test("real trace: granularity-invariance, and the control that keeps the claim honest", () => {
  for (const id of WINDOWS) {
    const rw = doc.results[id].realWorkload;
    assert.ok(rw, `${id}: the WP-15 arm must exist`);
    const m = rw["P2real_f0.8"];
    const eq = rw["P2equal6_f0.8"];
    const p = doc.results[id].policies["P2_f0.8"];
    assert.ok(eq, `${id}: the equal-share control must exist — the claim is not honest without it`);
    // The measured claim: P2's saving is invariant to decision granularity.
    assert.ok(Math.abs(m.pctVsP0.mean - p.pctVsP0.mean) < 0.5,
      `${id}: six-way splitting must move the headline by at most a rounding step (${m.pctVsP0.mean} vs ${p.pctVsP0.mean})`);
    // And the control shows the measured token shares are not what drives it:
    // equal shares must land within a whisker of the real ones.
    assert.ok(Math.abs(m.pctVsP0.mean - eq.pctVsP0.mean) < 0.1,
      `${id}: the equal-share control must match the real shares (${m.pctVsP0.mean} vs ${eq.pctVsP0.mean})`);
    // The human-decision column is k-by-construction: ~6x for both arms alike.
    for (const [label, arm] of [["real", m], ["equal", eq]]) {
      const mult = arm.humanDecisions.mean / p.humanDecisions.mean;
      assert.ok(mult > 5 && mult < 7,
        `${id} ${label}: per-subtask gating must scale decisions ~linearly with k=6 (got x${mult.toFixed(2)})`);
    }
    assert.equal(rw.subtasksPerArrival, 6);
    assert.ok(m.auditChainValidAllSeeds, `${id}: the audit chain must verify`);
  }
});

test("real trace: the write-up claims granularity-invariance and mechanics, not discoveries", () => {
  const md = readFileSync(new URL("../results/simulation.md", import.meta.url), "utf8");
  assert.match(md, /invariant to decision granularity/i, "the supportable claim must be the one stated");
  assert.match(md, /equal shares give the same answer/i, "the control's verdict must be printed");
  assert.match(md, /by construction, not by measurement/i, "the kx decision cost must be called mechanical");
  assert.match(md, /one run, one workflow/i, "the single-run caveat must be stated");
  assert.match(md, /sub-slot/i, "the timing-not-replayed reason must be stated");
  assert.match(md, /phase order/i, "the possible phase-order violation must be admitted");
  assert.doesNotMatch(md, /survives contact with a real workload shape/i, "the withdrawn overclaim must not return");
});

test("simulation: the committed write-up IS the renderer's output — generator drift is impossible to hide", () => {
  const md = readFileSync(new URL("../results/simulation.md", import.meta.url), "utf8");
  assert.equal(md, renderSimulationMd(doc), "results/simulation.md must equal renderSimulationMd(results/simulation.json) byte for byte — regenerate with `npm run simulate`");
});
