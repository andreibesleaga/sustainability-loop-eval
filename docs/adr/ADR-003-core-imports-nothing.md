# ADR-003 — The governor core imports nothing

- **Status:** Accepted
- **Date:** 2026-08-22

## Context

The article describes the governor as a hexagonal core: budget accounting and
verdict selection in the middle, and every concrete system — an HTTP client, a
charging protocol, an approval board — as an adapter behind one of four ports
(signal, forecast, human, actuation).

"Hexagonal" is easy to write in prose and easy to lose in code. One accidental
import of a JSON client, and the core is no longer portable.

## Decision

`governor/carbon-governor.js` has zero import statements. It takes numbers in and
returns verdicts out. Everything else is an adapter:

- `carbonValidator()` — the signal port, in the same file, turning a decision into the shape the gate wants.
- `governor/gate.js` — the actuation port. It imports exactly two things: `kaiban-distributed` and the core.
- `fitness/harness.js` — the human port.

Fitness function F7 checks this statically against the real import graph: the core
imports nothing, the gate adapter imports only those two specifiers, and the
`simulation/` and `dataplane/` adapters do not import each other.

## Consequences

- The same core can govern a data-centre workload and a charging fleet without change — which the two simulations demonstrate.
- The claim is a test, not a sentence. It cannot rot silently.
- Convenience imports in the core are forbidden, so anything the core needs must be passed in as a number or a plain object.

## Alternatives considered

- **State the rule in a comment.** Comments do not fail a build.
- **A lint rule.** Would work, but adds a dependency, and would not read as evidence in a results table.
