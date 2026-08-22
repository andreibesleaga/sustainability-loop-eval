/**
 * Fetch + cache the REAL grid-carbon traces the simulations run on.
 *
 * Source: UK National Grid ESO Carbon Intensity API (https://api.carbonintensity.org.uk),
 * free and keyless. Two 28-day windows, 30-minute slots:
 *   W1 winter 2026-01-05 -> 2026-02-02, W2 summer 2026-06-29 -> 2026-07-27.
 *
 * Two distinct series are cached, and they play different roles:
 *   - NATIONAL ACTUAL  -> ground truth. The governed service's own emissions are
 *                         always computed from this. (`/intensity/{from}/{to}`)
 *   - REGIONAL FORECAST -> the "peer signal". The architecture's signal comes from
 *                         PEER systems publishing their own carbon intensity, so we
 *                         model 3 peers as services sited in 3 GB regions and use each
 *                         region's published forecast as that peer's number.
 *                         NOTE: the regional endpoint is FORECAST-ONLY (no actual).
 *
 * Run once: `node simulation/fetch-traces.js`. Everything downstream reads the cache,
 * so results are reproducible with the network off.
 */
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";

const API = "https://api.carbonintensity.org.uk";
const SLOT_MIN = 30;
const OUT_DIR = new URL("../data/simulation/", import.meta.url);

/** The 3 peer systems, modelled as services located in 3 GB DNO regions. */
export const PEERS = [
  { regionid: 1, name: "North Scotland" },
  { regionid: 13, name: "London" },
  { regionid: 8, name: "South Wales" },
];

export const WINDOWS = [
  { id: "W1", label: "winter", from: "2026-01-05T00:00Z", to: "2026-02-02T00:00Z" },
  { id: "W2", label: "summer", from: "2026-06-29T00:00Z", to: "2026-07-27T00:00Z" },
];

const iso = (d) => d.toISOString().slice(0, 16) + "Z"; // the API's yyyy-MM-ddTHH:mmZ form

/** Split a window into 13-day chunks, safely inside the API's 14-day per-call limit. */
function chunks(from, to, days = 13) {
  const out = [];
  let cur = new Date(from);
  const end = new Date(to);
  while (cur < end) {
    const next = new Date(Math.min(cur.getTime() + days * 864e5, end.getTime()));
    out.push([iso(cur), iso(next)]);
    cur = next;
  }
  return out;
}

async function getJSON(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

/** Canonical slot grid: every 30-min slot start in [from, to). */
function slotGrid(from, to) {
  const grid = [];
  for (let t = new Date(from).getTime(); t < new Date(to).getTime(); t += SLOT_MIN * 6e4) grid.push(iso(new Date(t)));
  return grid;
}

/**
 * Align a {from -> value} map onto the grid, carrying the previous value forward
 * across gaps (and back-filling a leading gap from the first known value).
 * Returns the aligned series plus the number of slots that had to be filled.
 */
function align(grid, byFrom) {
  const values = new Array(grid.length).fill(null);
  let gaps = 0;
  for (let i = 0; i < grid.length; i++) {
    const v = byFrom.get(grid[i]);
    if (Number.isFinite(v)) values[i] = v;
    else { gaps++; values[i] = i > 0 ? values[i - 1] : null; }
  }
  if (values[0] === null) { // leading gap: back-fill from the first known value
    const first = values.find((v) => v !== null);
    if (first === undefined) throw new Error("series has no values at all — refusing to write an empty trace");
    for (let i = 0; values[i] === null; i++) values[i] = first;
  }
  return { values, gaps };
}

async function fetchNational(win) {
  const urls = chunks(win.from, win.to).map(([a, b]) => `${API}/intensity/${a}/${b}`);
  const actual = new Map(), forecast = new Map();
  for (const u of urls) for (const s of (await getJSON(u)).data) {
    if (Number.isFinite(s.intensity?.actual)) actual.set(s.from, s.intensity.actual);
    if (Number.isFinite(s.intensity?.forecast)) forecast.set(s.from, s.intensity.forecast);
  }
  return { urls, actual, forecast };
}

async function fetchRegion(win, regionid) {
  const urls = chunks(win.from, win.to).map(([a, b]) => `${API}/regional/intensity/${a}/${b}/regionid/${regionid}`);
  const fc = new Map();
  for (const u of urls) for (const s of (await getJSON(u)).data.data) {
    if (Number.isFinite(s.intensity?.forecast)) fc.set(s.from, s.intensity.forecast);
  }
  return { urls, forecast: fc };
}

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  const fetchedAt = new Date().toISOString();
  for (const win of WINDOWS) {
    const grid = slotGrid(win.from, win.to);
    const nat = await fetchNational(win);
    const na = align(grid, nat.actual), nf = align(grid, nat.forecast);
    const peers = [];
    for (const p of PEERS) {
      const r = await fetchRegion(win, p.regionid);
      const a = align(grid, r.forecast);
      peers.push({ ...p, series: "forecast", note: "regional endpoint is forecast-only", sourceUrls: r.urls, gapsCarriedForward: a.gaps, values: a.values });
      console.log(`  peer ${p.name} (region ${p.regionid}): ${a.values.length} slots, ${a.gaps} gaps`);
    }
    const doc = {
      window: win.id, label: win.label, from: win.from, to: win.to,
      slotMinutes: SLOT_MIN, slots: grid.length, fetchedAt,
      provider: "UK National Grid ESO Carbon Intensity API",
      units: "gCO2e/kWh",
      slotStarts: grid,
      national: {
        // The national FORECAST is cached for completeness and provenance only; no
        // experiment reads it (the peer signal is what an agent can actually see).
        role: "ground truth for emissions accounting",
        sourceUrls: nat.urls,
        actual: { series: "actual", gapsCarriedForward: na.gaps, values: na.values },
        forecast: { series: "forecast", gapsCarriedForward: nf.gaps, values: nf.values },
      },
      peers,
    };
    writeFileSync(new URL(`${win.id}.json`, OUT_DIR), JSON.stringify(doc, null, 2) + "\n");
    console.log(`${win.id} (${win.label}): ${grid.length} slots, national actual gaps=${na.gaps}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
