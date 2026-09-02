// SPDX-License-Identifier: GPL-3.0-only
/**
 * simulation/forecast.js — the reference FORECAST-PORT adapter (WP-3), offline.
 *
 * Loads a committed capture from data/forecast/ (taken manually by
 * fetch-forecast.js) and exposes exactly the interface docs/ports/FORECAST.md
 * contracts: verbatim published values, nulls for anything outside the capture,
 * full provenance, and never a substituted actual. One deliberate observation is
 * surfaced rather than hidden: the API's *available* forward horizon varies with
 * the time of day the capture was taken (a fw48h call does not always return 96
 * periods), so `horizonSlots` reports what the capture actually holds.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.resolve(__dirname, "..", "data", "forecast");

/** Latest committed capture file name (deterministic: lexicographic ISO order). */
export function latestCaptureFile() {
  const names = readdirSync(DIR).filter((n) => /^capture-.*\.json$/.test(n) && !n.includes(".graded"));
  if (!names.length) throw new Error("no committed forecast capture in data/forecast/");
  return names.sort().at(-1);
}

/** Load a capture into the forecast-port interface. */
export function forecastPort(file = latestCaptureFile()) {
  const doc = JSON.parse(readFileSync(path.join(DIR, file), "utf8"));
  const series = (periods) => periods.map((p) => (Number.isFinite(p.forecast) ? p.forecast : null));
  const national = series(doc.national.periods);
  const regional = new Map(doc.peerRegions.map((r) => [r.regionid, series(r.periods)]));
  const inRange = (arr, slot) => Number.isInteger(slot) && slot >= 0 && slot < arr.length;
  return {
    capturedAt: doc.capturedAt,
    horizonSlots: national.length,
    source: {
      provider: doc.provider,
      urls: [doc.national.sourceUrl, ...doc.peerRegions.map((r) => r.sourceUrl)],
    },
    firstPeriodFrom: doc.national.periods[0]?.from ?? null,
    national: (slot) => (inRange(national, slot) ? national[slot] : null),
    regional: (id, slot) => {
      const arr = regional.get(id);
      return arr && inRange(arr, slot) ? arr[slot] : null;
    },
  };
}
