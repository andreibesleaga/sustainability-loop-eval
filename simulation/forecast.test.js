// SPDX-License-Identifier: GPL-3.0-only
/**
 * simulation/forecast.test.js — conformance suite for the forecast port
 * (docs/ports/FORECAST.md): the reference adapter must serve the committed capture
 * verbatim, refuse with null outside it, and carry its provenance. Offline only.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { forecastPort, latestCaptureFile } from "./forecast.js";

const file = latestCaptureFile();
const raw = JSON.parse(readFileSync(new URL(`../data/forecast/${file}`, import.meta.url), "utf8"));
const port = forecastPort(file);

test("forecast port: verbatim values inside the horizon, for national and every captured region", () => {
  assert.ok(port.horizonSlots > 0, "a capture without periods is not a forecast");
  for (let s = 0; s < port.horizonSlots; s++) {
    const want = raw.national.periods[s].forecast;
    assert.equal(port.national(s), Number.isFinite(want) ? want : null, `national slot ${s} must be the published value, verbatim`);
  }
  for (const region of raw.peerRegions) {
    for (let s = 0; s < region.periods.length; s++) {
      const want = region.periods[s].forecast;
      assert.equal(port.regional(region.regionid, s), Number.isFinite(want) ? want : null,
        `${region.name} slot ${s} must be the published value, verbatim`);
    }
  }
});

test("forecast port: refusals are nulls — outside the horizon, unknown regions, junk slots", () => {
  assert.equal(port.national(port.horizonSlots), null, "past the horizon is a refusal, never an invention");
  assert.equal(port.national(-1), null);
  assert.equal(port.national(1.5), null, "a non-integer slot is not a period");
  assert.equal(port.regional(99, 0), null, "an uncaptured region is a refusal");
});

test("forecast port: provenance is complete, and the periods are contiguous 30-minute settlement slots", () => {
  assert.ok(Date.parse(port.capturedAt) > 0, "capturedAt must be a real instant");
  assert.equal(port.source.urls.length, 1 + raw.peerRegions.length, "every series names its source URL");
  assert.match(port.source.provider, /NESO|National Energy System Operator/);
  for (let s = 1; s < raw.national.periods.length; s++) {
    assert.equal(raw.national.periods[s].from, raw.national.periods[s - 1].to,
      `national periods must be contiguous at slot ${s}`);
    assert.equal(Date.parse(raw.national.periods[s].to) - Date.parse(raw.national.periods[s].from), 30 * 60 * 1000,
      `slot ${s} must be exactly 30 minutes`);
  }
  // The honest observation the contract requires the adapter to surface: the
  // AVAILABLE horizon is whatever the provider published at capture time — the
  // capture in the repository holds fewer than the nominal 96 fw48h periods.
  assert.ok(port.horizonSlots <= 96, "fw48h can never exceed 96 half-hour periods");
});
