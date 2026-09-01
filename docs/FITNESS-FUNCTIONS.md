# Architecture fitness functions

## What a fitness function is

A term from Ford, Parsons & Kua, *Building Evolutionary Architectures*: an
**objective, automated, repeatable test of an architectural characteristic** —
not a feature test. Where a unit test asks "does this function return the
right value", a fitness function asks "does the *architecture* still hold the
property we designed it for" (isolation, fail-safety, determinism, an ordering
guarantee) — and it asks the *real* running system, not a description of it.

## Why these thirteen

The article's central architectural claim is a governance gate that aggregates
validator verdicts onto a severity ladder (`allow < degrade < escalate < block
< terminate`), fails closed, binds a human to its top rungs, and leaves a
tamper-evident record. Each fitness function tests exactly one clause of that
claim against the shipped `kaiban-distributed` `ActionGate` — not a
description of it, not a mock of it.

**Which claim is whose.** F1, F2, F5, F6, F8 and F9 test *shipped upstream* code.
F3 and F4 test *this package's* rung semantics, because the runtime ships the
vocabulary but not the meaning (ADR-002, ADR-006). F7, F10, F11 and F12 test this
repository's own structure, invariants and documentation. F13 tests the *trust
boundary* of this package's core: what the ladder can still promise when the
number it decides on is supplied by the agent being governed.

- **F1** total order / most-severe-wins — the ladder means nothing if
  aggregation can pick less than the max. The carbon estimate is varied across
  cases rather than held at zero, so the carbon validator is a live participant
  in the aggregation and not a constant.
- **F2** fail-closed — internal errors, bad input and a verdict that is *not on
  the ladder* must all resolve to `block`; the one legitimate bypass
  (`enabled:false`) is an all-or-nothing deployment switch, not a per-request
  escape hatch. Recorded honestly: the **shipped gate passes a non-ladder action
  through verbatim**, and it is `gated()` here that normalises it to `block`,
  keeping the original under `rawAction`. The gap is upstream's.
- **F3** monotonicity — worse consumption must never yield a lighter verdict;
  the default rung boundaries (0.8/1.0/1.1/1.25) are pinned exactly.
- **F4** human binding — `escalate` and `block` must never execute without an
  approved human decision reaching the actuation point, and `terminate` must
  never execute at all. The expectation is stated exactly:
  `shouldRun = autoRun || (approved && action !== "terminate")`.
- **F5** gate-on-path — for each of the three operation types the gate's
  contract names (`tool-call`, `outbound-message`, `memory-write`), every
  attempt must leave exactly one audit record, in order, carrying its own
  operation and verdict; nothing may execute unaudited. Per case it also
  asserts `executed === (autoRun || approved)`, and that `terminate` never
  executed.
- **F6** audit-chain integrity — the record of what happened must both verify
  and detect an edit.
- **F7** port isolation — the governance core must be a dependency-free
  hexagon, `shared/` must stay a leaf, and the adapters must import only
  `governor/`, `shared/`, their own folder and Node built-ins — never each
  other. Checked against the real import graph, file by file, so a new file in
  any of those folders is covered automatically. The rules are listed below.
- **F8** determinism — the same inputs must reproduce byte-identical
  decisions, so runs are replayable and reviewable.
- **F9** aggregation equivalence — the article's reference model of the gate
  (`mostSevere()`) must actually compute what the shipped gate computes, so
  reasoning about one is reasoning about the other. Its assertion is a subset of
  F1's, on a different sample (other seeds, a wider estimate range); it is kept as
  the named equivalence obligation ADR-002 promises, not as extra discriminating
  power — read the two together.
- **F10** audit anchoring — what the chain does and does not catch, asserted
  rather than assumed. See below.
- **F11** governor core invariants — the properties the core must have for any
  reasoning about it to be sound. See below.
- **F12** documentation agrees with `results/` — a number typed into a document
  by hand is a number that can go stale. See below.
- **F13** self-declared estimates — the gate decides on a number the acting agent
  supplies about itself. What the architecture can and cannot promise about that
  is a property, not a caveat. See below.

## The four added in v1.1.0

### F10 — audit anchoring: edits are caught; truncation needs an anchor

300 cases over a real chain: random single-field edits, and random
truncations of the tail.

- A random **edit** makes `audit.verify()` fail, and it names the index.
- A random **truncation** is **not** detected by `verify()` alone — a shortened chain is still consistent. F10 asserts that rather than claiming otherwise.
- The same truncation **is** detected by `verifyAnchored(audit, anchor)`, where `anchor` is a `chainAnchor(records)` — `{ length, tipHash, anchorHash }`, the third a digest of the first two — taken earlier and kept outside the log. What no anchor catches: a record appended *after* the anchor that is later rewritten and re-hashed. Anchor after every batch that matters.

The point: a hash chain gives tamper evidence for *modification*. Catching
deletion needs one bit of state the attacker does not control. And because
`records()` returns the live objects, the log is tamper-*evident* in-process, not
tamper-*resistant*.

### F11 — governor core invariants

2,005 cases. Five things the rest of the package quietly relies on:

- **`decide()` is monotone in the estimate** — a larger estimate never yields a lighter verdict. (F3 checks monotonicity through committed spend; this is the input an agent controls.)
- **`decide()` is idempotent and side-effect free** — two identical calls agree and `spentG` does not move. Asking a question must not spend budget.
- **`commit()` is additive and `reset()` clears.**
- **`GATE_ACTION_SEVERITY` agrees with `LADDER` index order** — otherwise F1 and F9 compare two different ladders.
- **`verdictFor()` boundaries are inclusive from below** — a ratio of exactly 0.8 is `degrade`.

`commit()` also throws on a non-finite or negative value rather than committing a
silent zero (ADR-005), with a unit test alongside.

### F12 — the documentation agrees with `results/`

A static check, like F7. `tools/check-numbers.js` holds a registry covering every
hand-typed headline number in `README.md`, `docs/RESEARCH-QUESTIONS.md`,
`docs/ARTIFACT-INVENTORY.md`, `docs/architecture/ARCHITECTURE.md` and
`docs/adr/ADR-013`, plus the line-count claims about
`governor/carbon-governor.js`, which it computes rather than trusts. It compares
each with `results/*.json` and exits non-zero on a mismatch. It runs in `npm test`
and as `npm run check:docs`.

The point is narrow: **prose is part of the artifact.** A package whose README
says 13% where the JSON says 12.8% has a defect, and it is not in the JSON.

### F13 — self-declared estimates: metering bounds the lie to one action

Every rung in this system is reached because of `payload.estimatedGramsCO2e` — a
number the *acting agent* supplies about its own future behaviour. That is
attacker-controlled input, and monotonicity (F11) is no defence against a
strategically small one. F13 states exactly what protects the budget and what
does not:

- **With a trusted metering port** — `commit()` is charged the grams actually
  emitted, not the grams declared — an under-declaring agent is *never* given a
  more lenient outcome than a lag of one action. Formally, over 1,000 random
  under-declaration sequences: the liar's verdict is never stricter than the
  honest agent's at the same step, and never less strict than the honest agent's
  verdict at the *previous* step. Under-declaring buys exactly one action of
  slack per rung and no more, because the next decision is taken against a budget
  the meter has already corrected.
- **Without one** — `commit()` charged what was declared — an agent that declares
  zero is never caught. Over 500 sequences the verdict stayed `allow` for every
  action while true emissions ran past 1.25 × budget, the `terminate` line.

This is the executable form of limitation **R15**, and the reason the port
inventory in ARCHITECTURE §5 needs a **metering port** beside signal, forecast,
human and actuation. The evaluation in this package does not have one: the
simulations charge the model's own physics, which is a trusted meter by
construction, and the demo charges a self-declared estimate. A deployment that
skips the meter has the ladder's vocabulary and none of its guarantee.

## What F7 checks, exactly

The rules, because "the adapters do not import each other" is not precise enough
to be a test:

1. `governor/carbon-governor.js` and `governor/harness.js` have **zero** import statements. Both are core.
2. `governor/gate.js` imports exactly two specifiers besides Node built-ins: `kaiban-distributed` and the core (it also imports `node:crypto`, for the anchor digest; `node:*` is allowed everywhere).
3. `shared/*.js` is a leaf: nothing but Node built-ins.
4. Adapter files (`simulation/`, `dataplane/`, `demo/`) import only: their own folder, `governor/`, `shared/`, `node:*` built-ins, and `kaiban-distributed`. Never another adapter folder.
5. `*.test.js` files inside adapter folders are **included**, under the same rule. A test that reaches across folders is still an import that reaches across folders.
6. **One named external exception:** `dataplane/measure.js` may import the reference consumer library — the bare specifier `sustainability-wellknown-consumer`, or whatever `SUSTAINABILITY_CONSUMER_URL` points at (ADR-017). Any other external import anywhere in an adapter folder is a violation.
7. **Every adapter that actuates must import `governor/harness.js`:** `simulation/run.js`, `simulation/charging.js`, `demo/demo.js`, `demo/agent.js`. This is the rule that makes the human-in-the-loop guarantee structural rather than a habit — an adapter cannot quietly run a task without going through the one path that knows what `terminate` means.

The import graph is built by `fitness/import-graph.js`, which scans imports
statement by statement: `import x from "…"`, `import { … } from "…"`,
`import "…"`, `export … from "…"`, and dynamic `import("…")` with a string
literal. It does not span statements and it tolerates trailing comments.

## How to run

```
npm run fitness          # node --test over fitness/*.test.js
npm run fitness:report   # re-runs the same property functions, writes results/fitness.{json,md}
npm test                 # the adapter unit tests, then npm run fitness, then check:docs
npm run check:docs       # F12 on its own
npm run arch             # madge: no circular dependencies (part of the same claim F7 makes)
npm run arch:graph       # madge: the full import graph — this is what produced results/madge.txt
```

`fitness/` **is** the governor's test suite: the governance core has no separate
unit tests. The `node:test` files elsewhere (`simulation/lib.test.js`,
`simulation/policies.test.js`, `dataplane/measure.test.js`) cover the adapters'
own arithmetic instead — statistics, trace loading, policy semantics, document
checking. There are **46** of those, and `npm test` runs them first.

Each property lives once, in `fitness/props.js`, as an exported function
returning `{ id, property, cases, passed, notes }`; the `fitness/fN.test.js`
files assert on it, and `fitness/report.js` renders both `results/fitness.json`
and `results/fitness.md` from the same run — no duplicated logic, and no
hand-written result file. Every property except the two static ones (F7 and F12)
draws its cases from the package's single fixed-seed PRNG (`shared/prng.js`,
mulberry32 — the same one the simulations draw from), each with its own fixed
seed, so results are reproducible rather than flaky.

F4 and F5 depend on the reference actuation harness, **`governor/harness.js`**.
It imports nothing and is the only path from a decision to running a task; rule 7
above checks that every adapter goes through it. It moved out of `fitness/` in
v1.1.0, because sitting in the test folder made the guarantee read as a property
of the tests rather than of the architecture.

## Current results

`results/fitness.md` is rendered from the run, so it is the authority. As of
v1.1.0: **13/13 green over 14,966 cases.** Version 1.0.0 — the snapshot the
article cites — was 9/9 over 10,994 cases. The difference is properties added,
not properties fixed.

## How to extend

To add F14: write `f14…` in `fitness/props.js` returning the same summary
shape, add `fitness/f14.test.js` with a one-line docstring stating the
property and why it matters architecturally, add the call to
`fitness/report.js`'s `results` array, and add it to the list above. Keep each
property real: it must exercise the actual shipped code path (the real
`ActionGate`, not a reimplementation) or a genuine structural fact about this
repository — not just the reference core in isolation.
