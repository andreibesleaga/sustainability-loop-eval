// SPDX-License-Identifier: GPL-3.0-only
/**
 * simulation/lib.js — trace loading and the synthetic workload generator.
 *
 * The seeded PRNG and the statistics live in shared/ (one definition for the whole
 * package); this file only knows about carbon traces and about the workload the two
 * experiments replay over them.
 *
 * Determinism rule for this whole package: nothing here reads the wall clock, nothing
 * touches the network, every random draw comes from a seeded mulberry32. Re-running
 * any script must produce byte-identical JSON.
 */
import { readFileSync } from "node:fs";
import { mulberry32, poisson } from "../shared/prng.js";

// ── Traces ────────────────────────────────────────────────────────────────────
/** Fail loudly rather than let a null slot become a NaN somewhere in the results. */
function checkSeries(name, values, slots) {
  if (values.length !== slots) throw new Error(`${name}: expected ${slots} slots, got ${values.length}`);
  const bad = values.findIndex((v) => !Number.isFinite(v) || v < 0);
  if (bad !== -1) throw new Error(`${name}: non-finite or negative value at slot ${bad}`);
}

/**
 * Load a cached window and derive the peer signal.
 * `actual`  — national ACTUAL intensity, the ground truth used for all emissions.
 * `peerMean`— mean of the 3 peers' published (regional FORECAST) intensity.
 * `peerMax` — max of the 3, kept for the one-line sensitivity check.
 *
 * Only the peer series is ever used to *decide* anything, and only the national
 * actual series is ever used to *score* anything. Keeping that split honest is the
 * whole point of this loader.
 */
export function loadWindow(id, dir = new URL("../data/simulation/", import.meta.url)) {
  const d = JSON.parse(readFileSync(new URL(`${id}.json`, dir), "utf8"));
  const n = d.slots;
  checkSeries(`${id} national actual`, d.national.actual.values, n);
  for (const p of d.peers) checkSeries(`${id} peer ${p.name}`, p.values, n);

  const peerMean = [];
  const peerMax = [];
  for (let i = 0; i < n; i++) {
    const vs = d.peers.map((p) => p.values[i]);
    peerMean.push(vs.reduce((a, b) => a + b, 0) / vs.length);
    peerMax.push(Math.max(...vs));
  }
  return {
    id: d.window, label: d.label, from: d.from, to: d.to, slots: n,
    slotMinutes: d.slotMinutes, slotStarts: d.slotStarts,
    actual: d.national.actual.values,
    peerMean, peerMax,
    provenance: {
      provider: d.provider, fetchedAt: d.fetchedAt, units: d.units, slots: n,
      nationalActualGapsCarriedForward: d.national.actual.gapsCarriedForward,
      nationalSourceUrls: d.national.sourceUrls,
      peers: d.peers.map((p) => ({ regionid: p.regionid, name: p.name, series: p.series, note: p.note, gapsCarriedForward: p.gapsCarriedForward, sourceUrls: p.sourceUrls })),
    },
  };
}

// ── Synthetic workload (E2) ───────────────────────────────────────────────────
/** All workload knobs in one place; echoed verbatim into the results JSON. */
export const WORKLOAD = {
  arrivalsPerSlot: "Poisson(lambda=6)",
  lambda: 6,
  energyPerTaskKWh: 0.05,
  deferrableFraction: 0.5,
  deferralHorizonHours: 6,
  degradedEnergyFraction: 0.4,
  note: "SYNTHETIC. An agentic service running LLM-inference-style jobs; parameters are stipulated, not measured.",
};

/**
 * One workload realization: the identical task list is replayed under every policy,
 * so differences between policies are policy differences, not sampling noise.
 * Deadlines are clamped to the last slot, so no task is impossible to complete.
 */
export function generateWorkload(seed, slots, w = WORKLOAD, slotMinutes = 30) {
  const rand = mulberry32(seed);
  const horizon = (w.deferralHorizonHours * 60) / slotMinutes; // slots
  const tasks = [];
  for (let t = 0; t < slots; t++) {
    const k = poisson(rand, w.lambda);
    for (let j = 0; j < k; j++) {
      const deferrable = rand() < w.deferrableFraction;
      tasks.push({
        id: tasks.length, arrival: t, deferrable,
        deadline: deferrable ? Math.min(t + horizon, slots - 1) : t,
        energyKWh: w.energyPerTaskKWh,
      });
    }
  }
  return tasks;
}

// ── Trailing threshold (P1t) ──────────────────────────────────────────────────
/**
 * For each slot, the median of the `windowSlots` slots STRICTLY BEFORE it.
 *
 * The P1 baseline uses the median of the whole window, which a scheduler running in
 * real time could not know (ADR-010 discloses that lookahead). This is the causal
 * version: at slot i only slots [i-windowSlots, i) are visible. At slot 0, with no
 * history at all, the threshold is +Infinity, i.e. "no reason to defer yet"; from
 * slot 1 on it is the median of whatever has been seen so far, however little.
 */
export function trailingMedians(series, windowSlots) {
  const out = new Array(series.length);
  for (let i = 0; i < series.length; i++) {
    const from = Math.max(0, i - windowSlots);
    if (i === from) { out[i] = Infinity; continue; }
    const w = series.slice(from, i).sort((a, b) => a - b);
    const mid = (w.length - 1) / 2;
    out[i] = w.length % 2 ? w[mid] : (w[Math.floor(mid)] + w[Math.ceil(mid)]) / 2;
  }
  return out;
}
