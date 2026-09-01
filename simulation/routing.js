// SPDX-License-Identifier: GPL-3.0-only
/**
 * simulation/routing.js — E6: ROUTED EV CHARGING, "when AND where", as a real
 * deterministic simulation over the committed regional traces (npm run routing).
 *
 * The question (the owner's case C6 in docs/ROADMAP.md §3d): if a car can choose not
 * only WHEN to start its overnight charge but WHICH REGION'S charger to plug into —
 * routed between intervals to where the grid is cleanest — what does that buy over
 * the best window at home, and what does the drive there cost?
 *
 * Model, stated completely:
 *   - Same fleet, plug-in windows and deadline as E3 (imported from charging.js);
 *     same expectation calculus as bounds.js (uniform over nights x plug-in slots,
 *     no PRNG), so re-runs are byte-identical.
 *   - The car's home region is London (regionid 13 — the middle of the three
 *     committed peers by mean intensity). The candidate regions are the three peer
 *     series the repository already commits: North Scotland, London, South Wales.
 *   - Choosing region r and start s costs the charge energy at r's intensity over
 *     the window PLUS a MOVEMENT COST: `moveKWh` of extra energy per one-way trip to
 *     a non-home region, charged at that region's intensity at the start slot (the
 *     car drives there and that energy comes from somewhere; both legs' energy can
 *     be folded into the parameter). moveKWh is swept, because it is the honest
 *     unknown: 0 (a charger next door in the cheap region — the pure ceiling),
 *     2 kWh (~10 km each way for a ~5 mi/kWh EV), 5 kWh (~25 km each way).
 *
 * SCORING HONESTY (the R2 caveat, and it is load-bearing): Great Britain publishes
 * NO regional actual, so cross-region emissions can only be scored on the regional
 * FORECAST series. Every number here is therefore FORECAST-SCORED and advisory —
 * the same status as the spatial bound in bounds.js — and the tables say so. The
 * one exception: the stay-home arms are also scored on the national actual, so the
 * reader can see how forecast-scoring flatters (or not) the numbers it CAN check.
 *
 * SAFETY/LEGAL INVARIANTS carried over from E3 (ADR-011, R18): full charge before
 * the deadline in every arm; start-time choice only; the randomised-delay duty
 * (SI 2021/1467 reg. 11) applies at whatever charger the car lands on and is not
 * modelled here (R18 stands for this arm too). Routing is ADVICE to a driver who
 * consents; nothing here moves a car.
 *
 * Run: npm run routing     Output: results/routing.json + results/routing.md
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mean, r, sum } from "../shared/stats.js";
import { loadWindow } from "./lib.js";
import { FLEET, nightsIn } from "./charging.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const SLOTS_PER_DAY = 48;
const HOME_REGION = "London";
const MOVE_KWH_SWEEP = [0, 2, 5];

function loadPeers(id) {
  const raw = JSON.parse(readFileSync(path.join(ROOT, "data", "simulation", `${id}.json`), "utf8"));
  return raw.peers.map((p) => ({ name: p.name, regionid: p.regionid, values: p.values }));
}

/** Mean forecast intensity of `series` over the charge window starting at s. */
function windowMean(series, s) {
  let acc = 0;
  for (let i = 0; i < FLEET.chargeSlots; i++) acc += series[s + i];
  return acc / FLEET.chargeSlots;
}

/** grams for charging FLEET.energyKWh over the window at `series` intensities. */
function chargeG(series, s) {
  const per = FLEET.energyKWh / FLEET.chargeSlots;
  let g = 0;
  for (let i = 0; i < FLEET.chargeSlots; i++) g += per * series[s + i];
  return g;
}

function e6(W, peers) {
  const nights = nightsIn(W);
  const home = peers.find((p) => p.name === HOME_REGION);
  if (!home) throw new Error(`home region ${HOME_REGION} not in committed peers`);
  const plugIns = [];
  for (let p0 = FLEET.plugInSlotRange[0]; p0 <= FLEET.plugInSlotRange[1]; p0++) plugIns.push(p0);

  // Arm A (reference): charge at plug-in, home region, forecast-scored + actual-scored.
  // Arm B (E3's policy): best window at home, forecast-scored + actual-scored.
  // Arm C (routed): best (region, window), forecast-scored only, per moveKWh.
  const out = {
    nights,
    homeRegion: HOME_REGION,
    regions: peers.map((p) => p.name),
    scoring: "forecast-scored (GB publishes no regional actual — limitation R2); stay-home arms additionally scored on the national actual so the one checkable comparison is shown",
  };

  const collect = { naiveF: [], naiveA: [], bestHomeF: [], bestHomeA: [] };
  const routed = Object.fromEntries(MOVE_KWH_SWEEP.map((m) => [m, { g: [], routedAway: 0, byRegion: Object.fromEntries(peers.map((p) => [p.name, 0])), total: 0 }]));

  for (let d = 0; d < nights; d++) {
    const deadline = d * SLOTS_PER_DAY + FLEET.deadlineSlotOffset;
    for (const p0 of plugIns) {
      const p = d * SLOTS_PER_DAY + p0;
      const lastStart = deadline - FLEET.chargeSlots;

      collect.naiveF.push(chargeG(home.values, p));
      collect.naiveA.push(chargeG(W.actual, p));

      let bh = p;
      for (let s = p + 1; s <= lastStart; s++) if (windowMean(home.values, s) < windowMean(home.values, bh)) bh = s;
      collect.bestHomeF.push(chargeG(home.values, bh));
      collect.bestHomeA.push(chargeG(W.actual, bh));

      for (const m of MOVE_KWH_SWEEP) {
        let best = null;
        for (const region of peers) {
          for (let s = p; s <= lastStart; s++) {
            const move = region.name === HOME_REGION ? 0 : m * region.values[s];
            const g = chargeG(region.values, s) + move;
            if (best === null || g < best.g) best = { g, region: region.name };
          }
        }
        const bucket = routed[m];
        bucket.g.push(best.g);
        bucket.byRegion[best.region]++;
        bucket.total++;
        if (best.region !== HOME_REGION) bucket.routedAway++;
      }
    }
  }

  const perSession = (v) => r(mean(v), 1);
  const pctVs = (base, v) => r((100 * (mean(base) - mean(v))) / mean(base), 2);
  out.arms = {
    naive_home: {
      gPerSessionForecast: perSession(collect.naiveF),
      gPerSessionActual: perSession(collect.naiveA),
    },
    best_window_home: {
      gPerSessionForecast: perSession(collect.bestHomeF),
      gPerSessionActual: perSession(collect.bestHomeA),
      pctAvoidedVsNaiveForecast: pctVs(collect.naiveF, collect.bestHomeF),
      pctAvoidedVsNaiveActual: pctVs(collect.naiveA, collect.bestHomeA),
    },
  };
  // ── E6b: geo-migration — the RUNTIME re-homes, daily, with a switch cost ──
  // A system (an agentic runtime, a batch farm) picks ONE home region per day —
  // argmin of the day's mean forecast intensity — and pays `switchKWh` of energy
  // (state transfer, redeploy, warm-up), charged at the destination's day-mean
  // intensity, each time it moves. Hysteresis is the switch cost itself: a move
  // happens only if the day's saving on the day's load exceeds the toll.
  // Load: the fleet's daily charge energy stands in for any daily workload.
  const SWITCH_KWH_SWEEP = [0, 5, 20];
  const dailyLoadKWh = FLEET.vehicles * FLEET.energyKWh;
  out.migration = { switchKWhSweep: SWITCH_KWH_SWEEP, dailyLoadKWh, arms: {} };
  const dayMean = (series, d) => {
    let acc = 0;
    for (let s2 = 0; s2 < SLOTS_PER_DAY; s2++) acc += series[d * SLOTS_PER_DAY + s2];
    return acc / SLOTS_PER_DAY;
  };
  const migDays = Math.floor(W.slots / SLOTS_PER_DAY);
  {
    // Fixed-home baseline (forecast-scored, London).
    let fixedG = 0;
    for (let d = 0; d < migDays; d++) fixedG += dailyLoadKWh * dayMean(home.values, d);
    for (const sw of SWITCH_KWH_SWEEP) {
      let cur = HOME_REGION;
      let g = 0;
      let moves = 0;
      const daysIn = Object.fromEntries(peers.map((q) => [q.name, 0]));
      for (let d = 0; d < migDays; d++) {
        let bestR = cur;
        let bestCost = Infinity;
        for (const q of peers) {
          const toll = q.name === cur ? 0 : sw * dayMean(q.values, d);
          const cost = dailyLoadKWh * dayMean(q.values, d) + toll;
          if (cost < bestCost) { bestCost = cost; bestR = q.name; }
        }
        if (bestR !== cur) moves++;
        cur = bestR;
        g += bestCost;
        daysIn[cur]++;
      }
      out.migration.arms[`switchKWh${sw}`] = {
        totalGPerDay: r(g / migDays, 0),
        pctAvoidedVsFixedHome: r((100 * (fixedG - g)) / fixedG, 2),
        moves,
        daysInRegion: daysIn,
      };
    }
    out.migration.fixedHomeGPerDay = r(fixedG / migDays, 0);
  }

  out.routed = {};
  for (const m of MOVE_KWH_SWEEP) {
    const b = routed[m];
    out.routed[`moveKWh${m}`] = {
      gPerSessionForecast: perSession(b.g),
      pctAvoidedVsNaiveForecast: pctVs(collect.naiveF, b.g),
      pctAvoidedVsBestHomeForecast: pctVs(collect.bestHomeF, b.g),
      sessionsRoutedAwayPct: r((100 * b.routedAway) / b.total, 2),
      chosenRegionSharePct: Object.fromEntries(peers.map((p) => [p.name, r((100 * b.byRegion[p.name]) / b.total, 2)])),
    };
  }
  return out;
}

function renderMd(doc) {
  let out = `# E6 — Routed EV charging: when AND where (advisory, forecast-scored)\n\nGenerated by \`npm run routing\`. Deterministic expectation over the committed traces — no PRNG, no network. ${""}\n\n**Read the scoring note first:** Great Britain publishes no regional actual (limitation R2), so every cross-region number is scored on the regional FORECAST and is advisory. The stay-home arms are also scored on the national actual — the one comparison a reader can check against ground truth. Routing is advice to a consenting driver; the movement cost \`moveKWh\` (extra energy per one-way trip to a non-home region, charged at that region's intensity) is swept because it is the honest unknown. SI 2021/1467's randomised-delay duty applies at whichever charger the car lands on (R18).\n\n`;
  for (const [id, b] of Object.entries(doc.results)) {
    out += `## ${id} (${b.label}) — home region ${b.homeRegion}, ${b.nights} nights\n\n`;
    out += `| arm | g/session (forecast) | g/session (actual) | % vs naive (forecast) | % vs best-home (forecast) | sessions routed away | region shares |\n|---|---:|---:|---:|---:|---:|---|\n`;
    const a = b.arms;
    out += `| naive (plug-in, home) | ${a.naive_home.gPerSessionForecast} | ${a.naive_home.gPerSessionActual} | — | — | 0% | ${b.homeRegion} 100% |\n`;
    out += `| best window at home (E3's policy) | ${a.best_window_home.gPerSessionForecast} | ${a.best_window_home.gPerSessionActual} | ${a.best_window_home.pctAvoidedVsNaiveForecast}% | — | 0% | ${b.homeRegion} 100% |\n`;
    for (const [k, v] of Object.entries(b.routed)) {
      const shares = Object.entries(v.chosenRegionSharePct).map(([n, x]) => `${n} ${x}%`).join(", ");
      out += `| routed, ${k.replace("moveKWh", "move = ")} kWh | ${v.gPerSessionForecast} | n/a (R2) | ${v.pctAvoidedVsNaiveForecast}% | ${v.pctAvoidedVsBestHomeForecast}% | ${v.sessionsRoutedAwayPct}% | ${shares} |\n`;
    }
    out += `\n### E6b — geo-migration: the runtime re-homes daily (forecast-scored)\n\nOne system carrying ${b.migration.dailyLoadKWh} kWh/day of load picks one region per day; each move costs \`switchKWh\` charged at the destination's day-mean intensity. Fixed home (${b.homeRegion}): ${b.migration.fixedHomeGPerDay} g/day.\n\n| switch cost (kWh) | g/day | % avoided vs fixed home | moves in ${b.nights + 1} days | days per region |\n|---:|---:|---:|---:|---|\n`;
    for (const [k, v] of Object.entries(b.migration.arms)) {
      const stay = Object.entries(v.daysInRegion).map(([n, x]) => `${n} ${x}`).join(", ");
      out += `| ${k.replace("switchKWh", "")} | ${v.totalGPerDay} | ${v.pctAvoidedVsFixedHome}% | ${v.moves} | ${stay} |\n`;
    }
    out += `\nThe same Goodhart warning applies with force: a runtime that follows published regional zeros concentrates the WORLD's compute wherever the lowest number is printed. Migration must be gated (a reversible action with a cost and a rung), and the switch-cost sweep is the hysteresis that keeps it from flapping.\n\n`;
  }
  out += `## The summer row is a warning, and it is the most important result here\n\nIn summer the routed arms report avoiding ~100%: North Scotland's published forecast sits at ~0 gCO2e/kWh for the whole window, so forecast-scored routed emissions go to ~zero. Taken literally that is absurd — and that is the point. **A region (or any publisher) whose signal reads zero attracts ALL the load**: this is fitness function F13's lesson at the spatial level. The moment work follows published intensity, publishing becomes strategic (Goodhart, limitation R15), a biased-low signal is rewarded with demand, and no regional ground truth exists to catch it (R2). Routed compositions therefore need the metering/attestation story MORE than temporal ones, not less — the dirtier the incentive, the more the publish-back edge must be verifiable. The winter rows, where the argmin region's forecast is non-zero, are the realistic shape of the result.\n\n## Reading this, plainly\n\n- The routed arms answer the composition question C6 (docs/ROADMAP.md §3d): choosing *where* on top of *when*, with the drive priced in.\n- "% vs best-home" is the honest headline: it is what routing adds over the already-optimal home window, not over doing nothing.\n- A moveKWh of 0 is the ceiling (a clean-region charger next door); 2 and 5 kWh price a real detour. Where the % vs best-home collapses as moveKWh grows, routing is not worth the drive — that is a result, not a failure.\n- Forecast-scored means exactly that: if the regional forecasts are biased (R2 says they are, low), the routed numbers inherit the bias, and no regional ground truth exists to correct them. The stay-home rows show both scorings so the reader can gauge the gap where it is measurable.\n`;
  return out;
}

function main() {
  const doc = {
    generatedBy: "simulation/routing.js (npm run routing)",
    note: "E6: routed EV charging (region + window argmin) as deterministic expectation over the committed regional forecast traces. Advisory and forecast-scored by construction (no regional actual exists — R2).",
    fleet: { vehicles: FLEET.vehicles, energyKWh: FLEET.energyKWh, chargeSlots: FLEET.chargeSlots, plugInSlotRange: FLEET.plugInSlotRange, deadlineSlotOffset: FLEET.deadlineSlotOffset },
    homeRegion: HOME_REGION,
    moveKWhSweep: MOVE_KWH_SWEEP,
    results: {},
  };
  for (const id of ["W1", "W2"]) {
    const W = loadWindow(id);
    doc.results[id] = { label: W.label, ...e6(W, loadPeers(id)) };
  }
  writeFileSync(path.join(ROOT, "results", "routing.json"), JSON.stringify(doc, null, 2) + "\n");
  writeFileSync(path.join(ROOT, "results", "routing.md"), renderMd(doc));
  for (const id of ["W1", "W2"]) {
    const b = doc.results[id];
    console.log(`${id}: best-home ${b.arms.best_window_home.pctAvoidedVsNaiveForecast}% | routed m0 ${b.routed.moveKWh0.pctAvoidedVsNaiveForecast}% (+${b.routed.moveKWh0.pctAvoidedVsBestHomeForecast} over best-home) m2 ${b.routed.moveKWh2.pctAvoidedVsNaiveForecast}% m5 ${b.routed.moveKWh5.pctAvoidedVsNaiveForecast}% | routed-away at m2: ${b.routed.moveKWh2.sessionsRoutedAwayPct}%`);
  }
  console.log("routing done -> results/routing.json, results/routing.md");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
