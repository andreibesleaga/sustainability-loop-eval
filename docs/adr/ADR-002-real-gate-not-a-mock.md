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

## Alternatives considered

- **Mock the gate.** Faster and dependency-free, and worthless as evidence.
- **Vendor a copy of the gate source.** Removes the npm dependency but breaks the link to what actually ships, and invites silent drift.
