/**
 * The nine fitness-function properties (F1–F9), each as one exported function
 * returning a summary { id, property, cases, passed, notes }. Called from both
 * the node:test files (fitness/fN.test.js, which assert on `passed`) and from
 * report.js (which just collects the summaries) so the property logic lives
 * in exactly one place.
 */
import path from "node:path";
import { GATE_ACTION_SEVERITY } from "kaiban-distributed";
import { createCarbonGovernor, mostSevere, LADDER } from "../governor/carbon-governor.js";
import { makeGate, gated } from "../governor/gate.js";
import { execute } from "./harness.js";
import { mulberry32, pick, randInt, randFloat } from "../shared/prng.js";
import { ROOT, CORE, ADAPTERS, importsOf, jsFilesIn, targetOf } from "./import-graph.js";


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
    const governor = createCarbonGovernor({ budgetG: 1000 });
    const n = randInt(rng, 0, 5);
    const extraActions = Array.from({ length: n }, () => pick(rng, LADDER));
    const extraValidators = extraActions.map((action, idx) => ({
      name: `extra-${idx}`,
      check: () => ({ action, reason: "fixed", validator: `extra-${idx}` }),
    }));
    const { gate } = makeGate(governor, { extraValidators });
    const decision = await gated(gate, 0); // estimate 0 -> carbon verdict is "allow"
    const expected = mostSevere(["allow", ...extraActions]);
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
        ? `all ${cases} random verdict multisets resolved to the reference mostSevere() with it listed first`
        : `${cases - passed}/${cases} mismatches, e.g. ${JSON.stringify(failures[0])}`,
  };
}

// ── F2 — Fail-closed ─────────────────────────────────────────────────────────
// Why it matters: a governance gate that can be knocked into "allow" by an
// internal error is worse than no gate. (a)/(b) prove a throwing validator or
// a malformed carbon estimate can never leak through as anything but block.
// (c) documents the one intentional bypass: enabled:false is a deployment-time
// opt-out, not a per-request one — enforcement is all-or-nothing per deployment.
export async function f2FailClosed({ throwCases = 25, invalidCases = 25, disabledCases = 25 } = {}) {
  const rng = mulberry32(2);
  let passed = 0;
  const failures = [];
  const cases = throwCases + invalidCases + disabledCases;

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

  return {
    id: "F2",
    property: "Fail-closed: throwing validator / invalid estimate -> block; disabled -> documented all-or-nothing passthrough",
    cases,
    passed: passed === cases,
    notes:
      passed === cases
        ? `all ${cases} cases fail-closed correctly (${throwCases} throw, ${invalidCases} invalid-estimate, ${disabledCases} disabled-passthrough)`
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
// stays in the loop. This proves the reference harness (fitness/harness.js)
// never runs a task for those rungs unless an approved HumanPort object was
// actually supplied — the property that closes the loop from verdict to actuation.
export function f4HumanBinding(cases = 2000) {
  const rng = mulberry32(4);
  let passed = 0;
  const failures = [];
  for (let i = 0; i < cases; i++) {
    const action = pick(rng, LADDER);
    const hasApproval = rng() < 0.5;
    const approved = hasApproval ? rng() < 0.5 : false;
    const approval = hasApproval ? { approved } : undefined;
    let ran = false;
    const result = execute({ action }, () => { ran = true; return "done"; }, approval);
    const autoRun = action === "allow" || action === "degrade";
    const shouldRun = autoRun || approved;
    const ok = ran === shouldRun && result.executed === shouldRun;
    if (ok) passed++;
    else failures.push({ i, action, hasApproval, approved, ran, executed: result.executed });
  }
  return {
    id: "F4",
    property: "Human binding: escalate/block/terminate never execute without an explicit approved HumanPort approval",
    cases,
    passed: passed === cases,
    notes:
      passed === cases
        ? `all ${cases} random decisions obeyed the human-binding rule in fitness/harness.js`
        : `${cases - passed}/${cases} violated the rule, e.g. ${JSON.stringify(failures[0])}`,
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
  const cases = casesPerOperation * operations.length;
  for (const operation of operations) {
    for (let i = 0; i < casesPerOperation; i++) {
      const estimate = randFloat(rng, 0, 1400); // spans allow..terminate at budget 1000
      const approval = rng() < 0.3 ? { approved: rng() < 0.5 } : undefined;
      const decision = await gated(gate, estimate, { operation });
      attempted.push({ operation, action: decision.action });
      const { executed } = execute(decision, () => true, approval);
      if (executed) executedCount++; else refusedCount++;
    }
  }
  const records = audit.records();
  const opsSeen = new Set(records.map((r) => r.decision.context.operation));
  const aligned = records.length === attempted.length
    && records.every((r, i) => r.decision.context.operation === attempted[i].operation
      && r.decision.action === attempted[i].action
      && LADDER.includes(r.decision.action));
  const ok = aligned && executedCount + refusedCount === cases && opsSeen.size === operations.length;
  return {
    id: "F5",
    property: "Gate-on-path: every attempted operation produces exactly one audit record, in order, with its own operation type; nothing runs unaudited",
    cases,
    passed: ok,
    notes: ok
      ? `${records.length} audit records match the ${attempted.length} attempts one-for-one (operation + verdict); executed ${executedCount}, refused ${refusedCount}; all ${operations.length} operation types routed`
      : `records=${records.length}, attempts=${attempted.length}, aligned=${aligned}, executed=${executedCount}, refused=${refusedCount}, ops=${[...opsSeen]}`,
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
//   governor/gate.js             imports only kaiban-distributed + the core
//   shared/*.js                  are leaves (import nothing)
//   simulation/, dataplane/, demo/  may import governor/ and shared/ (and node:*),
//                                never each other and never the test suite
export function f7PortIsolation() {
  const notes = [];
  const violations = [];
  let checks = 0;

  const check = (file, allowed, label) => {
    checks++;
    const bad = importsOf(file).filter((s) => {
      const t = targetOf(file, s);
      return !(t.startsWith("node:") || allowed.includes(t));
    });
    if (bad.length) violations.push({ file: path.relative(ROOT, file), imports: bad, rule: label });
  };

  const corePath = path.join(ROOT, CORE, "carbon-governor.js");
  checks++;
  const coreImports = importsOf(corePath);
  if (coreImports.length) violations.push({ file: `${CORE}/carbon-governor.js`, imports: coreImports, rule: "core imports nothing" });
  else notes.push("core (carbon-governor.js) imports nothing");

  check(path.join(ROOT, CORE, "gate.js"), ["kaiban-distributed", CORE], "gate.js: kaiban-distributed + core only");
  notes.push("gate.js imports only kaiban-distributed + the core");

  const sharedFiles = jsFilesIn("shared");
  for (const f of sharedFiles) check(f, [], "shared/ modules are leaves");
  notes.push(`${sharedFiles.length} shared/ module(s) import nothing`);

  let adapterFiles = 0;
  for (const dir of ADAPTERS) {
    const files = jsFilesIn(dir);
    adapterFiles += files.length;
    for (const f of files) check(f, [dir, CORE, "shared", "kaiban-distributed"], `${dir}/ imports only itself, governor, shared`);
  }
  notes.push(`${adapterFiles} adapter file(s) in ${ADAPTERS.join("/")} import only governor/, shared/ and their own folder`);

  const ok = violations.length === 0;
  return {
    id: "F7",
    property: "Port isolation (hexagonal): core imports nothing, gate.js imports only kaiban-distributed+core, shared/ is a leaf, adapters never import each other",
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
