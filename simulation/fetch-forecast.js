// SPDX-License-Identifier: GPL-3.0-only
/**
 * simulation/fetch-forecast.js — capture NESO's forward forecast (WP-3), and later
 * grade a past capture against settled actuals. NETWORK TOOL, run manually like
 * fetch-traces.js; nothing in npm test touches it, and its outputs are committed
 * fixtures under data/forecast/.
 *
 *   node simulation/fetch-forecast.js
 *     -> data/forecast/capture-<ISO instant>.json : national fw48h + the three peer
 *        regions' fw48h, verbatim as published, with full provenance.
 *
 *   node simulation/fetch-forecast.js --grade data/forecast/capture-....json
 *     -> grades the capture's NATIONAL series against the settled actuals for the
 *        same window (fetchable once >= 48 h have passed) and writes
 *        <capture>.graded.json with MAPE/MAE/bias BY LEAD TIME. This is the
 *        prospective protocol docs/ports/FORECAST.md describes: the committed
 *        traces' forecast column has an unknown issue horizon, and only a capture
 *        taken before the fact can grade the forecast honestly. Regional series
 *        cannot be graded at all (no regional actual exists — limitation R2).
 *
 * The peer regions match ADR-008's stand-ins: 1 North Scotland, 13 London,
 * 8 South Wales.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mean, r } from "../shared/stats.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "..", "data", "forecast");
const API = "https://api.carbonintensity.org.uk";
const TIMEOUT_MS = 15_000; // every live fetch in the package has a timeout
const PEER_REGIONS = [
  { regionid: 1, name: "North Scotland" },
  { regionid: 13, name: "London" },
  { regionid: 8, name: "South Wales" },
];

async function getJson(url) {
  const res = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

/** Flatten one intensity period list into {from,to,forecast} rows, verbatim. */
const rows = (periods) => periods.map((p) => ({ from: p.from, to: p.to, forecast: p.intensity?.forecast ?? null }));

async function capture() {
  const capturedAt = new Date().toISOString();
  const from = capturedAt.slice(0, 16) + "Z"; // API accepts minute precision
  const natUrl = `${API}/intensity/${from}/fw48h`;
  const nat = await getJson(natUrl);
  const regions = [];
  for (const pr of PEER_REGIONS) {
    const url = `${API}/regional/intensity/${from}/fw48h/regionid/${pr.regionid}`;
    const doc = await getJson(url);
    const data = doc.data?.data ?? [];
    regions.push({ ...pr, sourceUrl: url, periods: rows(data) });
  }
  const out = {
    capturedAt,
    provider: "National Energy System Operator (NESO) Carbon Intensity API",
    note: "Prospective fw48h capture (WP-3). Values verbatim as published at capturedAt; unit is gCO2/kWh per the provider's methodology (CO2, generation-average, operational). Regional series are forecast-only by construction (R2). Grade the national series after >= 48 h with --grade.",
    national: { sourceUrl: natUrl, periods: rows(nat.data ?? []) },
    peerRegions: regions,
  };
  mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `capture-${capturedAt.replace(/[:]/g, "").slice(0, 15)}Z.json`);
  writeFileSync(file, JSON.stringify(out, null, 2) + "\n");
  console.log(`captured national fw48h (${out.national.periods.length} periods) + ${regions.length} peer regions -> ${path.relative(process.cwd(), file)}`);
}

async function grade(capturePath) {
  const cap = JSON.parse(readFileSync(capturePath, "utf8"));
  const periods = cap.national.periods.filter((p) => Number.isFinite(p.forecast));
  if (!periods.length) throw new Error("capture has no national forecast periods");
  const from = periods[0].from;
  const to = periods[periods.length - 1].to;
  const actuals = new Map();
  // The historical endpoint caps ranges; fetch in <=14-day chunks like fetch-traces.
  const doc = await getJson(`${API}/intensity/${from}/${to}`);
  for (const p of doc.data ?? []) actuals.set(p.from, p.intensity?.actual ?? null);

  const t0 = Date.parse(cap.capturedAt);
  const byLead = {}; // lead bucket (hours, 6h-wide) -> {ape[], err[]}
  let graded = 0;
  let unsettled = 0;
  for (const p of periods) {
    const a = actuals.get(p.from);
    if (!Number.isFinite(a) || a === 0) { unsettled++; continue; }
    const leadH = (Date.parse(p.from) - t0) / 3.6e6;
    const bucket = `${Math.floor(Math.max(0, leadH) / 6) * 6}-${Math.floor(Math.max(0, leadH) / 6) * 6 + 6}h`;
    (byLead[bucket] ??= { ape: [], err: [] });
    byLead[bucket].ape.push(Math.abs(p.forecast - a) / a);
    byLead[bucket].err.push(p.forecast - a);
    graded++;
  }
  if (!graded) throw new Error("no settled actuals yet — wait until the capture window has passed");
  const summary = Object.fromEntries(Object.entries(byLead).map(([k, v]) => [k, {
    periods: v.ape.length,
    mapePct: r(100 * mean(v.ape), 2),
    maeGPerKWh: r(mean(v.err.map(Math.abs)), 1),
    biasGPerKWh: r(mean(v.err), 1),
  }]));
  const out = {
    gradedAt: new Date().toISOString(),
    capture: path.basename(capturePath),
    capturedAt: cap.capturedAt,
    gradedPeriods: graded,
    unsettledPeriods: unsettled,
    regionalNote: "regional forecasts cannot be graded: Great Britain publishes no regional actual (limitation R2)",
    byLeadTime: summary,
  };
  const file = capturePath.replace(/\.json$/, ".graded.json");
  writeFileSync(file, JSON.stringify(out, null, 2) + "\n");
  console.log(`graded ${graded} periods (${unsettled} unsettled) -> ${path.relative(process.cwd(), file)}`);
  for (const [k, v] of Object.entries(summary)) console.log(`  lead ${k}: MAPE ${v.mapePct}% MAE ${v.maeGPerKWh} bias ${v.biasGPerKWh} (${v.periods})`);
}

const gradeIdx = process.argv.indexOf("--grade");
if (gradeIdx !== -1) {
  await grade(process.argv[gradeIdx + 1]);
} else {
  await capture();
}
