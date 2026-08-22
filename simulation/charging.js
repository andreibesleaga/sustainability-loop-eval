/**
 * E3 — Gated EV-charging shift on REAL grid-carbon traces.
 *
 * A fleet of 50 EVs plugs in each evening and must be full by 07:00. An agent
 * proposes moving the (fixed-length, fixed-energy) charge to the cleanest 3-hour
 * window it can see in the peer signal. Because that action touches physical
 * infrastructure, the proposal goes through the REAL gate AND requires a human
 * approval before it executes.
 *
 * HARD SAFETY / LEGAL CONSTRAINT, enforced by construction in this file:
 *   the ONLY thing that ever changes is the START TIME of a full charge inside the
 *   driver's own plug-in window. There is no discharge, no vehicle-to-grid, no
 *   state-of-charge logic, and no charge-vs-discharge decision anywhere. Every car
 *   always receives the full 20 kWh before its deadline, in every arm of every run.
 *   A gate refusal or a withheld approval falls back to charging naively — never to
 *   charging less, later than the deadline, or not at all.
 *
 * Real: the carbon traces. Synthetic: the fleet, the plug-in times, the approver.
 * Run: npm run charging     Output: results/charging.json + results/charging.md
 */
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createCarbonGovernor } from "../governor/carbon-governor.js";
import { makeGate, gated } from "../governor/gate.js";
import { mulberry32, randInt } from "../shared/prng.js";
import { mean, median, ms, sum } from "../shared/stats.js";
import { loadWindow } from "./lib.js";
import { renderChargingMd } from "./report.js";

export const FLEET = {
  vehicles: 50,
  energyKWh: 20,
  chargerKW: 7,
  chargeSlots: 6,                       // 3 h of 30-min slots
  plugInSlotRange: [34, 38],            // 17:00–19:00 UTC, i.e. 18:00 ± 1 h
  deadlineSlotOffset: 62,               // 07:00 next morning, measured from midnight
  budgetFactor: 0.8,                    // daily budget = 0.8 x median naive daily fleet emissions
  approvalRates: [1.0, 0.8],
  note: "SYNTHETIC fleet. 20 kWh delivered evenly over 3 h (avg 6.67 kW; a 7 kW charger's nameplate 3 h would be 21 kWh). No V2G, no discharge, no SoC logic — start-time shifting only.",
};
const SLOTS_PER_DAY = 48, SEEDS = [101, 202, 303, 404, 505, 606, 707, 808, 909, 1010];

/** Grams emitted charging `chargeSlots` slots from `start`, using the NATIONAL ACTUAL series. */
function emissions(W, start, energyKWh) {
  if (start < 0 || start + FLEET.chargeSlots > W.slots) throw new Error(`charge window ${start} runs off the trace`);
  const per = energyKWh / FLEET.chargeSlots;
  let g = 0;
  for (let i = 0; i < FLEET.chargeSlots; i++) g += per * W.actual[start + i];
  return g;
}
/** Mean PEER signal over a candidate window — what the agent can actually see at plug-in. */
function windowSignal(W, start) {
  let s = 0;
  for (let i = 0; i < FLEET.chargeSlots; i++) s += W.peerMean[start + i];
  return s / FLEET.chargeSlots;
}
/** Cleanest legal start: minimises the peer signal, never finishing past the deadline. */
export function bestStart(W, plugIn, deadline) {
  let best = plugIn, bestSig = windowSignal(W, plugIn);
  for (let s = plugIn + 1; s <= deadline - FLEET.chargeSlots; s++) {
    const sig = windowSignal(W, s);
    if (sig < bestSig) { best = s; bestSig = sig; }
  }
  return best;
}

/** Nights that fit entirely inside the window (the last night would run off the end). */
export const nightsIn = (W) => Math.floor((W.slots - FLEET.deadlineSlotOffset) / SLOTS_PER_DAY) + 1;

/**
 * Deterministic plug-in schedule for one seed: [night][vehicle] -> slot index.
 * Each night's plug-ins are sorted, so the governed arm evaluates them in the order
 * the cars actually arrive — budget pacing is only meaningful in chronological order.
 */
export function schedule(W, seed) {
  const rand = mulberry32(seed), nights = nightsIn(W), out = [];
  for (let d = 0; d < nights; d++) {
    const night = [];
    for (let v = 0; v < FLEET.vehicles; v++) night.push(d * SLOTS_PER_DAY + randInt(rand, ...FLEET.plugInSlotRange));
    out.push(night.sort((a, b) => a - b));
  }
  return out;
}

/** Naive arm: charge the moment the car is plugged in. */
export function naive(W, plan) {
  const nightly = plan.map((night) => sum(night.map((p) => emissions(W, p, FLEET.energyKWh))));
  return { totalG: sum(nightly), nightly, sessions: plan.length * FLEET.vehicles };
}

/**
 * Governed arm. Per session: propose the cleanest window, put the proposal through the
 * gate, then ask a human. Simulated approver: deterministic coin from a seeded PRNG at
 * `approvalRate`. Falls back to the naive charge on a gate refusal or a refused approval.
 */
export async function governed(W, plan, seed, approvalRate, budgetG) {
  const rand = mulberry32(seed ^ 0x5eed);
  const gov = createCarbonGovernor({ budgetG });
  const { gate, audit } = makeGate(gov);
  const m = { totalG: 0, shifted: 0, approvalsRequested: 0, approvalsGranted: 0, gateRefused: 0,
    shiftHours: [], actions: { allow: 0, degrade: 0, escalate: 0, block: 0, terminate: 0 }, nightly: [] };
  for (let d = 0; d < plan.length; d++) {
    gov.reset(); // one budget per night
    let nightG = 0;
    for (const plugIn of plan[d]) {
      const deadline = d * SLOTS_PER_DAY + FLEET.deadlineSlotOffset;
      const start = bestStart(W, plugIn, deadline);
      const decision = await gated(gate, FLEET.energyKWh * windowSignal(W, start),
        { agentId: "ev-agent", tool: "shift-charge-start" });
      m.actions[decision.action]++;
      const gateOk = decision.action === "allow" || decision.action === "degrade" || decision.action === "escalate";
      let chosen = plugIn; // safe default: the car charges regardless
      if (gateOk) {
        m.approvalsRequested++;
        if (rand() < approvalRate) { m.approvalsGranted++; chosen = start; }
      } else m.gateRefused++;
      if (chosen !== plugIn) { m.shifted++; m.shiftHours.push((chosen - plugIn) / 2); }
      const g = emissions(W, chosen, FLEET.energyKWh);
      gov.commit(g); m.totalG += g; nightG += g;
    }
    m.nightly.push(nightG);
  }
  m.auditValid = audit.verify().valid;
  m.auditRecords = audit.records().length;
  m.nights = plan.length;
  m.nightsOverBudget = m.nightly.filter((g) => g > budgetG).length;
  m.sessions = plan.length * FLEET.vehicles;
  return m;
}

async function main() {
  const doc = { experiment: "E3 — gated EV-charging shift", deterministic: true, seeds: SEEDS,
    fleet: FLEET, safety: "start-time shifting only; no V2G/discharge/SoC logic; every vehicle always receives its full charge before the deadline",
    gate: "kaiban-distributed@2.0.0 ActionGate + hash-chained AuditLog (real code, in-process)",
    provenance: {}, results: {} };

  for (const id of ["W1", "W2"]) {
    const W = loadWindow(id);
    doc.provenance[id] = { label: W.label, from: W.from, to: W.to, nights: nightsIn(W), ...W.provenance };
    const plans = SEEDS.map((s) => schedule(W, s));
    const naives = plans.map((p) => naive(W, p));
    const budgets = naives.map((n) => FLEET.budgetFactor * median(n.nightly));
    const arms = { naive: {
      totalGCO2e: ms(naives.map((n) => n.totalG), 0),
      gPerSession: ms(naives.map((n) => n.totalG / n.sessions), 1),
      sessions: naives[0].sessions,
    } };
    for (const rate of FLEET.approvalRates) {
      const runs = [];
      for (let i = 0; i < SEEDS.length; i++) runs.push(await governed(W, plans[i], SEEDS[i], rate, budgets[i]));
      arms[`governed_approval${rate.toFixed(2)}`] = {
        totalGCO2e: ms(runs.map((x) => x.totalG), 0),
        gPerSession: ms(runs.map((x) => x.totalG / x.sessions), 1),
        pctAvoidedVsNaive: ms(runs.map((x, i) => 100 - (100 * x.totalG) / naives[i].totalG), 2),
        sessionsShifted: ms(runs.map((x) => x.shifted), 1),
        approvalsRequested: ms(runs.map((x) => x.approvalsRequested), 1),
        approvalsGranted: ms(runs.map((x) => x.approvalsGranted), 1),
        gateRefusedShift: ms(runs.map((x) => x.gateRefused), 1),
        meanShiftHours: ms(runs.map((x) => mean(x.shiftHours)), 2),
        gateActions: Object.fromEntries(Object.keys(runs[0].actions).map((k) => [k, ms(runs.map((x) => x.actions[k]), 1)])),
        dailyBudgetG: ms(budgets, 0),
        nights: runs[0].nights,
        nightsOverBudget: ms(runs.map((x) => x.nightsOverBudget), 2),
        auditChainValidAllSeeds: runs.every((x) => x.auditValid),
        auditRecordsPerSeed: ms(runs.map((x) => x.auditRecords), 0),
      };
    }
    doc.results[id] = arms;
  }
  writeFileSync(new URL("../results/charging.json", import.meta.url), JSON.stringify(doc, null, 2) + "\n");
  writeFileSync(new URL("../results/charging.md", import.meta.url), renderChargingMd(doc, FLEET));
  console.log("E3 done -> results/charging.json, results/charging.md");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
