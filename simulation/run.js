// SPDX-License-Identifier: GPL-3.0-only
/**
 * E2 — Carbon-Verdict Governor vs baselines, on REAL grid-carbon traces.
 *
 * Real:      the 30-min carbon-intensity series (national ACTUAL = ground truth for
 *            emissions; 3 peers' published regional FORECAST = the peer signal).
 * Synthetic: the workload (see WORKLOAD in lib.js) and the human approver.
 *
 * Three policies replay the SAME task list per seed:
 *   P0 always-run          — run every task the moment it arrives.
 *   P1 defer-threshold     — carbon-aware scheduling baseline (GSF-style): defer
 *                            deferrable work while the peer signal is above its
 *                            28-day median.
 *   P2 carbon-verdict gov. — every task is a gated action: the estimate goes through
 *                            the REAL kaiban-distributed ActionGate, and the returned
 *                            rung (allow/degrade/escalate/block/terminate) is executed.
 *
 * Scheduling only ever looks at the peer FORECAST signal, never at the national
 * actual series, so no policy gets an oracle view of the ground truth it is scored on.
 *
 * Run: npm run simulate     Output: results/simulation.json + results/simulation.md
 */
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createCarbonGovernor } from "../governor/carbon-governor.js";
import { makeGate, gated } from "../governor/gate.js";
import { execute } from "../governor/harness.js";
import { mean, median, p95, pearson, r, ms } from "../shared/stats.js";
import { loadWindow, generateWorkload, trailingMedians, WORKLOAD } from "./lib.js";
import { renderSimulationMd } from "./report.js";

const SEEDS = [101, 202, 303, 404, 505, 606, 707, 808, 909, 1010];
const F_VALUES = [0.6, 0.7, 0.8, 0.9, 1.0];
const SLOT_MINUTES = 30;
const SLOTS_PER_DAY = (24 * 60) / SLOT_MINUTES; // 48
const P1T_TRAILING_DAYS = 7;                    // P1t's causal threshold window

/** Fresh tally for one run. `delays` collects per-task deferral minutes. */
function tally(days) {
  return { totalG: 0, completed: 0, onTime: 0, dropped: 0, degraded: 0, deferred: 0,
    delays: [], escalations: 0, blocks: 0, terminations: 0, humanDecisions: 0,
    blocksDeferrable: 0, dayG: new Array(days).fill(0) };
}

/** Record one execution: emissions from the NATIONAL ACTUAL series at the run slot. */
function exec(m, W, task, slot, energyKWh) {
  const g = energyKWh * W.actual[slot];
  m.totalG += g;
  m.dayG[Math.floor(slot / SLOTS_PER_DAY)] += g;
  m.completed++;
  if (slot <= task.deadline) m.onTime++;
  if (energyKWh < task.energyKWh) m.degraded++;
  if (slot > task.arrival) { m.deferred++; m.delays.push((slot - task.arrival) * SLOT_MINUTES); }
  return g;
}

/** Cleanest slot in [from, to] by the PEER signal (the forecast an agent can see). */
function cleanest(W, from, to) {
  let best = from;
  for (let s = from + 1; s <= to; s++) if (W.peerMean[s] < W.peerMean[best]) best = s;
  return best;
}

const daysIn = (W) => Math.ceil(W.slots / SLOTS_PER_DAY);

// ── P0: always run ────────────────────────────────────────────────────────────
export function runP0(tasks, W) {
  const m = tally(daysIn(W));
  for (const t of tasks) exec(m, W, t, t.arrival, t.energyKWh);
  return m;
}

// ── P1: defer below-median (carbon-aware scheduling baseline) ─────────────────
/**
 * Deferrable work that arrives while the peer signal is above the threshold waits for
 * the first slot at or below it. If no such slot exists before the deadline the task
 * runs AT the deadline — which can be dirtier than running on arrival. That is the
 * honest behaviour of a threshold scheduler and is one reason P1 gains so little.
 *
 * `threshold` is either one number for the whole window (P1: the median of the whole
 * peer series, which uses lookahead — see ADR-010) or a function of the arrival slot
 * (P1t: a trailing median, which does not). The threshold in force at ARRIVAL is the
 * one the task is scheduled against; that is the moment the decision is taken.
 */
export function runP1(tasks, W, threshold) {
  const thresholdAt = typeof threshold === "function" ? threshold : () => threshold;
  const m = tally(daysIn(W));
  for (const t of tasks) {
    let slot = t.arrival;
    const th = thresholdAt(t.arrival);
    if (t.deferrable && W.peerMean[t.arrival] > th) {
      slot = t.deadline;
      for (let s = t.arrival; s <= t.deadline; s++) if (W.peerMean[s] <= th) { slot = s; break; }
    }
    exec(m, W, t, slot, t.energyKWh);
  }
  return m;
}

// ── P2: carbon-verdict governor, decisions through the real gate ──────────────
/**
 * Each task is gated exactly once, when it arrives: the estimate is what the agent can
 * see (its energy x the peer signal now), while the budget is charged with the ACTUAL
 * grams emitted when the work runs. The rung then selects the plan:
 *
 *   allow                     -> run now, full energy.
 *   degrade | escalate | block-> deferrable work moves to the cleanest slot the peer
 *                                signal predicts before its deadline; non-deferrable
 *                                work runs now at `degradedFraction` of its energy.
 *   terminate                 -> the task is dropped; nothing runs, and nobody is asked.
 *
 * The three middle rungs choose the same physical action on purpose: what separates
 * them is who authorises it. `degrade` is automatic; `escalate` and `block` are only
 * carried out because a human approves them, and every one of those is counted as a
 * human decision (so humanDecisions == escalations + blocks, by construction). The
 * simulated approver always approves — it is the workload's cost in human attention
 * that is being measured here, not the approver's judgement.
 *
 * Every actuation goes through governor/harness.js's execute(), including the delayed
 * run of a deferred task: a deferred task is a PAUSED task, executing the decision it
 * was already gated and audited for on arrival (ADR-016), not a new ungated action.
 * `terminate` is handed a plan that throws if it is ever called — execute() refuses it
 * outright, so the throw is an assertion that the rung is truly not overridable.
 */
export async function runP2(tasks, W, budgetG, degradedFraction) {
  const m = tally(daysIn(W));
  const gov = createCarbonGovernor({ budgetG });
  // Deterministic gate clock derived from the trace's own slot grid, so an audit
  // record is stamped with the simulated time the decision was taken.
  let clockSlot = 0;
  const { gate, audit } = makeGate(gov, { clock: () => W.slotStarts?.[clockSlot] });
  const arrivals = Array.from({ length: W.slots }, () => []);
  for (const t of tasks) arrivals[t.arrival].push(t);
  const queued = Array.from({ length: W.slots }, () => []); // paused tasks due to run

  for (let slot = 0; slot < W.slots; slot++) {
    clockSlot = slot;
    if (slot % SLOTS_PER_DAY === 0) gov.reset(); // new day, new budget
    for (const q of queued[slot]) {
      execute(q.decision, () => gov.commit(exec(m, W, q.task, slot, q.energyKWh)), q.approval);
    }
    for (const t of arrivals[slot]) {
      const estimateG = t.energyKWh * W.peerMean[slot]; // peers' published signal
      const decision = await gated(gate, estimateG);
      const { action } = decision;
      // Internal invariant: gated() normalises any verdict outside the ladder to
      // "block" (governor/gate.js), so `action` is always one of the five rungs.
      if (action === "escalate") { m.escalations++; m.humanDecisions++; }
      else if (action === "block") { m.blocks++; m.humanDecisions++; if (t.deferrable) m.blocksDeferrable++; }
      if (action === "terminate") m.terminations++;

      // The human port. The simulated approver always approves; `terminate` is never
      // put to a human at all, which is why it gets no approval object.
      const approval = action === "escalate" || action === "block"
        ? { approved: true, by: "simulated-approver" }
        : undefined;

      const now = (energyKWh) => gov.commit(exec(m, W, t, slot, energyKWh));
      // Defer to the cleanest slot the peer signal predicts before the deadline; if
      // that is the current slot, run straight away (its queue is already past).
      const defer = () => {
        const s = cleanest(W, slot, t.deadline);
        if (s === slot) now(t.energyKWh);
        else queued[s].push({ task: t, energyKWh: t.energyKWh, decision, approval });
      };
      const plan =
        action === "allow" ? () => now(t.energyKWh)
        : action === "terminate" ? () => { throw new Error("unreachable: terminate executed"); }
        : t.deferrable ? defer
        : () => now(t.energyKWh * degradedFraction);

      const { executed } = execute(decision, plan, approval);
      if (!executed) m.dropped++;
    }
  }
  // Accounting invariant: every task either completed or was dropped. Nothing vanishes.
  if (m.completed + m.dropped !== tasks.length) throw new Error(`lost tasks: ${tasks.length - m.completed - m.dropped}`);
  m.auditValid = audit.verify().valid;
  m.auditRecords = audit.records().length; // one gate decision per task, measured not assumed
  m.days = m.dayG.length;
  m.daysOverBudget = m.dayG.filter((g) => g > budgetG).length;
  m.budgetG = budgetG;
  return m;
}

/** Collapse per-seed tallies into the reported mean +- sd block. */
function summarize(runs, p0Totals) {
  const pick = (f) => runs.map(f);
  const out = {
    totalGCO2e: ms(pick((m) => m.totalG), 0),
    pctVsP0: ms(runs.map((m, i) => (100 * m.totalG) / p0Totals[i] - 100), 2),
    tasksCompleted: ms(pick((m) => m.completed), 1),
    completedOnTime: ms(pick((m) => m.onTime), 1),
    dropped: ms(pick((m) => m.dropped), 1),
    degraded: ms(pick((m) => m.degraded), 1),
    deferred: ms(pick((m) => m.deferred), 1),
    meanDelayMin: ms(pick((m) => mean(m.delays)), 1),
    p95DelayMin: ms(pick((m) => p95(m.delays)), 1),
    escalations: ms(pick((m) => m.escalations), 1),
    humanDecisions: ms(pick((m) => m.humanDecisions), 1),
    blocks: ms(pick((m) => m.blocks), 1),
    // Sensitivity: block verdicts on DEFERRABLE work, whose physical outcome is only a
    // deferral. If deferral of blocked work were automatic rather than approved, the
    // human-decision count would be humanDecisionsIfDeferralAutomatic instead.
    blocksDeferrable: ms(pick((m) => m.blocksDeferrable), 1),
    humanDecisionsIfDeferralAutomatic: ms(pick((m) => m.humanDecisions - m.blocksDeferrable), 1),
    terminations: ms(pick((m) => m.terminations), 1),
  };
  if (runs[0].auditValid !== undefined) {
    out.days = runs[0].days;
    out.daysOverBudget = ms(pick((m) => m.daysOverBudget), 2);
    out.dailyBudgetG = ms(pick((m) => m.budgetG), 0);
    out.auditChainValidAllSeeds = runs.every((m) => m.auditValid);
    out.auditRecordsPerSeed = ms(pick((m) => m.auditRecords), 0);
  }
  return out;
}

async function main() {
  const windows = ["W1", "W2"].map((id) => loadWindow(id));
  const results = {}, correlations = {}, provenance = {};

  for (const W of windows) {
    provenance[W.id] = { label: W.label, from: W.from, to: W.to, days: daysIn(W), ...W.provenance };
    correlations[W.id] = {
      peerMeanVsNationalActual: r(pearson(W.peerMean, W.actual), 3),
      peerMaxVsNationalActual: r(pearson(W.peerMax, W.actual), 3),
      meanPeerMeanGPerKWh: r(mean(W.peerMean), 1),
      meanNationalActualGPerKWh: r(mean(W.actual), 1),
    };
    const threshold = median(W.peerMean);
    const trailing = trailingMedians(W.peerMean, (P1T_TRAILING_DAYS * 24 * 60) / SLOT_MINUTES);
    const workloads = SEEDS.map((s) => generateWorkload(s, W.slots));
    const p0 = workloads.map((tasks) => runP0(tasks, W));
    const p0Totals = p0.map((m) => m.totalG);
    const win = {
      peerMedianThresholdG: r(threshold, 1),
      p1tTrailingMedianDays: P1T_TRAILING_DAYS,
      tasksPerSeed: ms(workloads.map((t) => t.length), 1),
      policies: {},
    };
    win.policies.P0 = summarize(p0, p0Totals);
    win.policies.P1 = summarize(workloads.map((t) => runP1(t, W, threshold)), p0Totals);
    win.policies.P1t = summarize(workloads.map((t) => runP1(t, W, (slot) => trailing[slot])), p0Totals);
    for (const f of F_VALUES) {
      // Budget: f x the median of P0's own daily emissions for that seed's workload.
      const runs = [];
      for (let i = 0; i < SEEDS.length; i++) {
        const budgetG = f * median(p0[i].dayG);
        runs.push(await runP2(workloads[i], W, budgetG, WORKLOAD.degradedEnergyFraction));
      }
      win.policies[`P2_f${f.toFixed(1)}`] = summarize(runs, p0Totals);
    }
    results[W.id] = win;
  }
  const doc = {
    experiment: "E2 — carbon-verdict governor vs baselines",
    deterministic: true, seeds: SEEDS, budgetFactors: F_VALUES,
    workload: WORKLOAD,
    gate: "kaiban-distributed@2.0.0 ActionGate + hash-chained AuditLog (real code, in-process)",
    ladder: "allow < degrade < escalate < block < terminate (rungs 0.8/1.0/1.1/1.25 of daily budget committed)",
    policies: {
      P0: "always run: every task runs the moment it arrives",
      P1: "threshold deferral against the median of the WHOLE peer series (uses lookahead; disclosed in ADR-010)",
      P1t: `threshold deferral against a TRAILING ${P1T_TRAILING_DAYS}-day median of the peer signal (causal: no lookahead)`,
      P2: "carbon-verdict governor: every task gated once on arrival by the shipped ActionGate",
    },
    invariants: {
      completedOnTime: "BY CONSTRUCTION, not a finding: deadlines are clamped to the window (lib.js) and no policy ever runs a task after its deadline, so completedOnTime always equals tasksCompleted.",
      humanDecisions: "escalations + blocks, by construction: every escalate and every block verdict is authorised by the simulated approver and counted as one human decision.",
    },
    correlations, provenance, results,
  };
  writeFileSync(new URL("../results/simulation.json", import.meta.url), JSON.stringify(doc, null, 2) + "\n");
  writeFileSync(new URL("../results/simulation.md", import.meta.url), renderSimulationMd(doc));
  console.log("E2 done -> results/simulation.json, results/simulation.md");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
