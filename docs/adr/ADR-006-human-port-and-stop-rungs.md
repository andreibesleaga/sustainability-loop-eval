# ADR-006 — Escalation goes to the human port; block and terminate stop the action

- **Status:** Accepted
- **Date:** 2026-08-22

## Context

The point of having rungs above `degrade` is that a person is involved where the
consequences are serious or irreversible. That only means something if the code
path from a verdict to actually running something enforces it.

## Decision

`fitness/harness.js` is the single actuation path in this package, and it is about
twenty lines:

- `allow` and `degrade` run automatically.
- Anything above them runs only if an approval object is present and its `approved` field is exactly `true`.

On top of that floor, the policies decide who is asked:

- **Workload simulation (`simulation/run.js`).** `escalate` asks a human. `block` on non-deferrable work asks a human, who may authorise a degraded run; `block` on deferrable work simply defers, with no human involved. `terminate` drops the task, and no human is asked.
- **Charging simulation (`simulation/charging.js`).** `allow`, `degrade` and `escalate` ask the owner's approval for the shift. `block` and `terminate` refuse the shift outright, with no human asked, and the vehicle charges as it otherwise would.

So `terminate` never routes to a human anywhere in this package, and `block`
routes to one only in the workload simulation, where the alternative would be
dropping work that has no later slot.

Fitness function F4 checks the harness rule over 2,000 random decisions.

## Consequences

- Human approval sits exactly where irreversibility begins, and the rule is a test rather than a convention.
- The number of human decisions is a reported metric, not an afterthought — `results/simulation.md` reading 7 gives it per day, because it is a staffing cost.
- The approvers in the simulations are simulated. Real human latency, friction and fatigue are untested. This is stated in every result file and in ARCHITECTURE.md section 11.

## Alternatives considered

- **Route `terminate` to a human too.** Makes `terminate` mean the same as `block`, which removes the top rung's meaning.
- **Let the caller decide whether to honour a verdict.** Puts the guarantee back into every call site, which is what one gate exists to avoid.
