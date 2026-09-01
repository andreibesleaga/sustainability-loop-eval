// SPDX-License-Identifier: GPL-3.0-only
/**
 * simulation/routing.test.js — invariants of E6 (routed charging), against the
 * committed results/routing.json. Each test covers both windows. The orderings are
 * what make the arms comparable; the last test pins the honesty markers that keep
 * the forecast-scored numbers from being read as ground truth.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const doc = JSON.parse(readFileSync(new URL("../results/routing.json", import.meta.url), "utf8"));
const WINDOWS = ["W1", "W2"];
const MOVES = doc.moveKWhSweep;

test("routing: adding choices never hurts — routed(m=0) >= best-home >= naive, forecast-scored", () => {
  for (const id of WINDOWS) {
    const b = doc.results[id];
    assert.ok(b.arms.best_window_home.gPerSessionForecast <= b.arms.naive_home.gPerSessionForecast,
      `${id}: the best home window cannot be dirtier than plug-in`);
    assert.ok(b.routed.moveKWh0.gPerSessionForecast <= b.arms.best_window_home.gPerSessionForecast,
      `${id}: free routing includes staying home, so it cannot be dirtier than best-home`);
  }
});

test("routing: the drive costs — grams monotone non-decreasing in moveKWh, and shares/percentages account", () => {
  for (const id of WINDOWS) {
    const b = doc.results[id];
    let prev = -Infinity;
    for (const m of MOVES) {
      const arm = b.routed[`moveKWh${m}`];
      assert.ok(arm.gPerSessionForecast >= prev, `${id} m=${m}: a dearer detour cannot lower emissions`);
      prev = arm.gPerSessionForecast;
      const shares = Object.values(arm.chosenRegionSharePct);
      assert.ok(Math.abs(shares.reduce((x, y) => x + y, 0) - 100) < 0.1, `${id} m=${m}: region shares must sum to 100%`);
      assert.ok(arm.pctAvoidedVsNaiveForecast <= 100 + 1e-9, `${id} m=${m}: nothing avoids more than everything`);
      const homeShare = arm.chosenRegionSharePct[doc.homeRegion];
      assert.ok(Math.abs(arm.sessionsRoutedAwayPct - (100 - homeShare)) < 0.1,
        `${id} m=${m}: routed-away must equal 100% minus the home share`);
    }
  }
});

test("routing: E6b migration — a dearer move can only mean fewer or equal grams avoided", () => {
  for (const id of ["W1", "W2"]) {
    const m = doc.results[id].migration;
    let prevG = -Infinity;
    let prevPct = Infinity;
    const days = Object.values(m.arms)[0] ? Object.values(Object.values(m.arms)[0].daysInRegion).reduce((x, y) => x + y, 0) : 0;
    for (const sw of m.switchKWhSweep) {
      const arm = m.arms[`switchKWh${sw}`];
      assert.ok(arm.totalGPerDay >= prevG, `${id} sw=${sw}: grams/day monotone in switch cost`);
      assert.ok(arm.pctAvoidedVsFixedHome <= prevPct + 1e-9, `${id} sw=${sw}: avoided % cannot rise with a dearer move`);
      prevG = arm.totalGPerDay; prevPct = arm.pctAvoidedVsFixedHome;
      assert.ok(arm.moves <= days, `${id} sw=${sw}: cannot move more often than days pass`);
      assert.equal(Object.values(arm.daysInRegion).reduce((x, y) => x + y, 0), days,
        `${id} sw=${sw}: every day is spent in exactly one region`);
      assert.ok(arm.totalGPerDay <= m.fixedHomeGPerDay + 1e-9,
        `${id} sw=${sw}: staying home is always available, so migration cannot be dirtier than fixed-home`);
    }
  }
});

test("routing: the honesty markers are present — forecast-only scoring is declared, both scorings exist where checkable", () => {
  assert.match(doc.note, /forecast-scored/i);
  assert.match(doc.note, /R2/);
  for (const id of WINDOWS) {
    const b = doc.results[id];
    assert.match(b.scoring, /no regional actual/i);
    // The stay-home arms carry BOTH scorings so the reader can gauge the forecast gap
    // in the one place it can be gauged.
    assert.ok(Number.isFinite(b.arms.naive_home.gPerSessionActual));
    assert.ok(Number.isFinite(b.arms.best_window_home.gPerSessionActual));
  }
  const md = readFileSync(new URL("../results/routing.md", import.meta.url), "utf8");
  assert.match(md, /Goodhart/i, "the spatial-Goodhart warning must survive regeneration");
  assert.match(md, /attracts ALL the load/i);
});
