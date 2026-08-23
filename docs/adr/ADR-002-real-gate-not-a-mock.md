# ADR-002 — The real kaiban-distributed ActionGate is the enforcement point

- **Status:** Accepted
- **Date:** 2026-08-22

## Context

The article's central architectural claim is about a governance gate: it
aggregates validator verdicts onto a total-ordered ladder, fails closed, binds a
human to its top rungs, and leaves a tamper-evident record.

A test against a reimplementation of that gate would prove something about the
reimplementation. It would prove nothing about the runtime where the gate ships.

## Decision

Import `kaiban-distributed@2.0.0` from npm and call its shipped `ActionGate` and
`AuditLog` in-process, with the Carbon-Verdict Governor registered as one of its
pluggable validators. This is the package's only runtime dependency. Every
fitness function, every simulated task, every charging session, and the demo all
go through this same real gate.

Also record the runtime's own governance test suite as separate evidence
(`results/kaiban-upstream-tests.json`): 71 tests at commit `17ad362`, run inside a
checkout of the runtime.

## Consequences

- The results are statements about shipped code, not about a description of it.
- The package is pinned to one runtime version. A new release needs the numbers re-run.
- No broker, database or container is needed: the gate is in-process code and its semantics do not depend on any of that.
- The package's reference aggregation rule `mostSevere()` must be shown to agree with what the shipped gate actually computes; that is fitness function F9.

**What is upstream's and what is this package's.** This matters for reading every
fitness result, so it is stated plainly rather than left to be inferred.

`kaiban-distributed@2.0.0` ships: the aggregation rule (most-severe-wins), the
fail-closed behaviour on a validator error, the hash-chained audit log, and the
registry kill-switch (a revoked agent yields `terminate`; any other inactive agent
yields `block`). Those are properties of shipped code, and F1, F2, F5, F6, F8 and
F9 test them.

`kaiban-distributed@2.0.0` does **not** ship the meaning of the rungs. Its own
default actor path treats `allow` and `degrade` as "proceed" and treats
`escalate`, `block` and `terminate` identically, sending all three to a dead
letter. It has no human-approval port, and it does not itself distinguish `block`
from `terminate`. The rung semantics in ADR-006 — a human port, `block` as a
refusal a human may convert into a fallback, `terminate` as a stop nobody can lift
— are **this package's contribution**, implemented in `governor/carbon-governor.js`
and `governor/harness.js`. F3 and F4 test those.

Two more upstream facts, recorded so nobody has to go looking:

- The shipped gate passes an action string that is not on the ladder through verbatim rather than failing closed on it. This package normalises such a verdict to `block` in `gated()` (ADR-005, D3) and keeps the original under `rawAction`. The gap is upstream's to fix and is to be reported there.
- Upstream also ships `WorkflowOrchestrator` and `CheckpointStore` (Redis) for checkpoint-and-resume of workflow steps after a crash. That is crash recovery, not governance — but it is the natural place a production "pause and rehydrate" of a deferred task would live (ADR-016). Not used here.

## Alternatives considered

- **Mock the gate.** Faster and dependency-free, and worthless as evidence.
- **Vendor a copy of the gate source.** Removes the npm dependency but breaks the link to what actually ships, and invites silent drift.
