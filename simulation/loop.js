// SPDX-License-Identifier: GPL-3.0-only
/**
 * simulation/loop.js — E5: THE CLOSED LOOP, simulated for real (npm run loop).
 *
 * This is the experiment the article names and marks open ("Multi-party closed
 * loop — no third-party publisher yet"): N mutually foreign systems, each of which
 * PUBLISHES its own runtime document to a shared plane and READS its peers'
 * documents as a control signal. No exogenous coordinator, no shared scheduler —
 * regulation, if it happens, happens through the published medium alone.
 *
 * Model, stated completely (deterministic; no PRNG anywhere):
 *   - The day is 48 half-hour slots over the committed 28-day windows; the exogenous
 *     base signal is the committed NATIONAL ACTUAL intensity (real grid data).
 *   - Each of N systems has `unitsPerDay` deferrable work units per day and must
 *     place all of them into that day's slots (deadline = the day; conservation is
 *     asserted). Each unit is `unitKWh` of energy.
 *   - Each system publishes, every `staleness` days, a document whose Extended-level
 *     payload is its per-slot-of-day energy histogram for the previous day — i.e.
 *     exactly the kind of runtime metric the Internet-Draft's document carries.
 *   - Placement day t, system i: greedy into the slots minimising
 *         effective(s) = grid(t, s) + alpha * crowdIntensity(s)
 *     where crowd(s) is the sum of the LAST PUBLISHED histograms of all peers
 *     (staleness makes this picture old), scaled to intensity units so alpha is
 *     dimensionless. A system always sees its OWN current-day placements fresh
 *     (it knows what it is doing); a per-system slot capacity `slotCap` spreads its
 *     own units (a system cannot run everything at once).
 *   - alpha = 0 is the pure herd: everyone argmins the same grid signal, blind to
 *     everyone else. alpha > 0 is the loop: the plane's documents repel crowding.
 *     Iterating day over day makes this a delayed best-response dynamic — the
 *     classic setting where feedback either DAMPS (systems spread across near-argmin
 *     slots) or AMPLIFIES (everyone reacts to the same stale picture and hops
 *     together, a cobweb oscillation).
 *
 * Measured, per (N, alpha, staleness), over the last 14 days (after warm-up):
 *   - meanIntensityGPerKWh: what a unit actually paid, on the real actual series;
 *   - peakConcurrencyRatio: peak simultaneous units / (total units / slots-used
 *     ideal spread) — the herding cost the field names and does not measure;
 *   - top5PctSlotShare: share of all units landing in the busiest 5% of slots
 *     (directly comparable to limitation R11's 75.3% / 92.9%);
 *   - oscillationL1: mean L1 distance between consecutive days' aggregate placement
 *     histograms, normalised by total units — 0 means settled, large means hopping.
 *
 * Honest scope notes: systems are homogeneous except for publication phase (system
 * i publishes on days ≡ i mod staleness), which is the deterministic symmetry
 * breaker; the gate's budget pacing is deliberately NOT in this v1 (that arm is
 * WP-17's second half — this file measures the PLANE's own dynamics first); the
 * documents here are histograms, not full Draft documents — the mapping to the
 * Draft's members is one adapter, not new science.
 *
 * Run: npm run loop     Output: results/loop.json + results/loop.md
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mean, r } from "../shared/stats.js";
import { loadWindow } from "./lib.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const SLOTS = 48;
const UNITS_PER_DAY = 24;      // deferrable units each system must place per day
const UNIT_KWH = 0.05;         // same task energy as E2
const SLOT_CAP = 4;            // a system can run at most 4 units in one slot
const WARMUP_DAYS = 14;        // measure the last 14 of 28 days
const NS = [2, 5, 10, 25];
const ALPHAS = [0, 0.5, 2];    // 0 = blind herd; 0.5 = mild heed; 2 = strong heed
const STALENESS = [1, 7];      // publish daily vs weekly (the E1-measured reality is ~23 days)

/**
 * WP-12 modes, added beside the plane-only dynamic:
 *   "plane"   — the original: cost = grid + alpha x stale published crowd.
 *   "stagger" — SI 2021/1467's INTENT at slot resolution (the literal 600 s delay
 *               is a third of a slot — R18 records that): near-ties (within
 *               STAGGER_EPS g/kWh of the best) are broken by a per-system rotation,
 *               so identical actors stop making identical picks. Deterministic.
 *   "paced"   — the gate's claim ("a paced budget is a staggering mechanism"):
 *               each system runs a daily budget B = PACE_F x meanG x unitsPerDay x
 *               unitKWh and its pacing ratio (spent+next)/B quantises willingness
 *               exactly like the ladder — ratio >= 0.8 must skip the 1 cheapest
 *               remaining slot (degrade), >= 1.0 skip 2 (escalate, standing rule),
 *               >= 1.1 skip 3 (block, standing rule), >= 1.25 place nothing more
 *               (terminate: the unit is DROPPED and counted — pacing buys spread
 *               with completed work, and the table shows the price, like E2 does).
 *               Depletion pushes later spending off the common argmin — the
 *               anti-herd mechanism under test.
 *
 * WP-12b adds the arm WP-12's negative verdict pointed at (ADR-019):
 *   "capacity" — the SAME pacing ratio, but the rung acts on the system's PER-SLOT
 *               CAP instead of on run/defer/refuse: allow -> full cap; degrade
 *               (>= 0.8) -> cap halved; escalate (>= 1.0) -> cap quartered; block
 *               (>= 1.1) -> 1 unit per slot; terminate (>= 1.25) -> cap 0 for the
 *               REST OF THE DAY, and only then may a unit drop. Work that no longer
 *               fits its preferred slot SPILLS to the next cheapest feasible slot —
 *               that spill, not depletion, is the hypothesised spreading mechanism
 *               (the slot cap is what actually bounds the herd in every WP-12 row).
 */
const STAGGER_EPS = 1.0;   // g/kWh: what counts as a near-tie
const PACE_F = 0.8;        // budget factor, matching E2/E3's f = 0.8 headline
const PACE_RUNGS = [[1.25, Infinity], [1.1, 3], [1.0, 2], [0.8, 1]]; // ratio -> slots to skip
/**
 * ratio -> per-slot cap for the "capacity" arm, in the ladder's own order. At the
 * committed SLOT_CAP of 4 the escalate (quarter) and block (one unit) rungs coincide
 * at 1 unit per slot; that collapse is a property of the cap, not a modelling choice,
 * and it is stated in ADR-019 rather than hidden by inventing a fifth cap value.
 */
const CAP_RUNGS = [
  [1.25, 0],                                     // terminate: nothing more today
  [1.1, 1],                                      // block: one unit per slot
  [1.0, Math.max(1, Math.floor(SLOT_CAP / 4))],  // escalate: quarter the cap
  [0.8, Math.max(1, Math.floor(SLOT_CAP / 2))],  // degrade: halve the cap
];

/**
 * The paced arm's budget must BIND to test anything: f x the UNCONTROLLED mean never
 * binds for a scheduler that already picks cheap slots (first measured attempt: the
 * rungs never fired). So the budget is calibrated the way E2 calibrates against P0's
 * own day — here, f x the median day-cost of the BLIND HERD itself (what one system
 * spends filling its cap-bound cheapest slots), computed analytically per window.
 */
function herdBudget(W, paceF = PACE_F) {
  const days = Math.floor(W.slots / SLOTS);
  const costs = [];
  for (let d = 0; d < days; d++) {
    const daySlots = [];
    for (let s = 0; s < SLOTS; s++) daySlots.push(W.actual[d * SLOTS + s]);
    daySlots.sort((a, b) => a - b);
    let g = 0;
    let left = UNITS_PER_DAY;
    for (let k = 0; left > 0; k++) { const take = Math.min(SLOT_CAP, left); g += take * UNIT_KWH * daySlots[k]; left -= take; }
    costs.push(g);
  }
  costs.sort((a, b) => a - b);
  const mid = (costs.length - 1) / 2;
  const med = costs.length % 2 ? costs[mid] : (costs[Math.floor(mid)] + costs[Math.ceil(mid)]) / 2;
  return paceF * med;
}

/**
 * One full run of the dynamic for a window and one (mode, N, alpha, staleness) cell.
 *
 * `opts.paceF` overrides the budget factor. Nothing in `main()` passes it — every
 * committed cell uses PACE_F — but it lets a test drive the capacity arm under a
 * budget so generous that the terminate rung cannot fire, which is how the
 * "nothing is lost below terminate" property is checked rather than assumed.
 */
export function run(W, N, alpha, staleness, mode = "plane", opts = {}) {
  const days = Math.floor(W.slots / SLOTS);
  // published[i] = the per-slot histogram system i last put on the plane.
  const published = Array.from({ length: N }, () => new Array(SLOTS).fill(0));
  const aggregates = [];   // per measured day: aggregate placement histogram
  const paid = [];         // per measured day: mean intensity paid per unit
  // Scale factor so alpha is dimensionless: crowd energy -> intensity-comparable.
  // One "fully crowded" slot (all N systems at cap) maps to the window's mean
  // intensity, so alpha=1 weighs a full crowd like an average-intensity slot.
  const meanG = mean(W.actual);
  const crowdScale = meanG / (N * SLOT_CAP * UNIT_KWH);

  const budget = herdBudget(W, opts.paceF ?? PACE_F);
  let droppedUnits = 0;
  let droppedNoFeasibleSlot = 0; // capacity arm: a drop NOT caused by terminate (F3: must stay 0 at committed parameters)
  let measuredUnits = 0;
  let terminateFired = false;   // capacity arm: did any system ever reach the 1.25 rung?
  for (let d = 0; d < days; d++) {
    const dayBase = d * SLOTS;
    const placedToday = Array.from({ length: N }, () => new Array(SLOTS).fill(0));
    for (let i = 0; i < N; i++) {
      // capacity arm: this system's cap under its current rung. Every rung but
      // terminate is recomputed per unit as the ratio moves; cap 0 is STICKY, because
      // "terminate" means for the rest of the day, not for one action.
      let capToday = SLOT_CAP;
      // The crowd this system can see: peers' last PUBLISHED histograms (stale),
      // plus its own placements so far today (fresh — it knows itself).
      const crowd = new Array(SLOTS).fill(0);
      for (let j = 0; j < N; j++) if (j !== i) for (let s = 0; s < SLOTS; s++) crowd[s] += published[j][s];
      let spent = 0;
      for (let u = 0; u < UNITS_PER_DAY; u++) {
        // Rank candidate slots by effective cost (deterministic tie-break by index;
        // "stagger" rotates the tie-break start so near-ties decorrelate).
        const candidates = [];
        for (let s = 0; s < SLOTS; s++) {
          if (placedToday[i][s] >= SLOT_CAP) continue;
          const crowdEnergy = (crowd[s] + placedToday[i][s]) * UNIT_KWH;
          candidates.push([W.actual[dayBase + s] + alpha * crowdScale * crowdEnergy, s]);
        }
        if (!candidates.length) throw new Error("slot capacity too small for the workload");
        candidates.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
        let pick = 0;
        if (mode === "stagger") {
          const ties = candidates.filter((c) => c[0] - candidates[0][0] <= STAGGER_EPS).length;
          pick = ties > 1 ? (i + d) % ties : 0;
        } else if (mode === "paced" || mode === "paced_defer") {
          const nextCost = UNIT_KWH * W.actual[dayBase + candidates[0][1]];
          const ratio = (spent + nextCost) / budget;
          let skip = 0;
          for (const [th, k] of PACE_RUNGS) if (ratio >= th) { skip = k; break; }
          if (skip === Infinity) { droppedUnits += d >= WARMUP_DAYS ? 1 : 0; continue; }
          if (mode === "paced") {
            pick = Math.min(skip, candidates.length - 1);
          } else if (skip > 0) {
            // paced_defer: the gate's actual mechanism — a fired rung DEFERS: take
            // the cheapest slot strictly LATER in the day than the argmin choice
            // (like E2's block-on-deferrable moving work in time). Nothing later
            // left = the deadline has passed = the unit drops.
            const s0 = candidates[0][1];
            const later = candidates.filter((c) => c[1] > s0);
            if (!later.length) { droppedUnits += d >= WARMUP_DAYS ? 1 : 0; continue; }
            pick = candidates.indexOf(later[0]);
          }
        } else if (mode === "capacity") {
          // WP-12b: the rung sets the per-slot CAP; the unit still takes the cheapest
          // slot it is allowed into, so a shrinking cap SPILLS work down the ranking
          // instead of skipping, deferring or refusing it.
          if (capToday === 0) { droppedUnits += d >= WARMUP_DAYS ? 1 : 0; continue; }
          const nextCost = UNIT_KWH * W.actual[dayBase + candidates[0][1]];
          const ratio = (spent + nextCost) / budget;
          let cap = SLOT_CAP;
          for (const [th, c] of CAP_RUNGS) if (ratio >= th) { cap = c; break; }
          if (cap === 0) {
            // terminate: the ONLY rung in this arm that may lose work.
            terminateFired = true;
            capToday = 0;
            droppedUnits += d >= WARMUP_DAYS ? 1 : 0;
            continue;
          }
          capToday = cap;
          const spill = candidates.findIndex((c) => placedToday[i][c[1]] < cap);
          if (spill === -1) { droppedUnits += d >= WARMUP_DAYS ? 1 : 0; droppedNoFeasibleSlot += d >= WARMUP_DAYS ? 1 : 0; continue; }
          pick = spill;
        }
        const best = candidates[pick][1];
        placedToday[i][best]++;
        spent += UNIT_KWH * W.actual[dayBase + best];
      }
    }
    // Publish: system i refreshes its document on its own phase of the cadence.
    for (let i = 0; i < N; i++) {
      if (d % staleness === i % staleness) published[i] = placedToday[i].slice();
    }
    // Measure after warm-up.
    if (d >= WARMUP_DAYS) {
      const agg = new Array(SLOTS).fill(0);
      let gSum = 0;
      for (let i = 0; i < N; i++) for (let s = 0; s < SLOTS; s++) {
        agg[s] += placedToday[i][s];
        gSum += placedToday[i][s] * UNIT_KWH * W.actual[dayBase + s];
      }
      aggregates.push(agg);
      const placedUnits = agg.reduce((x, y) => x + y, 0);
      measuredUnits += placedUnits;
      paid.push(gSum / (placedUnits * UNIT_KWH));
    }
  }

  // Metrics over the measured days (denominator = that day's PLACED units, so the
  // paced arm's drops do not flatter its spread).
  const peakRatios = [];
  const topShares = [];
  for (const agg of aggregates) {
    const dayUnits = agg.reduce((x, y) => x + y, 0);
    const peak = Math.max(...agg);
    const used = agg.filter((x) => x > 0).length;
    peakRatios.push(peak / (dayUnits / Math.max(used, 1)));
    const sorted = [...agg].sort((a, b) => b - a);
    const topN = Math.max(1, Math.round(SLOTS * 0.05));
    topShares.push(sorted.slice(0, topN).reduce((x, y) => x + y, 0) / Math.max(dayUnits, 1));
  }
  const osc = [];
  for (let k = 1; k < aggregates.length; k++) {
    let l1 = 0;
    for (let s = 0; s < SLOTS; s++) l1 += Math.abs(aggregates[k][s] - aggregates[k - 1][s]);
    const dayUnits = Math.max(aggregates[k].reduce((x, y) => x + y, 0), 1);
    osc.push(l1 / dayUnits);
  }
  return {
    meanIntensityGPerKWh: r(mean(paid), 2),
    peakConcurrencyRatio: r(mean(peakRatios), 2),
    top5PctSlotShare: r(100 * mean(topShares), 2),
    oscillationL1: r(mean(osc), 3),
    ...(mode.startsWith("paced") || mode === "capacity"
      ? { droppedUnitsPct: r((100 * droppedUnits) / (droppedUnits + measuredUnits), 2), droppedNoFeasibleSlot }
      : {}),
    // WP-12b's assertable property: in the capacity arm nothing may be lost unless
    // the terminate rung actually fired, so the flag travels with the cell.
    ...(mode === "capacity" ? { terminateFired } : {}),
  };
}

function main() {
  const doc = {
    generatedBy: "simulation/loop.js (npm run loop)",
    note: "E5: the multi-party closed loop the article marks as its open problem, as a deterministic delayed-best-response dynamic over the committed national actual traces. Each system publishes its per-slot energy histogram on its own cadence phase and places deferrable work against grid intensity plus alpha x the (stale) published crowd. alpha=0 is the blind herd; the question each cell answers is whether the plane DAMPS the herd or AMPLIFIES it.",
    model: { slotsPerDay: SLOTS, unitsPerDay: UNITS_PER_DAY, unitKWh: UNIT_KWH, slotCap: SLOT_CAP, warmupDays: WARMUP_DAYS, Ns: NS, alphas: ALPHAS, stalenessDays: STALENESS },
    results: {},
  };
  for (const id of ["W1", "W2"]) {
    const W = loadWindow(id);
    const cells = {};
    for (const N of NS) for (const alpha of ALPHAS) for (const st of STALENESS) {
      cells[`N${N}_a${alpha}_s${st}`] = run(W, N, alpha, st);
    }
    // WP-12: the anti-herd comparison — plane vs stagger vs paced budget, at the
    // representative corners (blind and strong-heed; small and large N).
    const wp12 = {};
    for (const N of [5, 25]) for (const alpha of [0, 2]) for (const st of [1, 7]) {
      for (const mode of ["stagger", "paced", "paced_defer"]) {
        wp12[`${mode}_N${N}_a${alpha}_s${st}`] = run(W, N, alpha, st, mode);
      }
    }
    // WP-12b: the capacity-rung arm at the SAME corners, so the two verdicts are
    // read off the same rows. Appended as its own block — the wp12 cells above are
    // frozen results and nothing here may touch them.
    const wp12b = {};
    for (const N of [5, 25]) for (const alpha of [0, 2]) for (const st of [1, 7]) {
      wp12b[`capacity_N${N}_a${alpha}_s${st}`] = run(W, N, alpha, st, "capacity");
    }
    doc.results[id] = { label: W.label, cells, wp12, wp12b };
  }
  writeFileSync(path.join(ROOT, "results", "loop.json"), JSON.stringify(doc, null, 2) + "\n");
  writeFileSync(path.join(ROOT, "results", "loop.md"), renderMd(doc));
  for (const id of ["W1", "W2"]) {
    const c = doc.results[id].cells;
    console.log(`${id}: herd(N25,a0) top5% ${c["N25_a0_s1"].top5PctSlotShare}% peak ${c["N25_a0_s1"].peakConcurrencyRatio} | loop(N25,a2,fresh) top5% ${c["N25_a2_s1"].top5PctSlotShare}% peak ${c["N25_a2_s1"].peakConcurrencyRatio} osc ${c["N25_a2_s1"].oscillationL1} | stale7 osc ${c["N25_a2_s7"].oscillationL1}`);
  }
  console.log("loop done -> results/loop.json, results/loop.md");
}

/**
 * WP-12b's verdict, computed from the cells rather than written by hand: the word in
 * the heading follows the measurement, so a re-run that changed the direction would
 * change the prose (and break the test that pins the two against each other).
 *
 * "spreads"  — the blind-herd corner's top-5% share falls MATERIALLY (>= 2 points) in
 *              both windows, i.e. the cap arm does what the budget arm could not.
 * otherwise  — DISPROVEN AGAIN, in the same register as the WP-12 verdict, and the
 *              cell numbers say whether the arm merely SHEDS (drops work) or
 *              RESHUFFLES (keeps it, same cheap band).
 */
const SPREAD_POINTS = 2.0;   // percentage points of top-5% share that count as "spread"
function capacityVerdict(doc) {
  const rows = [];
  for (const [id, w] of Object.entries(doc.results)) {
    if (!w.wp12b) continue;
    let minDelta = Infinity;
    let maxDelta = -Infinity;
    for (const [k, v] of Object.entries(w.wp12b)) {
      const m = k.match(/_N(\d+)_a([\d.]+)_s(\d+)$/);
      const plane = w.cells[`N${m[1]}_a${m[2]}_s${m[3]}`];
      const delta = v.top5PctSlotShare - plane.top5PctSlotShare;
      minDelta = Math.min(minDelta, delta);
      maxDelta = Math.max(maxDelta, delta);
    }
    rows.push({
      id, label: w.label,
      herd: w.cells["N25_a0_s1"],
      cap: w.wp12b["capacity_N25_a0_s1"],
      paced: w.wp12["paced_N25_a0_s1"],
      defer: w.wp12["paced_defer_N25_a0_s1"],
      stagger: w.wp12["stagger_N25_a0_s1"],
      minDelta: r(minDelta, 2), maxDelta: r(maxDelta, 2),
    });
  }
  const spreads = rows.length > 0 && rows.every((x) => x.herd.top5PctSlotShare - x.cap.top5PctSlotShare >= SPREAD_POINTS);
  const sheds = rows.some((x) => x.cap.droppedUnitsPct > 1);
  // Does the cap arm land exactly where the skip-k budget arm landed at the blind-herd
  // corner? If it does, that coincidence IS the finding and gets said out loud.
  const equalsPaced = rows.length > 0 && rows.every((x) =>
    x.cap.top5PctSlotShare === x.paced.top5PctSlotShare && x.cap.droppedUnitsPct === x.paced.droppedUnitsPct);
  return { rows, spreads, sheds, equalsPaced, word: spreads ? "SPREADS" : "DISPROVEN AGAIN" };
}

export function renderMd(doc) {
  let out = `# E5 — The closed loop, measured\n\nGenerated by \`npm run loop\`. ${doc.note}\n\nModel constants: ${doc.model.unitsPerDay} units x ${doc.model.unitKWh} kWh per system per day, slot capacity ${doc.model.slotCap}, measured over the last ${28 - doc.model.warmupDays} days of each window. Deterministic: no PRNG; the symmetry breaker is each system's publication phase (system i publishes on days ≡ i mod staleness).\n\n`;
  for (const [id, w] of Object.entries(doc.results)) {
    out += `## ${id} (${w.label})\n\n| N | alpha | staleness (days) | mean intensity paid (g/kWh) | peak concurrency ratio | top-5%-slot share (the busiest 2 of 48 slots — strictly the top 4.17%) | day-to-day oscillation (L1/unit) |\n|---:|---:|---:|---:|---:|---:|---:|\n`;
    for (const N of doc.model.Ns) for (const a of doc.model.alphas) for (const st of doc.model.stalenessDays) {
      const c = w.cells[`N${N}_a${a}_s${st}`];
      out += `| ${N} | ${a} | ${st} | ${c.meanIntensityGPerKWh} | ${c.peakConcurrencyRatio} | ${c.top5PctSlotShare}% | ${c.oscillationL1} |\n`;
    }
    out += `\n`;
  }
  for (const [id, w] of Object.entries(doc.results)) {
    if (!w.wp12) continue;
    out += `## WP-12 — can anything dissolve the herd? (${id})\n\n| arm | N | alpha | staleness | g/kWh paid | top-5% share | peak ratio | oscillation | dropped |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|\n`;
    for (const [k, v] of Object.entries(w.wp12)) {
      const [mode, rest] = [k.replace(/_N\d+_a[\d.]+_s\d+$/, ""), k.match(/_N(\d+)_a([\d.]+)_s(\d+)$/)];
      out += `| ${mode} | ${rest[1]} | ${rest[2]} | ${rest[3]} | ${v.meanIntensityGPerKWh} | ${v.top5PctSlotShare}% | ${v.peakConcurrencyRatio} | ${v.oscillationL1} | ${v.droppedUnitsPct !== undefined ? v.droppedUnitsPct + "%" : "—"} |\n`;
    }
    out += `\n`;
  }
  const v = capacityVerdict(doc);
  for (const [id, w] of Object.entries(doc.results)) {
    if (!w.wp12b) continue;
    out += `## WP-12b — capacity rungs: does halving the cap spread what the budget could not? (${id})\n\nSame pacing ratio, same budget, same corners as WP-12; the rung sets the PER-SLOT CAP (allow ${doc.model.slotCap} / degrade ${Math.max(1, Math.floor(doc.model.slotCap / 2))} / escalate ${Math.max(1, Math.floor(doc.model.slotCap / 4))} / block 1 / terminate 0 for the rest of the day) and displaced work SPILLS to the next cheapest feasible slot. "vs plane" is this cell's top-5% share minus the same (N, alpha, staleness) plane cell's — negative means the cap arm spread the crowd.\n\n| arm | N | alpha | staleness | g/kWh paid | top-5% share | vs plane | peak ratio | oscillation | dropped | terminate fired |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|\n`;
    for (const [k, c] of Object.entries(w.wp12b)) {
      const m = k.match(/_N(\d+)_a([\d.]+)_s(\d+)$/);
      const plane = w.cells[`N${m[1]}_a${m[2]}_s${m[3]}`];
      const delta = r(c.top5PctSlotShare - plane.top5PctSlotShare, 2);
      out += `| capacity | ${m[1]} | ${m[2]} | ${m[3]} | ${c.meanIntensityGPerKWh} | ${c.top5PctSlotShare}% | ${delta > 0 ? "+" : ""}${delta} pt | ${c.peakConcurrencyRatio} | ${c.oscillationL1} | ${c.droppedUnitsPct}% | ${c.terminateFired ? "yes" : "no"} |\n`;
    }
    out += `\n`;
  }
  out += `## WP-12b verdict — ${v.word}\n\n`;
  if (v.spreads) {
    out += `Capacity semantics **spread the herd where budget depletion did not**. At the blind-herd corner (N=25, alpha=0, daily cadence) the top-5%-slot share falls from the herd's ${v.rows.map((x) => `${x.herd.top5PctSlotShare}% to ${x.cap.top5PctSlotShare}% (${x.id})`).join(" and ")} — against the SAME budget under which the skip-k paced arm went the other way (${v.rows.map((x) => `${x.paced.top5PctSlotShare}%`).join(" / ")}), the defer arm went further the other way (${v.rows.map((x) => `${x.defer.top5PctSlotShare}%`).join(" / ")}), and the stagger arm stayed inert (${v.rows.map((x) => `${x.stagger.top5PctSlotShare}%`).join(" / ")}). Across all eight corners the change against the matching plane cell runs ${v.rows.map((x) => `${x.minDelta} to ${x.maxDelta} pt (${x.id})`).join(", ")}. The mechanism is the SPILL, not the depletion: a lowered cap cannot refuse work, so the work must go somewhere cheap-but-next, and that is what moves mass off the common argmin. **The corrected §2h.2 claim survives its first test** — the gate's anti-herd lever is capacity semantics — and the price is in the same row: ${v.rows.map((x) => `${x.cap.droppedUnitsPct}%`).join(" / ")} of work dropped and ${v.rows.map((x) => `${x.cap.meanIntensityGPerKWh}`).join(" / ")} g/kWh paid against the herd's ${v.rows.map((x) => `${x.herd.meanIntensityGPerKWh}`).join(" / ")}.\n\n`;
  } else {
    out += `**Disproven again.** Capacity rungs do not spread the herd either. At the blind-herd corner (N=25, alpha=0, daily cadence) the top-5%-slot share goes from the herd's ${v.rows.map((x) => `${x.herd.top5PctSlotShare}% to ${x.cap.top5PctSlotShare}% (${x.id})`).join(" and ")} — no material fall, beside the skip-k paced arm's ${v.rows.map((x) => `${x.paced.top5PctSlotShare}%`).join(" / ")}, the defer arm's ${v.rows.map((x) => `${x.defer.top5PctSlotShare}%`).join(" / ")} and the inert stagger arm's ${v.rows.map((x) => `${x.stagger.top5PctSlotShare}%`).join(" / ")}. Across all eight corners the change against the matching plane cell runs ${v.rows.map((x) => `${x.minDelta} to ${x.maxDelta} pt (${x.id})`).join(", ")}. The arm ${v.sheds ? `also **SHEDS**: ${v.rows.map((x) => `${x.cap.droppedUnitsPct}%`).join(" / ")} of measured work is dropped, and only at the terminate rung` : `**RESHUFFLES** instead: ${v.rows.map((x) => `${x.cap.droppedUnitsPct}%`).join(" / ")} dropped, the same cheap band redealt`}, and it concentrates rather than flattens what survives: peak concurrency ratio ${v.rows.map((x) => `${x.herd.peakConcurrencyRatio} -> ${x.cap.peakConcurrencyRatio}`).join(" and ")}.${v.equalsPaced ? ` The sharpest way to put it: at the blind-herd corner the capacity arm lands on **exactly** the skip-k budget arm's share and drop rate (${v.rows.map((x) => `${x.cap.top5PctSlotShare}% / ${x.cap.droppedUnitsPct}%`).join(" and ")}), with share and drop rate BIT-identical to it, differing in grams paid (${v.rows.map((x) => `${x.cap.meanIntensityGPerKWh} vs ${x.paced.meanIntensityGPerKWh}`).join(", ")}) — two different rung semantics, one aggregate outcome, because in both the binding constraint is how much of a cheap day one budget buys.` : ""} What this means for the corrected §2h.2 claim is exact and unflattering: **"the gate's anti-herd lever is capacity semantics, not budget depletion" is not established by this model either.** The slot cap bounds the herd by its LEVEL — a static system parameter — not by the rung that moves it; lowering an already-binding cap redistributes one system's own units inside a cheap band that every system agrees on, so the crowd's shape survives. A gate-side anti-herd claim now needs a mechanism that makes different systems choose DIFFERENTLY — heterogeneous caps, per-actor phase, or an allocator that can see the crowd — and this package should claim none of them until one is measured.\n\n`;
  }
  out += `## What the table actually shows (the four findings)\n\n1. **The plane spreads the crowd only by paying grams.** Every alpha > 0 cell pays MORE mean intensity than its blind-herd counterpart (the herd pure-argmins the real signal; asserted as an invariant in loop.test.js). Where the top-5% share falls — most visibly at N=2, alpha=2, weekly cadence: 33.33% -> 14.88% (winter) and -> 11.9% (summer) — the price is dirtier slots (76.55 -> 99.52 and 71.46 -> 86.8 g/kWh; peak concentration also differs — the capacity arm peaks what it keeps harder than skip-k does, see the peak column). **A published signal alone cannot both spread the herd and stay clean.** That is the measured case for the second half of WP-17: allocation (the gate's paced budget) rather than information alone — and it is exactly Bailey et al.'s TOU-vs-managed-charging finding, reproduced in a publication-medium model.\n2. **Fresh mutual observation oscillates.** At N >= 5 with daily publication and strong heed, day-to-day oscillation sits at or near 2 — complete daily swaps, the cobweb (2 is the exact maximum when the number of placed units is constant day to day; shedding arms can exceed it slightly): everyone reads the same picture, everyone jumps together, the picture inverts. Staleness *lowers* oscillation here (phase-offset publication desynchronises the crowd) at the cost of steering on old data. Neither end is stable-and-clean; that trade is the result.\n3. **The effect shrinks as N grows.** With many identical systems the per-peer signal averages out (top-5% share climbs back toward the herd's 33.33% cap-bound value at N=25). Spreading a LARGE crowd through voluntary document-reading alone does not happen in this model; it needs heterogeneity, allocation, or both.\n4. **WP-12's verdict — our own conjecture is disproven.** Three anti-herd mechanisms were run head-to-head (table above): a PACED BUDGET with skip-k rungs sheds work instead of spreading it (units drop, the top-5% share RISES because survivors still pile into the same slots); the same budget with the gate's true DEFER semantics reshuffles inside the same cheap band (top share rises to ~41% at the alpha=0 corner; no rung-driven drops, though 11-21% of units still drop at their deadlines — the dropped column above prices it); and the STAGGER arm — SI 2021/1467's intent at slot resolution — is inert, because near-ties within 1 g/kWh are rare on real intensity data (consistent with the regulation targeting sub-slot synchrony, not slot-level herding). The claim "a paced budget is a staggering mechanism" is therefore disproven in this model class. What bounds the herd in every row is the per-system slot CAP — but WP-12b then built rungs that act on that cap (ADR-019) and measured them, and they concentrate rather than spread (see the WP-12b verdict above). Both anti-herd conjectures — budget depletion (WP-12) and capacity rungs (WP-12b) — were tested and disproven, so this package claims NO anti-herd property for the gate; what it does claim is that running the comparison at all is, to the checked record, unprecedented.\n\n## Reading notes\n\n- **alpha = 0 rows are the blind herd** — every system argmins the same grid signal; the top-5% share there is this model's R11. Peak ratio 1.0 for the herd is definitional (it packs its 6 cap-bound slots exactly), which is why the discriminating columns are the share, the intensity and the oscillation.\n- Staleness 1 vs 7 days brackets a real gap: E1 measured the median published document age at **23 days**; a control loop needs cadences near the top row. The gap between the rows is the argument for runtime cadence.\n- Not modelled here, on purpose: heterogeneous workloads, and strategic misreporting — F13 and E6's Goodhart warning say what happens when publishing becomes strategic.\n`;
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
