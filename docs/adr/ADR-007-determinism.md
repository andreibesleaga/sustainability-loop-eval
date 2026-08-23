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
- **Injected clock.** `governor/gate.js` gives the gate a clock that counts synthetic seconds from a fixed instant, so audit timestamps are reproducible. In `simulation/run.js` that clock is derived from the slot being simulated (`W.slotStarts[slot]`) rather than from a counter, so an audit timestamp says when in the simulated window the decision was taken.
- **Fixed windows.** The two simulation windows are fixed past dates: 2026-01-05 to 2026-02-02 and 2026-06-29 to 2026-07-27.
- **Cached traces.** `simulation/fetch-traces.js` is the only script that touches the grid API; everything downstream reads `data/simulation/`.
- **Fixed reference date.** The data-plane run computes freshness against 2026-08-21, not against "now".

Fitness function F8 checks that two fresh gates given the same 300-step estimate
sequence produce byte-identical decisions *and* byte-identical audit records.

## Consequences

- Re-running `npm run simulate` or `npm run charging` reproduces `results/*.json` byte for byte.
- **The one exception is the live data-plane measurement**, and it is worth stating precisely rather than as "latency will differ":
  - `fetchedAt` in `results/dataplane.json` and in the saved documents is a **real wall-clock read** — `new Date()` with no argument — and it is the only one in the package that lands in a result file. It has to be: it records when the live fetch actually happened, and a fixed date would be a lie about a live measurement.
  - Latency and body-size samples are live and move between runs.
  - Everything the run *concludes* — member presence, schema validity, disclaimer coverage, freshness — is computed against the fixed reference date `2026-08-21` and does not move, as long as the gateway's data is unchanged.
  - So the rule is not "no `Date.now()` anywhere". It is: **no wall-clock read may affect a conclusion.** Recording when a live measurement happened is not a conclusion. This is stated in `results/dataplane.md` and in `docs/DEVELOPMENT.md`.
- Any new script must accept a seed or a fixed date rather than reading the clock.

## Alternatives considered

- **Record fixtures of previous runs.** Reproducible, but hides the logic that produced them.
- **Report averages over unseeded runs.** Cheaper to write and impossible to check.
