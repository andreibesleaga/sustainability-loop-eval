# ADR-007 — Determinism by construction

- **Status:** Accepted
- **Date:** 2026-08-22

## Context

A governance decision that cannot be reproduced from the same inputs cannot be
replayed, reviewed after an incident, or trusted in a results table. A test that
sometimes fails teaches people to ignore failures.

## Decision

Nothing that affects a result may read the wall clock, call the network at run
time, or use unseeded randomness.

- **Seeded random numbers.** One mulberry32 generator in `shared/prng.js`, used by fitness and simulation. The simulations use ten fixed seeds: 101, 202, 303, 404, 505, 606, 707, 808, 909, 1010.
- **Injected clock.** `governor/gate.js` gives the gate a clock that counts synthetic seconds from a fixed instant, so audit timestamps are reproducible.
- **Fixed windows.** The two simulation windows are fixed past dates: 2026-01-05 to 2026-02-02 and 2026-06-29 to 2026-07-27.
- **Cached traces.** `simulation/fetch-traces.js` is the only script that touches the grid API; everything downstream reads `data/simulation/`.
- **Fixed reference date.** The data-plane run computes freshness against 2026-08-21, not against "now".

Fitness function F8 checks that two fresh gates given the same 300-step estimate
sequence produce byte-identical decisions *and* byte-identical audit records.

## Consequences

- Re-running `npm run simulate` or `npm run charging` reproduces `results/*.json` byte for byte.
- The one exception is the live data-plane measurement: latencies and the `fetchedAt` stamp change every run. Member presence, schema validity and freshness do not, as long as the gateway's data is unchanged. This is stated in `results/dataplane.md`.
- Any new script must accept a seed or a fixed date rather than reading the clock.

## Alternatives considered

- **Record fixtures of previous runs.** Reproducible, but hides the logic that produced them.
- **Report averages over unseeded runs.** Cheaper to write and impossible to check.
