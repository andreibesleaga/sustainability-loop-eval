# ADR-003 — The governor core imports nothing

- **Status:** Accepted
- **Date:** 2026-08-22

## Context

The article describes the governor as a hexagonal core: budget accounting and
verdict selection in the middle, and every concrete system — an HTTP client, a
charging protocol, an approval board — as an adapter behind one of four ports
(signal, forecast, human, actuation). Three of those four ports have an adapter in
this repository. The **forecast port is designed, not built**: the simulations read
the peer signal straight from the cached trace rather than through a forecast
adapter, so there is no file to point at for it.

"Hexagonal" is easy to write in prose and easy to lose in code. One accidental
import of a JSON client, and the core is no longer portable.

## Decision

`governor/carbon-governor.js` has zero import statements. It takes numbers in and
returns verdicts out. Everything else is an adapter:

- `carbonValidator()` — the signal port, in the same file, turning a decision into the shape the gate wants.
- `governor/gate.js` — the actuation port. It imports exactly two things besides a Node built-in: `kaiban-distributed` and the core (plus `node:crypto`, for the audit-anchor digest).
- `governor/harness.js` — the human port, and the only path in the package from a verdict to running something. It also imports nothing. It lives next to the core, in `governor/`, because it is part of the architecture rather than part of the test layer; it used to sit in `fitness/`, which read as though the guarantee were a property of the tests.
- The **forecast port** has no adapter. It is part of the design and is named as designed-not-built in `ARCHITECTURE.md` sections 4 and 11 and in the glossary.

Fitness function F7 checks this statically against the real import graph: both
files in `governor/` other than the gate adapter import nothing at all, the gate
adapter imports only those two specifiers and Node built-ins, and the `simulation/`, `dataplane/` and
`demo/` adapters do not import each other.

## Consequences

- The same core can govern a data-centre workload and a charging fleet without change — which the two simulations demonstrate.
- The claim is a test, not a sentence. It cannot rot silently.
- Convenience imports in the core are forbidden, so anything the core needs must be passed in as a number or a plain object.

## Alternatives considered

- **State the rule in a comment.** Comments do not fail a build.
- **A lint rule.** Would work, but adds a dependency, and would not read as evidence in a results table.
