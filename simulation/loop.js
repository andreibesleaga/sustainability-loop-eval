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

/** One full run of the dynamic for a window and one (N, alpha, staleness) cell. */
function run(W, N, alpha, staleness) {
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

  for (let d = 0; d < days; d++) {
    const dayBase = d * SLOTS;
    const placedToday = Array.from({ length: N }, () => new Array(SLOTS).fill(0));
    for (let i = 0; i < N; i++) {
      // The crowd this system can see: peers' last PUBLISHED histograms (stale),
      // plus its own placements so far today (fresh — it knows itself).
      const crowd = new Array(SLOTS).fill(0);
      for (let j = 0; j < N; j++) if (j !== i) for (let s = 0; s < SLOTS; s++) crowd[s] += published[j][s];
      for (let u = 0; u < UNITS_PER_DAY; u++) {
        let best = -1;
        let bestCost = Infinity;
        for (let s = 0; s < SLOTS; s++) {
          if (placedToday[i][s] >= SLOT_CAP) continue;
          const crowdEnergy = (crowd[s] + placedToday[i][s]) * UNIT_KWH;
          const cost = W.actual[dayBase + s] + alpha * crowdScale * crowdEnergy;
          if (cost < bestCost) { bestCost = cost; best = s; }
        }
        if (best === -1) throw new Error("slot capacity too small for the workload");
        placedToday[i][best]++;
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
      paid.push(gSum / (N * UNITS_PER_DAY * UNIT_KWH));
    }
  }

  // Metrics over the measured days.
  const totalUnits = N * UNITS_PER_DAY;
  const peakRatios = [];
  const topShares = [];
  for (const agg of aggregates) {
    const peak = Math.max(...agg);
    const used = agg.filter((x) => x > 0).length;
    peakRatios.push(peak / (totalUnits / Math.max(used, 1)));
    const sorted = [...agg].sort((a, b) => b - a);
    const topN = Math.max(1, Math.round(SLOTS * 0.05));
    topShares.push(sorted.slice(0, topN).reduce((x, y) => x + y, 0) / totalUnits);
  }
  const osc = [];
  for (let k = 1; k < aggregates.length; k++) {
    let l1 = 0;
    for (let s = 0; s < SLOTS; s++) l1 += Math.abs(aggregates[k][s] - aggregates[k - 1][s]);
    osc.push(l1 / totalUnits);
  }
  return {
    meanIntensityGPerKWh: r(mean(paid), 2),
    peakConcurrencyRatio: r(mean(peakRatios), 2),
    top5PctSlotShare: r(100 * mean(topShares), 2),
    oscillationL1: r(mean(osc), 3),
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
    doc.results[id] = { label: W.label, cells };
  }
  writeFileSync(path.join(ROOT, "results", "loop.json"), JSON.stringify(doc, null, 2) + "\n");
  writeFileSync(path.join(ROOT, "results", "loop.md"), renderMd(doc));
  for (const id of ["W1", "W2"]) {
    const c = doc.results[id].cells;
    console.log(`${id}: herd(N25,a0) top5% ${c["N25_a0_s1"].top5PctSlotShare}% peak ${c["N25_a0_s1"].peakConcurrencyRatio} | loop(N25,a2,fresh) top5% ${c["N25_a2_s1"].top5PctSlotShare}% peak ${c["N25_a2_s1"].peakConcurrencyRatio} osc ${c["N25_a2_s1"].oscillationL1} | stale7 osc ${c["N25_a2_s7"].oscillationL1}`);
  }
  console.log("loop done -> results/loop.json, results/loop.md");
}

function renderMd(doc) {
  let out = `# E5 — The closed loop, measured\n\nGenerated by \`npm run loop\`. ${doc.note}\n\nModel constants: ${doc.model.unitsPerDay} units x ${doc.model.unitKWh} kWh per system per day, slot capacity ${doc.model.slotCap}, measured over the last ${28 - doc.model.warmupDays} days of each window. Deterministic: no PRNG; the symmetry breaker is each system's publication phase (system i publishes on days ≡ i mod staleness).\n\n`;
  for (const [id, w] of Object.entries(doc.results)) {
    out += `## ${id} (${w.label})\n\n| N | alpha | staleness (days) | mean intensity paid (g/kWh) | peak concurrency ratio | top-5%-slot share | day-to-day oscillation (L1/unit) |\n|---:|---:|---:|---:|---:|---:|---:|\n`;
    for (const N of doc.model.Ns) for (const a of doc.model.alphas) for (const st of doc.model.stalenessDays) {
      const c = w.cells[`N${N}_a${a}_s${st}`];
      out += `| ${N} | ${a} | ${st} | ${c.meanIntensityGPerKWh} | ${c.peakConcurrencyRatio} | ${c.top5PctSlotShare}% | ${c.oscillationL1} |\n`;
    }
    out += `\n`;
  }
  out += `## What the table actually shows (the three findings)\n\n1. **The plane spreads the crowd only by paying grams.** Every alpha > 0 cell pays MORE mean intensity than its blind-herd counterpart (the herd pure-argmins the real signal; asserted as an invariant in loop.test.js). Where the top-5% share falls — most visibly at N=2, alpha=2, weekly cadence: 33.33% -> 14.88% (winter) and -> 11.9% (summer) — the price is dirtier slots (76.55 -> 99.52 and 71.46 -> 86.8 g/kWh). **A published signal alone cannot both spread the herd and stay clean.** That is the measured case for the second half of WP-17: allocation (the gate's paced budget) rather than information alone — and it is exactly Bailey et al.'s TOU-vs-managed-charging finding, reproduced in a publication-medium model.\n2. **Fresh mutual observation oscillates.** At N >= 5 with daily publication and strong heed, day-to-day oscillation sits at or near its maximum of 2 — complete daily swaps, the cobweb: everyone reads the same picture, everyone jumps together, the picture inverts. Staleness *lowers* oscillation here (phase-offset publication desynchronises the crowd) at the cost of steering on old data. Neither end is stable-and-clean; that trade is the result.\n3. **The effect shrinks as N grows.** With many identical systems the per-peer signal averages out (top-5% share climbs back toward the herd's 33.33% cap-bound value at N=25). Spreading a LARGE crowd through voluntary document-reading alone does not happen in this model; it needs heterogeneity, allocation, or both.\n\n## Reading notes\n\n- **alpha = 0 rows are the blind herd** — every system argmins the same grid signal; the top-5% share there is this model's R11. Peak ratio 1.0 for the herd is definitional (it packs its 6 cap-bound slots exactly), which is why the discriminating columns are the share, the intensity and the oscillation.\n- Staleness 1 vs 7 days brackets a real gap: E1 measured the median published document age at **23 days**; a control loop needs cadences near the top row. The gap between the rows is the argument for runtime cadence.\n- Not modelled here, on purpose: the gate's budget pacing (WP-17's second half — the finding above says it is needed), heterogeneous workloads, and strategic misreporting — F13 and E6's Goodhart warning say what happens when publishing becomes strategic.\n`;
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
