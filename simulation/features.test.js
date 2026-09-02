// SPDX-License-Identifier: GPL-3.0-only
/**
 * simulation/features.test.js — the runner for features/*.feature (WP-6): one plain
 * Gherkin file per port, executed against the REAL adapters.
 *
 * There is no BDD framework here and no parallel implementation. The parser below is a
 * line-based reader of Feature/Scenario/Given/When/Then/And/But; the step table maps each
 * sentence a feature file uses onto the same exported functions the fitness functions and
 * the simulations already drive — the shipped kaiban-distributed ActionGate through
 * gated(), the governor core, the actuation harness, runP2, the E3 fleet's governed()
 * arm, forecastPort(), and plane.js's mandatoryMembers()/memberCoverage(). Nothing under
 * test is stubbed. The only inputs that are stipulated are
 * the ones the experiments themselves stipulate: the synthetic workload, the synthetic
 * fleet, and the approver's decision (which is an INPUT to the human port, not the port).
 *
 * A step with no entry in the table fails the run loudly — there is no "pending".
 *
 * Offline and deterministic: committed traces, the committed forecast capture and the
 * committed gateway documents; fixed seeds; a fixed reference date; no wall clock, no
 * network. Six test( blocks, one per feature file.
 *
 * F7 (port isolation) constrains what this file may import: an adapter test sees only its
 * own folder, governor/ and shared/. That is why the publication scenarios are driven by
 * simulation/plane.js's own derived member set rather than by dataplane/doc-check.js, and
 * why the metering scenarios state the one-action bound as the concrete case that
 * fitness/f13.test.js states over 1,500 random sequences.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createCarbonGovernor, severityOf, LADDER } from "../governor/carbon-governor.js";
import { makeGate, gated } from "../governor/gate.js";
import { execute } from "../governor/harness.js";
import { median } from "../shared/stats.js";
import { loadWindow, generateWorkload, WORKLOAD } from "./lib.js";
import { runP0, runP2 } from "./run.js";
import { FLEET, schedule, naive, governed } from "./charging.js";
import { forecastPort, latestCaptureFile } from "./forecast.js";
import { mandatoryMembers, memberCoverage } from "./plane.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const FEATURES = path.join(ROOT, "features");
const DOCS = path.join(ROOT, "data", "dataplane", "docs");

// ── A minimal Gherkin reader ──────────────────────────────────────────────────
/**
 * Feature / Scenario / Given|When|Then|And|But, plus the free-text paragraph under the
 * Feature line. Anything else is a parse error: a typo must not silently disappear.
 */
function parseFeature(text, file) {
  const scenarios = [];
  let feature = null;
  let current = null;
  let inDescription = false;
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const at = `${file}:${i + 1}`;
    if (!line || line.startsWith("#")) continue;
    let m;
    if ((m = /^Feature:\s*(.+)$/.exec(line))) {
      if (feature !== null) throw new Error(`${at}: a second Feature: line`);
      feature = m[1];
      inDescription = true;
      continue;
    }
    if (feature === null) throw new Error(`${at}: content before the Feature: line`);
    if ((m = /^Scenario:\s*(.+)$/.exec(line))) {
      current = { name: m[1], steps: [] };
      scenarios.push(current);
      inDescription = false;
      continue;
    }
    if ((m = /^(Given|When|Then|And|But)\s+(.+)$/.exec(line))) {
      if (current === null) throw new Error(`${at}: a step outside any Scenario`);
      current.steps.push({ keyword: m[1], text: m[2].trim(), at });
      inDescription = false;
      continue;
    }
    if (inDescription) continue; // the prose paragraph under Feature:
    throw new Error(`${at}: not a Feature:, a Scenario: or a Given/When/Then/And/But step -> ${line}`);
  }
  if (feature === null) throw new Error(`${file}: no Feature: line`);
  if (!scenarios.length) throw new Error(`${file}: no scenarios`);
  for (const s of scenarios) if (!s.steps.length) throw new Error(`${file}: scenario "${s.name}" has no steps`);
  return { feature, scenarios };
}

// ── Shared, memoised fixtures (loaded at most once per process) ───────────────
const once = (fn) => { let v, done = false; return () => (done ? v : ((v = fn()), (done = true), v)); };
const onceAsync = (fn) => { let p; return () => (p ??= fn()); };

const winter = once(() => loadWindow("W1"));
const winterTasks = once(() => generateWorkload(101, winter().slots));
const winterPlan = once(() => schedule(winter(), 101));
const winterNaive = once(() => naive(winter(), winterPlan()));

/** E2's headline arm: f = 0.8 of P0's median daily emissions, the paper's budget. */
const p2Headline = onceAsync(async () => {
  const W = winter();
  const tasks = winterTasks();
  const p0 = runP0(tasks, W);
  return runP2(tasks, W, 0.8 * median(p0.dayG), WORKLOAD.degradedEnergyFraction);
});
/** A budget small enough that every arriving task is terminated. */
const p2AllTerminated = onceAsync(() => runP2(winterTasks(), winter(), 1e-9, WORKLOAD.degradedEnergyFraction));
/** E3 with the owner refusing every proposal the gate lets through. */
const chargingOwnerRefuses = onceAsync(() =>
  governed(winter(), winterPlan(), 101, 0.0, FLEET.budgetFactor * median(winterNaive().nightly)));
/** E3 with a budget small enough that the gate terminates every proposal. */
const chargingGateRefuses = onceAsync(() => governed(winter(), winterPlan(), 101, 1.0, 1e-9));

const capture = once(() => ({
  port: forecastPort(),
  raw: JSON.parse(readFileSync(path.join(ROOT, "data", "forecast", latestCaptureFile()), "utf8")),
}));

/** Every document the reference gateway actually served, as committed. */
const servedDocuments = once(() =>
  readdirSync(DOCS)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => ({ file: f, doc: JSON.parse(readFileSync(path.join(DOCS, f), "utf8")) })));

const fixedCheck = (action, idx) => ({
  name: `check-${idx}`,
  check: () => ({ action, reason: "fixed for this scenario", validator: `check-${idx}` }),
});
/** Build the scenario's gate on first use, after any extra checks have been declared. */
function gateOf(w) {
  w.gate ??= makeGate(createCarbonGovernor({ budgetG: w.budgetG }), { extraValidators: w.extraChecks ?? [] }).gate;
  return w.gate;
}
const firstIndexOf = (verdicts, rung) => verdicts.indexOf(rung);
const relDiff = (a, b) => Math.abs(a - b) / Math.max(Math.abs(a), 1);

// ── The step table: one regex per sentence the feature files use ──────────────
const STEPS = [
  // ── signal ──────────────────────────────────────────────────────────────────
  [/^the committed winter window of real grid-carbon readings$/, (w) => { w.W = winter(); }],
  [/^the readings used to decide are the peers' published forecast and the readings used to score are the national actual$/, (w) => {
    assert.equal(w.W.peerMean.length, w.W.slots, "the peer signal must cover every slot");
    assert.equal(w.W.actual.length, w.W.slots, "the national actual must cover every slot");
    assert.notDeepEqual(w.W.peerMean, w.W.actual, "deciding and scoring must not be the same series");
  }],
  [/^every reading in the window is a finite, non-negative number$/, (w) => {
    for (const series of [w.W.actual, w.W.peerMean, w.W.peerMax]) {
      for (const v of series) assert.ok(Number.isFinite(v) && v >= 0, `bad reading ${v}`);
    }
  }],
  [/^the window records which operator published it and where each series came from$/, (w) => {
    assert.match(w.W.provenance.provider, /NESO|National Energy System Operator/);
    assert.ok(w.W.provenance.nationalSourceUrls.length > 0, "the national series must name its source");
    for (const p of w.W.provenance.peers) assert.ok(p.sourceUrls.length > 0, `${p.name} must name its source`);
  }],
  [/^a carbon budget of (\d+) grams for the period$/, (w, g) => { w.budgetG = Number(g); w.extraChecks = []; }],
  [/^three further checks that answer "([a-z-]+)", "([a-z-]+)" and "([a-z-]+)"$/, (w, a, b, c) => {
    w.extraChecks = [a, b, c].map(fixedCheck);
  }],
  [/^a further check that fails with an error$/, (w) => {
    w.extraChecks = [{ name: "broken-adapter", check() { throw new Error("the signal adapter blew up"); } }];
  }],
  [/^two further checks, the first answering something that is not a rung at all and the second answering "([a-z-]+)"$/, (w, a) => {
    // Order matters, and that is the point: the shipped gate ranks with
    // GATE_ACTION_SEVERITY, which has no entry for an off-ladder action, so its
    // comparator yields NaN and the ordering collapses to insertion order — the
    // off-ladder verdict then MASKS the terminate behind it. gated() re-aggregates.
    w.offLadder = "not-a-rung";
    w.extraChecks = [fixedCheck(w.offLadder, 0), fixedCheck(a, 1)];
  }],
  [/^an agent proposes an action estimated at (\d+) grams$/, async (w, g) => { w.decision = await gated(gateOf(w), Number(g)); }],
  [/^the gate answers "([a-z-]+)"$/, (w, action) => { assert.equal(w.decision.action, action); }],
  [/^the verdict that decided it is the first one listed$/, (w) => {
    assert.equal(w.decision.verdicts[0].action, w.decision.action);
  }],
  [/^the agent's estimate is missing, not a number, or negative$/, async (w) => {
    w.decisions = [];
    for (const bad of [undefined, NaN, -1, "not-a-number"]) {
      w.decisions.push({ bad, decision: await gated(makeGate(createCarbonGovernor({ budgetG: w.budgetG })).gate, bad) });
    }
  }],
  [/^every one of those proposals is refused with "([a-z-]+)"$/, (w, action) => {
    for (const d of w.decisions) assert.equal(d.decision.action, action, `estimate ${String(d.bad)} must be refused`);
  }],
  [/^the shipped gate on its own would have answered "([a-z-]+)"$/, (w, action) => {
    assert.equal(w.decision.rawAction, action, "the shipped gate's own answer is kept as rawAction");
  }],
  [/^the recorded answer is "([a-z-]+)"$/, (w, action) => { assert.equal(w.decision.action, action); }],
  [/^the reason says the off-ladder verdict was treated as a block, fail closed$/, (w) => {
    assert.equal(w.decision.normalisedReason, `non-ladder verdict '${w.offLadder}' treated as block (fail closed)`);
  }],

  // ── forecast ────────────────────────────────────────────────────────────────
  [/^the committed forecast capture taken from the national grid operator$/, (w) => {
    const c = capture();
    w.port = c.port;
    w.raw = c.raw;
    w.refusals = [];
  }],
  [/^every period inside the published horizon is served exactly as published, for the country and for every captured region$/, (w) => {
    assert.ok(w.port.horizonSlots > 0, "a capture with no periods is not a forecast");
    for (let s = 0; s < w.port.horizonSlots; s++) {
      const want = w.raw.national.periods[s].forecast;
      assert.equal(w.port.national(s), Number.isFinite(want) ? want : null, `national period ${s}`);
    }
    for (const region of w.raw.peerRegions) {
      for (let s = 0; s < region.periods.length; s++) {
        const want = region.periods[s].forecast;
        assert.equal(w.port.regional(region.regionid, s), Number.isFinite(want) ? want : null, `${region.name} period ${s}`);
      }
    }
  }],
  [/^a system asks for a period beyond the published horizon$/, (w) => {
    w.refusals.push(["beyond the horizon", w.port.national(w.port.horizonSlots)]);
  }],
  [/^a system asks for a region that was never captured$/, (w) => {
    const captured = new Set(w.raw.peerRegions.map((r) => r.regionid));
    let unknown = 0;
    while (captured.has(unknown)) unknown++;
    w.refusals.push([`region ${unknown}`, w.port.regional(unknown, 0)]);
  }],
  [/^a system asks for something that is not a settlement period at all$/, (w) => {
    w.refusals.push(["period -1", w.port.national(-1)], ["period 1.5", w.port.national(1.5)]);
  }],
  [/^each of those answers is "no data", never a substituted or invented number$/, (w) => {
    assert.ok(w.refusals.length >= 4, "the scenario must actually have asked");
    for (const [what, answer] of w.refusals) assert.equal(answer, null, `${what} must be a refusal`);
  }],
  [/^the capture names the operator, the moment it was taken, and a source URL for every series it holds$/, (w) => {
    assert.match(w.port.source.provider, /NESO|National Energy System Operator/);
    assert.ok(Date.parse(w.port.capturedAt) > 0, "capturedAt must be a real instant");
    assert.equal(w.port.source.urls.length, 1 + w.raw.peerRegions.length, "one source URL per series");
  }],
  [/^the horizon reported is the number of periods the capture really holds$/, (w) => {
    assert.equal(w.port.horizonSlots, w.raw.national.periods.length);
  }],
  [/^that is fewer than the 96 half-hour periods a 48-hour request could nominally return$/, (w) => {
    assert.ok(w.port.horizonSlots < 96, `horizon ${w.port.horizonSlots} should be short of the nominal 96`);
  }],

  // ── human ───────────────────────────────────────────────────────────────────
  [/^a gate decision of "([a-z-]+)"$/, (w, action) => {
    assert.ok(LADDER.includes(action), `${action} is not a rung`);
    w.decision = { action };
    w.ranCount = 0;
    w.task = () => { w.ranCount++; return "the action ran"; };
  }],
  [/^no human is asked$/, (w) => { w.result = execute(w.decision, w.task); }],
  [/^a named approver approves it$/, (w) => { w.result = execute(w.decision, w.task, { approved: true, by: "approval-board" }); }],
  [/^an approval arrives whose approved field is the text "true" rather than the value true$/, (w) => {
    w.result = execute(w.decision, w.task, { approved: "true", by: "approval-board" });
  }],
  [/^the action runs$/, (w) => {
    assert.equal(w.result.executed, true, `expected ${w.decision.action} to run: ${w.result.reason ?? ""}`);
    assert.equal(w.result.result, "the action ran", "the harness must return what the action returned");
  }],
  [/^the action does not run, because it requires human approval$/, (w) => {
    assert.equal(w.result.executed, false);
    assert.equal(w.result.reason, `requires human approval for action: ${w.decision.action}`);
    assert.equal(w.ranCount, 0, "the action must never have been called");
  }],
  [/^the action does not run, because terminate is not overridable$/, (w) => {
    assert.equal(w.result.executed, false);
    assert.equal(w.result.reason, "terminate is not overridable");
    assert.equal(w.ranCount, 0, "the action must never have been called");
  }],
  [/^the committed winter window and the seed-101 synthetic workload$/, (w) => { w.W = winter(); w.tasks = winterTasks(); }],
  [/^the governed policy runs at the headline daily budget$/, async (w) => { w.m = await p2Headline(); }],
  [/^the number of human decisions equals the escalate verdicts plus the block verdicts$/, (w) => {
    assert.ok(w.m.escalations + w.m.blocks > 0, "the arm must actually reach the human rungs");
    assert.equal(w.m.humanDecisions, w.m.escalations + w.m.blocks);
  }],
  [/^every terminated task was dropped without anyone being asked$/, (w) => {
    assert.ok(w.m.terminations > 0, "the arm must actually reach terminate");
    assert.equal(w.m.dropped, w.m.terminations, "the only refusals are the terminated tasks");
  }],

  // ── actuation ───────────────────────────────────────────────────────────────
  [/^the committed winter window and the deterministic plug-in schedule for seed 101$/, (w) => {
    w.W = winter();
    w.plan = winterPlan();
    w.naive = winterNaive();
  }],
  [/^the governed fleet runs with the owner refusing every proposal$/, async (w) => { w.m = await chargingOwnerRefuses(); }],
  [/^the daily carbon budget is so small that the gate terminates every proposal$/, async (w) => { w.m = await chargingGateRefuses(); }],
  [/^no charging session is moved$/, (w) => {
    assert.equal(w.m.shifted, 0);
    assert.equal(w.m.shiftHours.length, 0);
  }],
  [/^every charging session still receives its full charge$/, (w) => {
    const expected = w.plan.length * FLEET.vehicles;
    assert.equal(w.m.sessions, expected, "every plugged-in car is a completed session");
    assert.equal(w.naive.sessions, expected, "the baseline charges exactly the same sessions");
  }],
  [/^the fleet's emissions are exactly the ungoverned baseline's$/, (w) => {
    assert.ok(relDiff(w.m.totalG, w.naive.totalG) < 1e-12,
      `governed ${w.m.totalG} vs naive ${w.naive.totalG} — a refusal must fall back to the naive charge`);
  }],
  [/^the gate refuses every session and no approval is ever requested$/, (w) => {
    assert.equal(w.m.gateRefused, w.m.sessions);
    assert.equal(w.m.approvalsRequested, 0);
    assert.equal(w.m.actions.terminate, w.m.sessions);
  }],
  [/^the governed policy runs with a budget so small that every task is terminated$/, async (w) => { w.m = await p2AllTerminated(); }],
  [/^no task runs and every task is dropped$/, (w) => {
    assert.equal(w.m.completed, 0);
    assert.equal(w.m.dropped, w.tasks.length);
    assert.equal(w.m.terminations, w.tasks.length);
  }],
  [/^no task is lost: completed plus dropped equals the number of tasks$/, (w) => {
    assert.equal(w.m.completed + w.m.dropped, w.tasks.length);
  }],
  [/^the audit chain is valid and holds exactly one gate decision per task$/, (w) => {
    assert.equal(w.m.auditValid, true);
    assert.equal(w.m.auditRecords, w.tasks.length, "a deferred action is a paused decision, not a new one");
  }],

  // ── metering ────────────────────────────────────────────────────────────────
  [/^an honest agent that declares the (\d+) grams each of its actions really emits$/, (w, g) => {
    w.trueG = Number(g);
    w.honest = createCarbonGovernor({ budgetG: w.budgetG });
  }],
  [/^a dishonest agent that declares nothing while emitting the same (\d+) grams$/, (w, g) => {
    assert.equal(Number(g), w.trueG, "both agents must emit the same grams");
    w.liar = createCarbonGovernor({ budgetG: w.budgetG });
  }],
  [/^a metering port that charges both agents the grams actually emitted$/, (w) => { w.metered = true; }],
  [/^each agent proposes six actions in turn$/, (w) => {
    w.honestVerdicts = [];
    w.liarVerdicts = [];
    for (let k = 0; k < 6; k++) {
      w.honestVerdicts.push(w.honest.decide(w.trueG).action);
      w.liarVerdicts.push(w.liar.decide(0).action);
      w.honest.commit(w.trueG);
      w.liar.commit(w.metered ? w.trueG : 0);
    }
  }],
  [/^the honest agent's verdicts are (.+)$/, (w, list) => {
    assert.deepEqual(w.honestVerdicts, list.split(",").map((s) => s.trim()));
  }],
  [/^the dishonest agent reaches every rung exactly one action later$/, (w) => {
    const rungs = [...new Set(w.honestVerdicts)].filter((a) => a !== "allow");
    assert.ok(rungs.length >= 2, "the honest sequence must actually climb the ladder");
    for (const rung of rungs) {
      const honestAt = firstIndexOf(w.honestVerdicts, rung);
      const liarAt = firstIndexOf(w.liarVerdicts, rung);
      assert.equal(liarAt, honestAt + 1, `"${rung}" must be reached exactly one action late, not ${liarAt - honestAt}`);
    }
  }],
  [/^the dishonest agent is never treated more strictly than the honest one$/, (w) => {
    for (let k = 0; k < w.honestVerdicts.length; k++) {
      assert.ok(severityOf(w.liarVerdicts[k]) <= severityOf(w.honestVerdicts[k]), `action ${k}`);
    }
  }],
  [/^an agent that declares nothing and is charged only what it declares$/, (w) => {
    w.gov = createCarbonGovernor({ budgetG: w.budgetG });
  }],
  [/^it takes ten actions that each really emit (\d+) grams$/, (w, g) => {
    w.trueSpentG = 0;
    w.verdicts = [];
    for (let k = 0; k < 10; k++) {
      w.verdicts.push(w.gov.decide(0).action);
      w.gov.commit(0); // unmetered: the budget is charged the declared zero
      w.trueSpentG += Number(g);
    }
  }],
  [/^every verdict is "([a-z-]+)"$/, (w, action) => {
    for (const v of w.verdicts) assert.equal(v, action);
  }],
  [/^its true emissions have run past the terminate rung unnoticed$/, (w) => {
    assert.ok(w.trueSpentG > 1.25 * w.budgetG, `true emissions ${w.trueSpentG} must exceed the terminate rung`);
    assert.equal(w.gov.spentG, 0, "the unmetered budget never moved");
  }],
  [/^the metering port reports a reading that is not a finite, non-negative number$/, (w) => {
    w.gov = createCarbonGovernor({ budgetG: w.budgetG });
    w.refused = [];
    for (const bad of [NaN, -5, Infinity, undefined, "300"]) {
      assert.throws(() => w.gov.commit(bad), /finite, non-negative/, `commit(${String(bad)}) must be refused`);
      w.refused.push(bad);
    }
  }],
  [/^the governor refuses the reading and the budget does not move$/, (w) => {
    assert.equal(w.refused.length, 5);
    assert.equal(w.gov.spentG, 0, "a bad reading must never be absorbed as a silent zero");
  }],

  // ── publication ─────────────────────────────────────────────────────────────
  [/^the sustainability documents the reference gateway actually served$/, (w) => {
    w.docs = servedDocuments();
    assert.ok(w.docs.length > 0, "there must be committed gateway documents to read");
  }],
  [/^a fixed reference date of (\d{4}-\d{2}-\d{2})$/, (w, d) => { w.refDate = new Date(`${d}T00:00:00Z`); }],
  [/^the member set the loop requires at publication is derived from those documents themselves, not hard-coded$/, (w) => {
    // Recompute the intersection independently: the loop's set must BE the documents'.
    let common = null;
    for (const { doc } of w.docs) {
      const keys = new Set(Object.keys(doc.body ?? doc));
      common = common === null ? keys : new Set([...common].filter((k) => keys.has(k)));
    }
    w.members = mandatoryMembers();
    assert.deepEqual(w.members, [...common].sort(), "plane.js derives its set from the served documents");
  }],
  [/^it contains the members that say who published, when, for what period, and how it was measured$/, (w) => {
    // The Internet-Draft's eight mandatory members, named in the order the sentence reads.
    w.identityMembers = ["provider", "target", "version", "updated", "capabilities",
      "reporting-period", "measurement-method", "methodology-uri"];
    for (const m of w.identityMembers) assert.ok(w.members.includes(m), `derived set is missing ${m}`);
  }],
  [/^every served document is more than a day old, far older than the loop's 30-minute cadence$/, (w) => {
    w.ages = w.docs.map(({ file, doc }) => {
      const body = doc.body ?? doc;
      const published = new Date(body.updated);
      return { file, body, published, ageDays: (w.refDate.getTime() - published.getTime()) / 86400000 };
    });
    for (const { file, ageDays } of w.ages) {
      assert.ok(ageDays > 1, `${file} is ${ageDays} days old — the staleness case needs a stale document`);
    }
  }],
  [/^the oldest of them is more than half a year old, and is still served exactly as published$/, (w) => {
    const oldest = w.ages.reduce((a, b) => (b.ageDays > a.ageDays ? b : a));
    assert.ok(oldest.ageDays > 180, `the oldest served document is only ${oldest.ageDays} days old`);
    assert.deepEqual(oldest.body, JSON.parse(readFileSync(path.join(DOCS, oldest.file), "utf8")),
      "a served document is returned as its publisher left it");
  }],
  [/^each carries its publisher's own updated timestamp, a real instant, neither invented nor refreshed$/, (w) => {
    for (const { file, body, published } of w.ages) {
      assert.equal(typeof body.updated, "string", `${file}: updated must be the publisher's own value`);
      assert.ok(!Number.isNaN(published.getTime()), `${file}: updated must be a real instant`);
      assert.ok(published.getTime() < w.refDate.getTime(), `${file}: nothing is published in the future`);
    }
  }],
  [/^every one of them still carries every member the loop requires at publication$/, (w) => {
    const coverage = memberCoverage(mandatoryMembers());
    for (const [member, c] of Object.entries(coverage)) {
      assert.equal(c.documentsTotal, w.docs.length);
      assert.equal(c.documentsCarrying, c.documentsTotal, `${member} is missing from a served document`);
    }
  }],
  [/^fewer than half of them carry a carbon-intensity member$/, (w) => {
    w.coverage = memberCoverage();
    const c = w.coverage["carbon-intensity-gCO2e-per-kWh"];
    assert.equal(c.documentsTotal, w.docs.length);
    assert.ok(c.coveragePct < 50, `carbon-intensity coverage is ${c.coveragePct}%`);
  }],
  [/^more of them carry their energy consumption than carry their intensity$/, (w) => {
    assert.ok(w.coverage["energy-consumption"].documentsCarrying > w.coverage["carbon-intensity-gCO2e-per-kWh"].documentsCarrying,
      "load is the member a congestion signal actually needs, and more publishers carry it");
  }],
];

// ── Execution ─────────────────────────────────────────────────────────────────
/** Run one feature file: every scenario, every step, in order. Fail loudly on anything. */
async function runFeature(file) {
  const parsed = parseFeature(readFileSync(path.join(FEATURES, file), "utf8"), file);
  let stepsRun = 0;
  for (const scenario of parsed.scenarios) {
    const world = {}; // one fresh world per scenario
    for (const step of scenario.steps) {
      const hit = STEPS.find(([re]) => re.test(step.text));
      // No silent "pending": a sentence with no step behind it is a failure.
      assert.ok(hit, `${step.at}: no step maps "${step.keyword} ${step.text}" onto any real function`);
      const m = hit[0].exec(step.text);
      try {
        await hit[1](world, ...m.slice(1));
      } catch (e) {
        e.message = `${step.at}\n  Scenario: ${scenario.name}\n  ${step.keyword} ${step.text}\n  ${e.message}`;
        throw e;
      }
      stepsRun++;
    }
  }
  assert.ok(stepsRun > 0, `${file}: nothing ran`);
  return { scenarios: parsed.scenarios.length, stepsRun };
}

test("features/signal.feature — readings in, a verdict out, and a missing reading never a green light", async () => {
  const { scenarios } = await runFeature("signal.feature");
  assert.equal(scenarios, 6);
});

test("features/forecast.feature — the published forecast served verbatim, and refused outside the capture", async () => {
  const { scenarios } = await runFeature("forecast.feature");
  assert.equal(scenarios, 4);
});

test("features/human.feature — escalate and block bound to a person, terminate bound to nobody", async () => {
  const { scenarios } = await runFeature("human.feature");
  assert.equal(scenarios, 5);
});

test("features/actuation.feature — a refusal withholds the optimisation, never the power", async () => {
  const { scenarios } = await runFeature("actuation.feature");
  assert.equal(scenarios, 4);
});

test("features/metering.feature — what a trusted meter buys, and what its absence costs", async () => {
  const { scenarios } = await runFeature("metering.feature");
  assert.equal(scenarios, 3);
});

test("features/publication.feature — old documents are still served, and never rewritten to look fresh", async () => {
  const { scenarios } = await runFeature("publication.feature");
  assert.equal(scenarios, 3);
});
