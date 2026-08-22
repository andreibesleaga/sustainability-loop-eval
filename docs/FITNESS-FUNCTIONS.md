# Architecture fitness functions

## What a fitness function is

A term from Ford, Parsons & Kua, *Building Evolutionary Architectures*: an
**objective, automated, repeatable test of an architectural characteristic** —
not a feature test. Where a unit test asks "does this function return the
right value", a fitness function asks "does the *architecture* still hold the
property we designed it for" (isolation, fail-safety, determinism, an ordering
guarantee) — and it asks the *real* running system, not a description of it.

## Why these nine

The paper's central architectural claim is a governance gate that aggregates
validator verdicts onto a severity ladder (`allow < degrade < escalate < block
< terminate`), fails closed, binds a human to its top rungs, and leaves a
tamper-evident record. Each fitness function tests exactly one clause of that
claim against the shipped `kaiban-distributed` `ActionGate` — not a
description of it, not a mock of it:

- **F1** total order / most-severe-wins — the ladder means nothing if
  aggregation can pick less than the max.
- **F2** fail-closed — internal errors and bad input must resolve to `block`,
  and the one legitimate bypass (`enabled:false`) is an honest,
  all-or-nothing deployment switch, not a per-request escape hatch.
- **F3** monotonicity — worse consumption must never yield a lighter verdict;
  the default rung boundaries (0.8/1.0/1.1/1.25) are pinned exactly.
- **F4** human binding — escalate/block/terminate must never execute without
  an approved human decision reaching the actuation point.
- **F5** gate-on-path — for each of the three operation types the gate's
  contract names (`tool-call`, `outbound-message`, `memory-write`), every
  attempt must leave exactly one audit record, in order, carrying its own
  operation and verdict; nothing may execute unaudited.
- **F6** audit-chain integrity — the record of what happened must both verify
  and detect tampering.
- **F7** port isolation — the governance core must be a dependency-free
  hexagon, `shared/` must stay a leaf, and the adapters (`simulation/`,
  `dataplane/`, `demo/`) must import only `governor/`, `shared/` and their own
  folder — never each other. Checked against the real import graph, file by
  file, so a new file in any of those folders is covered automatically.
- **F8** determinism — the same inputs must reproduce byte-identical
  decisions, so runs are replayable and reviewable.
- **F9** aggregation equivalence — the paper's reference model of the gate
  (`mostSevere()`) must actually compute what the shipped gate computes, so
  reasoning about one is reasoning about the other.

## How to run

```
npm run fitness          # node --test over fitness/*.test.js  (9/9)
npm run fitness:report   # re-runs the same property functions, writes results/fitness.json
npm test                 # the unit tests for the adapters, then npm run fitness
npm run arch             # madge: no circular dependencies (the same claim F7 makes)
```

`fitness/` **is** the governor's test suite: the governance core has no separate
unit tests, because every property worth asserting about it is asserted here
against the shipped gate. The `node:test` files elsewhere (`simulation/*.test.js`,
`dataplane/*.test.js`) cover the adapters' own arithmetic instead — statistics,
trace loading, policy semantics, document checking — not the governor.

Each property lives once, in `fitness/props.js`, as an exported function
returning `{ id, property, cases, passed, notes }`; the `fitness/fN.test.js`
files assert on it, `fitness/report.js` collects it into JSON — no duplicated
logic. Property-style cases (F1, F3, F4, F5, F9) use the package's single fixed-seed
PRNG (`shared/prng.js`, mulberry32 — the same one the simulations draw from) so
results are reproducible, not flaky. F4's
correctness depends on a small reference actuation harness
(`fitness/harness.js`, ~20 lines) that is the only path this package uses
from a decision to actually running a task.

## How to extend

To add F10: write `fN` in `fitness/props.js` returning the same summary
shape, add `fitness/fN.test.js` with a one-line docstring stating the
property and why it matters architecturally, and add the call to
`fitness/report.js`'s `results` array. Keep each property real: it must
exercise the actual shipped code path (the real `ActionGate`, not a
reimplementation), not just the reference core.
