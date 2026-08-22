# ADR-004 — A five-rung ladder driven by a pacing ratio, rungs 0.8 / 1.0 / 1.1 / 1.25

- **Status:** Accepted
- **Date:** 2026-08-22

## Context

The governor needs a decision vocabulary. A yes/no gate is too blunt: most
carbon-relevant actions have a middle option — run smaller, run later, ask
someone. And whatever the vocabulary is, concurrent policies must aggregate to a
single answer, which needs a total order.

The runtime already ships that vocabulary: `allow < degrade < escalate < block <
terminate`, with a numeric severity per rung.

## Decision

Adopt the runtime's five-rung ladder as the carbon policy vocabulary. Drive it
from one number: the **pacing ratio**, defined as

```
(grams already spent this period + this action's estimate) / period budget
```

Map the ratio onto the ladder at fixed default rungs: `degrade` at 0.8,
`escalate` at 1.0, `block` at 1.1, `terminate` at 1.25. The rungs are exported as
`DEFAULT_RUNGS` and can be overridden per governor instance.

Because `degrade` fires at 80% of the budget rather than at 100%, the governor
*paces* spending across the period instead of running freely and then stopping
dead.

## Consequences

- One number, read off four thresholds — a reviewer can verify the whole policy by reading nine lines.
- Pacing is visible in the results: even at a budget equal to the median uncontrolled day, the ladder still cuts emissions, because the degrade rung fires early (`results/simulation.md`, reading 6).
- Pacing is not capping. Days still end over budget, because deferred work commits into the next day. This is a design property, stated in `results/simulation.md` reading 9 and in ARCHITECTURE.md section 11.
- The rung values are a stipulated default, not a derived optimum. They are pinned exactly by fitness function F3 so a change is deliberate and visible.

## Alternatives considered

- **A hard cap at 1.0.** Simpler to explain, but it turns a budget into a cliff and gives no early, cheap response.
- **A continuous throttle.** Finer control, but no total order, so concurrent policies could not aggregate and the gate could not fail closed.
- **Three rungs.** Loses either the cheap early response (`degrade`) or the human step (`escalate`).
