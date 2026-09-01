# ADR-013 — Fitness functions are the architecture test layer

- **Status:** Accepted
- **Date:** 2026-08-22

## Context

Unit tests ask whether a function returns the right value. The claims in the
article are of a different kind: the aggregation is a maximum over a total order,
the gate fails closed, the core is dependency-free, decisions are reproducible.
Those are properties of the *architecture*, and they are usually defended in prose.

Ford, Parsons and Kua call an objective, automated, repeatable test of an
architectural characteristic a **fitness function**.

## Decision

Make the architecture claims executable, one function per clause of the claim,
against the real shipped gate.

- Twelve functions, F1 to F12, one architectural property each: total order, fail-closed, monotonicity, human binding, gate-on-path, audit-chain integrity, port isolation, determinism, aggregation equivalence, audit anchoring, core invariants, documentation-agrees-with-results. (Nine at v1.0.0; F10–F12 were added in v1.1.0.)
- Each property lives once, in `fitness/props.js`, as a function returning `{ id, property, cases, passed, notes }`.
- `fitness/fN.test.js` asserts on `passed`; `fitness/report.js` renders the same summaries into `results/fitness.json` and `results/fitness.md`. No duplicated logic, and no hand-written result file.
- Property-style cases use the seeded generator, so they are reproducible rather than flaky.
- The rationale for each function — why it matters architecturally — is written down in [`docs/FITNESS-FUNCTIONS.md`](../FITNESS-FUNCTIONS.md) and again as a comment above each property.

## Consequences

- The architectural claims are checkable in seconds and cannot rot silently.
- The result is a table a reviewer can read (`results/fitness.md`). At v1.0.0 — the snapshot the article cites — that was **9 of 9 green over 10,994 cases**; at v1.1.0 it is 13 of 13 over 14,925.
- Two of the thirteen, F7 and F12, are static checks rather than properties over generated cases. Their check counts are included in the total.
- Adding a property is a fixed, small ritual: a function in `props.js`, a test file, one line in `report.js`, an entry in `FITNESS-FUNCTIONS.md`.

## Alternatives considered

- **Ordinary unit tests only.** They would test the governor's arithmetic and say nothing about isolation, determinism or fail-closed behaviour.
- **A written architecture review.** Not repeatable, and it does not fail when the code changes.
