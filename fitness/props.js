// SPDX-License-Identifier: GPL-3.0-only
/**
 * The thirteen fitness-function properties (F1–F13), each as one exported function
 * returning a summary { id, property, cases, passed, notes }. Called from both
 * the node:test files (fitness/fN.test.js, which assert on `passed`) and from
 * report.js (which collects the summaries and renders results/fitness.md) so the
 * property logic lives in exactly one place.
 *
 * F1/F2/F5/F6/F8/F9 test properties of the SHIPPED gate (kaiban-distributed@2.0.0).
 * F3/F4/F10/F11 test this package's own contribution: the Carbon-Verdict Governor
 * core, the actuation harness and the audit anchor. F7/F12 are static checks of the
 * repository itself (import graph; documentation against results/).
 */
import path from "node:path";
import { GATE_ACTION_SEVERITY } from "kaiban-distributed";
import { createCarbonGovernor, mostSevere, severityOf, LADDER, DEFAULT_RUNGS } from "../governor/carbon-governor.js";
import { makeGate, gated, chainAnchor, verifyAnchored } from "../governor/gate.js";
import { execute } from "../governor/harness.js";
import { mulberry32, pick, randInt, randFloat } from "../shared/prng.js";
import { ROOT, CORE, SHARED, ADAPTERS, importsOf, jsFilesIn, targetOf, importsModule } from "./import-graph.js";
import { checkNumbers } from "../tools/check-numbers.js";


// ── F1 — Total order / most-severe-wins ─────────────────────────────────────
// Why it matters: the ladder is only a safety contract if the gate always
// resolves conflicting validator opinions to the single MOST SEVERE verdict
// and surfaces it first. If aggregation ever picked less than the max, a
// lenient validator could silently mask one that wants to block/terminate.
export async function f1TotalOrder(cases = 2000) {
  const rng = mulberry32(1);
  let passed = 0;
  const failures = [];
  for (let i = 0; i < cases; i++) {
    const budgetG = randFloat(rng, 10, 5000);
    const governor = createCarbonGovernor({ budgetG });
    // Vary the CARBON estimate too, so the deciding verdict is not always the same
    // rung: the aggregation has to be right for every combination, not just for
    // "allow plus extras".
    const estimateG = randFloat(rng, 0, budgetG * 1.6);
    const carbonAction = governor.decide(estimateG).action; // decide() does not commit
    const n = randInt(rng, 0, 5);
    const extraActions = Array.from({ length: n }, () => pick(rng, LADDER));
    const extraValidators = extraActions.map((action, idx) => ({
      name: `extra-${idx}`,
      check: () => ({ action, reason: "fixed", validator: `extra-${idx}` }),
    }));
    const { gate } = makeGate(governor, { extraValidators });
    const decision = await gated(gate, estimateG);
    const expected = mostSevere([carbonAction, ...extraActions]);
    const maxSeverity = Math.max(...decision.verdicts.map((v) => GATE_ACTION_SEVERITY[v.action]));
    const ok =
      decision.action === expected &&
      GATE_ACTION_SEVERITY[decision.action] === maxSeverity &&
      decision.verdicts[0].action === decision.action;
    if (ok) passed++;
    else failures.push({ i, expected, got: decision.action, first: decision.verdicts[0]?.action });
  }
  return {
    id: "F1",
    property: "Total order / most-severe-wins: gate decision == max GATE_ACTION_SEVERITY, deciding verdict first",
    cases,
    passed: passed === cases,
    notes:
      passed === cases
        ? `all ${cases} random verdict multisets (carbon rung varied across the whole ladder) resolved to the reference mostSevere() with it listed first`
        : `${cases - passed}/${cases} mismatches, e.g. ${JSON.stringify(failures[0])}`,
  };
}

// ── F2 — Fail-closed ─────────────────────────────────────────────────────────
// Why it matters: a governance gate that can be knocked into "allow" by an
// internal error is worse than no gate. (a)/(b) prove a throwing validator or
// a malformed carbon estimate can never leak through as anything but block.
// (c) documents the one intentional bypass: enabled:false is a deployment-time
// opt-out, not a per-request one — enforcement is all-or-nothing per deployment.
// (d) is the ROGUE-VALIDATOR case, and it is the one that found a real upstream gap:
// the shipped gate ranks verdicts with GATE_ACTION_SEVERITY, which is `undefined` for
// an action that is not on the ladder, so its sort comparator returns NaN and the
// ordering collapses to insertion order. Measured on kaiban-distributed@2.0.0, the
// shipped gate answers **allow** for the verdict set [allow, "not-a-rung", terminate].
// governor/gate.js's gated() re-aggregates fail-closed when any verdict is off the
// ladder, which is what this sub-case checks; the raw shipped answer is kept as
// `rawAction` so the gap stays visible rather than being papered over.
export async function f2FailClosed({ throwCases = 25, invalidCases = 25, disabledCases = 25, rogueCases = 25 } = {}) {
  const rng = mulberry32(2);
  let passed = 0;
  const failures = [];
  const cases = throwCases + invalidCases + disabledCases + rogueCases;
  let rogueMaskedByShippedGate = 0;

  for (let i = 0; i < throwCases; i++) {
    const governor = createCarbonGovernor({ budgetG: 1000 });
    const thrower = { name: "thrower", check() { throw new Error(`boom-${i}`); } };
    const { gate } = makeGate(governor, { extraValidators: [thrower] });
    let decision, threw = false;
    try { decision = await gated(gate, 0); } catch { threw = true; }
    const ok = !threw && decision.action === "block";
    if (ok) passed++; else failures.push({ case: "throw", i });
  }

  const invalidEstimates = [NaN, -1, undefined, "not-a-number"];
  for (let i = 0; i < invalidCases; i++) {
    const governor = createCarbonGovernor({ budgetG: 1000 });
    const estimate = pick(rng, invalidEstimates);
    const { gate } = makeGate(governor);
    const decision = await gated(gate, estimate);
    const ok = decision.action === "block";
    if (ok) passed++; else failures.push({ case: "invalid-estimate", estimate, got: decision.action });
  }

  for (let i = 0; i < disabledCases; i++) {
    const governor = createCarbonGovernor({ budgetG: 1000 });
    const estimate = randInt(rng, 0, 5000);
    const { gate, audit } = makeGate(governor, { enabled: false });
    const decision = await gated(gate, estimate);
    const ok = decision.action === "allow" && decision.verdicts.length === 0 && audit.records().length === 0;
    if (ok) passed++; else failures.push({ case: "disabled", estimate, decision });
  }

  const ROGUE = "not-a-rung";
  for (let i = 0; i < rogueCases; i++) {
    const governor = createCarbonGovernor({ budgetG: 1000 });
    const others = Array.from({ length: randInt(rng, 0, 3) }, () => pick(rng, LADDER));
    const actions = [ROGUE, ...others];
    // Shuffle so the rogue verdict sometimes sits first and sometimes last: the
    // shipped gate's answer depends on that position, the normalised one must not.
    for (let k = actions.length - 1; k > 0; k--) {
      const j = randInt(rng, 0, k);
      [actions[k], actions[j]] = [actions[j], actions[k]];
    }
    const extraValidators = actions.map((action, idx) => ({
      name: `v-${idx}`, check: () => ({ action, reason: "fixed", validator: `v-${idx}` }),
    }));
    const { gate } = makeGate(governor, { extraValidators });
    const decision = await gated(gate, 0); // carbon verdict is "allow" at estimate 0
    const expected = mostSevere(["allow", ...actions]); // ROGUE ranks as block severity
    const ok = decision.action === expected
      && LADDER.includes(decision.action)
      && severityOf(decision.action) >= severityOf("block")
      && decision.rawAction !== undefined
      && decision.normalisedReason === `non-ladder verdict '${ROGUE}' treated as block (fail closed)`;
    if (severityOf(decision.rawAction) < severityOf(expected)) rogueMaskedByShippedGate++;
    if (ok) passed++; else failures.push({ case: "rogue", actions, expected, got: decision.action, raw: decision.rawAction });
  }

  return {
    id: "F2",
    property: "Fail-closed: throwing validator / invalid estimate / off-ladder verdict -> block or worse; disabled -> documented all-or-nothing passthrough",
    cases,
    passed: passed === cases,
    notes:
      passed === cases
        ? `all ${cases} cases fail-closed correctly (${throwCases} throw, ${invalidCases} invalid-estimate, ${disabledCases} disabled-passthrough, ${rogueCases} rogue off-ladder verdict). Upstream gap recorded honestly: in ${rogueMaskedByShippedGate}/${rogueCases} rogue cases the SHIPPED gate's own answer was less severe than the correct one (rawAction), because GATE_ACTION_SEVERITY has no entry for an off-ladder action; governor/gate.js re-aggregates fail-closed`
        : `${cases - passed}/${cases} failed, e.g. ${JSON.stringify(failures[0])}`,
  };
}

// ── F3 — Monotonicity ────────────────────────────────────────────────────────
// Why it matters: operators reason about the ladder as "worse consumption ->
// never a lighter-touch verdict". If severity could dip as commitment rose,
// the budget pacing would be unpredictable and untrustable under review.
export function f3Monotonicity(cases = 2000) {
  const rng = mulberry32(3);
  let passed = 0;
  const failures = [];
  for (let i = 0; i < cases; i++) {
    const budgetG = randFloat(rng, 10, 100000);
    const governor = createCarbonGovernor({ budgetG });
    const steps = randInt(rng, 2, 6);
    let ratio = 0;
    let prevSeverity = -1;
    let ok = true;
    for (let s = 0; s < steps; s++) {
      ratio += randFloat(rng, 0, 0.5); // non-decreasing by construction
      const action = governor.verdictFor(ratio);
      const severity = GATE_ACTION_SEVERITY[action];
      if (severity < prevSeverity) { ok = false; break; }
      prevSeverity = severity;
    }
    if (ok) passed++; else failures.push({ i, budgetG });
  }

  const governor = createCarbonGovernor({ budgetG: 1000 });
  const boundaries = [[0.8, "degrade"], [1.0, "escalate"], [1.1, "block"], [1.25, "terminate"]];
  let boundaryOk = true;
  const boundaryFailures = [];
  for (const [ratio, expected] of boundaries) {
    const got = governor.verdictFor(ratio);
    if (got !== expected) { boundaryOk = false; boundaryFailures.push({ ratio, expected, got }); }
  }

  const allPassed = passed === cases && boundaryOk;
  return {
    id: "F3",
    property: "Monotonicity: non-decreasing committed ratio -> non-decreasing severity; exact default rung boundaries",
    cases: cases + boundaries.length,
    passed: allPassed,
    notes: allPassed
      ? `all ${cases} monotone sequences held severity + all ${boundaries.length} default rung boundaries mapped exactly`
      : `sequence failures: ${cases - passed}/${cases}; boundary failures: ${JSON.stringify(boundaryFailures)}`,
  };
}

// ── F4 — Human binding on top rungs ─────────────────────────────────────────
// Why it matters: the whole point of escalate/block/terminate is that a human
// stays in the loop — and the point of terminate is that even a human cannot
// wave it through. This proves the reference harness (governor/harness.js) never
// runs a task for escalate/block unless an approved HumanPort object was actually
// supplied, and never runs one for terminate under ANY approval: the property that
// closes the loop from verdict to actuation.
export function f4HumanBinding(cases = 2000) {
  const rng = mulberry32(4);
  let passed = 0;
  let terminateCases = 0, terminateRefused = 0, terminateApproved = 0;
  const failures = [];
  for (let i = 0; i < cases; i++) {
    const action = pick(rng, LADDER);
    const hasApproval = rng() < 0.5;
    const approved = hasApproval ? rng() < 0.5 : false;
    const approval = hasApproval ? { approved } : undefined;
    if (action === "terminate" && approved) terminateApproved++;
    let ran = false;
    const result = execute({ action }, () => { ran = true; return "done"; }, approval);
    const autoRun = action === "allow" || action === "degrade";
    const shouldRun = autoRun || (approved && action !== "terminate");
    const ok = ran === shouldRun && result.executed === shouldRun;
    if (action === "terminate") {
      terminateCases++;
      if (!ran && result.reason === "terminate is not overridable") terminateRefused++;
    }
    if (ok) passed++;
    else failures.push({ i, action, hasApproval, approved, ran, executed: result.executed, shouldRun });
  }
  const terminateOk = terminateCases > 0 && terminateRefused === terminateCases;
  return {
    id: "F4",
    property: "Human binding: escalate/block never execute without an explicit approved HumanPort approval, and terminate never executes at all",
    cases,
    passed: passed === cases && terminateOk,
    notes:
      passed === cases && terminateOk
        ? `all ${cases} random decisions obeyed the human-binding rule in governor/harness.js, including ${terminateCases} terminate cases (${terminateApproved} of them carrying an approved approval object) that were refused as not overridable`
        : `${cases - passed}/${cases} violated the rule, e.g. ${JSON.stringify(failures[0])}; terminate refused ${terminateRefused}/${terminateCases}`,
  };
}

// ── F5 — Gate-on-path ────────────────────────────────────────────────────────
// Why it matters: a governance gate that some code paths can skip is decorative.
// This proves that for every one of the three operation types the gate's contract
// names (tool-call / outbound-message / memory-write, the GateOperation union in
// kaiban-distributed's governance types), the ONLY path from a decision to running
// anything is via gate.evaluate: the audit chain must contain exactly one record per
// attempted operation, in order, carrying that operation's own context.
export async function f5GateOnPath(casesPerOperation = 700) {
  const operations = ["tool-call", "outbound-message", "memory-write"];
  const rng = mulberry32(5);
  const governor = createCarbonGovernor({ budgetG: 1000 });
  const { gate, audit } = makeGate(governor);
  const attempted = [];
  let executedCount = 0;
  let refusedCount = 0;
  let harnessViolations = 0;
  let terminateExecuted = 0;
  const cases = casesPerOperation * operations.length;
  for (const operation of operations) {
    for (let i = 0; i < casesPerOperation; i++) {
      const estimate = randFloat(rng, 0, 1400); // spans allow..terminate at budget 1000
      const approval = rng() < 0.3 ? { approved: rng() < 0.5 } : undefined;
      const decision = await gated(gate, estimate, { operation });
      attempted.push({ operation, action: decision.action });
      const { executed } = execute(decision, () => true, approval);
      // The harness rule, asserted here rather than assumed: what actually ran is
      // exactly what allow/degrade or an approved non-terminate rung permitted.
      const autoRun = decision.action === "allow" || decision.action === "degrade";
      const approved = approval?.approved === true;
      const shouldRun = autoRun || (approved && decision.action !== "terminate");
      if (executed !== shouldRun) harnessViolations++;
      if (decision.action === "terminate" && executed) terminateExecuted++;
      if (executed) executedCount++; else refusedCount++;
    }
  }
  const records = audit.records();
  const opsSeen = new Set(records.map((r) => r.decision.context.operation));
  const aligned = records.length === attempted.length
    && records.every((r, i) => r.decision.context.operation === attempted[i].operation
      && r.decision.action === attempted[i].action
      && LADDER.includes(r.decision.action));
  const ok = aligned && executedCount + refusedCount === cases && opsSeen.size === operations.length
    && harnessViolations === 0 && terminateExecuted === 0;
  return {
    id: "F5",
    property: "Gate-on-path: every attempted operation produces exactly one audit record, in order, with its own operation type; nothing runs unaudited, and what ran is exactly what the harness rule permits",
    cases,
    passed: ok,
    notes: ok
      ? `${records.length} audit records match the ${attempted.length} attempts one-for-one (operation + verdict); executed ${executedCount}, refused ${refusedCount}, every one of them exactly as the harness rule predicts; no terminate ever executed; all ${operations.length} operation types routed`
      : `records=${records.length}, attempts=${attempted.length}, aligned=${aligned}, executed=${executedCount}, refused=${refusedCount}, harnessViolations=${harnessViolations}, terminateExecuted=${terminateExecuted}, ops=${[...opsSeen]}`,
  };
}

// ── F6 — Audit-chain integrity ───────────────────────────────────────────────
// Why it matters: an audit trail an operator (or attacker) can silently edit
// after the fact is not evidence. This proves verify() is valid over a real
// run and that mutating even one field of one record is detected.
export async function f6AuditChainIntegrity(n = 500) {
  const rng = mulberry32(6);
  const governor = createCarbonGovernor({ budgetG: 1000 });
  const { gate, audit } = makeGate(governor);
  for (let i = 0; i < n; i++) {
    await gated(gate, randFloat(rng, 0, 1400));
  }
  const beforeTamper = audit.verify();

  const records = audit.records();
  const idx = randInt(rng, 0, records.length - 1);
  const original = records[idx].decision.action;
  records[idx].decision.action = original === "allow" ? "terminate" : "allow";
  const afterTamper = audit.verify();

  const ok = beforeTamper.valid === true && afterTamper.valid === false && afterTamper.brokenAt === idx;
  return {
    id: "F6",
    property: "Audit-chain integrity: verify() valid over N decisions; tampering one record's field breaks verify() at that index",
    cases: n,
    passed: ok,
    notes: ok
      ? `${n} decisions verified valid; tampering record ${idx} was detected (brokenAt=${afterTamper.brokenAt})`
      : `beforeValid=${beforeTamper.valid}, afterValid=${afterTamper.valid}, brokenAt=${afterTamper.brokenAt}, expectedIdx=${idx}`,
  };
}

// ── F7 — Port isolation (hexagonal) ─────────────────────────────────────────
// Why it matters: the paper's architectural claim is that the governance core is a
// pure, portable hexagon with adapters at the edges. This is a static check of that
// claim against the ACTUAL import graph of the repository as it stands, not an
// assertion in prose:
//   governor/carbon-governor.js  imports nothing at all
//   governor/harness.js          imports nothing at all
//   governor/gate.js             imports only kaiban-distributed + the core (+ node:*)
//   shared/*.js                  are leaves (import nothing)
//   simulation/, dataplane/, demo/  may import governor/, shared/, node:* and their own
//                                folder, never each other and never the test suite
//   the ONE permitted external library in an adapter is the optional consumer library
//   in dataplane/measure.js, named here so a second one cannot slip in unnoticed —
//   together with the one dynamic import whose specifier is an environment variable
//   (SUSTAINABILITY_CONSUMER_URL), which is the documented override for the same
//   library and is allowed in that file and nowhere else
//   every adapter that ACTUATES must import governor/harness.js, so no adapter can
//   invent its own path from a verdict to running something

/** The optional reference consumer library — the single named external-library exception. */
export const CONSUMER_PACKAGE = "sustainability-wellknown-consumer";

/** Adapter files that actuate, and therefore must go through the harness. */
export const ACTUATING_ADAPTERS = [
  "simulation/run.js", "simulation/charging.js", "demo/demo.js", "demo/agent.js",
];

export function f7PortIsolation() {
  const notes = [];
  const violations = [];
  let checks = 0;

  const check = (file, allowed, label) => {
    checks++;
    const bad = importsOf(file).filter((spec) => {
      const t = targetOf(file, spec);
      return !(t.startsWith("node:") || allowed.includes(t));
    });
    if (bad.length) violations.push({ file: path.relative(ROOT, file), imports: bad, rule: label });
  };

  // 1. The core hexagon: every file in governor/ is enumerated, so adding one to that
  //    folder cannot escape the rule by not being listed here.
  const coreFiles = jsFilesIn(CORE);
  const mustImportNothing = new Set(["carbon-governor.js", "harness.js"]);
  const seenPure = [];
  for (const f of coreFiles) {
    const base = path.basename(f);
    checks++;
    if (mustImportNothing.has(base)) {
      const imports = importsOf(f);
      if (imports.length) violations.push({ file: `${CORE}/${base}`, imports, rule: `${base} imports nothing` });
      else seenPure.push(base);
    } else if (base === "gate.js") {
      check(f, ["kaiban-distributed", CORE], "gate.js: kaiban-distributed + core only");
      checks--; // check() already counted this one
    } else {
      violations.push({ file: `${CORE}/${base}`, imports: [], rule: `unexpected file in ${CORE}/: extend F7 before adding one` });
    }
  }
  for (const base of mustImportNothing) {
    if (!coreFiles.some((f) => path.basename(f) === base)) {
      violations.push({ file: `${CORE}/${base}`, imports: [], rule: "expected core file is missing" });
    }
  }
  notes.push(`${coreFiles.length} governor/ file(s) checked: ${[...seenPure].sort().join(" + ")} import nothing at all; gate.js imports only kaiban-distributed + the core (+ node:* built-ins)`);

  // 2. shared/ modules are leaves.
  const sharedFiles = jsFilesIn(SHARED);
  for (const f of sharedFiles) check(f, [], "shared/ modules are leaves");
  notes.push(`${sharedFiles.length} shared/ module(s) import nothing`);

  // 3. Adapter source files, and 4. their test files under a relaxed rule.
  let adapterFiles = 0, adapterTests = 0;
  for (const dir of ADAPTERS) {
    for (const f of jsFilesIn(dir)) {
      adapterFiles++;
      const allowed = [dir, CORE, SHARED, "kaiban-distributed"];
      // The one named external-library exception, and only in the file that needs it.
      // "<dynamic>" is the SUSTAINABILITY_CONSUMER_URL override — a specifier that is an
      // environment variable and so cannot be resolved statically. It is allowed here
      // and nowhere else, precisely because a dynamic import is the one thing this
      // scanner cannot see through.
      if (path.relative(ROOT, f) === path.join("dataplane", "measure.js")) allowed.push(CONSUMER_PACKAGE, "<dynamic>");
      check(f, allowed, `${dir}/ imports only itself, governor, shared`);
    }
    for (const f of jsFilesIn(dir, { tests: true })) {
      adapterTests++;
      check(f, [dir, CORE, SHARED, "kaiban-distributed"], `${dir}/ tests import only their own folder, governor, shared`);
    }
  }
  notes.push(`${adapterFiles} adapter file(s) + ${adapterTests} adapter test file(s) in ${ADAPTERS.join("/")} import only governor/, shared/, node:* and their own folder`);
  notes.push(`the only external library allowed in an adapter is the optional "${CONSUMER_PACKAGE}" in dataplane/measure.js, alongside its one SUSTAINABILITY_CONSUMER_URL dynamic import; every other import in every adapter resolves statically`);

  // 5. Every actuating adapter goes through the harness — there is no second path
  //    from a verdict to running something.
  for (const rel of ACTUATING_ADAPTERS) {
    checks++;
    const abs = path.join(ROOT, rel);
    if (!importsModule(abs, `${CORE}/harness.js`)) {
      violations.push({ file: rel, imports: [], rule: `actuating adapters must import ${CORE}/harness.js` });
    }
  }
  notes.push(`${ACTUATING_ADAPTERS.length} actuating adapter(s) (${ACTUATING_ADAPTERS.join(", ")}) import ${CORE}/harness.js`);

  const ok = violations.length === 0;
  return {
    id: "F7",
    property: "Port isolation (hexagonal): core and harness import nothing, gate.js imports only kaiban-distributed+core (+ node:* built-ins), shared/ is a leaf, adapters never import each other, and every actuating adapter goes through the harness",
    cases: checks,
    passed: ok,
    notes: ok ? notes.join("; ") : `violations: ${JSON.stringify(violations)}`,
  };
}

// ── F8 — Determinism ─────────────────────────────────────────────────────────
// Why it matters: a governance decision that can't be reproduced from the same
// inputs can't be replayed, tested, or trusted in an incident review. This
// proves two independent fresh gates given the same estimate sequence produce
// byte-identical decisions AND byte-identical audit chains.
export async function f8Determinism(n = 300) {
  const rng = mulberry32(8);
  const estimates = Array.from({ length: n }, () => randFloat(rng, 0, 1400));

  async function run() {
    const governor = createCarbonGovernor({ budgetG: 1000 });
    const { gate, audit } = makeGate(governor);
    const decisions = [];
    for (const e of estimates) decisions.push(await gated(gate, e));
    return { decisions, records: audit.records() };
  }

  const a = await run();
  const b = await run();
  const decisionsEqual = JSON.stringify(a.decisions) === JSON.stringify(b.decisions);
  const recordsEqual = JSON.stringify(a.records) === JSON.stringify(b.records);
  const ok = decisionsEqual && recordsEqual;
  return {
    id: "F8",
    property: "Determinism: the same estimate sequence yields byte-identical decisions and audit records across two fresh gates",
    cases: n,
    passed: ok,
    notes: ok
      ? `${n}-step sequence byte-identical across two fresh gates (decisions + audit chain)`
      : `decisionsEqual=${decisionsEqual}, recordsEqual=${recordsEqual}`,
  };
}

// ── F9 — Aggregation equivalence ─────────────────────────────────────────────
// Why it matters: this package's reference core (mostSevere) is only a valid
// stand-in for reasoning about the shipped gate if it actually computes the
// same aggregation the shipped gate computes. This is that equivalence check,
// varying both the carbon verdict and the extra-validator verdicts at once.
export async function f9AggregationEquivalence(cases = 2000) {
  const rng = mulberry32(9);
  let passed = 0;
  const failures = [];
  for (let i = 0; i < cases; i++) {
    const budgetG = randFloat(rng, 10, 5000);
    const governor = createCarbonGovernor({ budgetG });
    const estimate = randFloat(rng, 0, budgetG * 2);
    const carbonAction = governor.decide(estimate).action; // side-effect free (decide doesn't commit)
    const n = randInt(rng, 0, 4);
    const extraActions = Array.from({ length: n }, () => pick(rng, LADDER));
    const extraValidators = extraActions.map((action, idx) => ({
      name: `extra-${idx}`,
      check: () => ({ action, reason: "fixed", validator: `extra-${idx}` }),
    }));
    const { gate } = makeGate(governor, { extraValidators });
    const decision = await gated(gate, estimate);
    const expected = mostSevere([carbonAction, ...extraActions]);
    const ok = decision.action === expected;
    if (ok) passed++;
    else failures.push({ i, expected, got: decision.action, carbonAction, extraActions });
  }
  return {
    id: "F9",
    property: "Aggregation equivalence: governor.mostSevere() (reference rule) agrees with the shipped gate's aggregation",
    cases,
    passed: passed === cases,
    notes:
      passed === cases
        ? `all ${cases} random verdict sets (varying carbon action + extras) agreed with mostSevere()`
        : `${cases - passed}/${cases} mismatches, e.g. ${JSON.stringify(failures[0])}`,
  };
}

// ── F10 — Audit anchoring ────────────────────────────────────────────────────
// Why it matters: F6 shows the chain is tamper-EVIDENT for edits. It is not the
// same as tamper-RESISTANT, and the difference matters to anyone who would rely on
// the log as evidence. `AuditLog.records()` hands out the live record objects, so a
// process holding the log can edit them (F6 detects that) — but it can also DROP the
// tail, and a shorter chain re-hashes perfectly: verify() alone says "valid". What
// catches that is an external ANCHOR — {length, tipHash} written down somewhere the
// log's holder cannot rewrite. This function proves both halves honestly: the edit
// case is detected by verify(); the truncation case is NOT, and only verifyAnchored()
// sees it.
export async function f10AuditAnchoring({ editCases = 150, truncateCases = 150, chainLength = 40 } = {}) {
  const rng = mulberry32(10);
  const cases = editCases + truncateCases;
  let passed = 0;
  let truncationMissedByVerify = 0;
  const failures = [];

  const freshChain = async (n) => {
    const governor = createCarbonGovernor({ budgetG: 1000 });
    const { gate, audit } = makeGate(governor);
    for (let i = 0; i < n; i++) await gated(gate, randFloat(rng, 0, 1400));
    return audit;
  };

  // (a) random edits: verify() must catch every one, and so must verifyAnchored().
  for (let i = 0; i < editCases; i++) {
    const audit = await freshChain(chainLength);
    const anchor = chainAnchor(audit.records());
    const records = audit.records();
    const idx = randInt(rng, 0, records.length - 1);
    const field = pick(rng, ["action", "timestamp"]);
    if (field === "action") {
      records[idx].decision.action = records[idx].decision.action === "allow" ? "terminate" : "allow";
    } else {
      records[idx].timestamp = "1999-01-01T00:00:00.000Z";
    }
    const v = audit.verify();
    const va = verifyAnchored(audit, anchor);
    const ok = v.valid === false && v.brokenAt === idx && va.valid === false;
    if (ok) passed++; else failures.push({ case: "edit", i, idx, field, verify: v, anchored: va });
  }

  // (b) tail truncation: verify() says the shorter chain is fine (assert that, rather
  //     than pretend otherwise); only the anchor catches it.
  for (let i = 0; i < truncateCases; i++) {
    const audit = await freshChain(chainLength);
    const anchor = chainAnchor(audit.records());
    const drop = randInt(rng, 1, chainLength - 1);
    audit.records().length = chainLength - drop; // truncate the live array in place
    const v = audit.verify();
    if (v.valid === true) truncationMissedByVerify++;
    const va = verifyAnchored(audit, anchor);
    const ok = v.valid === true && va.valid === false && va.reason === "chain shorter than anchor (truncation or deletion)";
    if (ok) passed++; else failures.push({ case: "truncate", i, drop, verify: v, anchored: va });
  }

  return {
    id: "F10",
    property: "Audit anchoring: edits are caught by verify() alone; truncation/deletion is NOT, and is caught only against an external {length, tipHash} anchor",
    cases,
    passed: passed === cases,
    notes:
      passed === cases
        ? `${editCases} random single-field edits all broke verify() at exactly the edited index; ${truncateCases} random tail truncations were reported VALID by verify() in ${truncationMissedByVerify}/${truncateCases} cases (tamper-evident, not tamper-resistant) and were caught by verifyAnchored() in all ${truncateCases}`
        : `${cases - passed}/${cases} failed, e.g. ${JSON.stringify(failures[0])}`,
  };
}

// ── F11 — Governor core invariants ───────────────────────────────────────────
// Why it matters: everything above rests on the core behaving like a small, boring,
// predictable function. These are the properties a reader would otherwise have to
// take on trust from reading it: decide() is monotone in the estimate and has no
// side effects, commit() is additive and reset() clears, the shipped severity table
// agrees with the ladder's own order, and rung boundaries are inclusive from below.
export function f11CoreInvariants({ monotoneCases = 500, idempotenceCases = 500, commitCases = 500, boundaryCases = 500 } = {}) {
  const rng = mulberry32(11);
  const cases = monotoneCases + idempotenceCases + commitCases + boundaryCases + LADDER.length;
  let passed = 0;
  const failures = [];

  // (a) decide() is monotone in estimateG: more grams never yields a lighter rung.
  for (let i = 0; i < monotoneCases; i++) {
    const gov = createCarbonGovernor({ budgetG: randFloat(rng, 10, 100000) });
    gov.commit(randFloat(rng, 0, 5000));
    const a = randFloat(rng, 0, 20000);
    const b = a + randFloat(rng, 0, 20000);
    const ok = severityOf(gov.decide(b).action) >= severityOf(gov.decide(a).action);
    if (ok) passed++; else failures.push({ case: "monotone", i, a, b });
  }

  // (b) decide() is idempotent and side-effect free: it must not move spentG.
  for (let i = 0; i < idempotenceCases; i++) {
    const gov = createCarbonGovernor({ budgetG: randFloat(rng, 10, 100000) });
    const spent = randFloat(rng, 0, 5000);
    gov.commit(spent);
    const estimate = randFloat(rng, 0, 20000);
    const first = gov.decide(estimate);
    const second = gov.decide(estimate);
    const ok = JSON.stringify(first) === JSON.stringify(second) && gov.spentG === spent;
    if (ok) passed++; else failures.push({ case: "idempotent", i, first, second, spentG: gov.spentG, spent });
  }

  // (c) commit() is additive, reset() clears, and a bad value throws rather than
  //     being absorbed as a silent zero.
  for (let i = 0; i < commitCases; i++) {
    const gov = createCarbonGovernor({ budgetG: 1000 });
    const parts = Array.from({ length: randInt(rng, 1, 5) }, () => randFloat(rng, 0, 500));
    for (const g of parts) gov.commit(g);
    const total = parts.reduce((a, b) => a + b, 0);
    const additive = Math.abs(gov.spentG - total) < 1e-9;
    let threw = false;
    try { gov.commit(pick(rng, [NaN, -1, undefined, "1", Infinity])); } catch { threw = true; }
    const unchangedAfterThrow = Math.abs(gov.spentG - total) < 1e-9;
    gov.reset();
    const ok = additive && threw && unchangedAfterThrow && gov.spentG === 0;
    if (ok) passed++; else failures.push({ case: "commit", i, additive, threw, cleared: gov.spentG });
  }

  // (d) rung boundaries are inclusive from below: exactly AT a rung is that rung, and
  //     one ulp below it is the rung beneath.
  const rungNames = ["degrade", "escalate", "block", "terminate"];
  for (let i = 0; i < boundaryCases; i++) {
    const gov = createCarbonGovernor({ budgetG: 1000 });
    const name = pick(rng, rungNames);
    const at = DEFAULT_RUNGS[name];
    const below = LADDER[LADDER.indexOf(name) - 1];
    const ok = gov.verdictFor(at) === name && gov.verdictFor(at - 1e-9) === below;
    if (ok) passed++; else failures.push({ case: "boundary", name, at, got: gov.verdictFor(at) });
  }

  // (e) the SHIPPED severity table agrees with this package's ladder order, rung for
  //     rung. If upstream ever reordered it, every property above would silently mean
  //     something different.
  let tableOk = true;
  for (let i = 0; i < LADDER.length; i++) {
    if (GATE_ACTION_SEVERITY[LADDER[i]] === i) passed++;
    else { tableOk = false; failures.push({ case: "severity-table", rung: LADDER[i], expected: i, got: GATE_ACTION_SEVERITY[LADDER[i]] }); }
  }

  return {
    id: "F11",
    property: "Governor core invariants: decide() monotone + side-effect free, commit() additive and loud on bad input, reset() clears, rung boundaries inclusive from below, shipped GATE_ACTION_SEVERITY order == LADDER order",
    cases,
    passed: passed === cases,
    notes:
      passed === cases
        ? `${monotoneCases} monotone, ${idempotenceCases} idempotence/no-side-effect, ${commitCases} commit/reset (each also proving commit() throws rather than absorbing a bad value) and ${boundaryCases} rung-boundary cases held; GATE_ACTION_SEVERITY matches LADDER for all ${LADDER.length} rungs (${tableOk})`
        : `${cases - passed}/${cases} failed, e.g. ${JSON.stringify(failures[0])}`,
  };
}

// ── F12 — Documentation agrees with results/ ─────────────────────────────────
// Why it matters: every headline number in the README and the docs is hand-typed,
// and results/ is regenerated by scripts. Prose and evidence drift apart silently —
// that is how a paper ends up citing a number nothing produces any more. This is a
// static check, like F7: each registered claim is re-read from the document and
// compared against the value in results/*.json that it is supposed to come from.
export function f12DocsAgreeWithResults() {
  const { checks, mismatches } = checkNumbers();
  const ok = mismatches.length === 0;
  return {
    id: "F12",
    property: "Documentation agrees with results/: every registered headline number in README.md, RESEARCH.md, CHANGELOG.md and docs/ matches the value in results/*.json it is drawn from",
    cases: checks.length,
    passed: ok,
    notes: ok
      ? `all ${checks.length} registered claims across ${new Set(checks.map((c) => c.docFile)).size} documents match results/`
      : `${mismatches.length}/${checks.length} mismatch: ${mismatches.map((m) => `${m.docFile}:${m.line} ${m.label} doc=${m.found} results=${m.expected}`).join(" | ")}`,
  };
}

// ── F13 — Self-declared estimates: what trusted metering does and does not save ──
// Why it matters: the validator reads the ACTING agent's own estimate
// (`payload.estimatedGramsCO2e`). That number is attacker-controlled input, and the
// core's monotonicity (F11) is no defence against a strategically small one. This
// property states exactly what protects the budget and what does not:
//   (a) WITH trusted metering — commit() charges the grams actually emitted — an
//       under-declaring agent never obtains a stricter verdict than an honest one at the
//       same step (monotone), and it crosses every rung AT MOST ONE ACTION after the
//       honest agent would have: ratio_lie(k+1) >= spent_k / B = ratio_truth(k), so the
//       lie buys exactly one action of slack per rung, never more;
//   (b) WITHOUT trusted metering — commit() charges what the agent declared — an agent
//       that declares zero is never caught: every verdict stays `allow` however far past
//       `terminate` its true emissions run.
// (b) is why the architecture needs a METERING port beside signal/forecast/human/
// actuation (limitation R15); (a) is the guarantee that port buys.
export function f13AdversarialEstimates({ lagCases = 1000, unmeteredCases = 500, sequenceLength = 30 } = {}) {
  const rng = mulberry32(13);
  const cases = lagCases + unmeteredCases;
  let passed = 0;
  const failures = [];

  // (a) trusted metering: lying is bounded to one action of lag per rung.
  for (let i = 0; i < lagCases; i++) {
    const budgetG = randFloat(rng, 100, 10000);
    const honest = createCarbonGovernor({ budgetG });
    const liar = createCarbonGovernor({ budgetG });
    const n = randInt(rng, 2, sequenceLength);
    let ok = true;
    let previousTruth = 0;
    for (let k = 0; k < n && ok; k++) {
      const trueG = randFloat(rng, 0, budgetG / 4);
      const declared = trueG * randFloat(rng, 0, 1); // any under-declaration, down to "nothing"
      const truth = severityOf(honest.decide(trueG).action);
      const lie = severityOf(liar.decide(declared).action);
      if (lie > truth) { ok = false; failures.push({ case: "lie-stricter-than-truth", i, k, trueG, declared }); }
      if (k > 0 && lie < previousTruth) { ok = false; failures.push({ case: "lag-exceeds-one-action", i, k, lie, previousTruth }); }
      honest.commit(trueG);
      liar.commit(trueG); // trusted metering: both are charged what was actually emitted
      previousTruth = truth;
    }
    if (ok) passed++;
  }

  // (b) declared metering: a zero-declarer is never caught, however much it emits.
  for (let i = 0; i < unmeteredCases; i++) {
    const budgetG = randFloat(rng, 100, 10000);
    const gov = createCarbonGovernor({ budgetG });
    const n = randInt(rng, 13, sequenceLength); // 13 x (>= budget/10) guarantees > 1.25 x budget
    let trueSpent = 0;
    let allAllow = true;
    for (let k = 0; k < n; k++) {
      const trueG = randFloat(rng, budgetG / 10, budgetG / 2);
      if (gov.decide(0).action !== "allow") allAllow = false;
      gov.commit(0); // unmetered: the budget is charged what was declared — nothing
      trueSpent += trueG;
    }
    const ok = allAllow && trueSpent > budgetG * 1.25;
    if (ok) passed++; else failures.push({ case: "unmetered", i, allAllow, trueSpent, budgetG });
  }

  return {
    id: "F13",
    property: "Self-declared estimates: with trusted metering an under-declaring agent is never stricter than an honest one and lags every rung by at most one action; without trusted metering a zero-declarer is never caught",
    cases,
    passed: passed === cases,
    notes:
      passed === cases
        ? `${lagCases} random under-declaration sequences: lie never stricter than truth, and every rung reached at most one action late when commit() is charged the true grams; ${unmeteredCases} sequences with commit() charged the declared zero: all verdicts stayed allow while true emissions ran past 1.25 x budget — the metering port is what makes the ladder mean anything against a dishonest estimate (R15)`
        : `${cases - passed}/${cases} failed, e.g. ${JSON.stringify(failures[0])}`,
  };
}
