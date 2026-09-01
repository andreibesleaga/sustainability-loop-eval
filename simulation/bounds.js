// SPDX-License-Identifier: GPL-3.0-only
/**
 * simulation/bounds.js — the MAXIMUM-OPTIMISATION CALCULUS for both experiments,
 * computed as deterministic expectations over the committed traces. No PRNG, no
 * seeds, no network: every number is an exact arithmetic consequence of
 * data/simulation/W1.json and W2.json plus the models' own constants, so a re-run
 * is byte-identical by construction.
 *
 * What it answers, per window (winter / summer):
 *   1. E2 temporal potential — the best a deferral scheduler could possibly do for
 *      the E2 workload SHAPE, per horizon (6/12/24/48 h), per deferrable fraction
 *      (0.5 / 1.0), deciding on the peer signal (what a causal scheduler can see)
 *      and on the national actual (the oracle). This is the ceiling WP-1's
 *      simulation must sit under, computed before that simulation exists.
 *   2. E3 charging bounds — naive, contiguous argmin on the peer signal (the
 *      shipped ungated arm's policy), contiguous argmin on the actual (value of a
 *      perfect signal), and the INTERRUPTIBLE bound (the 6 cheapest half-hour
 *      slots, not necessarily contiguous) on both signals. The interruptible bound
 *      is the physical floor for start-time-plus-interruption scheduling; the model
 *      itself remains start-time-only by ADR-011.
 *   3. The peak-avoidance vs clean-seeking decomposition of each E3 arm against the
 *      window's own mean intensity — the split that docs/ROADMAP.md section 2c-bis
 *      derived by hand, now produced by a run (WP-2b).
 *   4. The spatial bound — per-slot minimum across the three peer regions'
 *      published (forecast) intensity. FORECAST-SCORED ONLY: the regional series
 *      has no actual (limitation R2), so this is the ceiling of choosing *where*
 *      as seen through the only regional data Great Britain publishes.
 *   5. Monetisable QUANTITIES (kWh in the evening peak by arm, kWh shifted) —
 *      quantities only, deliberately no prices: prices belong to whoever multiplies,
 *      with their own tariff.
 *
 * Expectations, not draws: E2 arrivals are Poisson with a constant rate, so the
 * expected per-task intensity is the unweighted mean over arrival slots; E3 plug-in
 * slots are uniform on {34..38}, so the expectation is the mean over the five
 * cases. Numbers therefore differ from the seeded simulations only by those
 * simulations' sampling noise.
 *
 * Run: npm run bounds     Output: results/bounds.json + results/bounds.md
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mean, r, sum } from "../shared/stats.js";
import { loadWindow, WORKLOAD } from "./lib.js";
import { FLEET, nightsIn } from "./charging.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const SLOTS_PER_DAY = 48;
const SLOT_MINUTES = 30;
const HORIZONS_H = [6, 12, 24, 48];
const FRACTIONS = [0.5, 1.0];
// The evening block used for the peak-energy quantities. Stated in UTC like the
// fleet's plugInSlotRange; the local-time caveat is the same one charging.js makes.
const PEAK = { fromSlot: 32, toSlot: 38, label: "16:00-19:00 UTC" };

// ── generic argmin helpers ───────────────────────────────────────────────────
/** Start s in [from, lastStart] minimising the mean of `series` over `len` slots. */
function bestContiguous(series, from, lastStart, len) {
  let best = from;
  let bestSum = Infinity;
  for (let s = from; s <= lastStart; s++) {
    let acc = 0;
    for (let i = 0; i < len; i++) acc += series[s + i];
    if (acc < bestSum) { bestSum = acc; best = s; }
  }
  return best;
}
/** The `k` slots in [from, to) with the smallest `series` values (stable order). */
function cheapestSlots(series, from, to, k) {
  const idx = [];
  for (let s = from; s < to; s++) idx.push(s);
  idx.sort((a, b) => series[a] - series[b] || a - b);
  return idx.slice(0, k);
}

// ── 1. E2 temporal potential ─────────────────────────────────────────────────
/**
 * Expected per-task emitted intensity (gCO2e/kWh, on the NATIONAL ACTUAL) for the
 * E2 workload shape when every deferrable task runs at the argmin of `decide`
 * within its horizon. Deadlines clamp to the last slot exactly as
 * generateWorkload() clamps them.
 */
function e2Potential(W) {
  const baseMean = mean(W.actual); // run-on-arrival expectation, uniform arrivals
  const out = { baselineMeanGPerKWh: r(baseMean, 2) };
  for (const h of HORIZONS_H) {
    const H = (h * 60) / SLOT_MINUTES;
    const perSignal = {};
    for (const [name, decide] of [["peer", W.peerMean], ["oracle", W.actual]]) {
      const chosen = [];
      for (let t = 0; t < W.slots; t++) {
        const deadline = Math.min(t + H, W.slots - 1);
        let best = t;
        for (let s = t + 1; s <= deadline; s++) if (decide[s] < decide[best]) best = s;
        chosen.push(W.actual[best]); // decided on `decide`, always scored on actual
      }
      const defMean = mean(chosen);
      const byFraction = {};
      for (const f of FRACTIONS) {
        const blended = f * defMean + (1 - f) * baseMean;
        byFraction[`f${f}`] = {
          meanGPerKWh: r(blended, 2),
          pctSavedVsArrival: r((100 * (baseMean - blended)) / baseMean, 2),
        };
      }
      perSignal[name] = { deferrableMeanGPerKWh: r(defMean, 2), byFraction };
    }
    out[`h${h}`] = perSignal;
  }
  return out;
}

// ── 2+3+5. E3 charging bounds, decomposition, peak quantities ────────────────
function e3Bounds(W) {
  const nights = nightsIn(W);
  const plugIns = [];
  for (let p = FLEET.plugInSlotRange[0]; p <= FLEET.plugInSlotRange[1]; p++) plugIns.push(p);
  const perSlotKWh = FLEET.energyKWh / FLEET.chargeSlots;

  /** Mean over nights x plug-ins of `slotsFor(plugIn, deadline)` scored on actual. */
  const arms = {
    naive: (p) => { const s = []; for (let i = 0; i < FLEET.chargeSlots; i++) s.push(p + i); return s; },
    argmin_peer: (p, d) => {
      const s = bestContiguous(W.peerMean, p, d - FLEET.chargeSlots, FLEET.chargeSlots);
      const out = []; for (let i = 0; i < FLEET.chargeSlots; i++) out.push(s + i); return out;
    },
    argmin_actual: (p, d) => {
      const s = bestContiguous(W.actual, p, d - FLEET.chargeSlots, FLEET.chargeSlots);
      const out = []; for (let i = 0; i < FLEET.chargeSlots; i++) out.push(s + i); return out;
    },
    interruptible_peer: (p, d) => cheapestSlots(W.peerMean, p, d, FLEET.chargeSlots),
    interruptible_actual: (p, d) => cheapestSlots(W.actual, p, d, FLEET.chargeSlots),
  };

  const meanActual = mean(W.actual);
  const results = {};
  let naiveGPerSession = 0;
  for (const [name, slotsFor] of Object.entries(arms)) {
    const gs = [];
    const peakShares = [];
    const shiftHours = [];
    for (let dNight = 0; dNight < nights; dNight++) {
      const deadline = dNight * SLOTS_PER_DAY + FLEET.deadlineSlotOffset;
      for (const p0 of plugIns) {
        const p = dNight * SLOTS_PER_DAY + p0;
        const slots = slotsFor(p, deadline);
        if (slots.length !== FLEET.chargeSlots) throw new Error(`${name}: wrong slot count`);
        if (slots[slots.length - 1] >= deadline || slots[0] < p) throw new Error(`${name}: slot outside [plug-in, deadline)`);
        gs.push(sum(slots.map((s) => perSlotKWh * W.actual[s])));
        const inPeak = slots.filter((s) => { const sod = s % SLOTS_PER_DAY; return sod >= PEAK.fromSlot && sod < PEAK.toSlot; }).length;
        peakShares.push(inPeak / FLEET.chargeSlots);
        shiftHours.push(((slots[0] - p) * SLOT_MINUTES) / 60);
      }
    }
    const gPerSession = mean(gs);
    if (name === "naive") naiveGPerSession = gPerSession;
    const naiveIntensity = naiveGPerSession / FLEET.energyKWh;
    const armIntensity = gPerSession / FLEET.energyKWh;
    const totalPct = (100 * (naiveIntensity - armIntensity)) / naiveIntensity;
    results[name] = {
      gPerSession: r(gPerSession, 1),
      pctAvoidedVsNaive: name === "naive" ? 0 : r(totalPct, 2),
      // Decomposition against the window's own mean intensity (WP-2b): how much of
      // the saving is leaving the dirty evening vs finding cleaner-than-average slots.
      decomposition: name === "naive" ? null : {
        peakAvoidancePp: r((100 * (naiveIntensity - meanActual)) / naiveIntensity, 2),
        cleanSeekingPp: r((100 * (meanActual - armIntensity)) / naiveIntensity, 2),
      },
      peakEnergySharePct: r(100 * mean(peakShares), 2),
      meanStartDelayHours: r(mean(shiftHours), 2),
    };
  }
  const kWhPerNight = FLEET.vehicles * FLEET.energyKWh;
  return {
    nights,
    sessionsPerNight: FLEET.vehicles,
    kWhPerNight,
    windowMeanGPerKWh: r(meanActual, 2),
    peak: PEAK,
    // Quantity for whoever wants to price it: kWh moved out of the evening peak by
    // the peer-signal argmin, per night, in expectation.
    peakKWhMovedPerNight_argmin_peer: r(
      kWhPerNight * ((results.naive.peakEnergySharePct - results.argmin_peer.peakEnergySharePct) / 100), 1),
    arms: results,
  };
}

// ── 4b. National forecast accuracy, from the committed pairs ─────────────────
// NESO publishes no error metric anywhere (verified 2026-09-01); the committed
// traces carry both national forecast and actual, so the error is computable here
// and lives in results/ like every other quoted number. CAVEAT, carried into the
// output: these are the forecast values the historical endpoint returns beside the
// settled actual — their issue horizon is not stated by the API, so this is NOT a
// 48-hour-ahead error. A true fw48h error needs prospective capture (WP-3).
function forecastAccuracy(id) {
  const raw = JSON.parse(readFileSync(path.join(ROOT, "data", "simulation", `${id}.json`), "utf8"));
  const F = raw.national.forecast.values;
  const A = raw.national.actual.values;
  let n = 0;
  let sumApe = 0;
  let sumAe = 0;
  let high = 0;
  for (let i = 0; i < A.length; i++) {
    if (!Number.isFinite(F[i]) || !Number.isFinite(A[i]) || A[i] === 0) continue;
    const e = F[i] - A[i];
    sumAe += Math.abs(e);
    sumApe += Math.abs(e) / A[i];
    if (e > 0) high++;
    n++;
  }
  return {
    caveat: "error of the forecast the HISTORICAL endpoint returns beside the settled actual; issue horizon unstated by the API — not a 48-hour-ahead figure (see WP-3)",
    slots: n,
    mapePct: r((100 * sumApe) / n, 2),
    maeGPerKWh: r(sumAe / n, 1),
    forecastHighPctOfSlots: r((100 * high) / n, 1),
  };
}

// ── 4. Spatial bound (forecast-scored only) ──────────────────────────────────
function spatialBound(id) {
  const raw = JSON.parse(readFileSync(path.join(ROOT, "data", "simulation", `${id}.json`), "utf8"));
  const peers = raw.peers.map((p) => ({ name: p.name, values: p.values }));
  const n = raw.slots;
  const minSeries = [];
  const share = Object.fromEntries(peers.map((p) => [p.name, 0]));
  for (let i = 0; i < n; i++) {
    let best = 0;
    for (let j = 1; j < peers.length; j++) if (peers[j].values[i] < peers[best].values[i]) best = j;
    minSeries.push(peers[best].values[i]);
    share[peers[best].name]++;
  }
  const peerMean = [];
  for (let i = 0; i < n; i++) peerMean.push(mean(peers.map((p) => p.values[i])));
  const mMin = mean(minSeries);
  const mMean = mean(peerMean);
  return {
    scoredOn: "peer regional FORECAST series only — the regional endpoints publish no actual (limitation R2), so this ceiling cannot be validated against a regional ground truth",
    peers: peers.map((p) => p.name),
    meanCheapestPeerGPerKWh: r(mMin, 2),
    meanPeerSignalGPerKWh: r(mMean, 2),
    pctBelowPeerSignal: r((100 * (mMean - mMin)) / mMean, 2),
    argminShareOfSlotsPct: Object.fromEntries(
      Object.entries(share).map(([k, v]) => [k, r((100 * v) / n, 2)])),
  };
}

// ── run ──────────────────────────────────────────────────────────────────────
function main() {
  const doc = {
    generatedBy: "simulation/bounds.js (npm run bounds)",
    note: "Deterministic expectation calculus over the committed traces — no PRNG, no seeds, no network. Ceilings and floors, not simulations: the seeded experiments must land under these bounds, and any future arm that beats its bound is a bug.",
    workloadShape: { deferralHorizonsSweptH: HORIZONS_H, deferrableFractionsSwept: FRACTIONS, energyPerTaskKWh: WORKLOAD.energyPerTaskKWh, baseHorizonH: WORKLOAD.deferralHorizonHours },
    fleet: { vehicles: FLEET.vehicles, energyKWh: FLEET.energyKWh, chargeSlots: FLEET.chargeSlots, plugInSlotRange: FLEET.plugInSlotRange, deadlineSlotOffset: FLEET.deadlineSlotOffset },
    results: {},
  };
  for (const id of ["W1", "W2"]) {
    const W = loadWindow(id);
    doc.results[id] = {
      label: W.label,
      e2Potential: e2Potential(W),
      e3: e3Bounds(W),
      spatial: spatialBound(id),
      forecastAccuracy: forecastAccuracy(id),
    };
  }
  writeFileSync(path.join(ROOT, "results", "bounds.json"), JSON.stringify(doc, null, 2) + "\n");
  writeFileSync(path.join(ROOT, "results", "bounds.md"), renderMd(doc));
  for (const id of ["W1", "W2"]) {
    const b = doc.results[id];
    console.log(`${id} E2 ceiling (oracle, f=1.0): h6 ${b.e2Potential.h6.oracle.byFraction["f1"].pctSavedVsArrival}% h12 ${b.e2Potential.h12.oracle.byFraction["f1"].pctSavedVsArrival}% h24 ${b.e2Potential.h24.oracle.byFraction["f1"].pctSavedVsArrival}% h48 ${b.e2Potential.h48.oracle.byFraction["f1"].pctSavedVsArrival}%`);
    console.log(`${id} E3: argmin_peer ${b.e3.arms.argmin_peer.pctAvoidedVsNaive}% | perfect signal ${b.e3.arms.argmin_actual.pctAvoidedVsNaive}% | interruptible floor ${b.e3.arms.interruptible_actual.pctAvoidedVsNaive}%`);
  }
  console.log("bounds done -> results/bounds.json, results/bounds.md");
}

// ── markdown ─────────────────────────────────────────────────────────────────
function renderMd(doc) {
  let out = `# Bounds — the maximum-optimisation calculus\n\nGenerated by \`npm run bounds\` from the committed traces. ${doc.note}\n\n`;
  for (const [id, b] of Object.entries(doc.results)) {
    out += `## ${id} (${b.label})\n\n### E2 temporal potential — % of emissions a deferral scheduler could save, at best\n\nExpected saving vs run-on-arrival for the E2 workload shape (baseline mean ${b.e2Potential.baselineMeanGPerKWh} gCO2e/kWh), by horizon, deciding signal and deferrable fraction f:\n\n| horizon | peer signal, f=0.5 | peer, f=1.0 | oracle, f=0.5 | oracle, f=1.0 |\n|---|---:|---:|---:|---:|\n`;
    for (const h of HORIZONS_H) {
      const e = b.e2Potential[`h${h}`];
      out += `| ${h} h | ${e.peer.byFraction["f0.5"].pctSavedVsArrival}% | ${e.peer.byFraction["f1"].pctSavedVsArrival}% | ${e.oracle.byFraction["f0.5"].pctSavedVsArrival}% | ${e.oracle.byFraction["f1"].pctSavedVsArrival}% |\n`;
    }
    out += `\nThe oracle column decides on the national actual (impossible live); the peer column decides on what a causal scheduler can actually see. The seeded P1/P1t results in \`results/simulation.json\` must sit under the corresponding ceiling, and WP-1's argmin arms should approach the peer column.\n\n### E3 charging bounds (expectation over nights x plug-in slots; scored on the national actual)\n\n| arm | g/session | % avoided vs naive | peak-avoidance pp | clean-seeking pp | % of charge energy in ${b.e3.peak.label} | mean start delay h |\n|---|---:|---:|---:|---:|---:|---:|\n`;
    for (const [name, a] of Object.entries(b.e3.arms)) {
      const d = a.decomposition;
      out += `| ${name} | ${a.gPerSession} | ${a.pctAvoidedVsNaive}% | ${d ? d.peakAvoidancePp : "—"} | ${d ? d.cleanSeekingPp : "—"} | ${a.peakEnergySharePct}% | ${a.meanStartDelayHours} |\n`;
    }
    out += `\n**National forecast accuracy on this window's committed pairs** (${b.forecastAccuracy.slots} slots): MAPE ${b.forecastAccuracy.mapePct}%, MAE ${b.forecastAccuracy.maeGPerKWh} gCO2e/kWh, forecast high in ${b.forecastAccuracy.forecastHighPctOfSlots}% of slots — ${b.forecastAccuracy.caveat}.\n\nWindow mean intensity ${b.e3.windowMeanGPerKWh} gCO2e/kWh. The decomposition splits each arm's saving into "left the dirty evening" (naive vs window mean) and "found cleaner-than-average slots" (window mean vs arm) — the split ROADMAP section 2c-bis derived by hand, now produced by this run. \`interruptible_*\` is a BOUND only: the model stays start-time-only (ADR-011). Quantity for pricing: the peer-signal argmin moves **${b.e3.peakKWhMovedPerNight_argmin_peer} kWh per night** (of ${b.e3.kWhPerNight}) out of ${b.e3.peak.label}, in expectation.\n\n### Spatial bound (forecast-scored only)\n\nCheapest peer region per slot vs the mean peer signal: **${b.spatial.meanCheapestPeerGPerKWh} vs ${b.spatial.meanPeerSignalGPerKWh} gCO2e/kWh (${b.spatial.pctBelowPeerSignal}% lower)**. Argmin share of slots: ${Object.entries(b.spatial.argminShareOfSlotsPct).map(([k, v]) => `${k} ${v}%`).join(", ")}. ${b.spatial.scoredOn}.\n\n`;
  }
  out += `## Reading these numbers\n\n- Every value is an expectation, not a seeded draw; the seeded experiments differ from these only by their own sampling noise.\n- A ceiling here is a *refutation device*: any future arm that reports a saving above its bound has a bug, and any arm far below its ceiling has measurable headroom.\n- The spatial section is a ceiling on *advice*, not on delivery: nothing in this package can move work between regions, and the regional series cannot be scored against a regional actual.\n`;
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
