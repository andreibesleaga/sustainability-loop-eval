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
 */
const STAGGER_EPS = 1.0;   // g/kWh: what counts as a near-tie
const PACE_F = 0.8;        // budget factor, matching E2/E3's f = 0.8 headline
const PACE_RUNGS = [[1.25, Infinity], [1.1, 3], [1.0, 2], [0.8, 1]]; // ratio -> slots to skip

/**
 * The paced arm's budget must BIND to test anything: f x the UNCONTROLLED mean never
 * binds for a scheduler that already picks cheap slots (first measured attempt: the
 * rungs never fired). So the budget is calibrated the way E2 calibrates against P0's
 * own day — here, f x the median day-cost of the BLIND HERD itself (what one system
 * spends filling its cap-bound cheapest slots), computed analytically per window.
 */
function herdBudget(W) {
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
  return PACE_F * med;
}

/** One full run of the dynamic for a window and one (mode, N, alpha, staleness) cell. */
function run(W, N, alpha, staleness, mode = "plane") {
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

  const budget = herdBudget(W);
  let droppedUnits = 0;
  let measuredUnits = 0;
  for (let d = 0; d < days; d++) {
    const dayBase = d * SLOTS;
    const placedToday = Array.from({ length: N }, () => new Array(SLOTS).fill(0));
    for (let i = 0; i < N; i++) {
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
    ...(mode.startsWith("paced")
      ? { droppedUnitsPct: r((100 * droppedUnits) / (droppedUnits + measuredUnits), 2) }
      : {}),
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
    doc.results[id] = { label: W.label, cells, wp12 };
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
  for (const [id, w] of Object.entries(doc.results)) {
    if (!w.wp12) continue;
    out += `## WP-12 — can anything dissolve the herd? (${id})\n\n| arm | N | alpha | staleness | g/kWh paid | top-5% share | peak ratio | oscillation | dropped |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|\n`;
    for (const [k, v] of Object.entries(w.wp12)) {
      const [mode, rest] = [k.replace(/_N\d+_a[\d.]+_s\d+$/, ""), k.match(/_N(\d+)_a([\d.]+)_s(\d+)$/)];
      out += `| ${mode} | ${rest[1]} | ${rest[2]} | ${rest[3]} | ${v.meanIntensityGPerKWh} | ${v.top5PctSlotShare}% | ${v.peakConcurrencyRatio} | ${v.oscillationL1} | ${v.droppedUnitsPct !== undefined ? v.droppedUnitsPct + "%" : "—"} |\n`;
    }
    out += `\n`;
  }
  out += `## What the table actually shows (the four findings)\n\n1. **The plane spreads the crowd only by paying grams.** Every alpha > 0 cell pays MORE mean intensity than its blind-herd counterpart (the herd pure-argmins the real signal; asserted as an invariant in loop.test.js). Where the top-5% share falls — most visibly at N=2, alpha=2, weekly cadence: 33.33% -> 14.88% (winter) and -> 11.9% (summer) — the price is dirtier slots (76.55 -> 99.52 and 71.46 -> 86.8 g/kWh). **A published signal alone cannot both spread the herd and stay clean.** That is the measured case for the second half of WP-17: allocation (the gate's paced budget) rather than information alone — and it is exactly Bailey et al.'s TOU-vs-managed-charging finding, reproduced in a publication-medium model.\n2. **Fresh mutual observation oscillates.** At N >= 5 with daily publication and strong heed, day-to-day oscillation sits at or near its maximum of 2 — complete daily swaps, the cobweb: everyone reads the same picture, everyone jumps together, the picture inverts. Staleness *lowers* oscillation here (phase-offset publication desynchronises the crowd) at the cost of steering on old data. Neither end is stable-and-clean; that trade is the result.\n3. **The effect shrinks as N grows.** With many identical systems the per-peer signal averages out (top-5% share climbs back toward the herd's 33.33% cap-bound value at N=25). Spreading a LARGE crowd through voluntary document-reading alone does not happen in this model; it needs heterogeneity, allocation, or both.\n4. **WP-12's verdict, and it falsifies our own conjecture.** Three anti-herd mechanisms were run head-to-head (table above): a PACED BUDGET with skip-k rungs sheds work instead of spreading it (units drop, the top-5% share RISES because survivors still pile into the same slots); the same budget with the gate's true DEFER semantics reshuffles inside the same cheap band (top share rises to ~41%, no drops); and the STAGGER arm — SI 2021/1467's intent at slot resolution — is inert, because near-ties within 1 g/kWh are rare on real intensity data (consistent with the regulation targeting sub-slot synchrony, not slot-level herding). The claim "a paced budget is a staggering mechanism" is therefore FALSIFIED in this model class. What actually bounds the herd in every row is the per-system slot CAP — capacity semantics. The redirect is concrete: the gate's anti-herd lever is rate/capacity rungs (degrade = halve your per-slot cap), which is CarbonFlex's capacity limit made a governance verdict — designed, not yet built (WP-12b).\n\n## Reading notes\n\n- **alpha = 0 rows are the blind herd** — every system argmins the same grid signal; the top-5% share there is this model's R11. Peak ratio 1.0 for the herd is definitional (it packs its 6 cap-bound slots exactly), which is why the discriminating columns are the share, the intensity and the oscillation.\n- Staleness 1 vs 7 days brackets a real gap: E1 measured the median published document age at **23 days**; a control loop needs cadences near the top row. The gap between the rows is the argument for runtime cadence.\n- Not modelled here, on purpose: the gate's budget pacing (WP-17's second half — the finding above says it is needed), heterogeneous workloads, and strategic misreporting — F13 and E6's Goodhart warning say what happens when publishing becomes strategic.\n`;
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
