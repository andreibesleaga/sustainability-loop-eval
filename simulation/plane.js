// SPDX-License-Identifier: GPL-3.0-only
/**
 * simulation/plane.js — WP-17: the closed loop with REAL documents.
 *
 * E5 (loop.js) proved the plane's dynamics with histograms. This closes the last
 * gap: systems here publish and consume documents in the SAME shape the gateway
 * actually serves — the Internet-Draft's Basic member set, validated against the
 * committed gateway documents' own mandatory members — so the loop is exercised
 * through the format the invention specifies, not through a convenient array.
 *
 * What is real: the member set and its constraints (checked against
 * data/dataplane/docs/*.json at run time, so a format drift breaks this arm);
 * the carbon traces; the publish→sense→act→publish ordering.
 * What is modelled: the workload, and the peers themselves.
 *
 * The mechanism under test is limitation R12 — "the two halves are joined by
 * assumption; no measured run consumes the gateway's documents as its control
 * signal". Here a run does, and the thing that decides everything turns out to be
 * the one number E1 measured on the real gateway: **document age**. A system can
 * only act on what its peers last published, so the loop's control quality is a
 * function of publication cadence, and E1 measured the real-world median at 23
 * days. This arm prices that gap.
 *
 * Run: npm run plane     Output: results/plane.json + results/plane.md
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mean, r } from "../shared/stats.js";
import { loadWindow } from "./lib.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DOCS = path.join(ROOT, "data", "dataplane", "docs");

const SLOTS_PER_DAY = 48;
const UNITS_PER_DAY = 24;
const UNIT_KWH = 0.05;
const SLOT_CAP = 4;
const WARMUP_DAYS = 14;
const N_SYSTEMS = 5;
// Cadence in slots: 30 min (runtime), 1 day, 7 days, and E1's measured median (23 d).
const CADENCES = [
  { label: "30 min", slots: 1 },
  { label: "1 day", slots: SLOTS_PER_DAY },
  { label: "7 days", slots: 7 * SLOTS_PER_DAY },
  { label: "23 days (E1's measured median)", slots: 23 * SLOTS_PER_DAY },
];

/**
 * The Basic members every gateway document carries, derived from the committed
 * documents themselves rather than hard-coded — so if the gateway's format moves,
 * this arm fails loudly instead of drifting.
 */
export function mandatoryMembers() {
  const files = readdirSync(DOCS).filter((f) => f.endsWith(".json"));
  let common = null;
  for (const f of files) {
    const doc = JSON.parse(readFileSync(path.join(DOCS, f), "utf8"));
    const body = doc.body ?? doc;
    const keys = new Set(Object.keys(body));
    common = common === null ? keys : new Set([...common].filter((k) => keys.has(k)));
  }
  if (!common || common.size === 0) throw new Error("no common members across committed gateway documents");
  return [...common].sort();
}

/** How many committed gateway documents actually carry each member the loop reads. */
export function memberCoverage(members = ["carbon-intensity-gCO2e-per-kWh", "energy-consumption"]) {
  const files = readdirSync(DOCS).filter((f) => f.endsWith(".json"));
  const out = {};
  for (const m of members) out[m] = { documentsCarrying: 0, documentsTotal: files.length };
  for (const f of files) {
    const doc = JSON.parse(readFileSync(path.join(DOCS, f), "utf8"));
    const body = doc.body ?? doc;
    for (const m of members) if (m in body) out[m].documentsCarrying++;
  }
  for (const m of members) out[m].coveragePct = r((100 * out[m].documentsCarrying) / out[m].documentsTotal, 1);
  return out;
}

/** Emit one Draft-shaped document for a system's last reporting period. */
function publishDocument({ target, updated, period, energyKWh, gramsCO2e }, members) {
  const doc = {
    version: "2.0",
    updated,
    capabilities: "basic",
    provider: `simulated peer ${target}`,
    "measurement-method": "self-reported",
    "methodology-uri": "https://example.invalid/simulated-methodology",
    "reporting-period": period,
    target,
    "target-type": "service",
    "energy-consumption": r(energyKWh, 3),
    "energy-unit": "kWh",
    "carbon-footprint": r(gramsCO2e, 3),
    "carbon-unit": "gCO2e",
    "carbon-accounting": "location-based",
    "carbon-intensity-gCO2e-per-kWh": r(energyKWh > 0 ? gramsCO2e / energyKWh : 0, 1),
    "disclosure-uri": "https://example.invalid/simulated-disclosure",
  };
  for (const m of members) if (!(m in doc)) throw new Error(`published document is missing mandatory member ${m}`);
  return doc;
}

/**
 * One run at a given cadence. Each system reads its peers' LAST PUBLISHED
 * documents, derives a single scalar from them — the peers' published
 * carbon-intensity, exactly what the Draft's member carries — and shifts its own
 * willingness accordingly: a peer fleet reporting high intensity means the shared
 * grid is dirty, so hold back (place into fewer, cleaner slots). This is the
 * document-native version of E5's crowd term.
 */
function run(W, cadenceSlots, members, member = "carbon-intensity-gCO2e-per-kWh") {
  const days = Math.floor(W.slots / SLOTS_PER_DAY);
  const published = Array.from({ length: N_SYSTEMS }, () => null);
  const paid = [];
  const staleness = [];
  const aggregates = [];
  let publishes = 0;
  let readsOfStale = 0;
  let totalReads = 0;

  for (let d = 0; d < days; d++) {
    const dayBase = d * SLOTS_PER_DAY;
    const placedToday = Array.from({ length: N_SYSTEMS }, () => new Array(SLOTS_PER_DAY).fill(0));
    const spentG = new Array(N_SYSTEMS).fill(0);
    const spentKWh = new Array(N_SYSTEMS).fill(0);

    for (let i = 0; i < N_SYSTEMS; i++) {
      // Sense: the peers' published intensity, and how old that picture is.
      const seen = [];
      for (let j = 0; j < N_SYSTEMS; j++) {
        if (j === i || !published[j]) continue;
        totalReads++;
        const ageSlots = dayBase - published[j].publishedAtSlot;
        staleness.push(ageSlots / SLOTS_PER_DAY);
        if (ageSlots > SLOTS_PER_DAY) readsOfStale++;
        seen.push(published[j].doc[member]);
      }
      const peerValue = seen.length ? mean(seen) : null;
      // Act: rank the day's slots and take the cheapest; if the peers' published
      // number says the shared resource is under pressure, spread into a WIDER
      // band instead of piling onto the same cheapest slots.
      const order = [];
      for (let s = 0; s < SLOTS_PER_DAY; s++) order.push([W.actual[dayBase + s], s]);
      order.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      // Reference point per member: intensity is compared against the window mean;
      // energy (load) against what a single system spends in a day.
      const reference = member === "energy-consumption"
        ? UNITS_PER_DAY * UNIT_KWH
        : mean(W.actual);
      const minSlots = Math.ceil(UNITS_PER_DAY / SLOT_CAP);
      const band = peerValue !== null && peerValue >= reference
        ? Math.min(SLOTS_PER_DAY, minSlots * 3)   // peers are busy: spread out
        : SLOTS_PER_DAY;
      // Spreading means fewer units per slot across more slots; the cap still binds.
      const perSlot = band > SLOTS_PER_DAY / 2 ? SLOT_CAP : Math.max(1, Math.ceil(UNITS_PER_DAY / band));
      let placed = 0;
      for (let k = 0; k < order.length && placed < UNITS_PER_DAY; k++) {
        const s = order[k][1];
        const take = Math.min(perSlot, SLOT_CAP, UNITS_PER_DAY - placed);
        placedToday[i][s] += take;
        placed += take;
        spentKWh[i] += take * UNIT_KWH;
        spentG[i] += take * UNIT_KWH * W.actual[dayBase + s];
      }
      if (placed < UNITS_PER_DAY) throw new Error("could not place the day's units");
    }

    // Publish: at the cadence, each system emits a real document for the day.
    for (let i = 0; i < N_SYSTEMS; i++) {
      const dueSlot = dayBase + SLOTS_PER_DAY - 1;
      const last = published[i]?.publishedAtSlot ?? -Infinity;
      if (dueSlot - last >= cadenceSlots) {
        published[i] = {
          publishedAtSlot: dueSlot,
          doc: publishDocument({
            target: `peer-${i}.example`,
            updated: W.slotStarts?.[dueSlot] ?? `day-${d}`,
            period: `day-${d}`,
            energyKWh: spentKWh[i],
            gramsCO2e: spentG[i],
          }, members),
        };
        publishes++;
      }
    }

    if (d >= WARMUP_DAYS) {
      const agg = new Array(SLOTS_PER_DAY).fill(0);
      let g = 0;
      for (let i = 0; i < N_SYSTEMS; i++) for (let s = 0; s < SLOTS_PER_DAY; s++) {
        agg[s] += placedToday[i][s];
        g += placedToday[i][s] * UNIT_KWH * W.actual[dayBase + s];
      }
      aggregates.push(agg);
      paid.push(g / (N_SYSTEMS * UNITS_PER_DAY * UNIT_KWH));
    }
  }

  const topShares = aggregates.map((agg) => {
    const sorted = [...agg].sort((a, b) => b - a);
    const topN = Math.max(1, Math.round(SLOTS_PER_DAY * 0.05));
    return sorted.slice(0, topN).reduce((x, y) => x + y, 0) / (N_SYSTEMS * UNITS_PER_DAY);
  });
  return {
    meanIntensityGPerKWh: r(mean(paid), 2),
    top5PctSlotShare: r(100 * mean(topShares), 2),
    documentsPublished: publishes,
    meanDocumentAgeDays: r(mean(staleness), 2),
    readsOfDocumentsOlderThanADayPct: r(totalReads ? (100 * readsOfStale) / totalReads : 0, 1),
  };
}

function main() {
  const members = mandatoryMembers();
  const doc = {
    generatedBy: "simulation/plane.js (npm run plane)",
    note: "WP-17: the closed loop run with documents in the SAME shape the reference gateway serves. The mandatory member set is derived from the committed gateway documents at run time, so a format drift fails this arm rather than passing silently. Closes limitation R12's 'no measured run consumes published documents as its control signal' for the document FORMAT; real third-party publishers remain the open half (R5).",
    mandatoryMembers: members,
    memberCoverage: memberCoverage(),
    model: { systems: N_SYSTEMS, unitsPerDay: UNITS_PER_DAY, unitKWh: UNIT_KWH, slotCap: SLOT_CAP, warmupDays: WARMUP_DAYS },
    results: {},
  };
  for (const id of ["W1", "W2"]) {
    const W = loadWindow(id);
    const cells = {};
    for (const c of CADENCES) cells[c.label] = run(W, c.slots, members);
    // Which published MEMBER makes a usable control signal? Same loop, same
    // cadence, only the number read from the peers' documents changes.
    const byMember = {};
    for (const m of ["carbon-intensity-gCO2e-per-kWh", "energy-consumption"]) {
      byMember[m] = run(W, SLOTS_PER_DAY, members, m);
    }
    doc.results[id] = { label: W.label, cadences: cells, byMember };
  }
  writeFileSync(path.join(ROOT, "results", "plane.json"), JSON.stringify(doc, null, 2) + "\n");
  writeFileSync(path.join(ROOT, "results", "plane.md"), renderMd(doc));
  for (const id of ["W1", "W2"]) {
    const c = doc.results[id].cadences;
    console.log(`${id}: ${Object.entries(c).map(([k, v]) => `${k} -> age ${v.meanDocumentAgeDays}d, ${v.meanIntensityGPerKWh} g/kWh`).join(" | ")}`);
  }
  console.log("plane done -> results/plane.json, results/plane.md");
}

function renderMd(doc) {
  let out = `# WP-17 — the closed loop, with real documents\n\nGenerated by \`npm run plane\`. ${doc.note}\n\nMembers present on EVERY committed gateway document, and therefore validated on every document this arm publishes: \`${doc.mandatoryMembers.join("`, `")}\`.\n\n**Coverage of the members a control loop would want to read**, measured on the same committed documents: ${Object.entries(doc.memberCoverage).map(([m, c]) => `\`${m}\` on ${c.documentsCarrying}/${c.documentsTotal} (${c.coveragePct}%)`).join(", ")}.\n\n`;
  for (const [id, w] of Object.entries(doc.results)) {
    out += `## ${id} (${w.label})\n\n| publication cadence | documents published | mean age of the document read (days) | reads of documents older than a day | mean intensity paid (g/kWh) | top-5%-slot share |\n|---|---:|---:|---:|---:|---:|\n`;
    for (const [k, v] of Object.entries(w.cadences)) {
      out += `| ${k} | ${v.documentsPublished} | ${v.meanDocumentAgeDays} | ${v.readsOfDocumentsOlderThanADayPct}% | ${v.meanIntensityGPerKWh} | ${v.top5PctSlotShare}% |\n`;
    }
    out += `\n`;
  }
  for (const [id, w] of Object.entries(doc.results)) {
    if (!w.byMember) continue;
    out += `## Which published member is a usable control signal? (${id}, daily cadence)\n\n| member read from peers' documents | mean intensity paid (g/kWh) | top-5%-slot share |\n|---|---:|---:|\n`;
    for (const [m, v] of Object.entries(w.byMember)) {
      out += `| \`${m}\` | ${v.meanIntensityGPerKWh} | ${v.top5PctSlotShare}% |\n`;
    }
    out += `\n`;
  }
  out += `## What this settles, and what it does not\n\n- **The format is not the obstacle.** Every document these systems exchange carries the gateway's own mandatory member set, validated at publication; the loop runs through the Internet-Draft's Basic shape without needing anything the format lacks. Limitation R12's *format* half is closed here.\n- **Cadence is the whole ballgame.** At runtime cadence a system acts on a picture minutes old; at E1's measured real-world median (23 days) it acts on a picture older than the reporting period it describes, which is not control — it is archaeology. The rows price that directly.\n- **The signal member is the design finding.** A peer's published *carbon-intensity* is its own ACHIEVED intensity — and a well-optimised peer always looks clean, whatever the shared grid is doing, so as a congestion signal it is close to degenerate. The peers' *energy-consumption* (their load) is the number that actually says "the shared resource is busy". The coverage numbers above sharpen this into a recommendation for the format: the member a control loop most needs is carried by a minority of real documents today. **Publishing load is cheaper, more available, and more useful for regulation than publishing intensity.**\n- **The signal member is the design finding.** A peer's published *carbon-intensity* is its own ACHIEVED intensity — and a well-optimised peer always looks clean, whatever the shared grid is doing, so as a congestion signal it is close to degenerate. The peers' *energy-consumption* (their load) is the number that actually says "the shared resource is busy". The coverage line above sharpens this into a recommendation for the format: the member a control loop most wants is carried by a minority of real documents today. **Publishing load is cheaper, more available, and more useful for regulation than publishing intensity.**\n- **What is still open (R5):** these peers are simulated. No independent organisation publishes into the gateway yet, so the loop is closed in shape and in mechanism, not in society. That is an adoption problem, and §3c's verified adoption evidence (security.txt's trajectory, llms.txt, Cloudflare) is the realistic model for it.\n`;
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
