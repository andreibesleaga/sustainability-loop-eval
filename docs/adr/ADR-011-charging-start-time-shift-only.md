# ADR-011 — The charging scenario shifts start times only

- **Status:** Accepted
- **Date:** 2026-08-22

## Context

The physical half of the loop is demand response: moving electrical demand in time.
The demand-shaping mechanism this layer would request from charging systems is the
subject of patent application WO2025172639A1 (priority February 2024, published
August 2025, assigned to Liikennevirta Oy), on which the author is a co-inventor.

This work is independent research. It represents no position of the assignee, and
its agents sit strictly *above* the mechanism: they decide whether and when demand
shaping is worth requesting. They do not implement it.

A charging simulation also has a plain safety dimension: nobody should wake up to
a car that did not charge.

## Decision

`simulation/charging.js` changes exactly one thing: the **start time** of a
full-length, full-energy charge, inside the driver's own plug-in window. The file
contains no vehicle-to-grid, no discharge, no state-of-charge logic, and no
charge-versus-discharge decision anywhere.

Every vehicle receives its full 20 kWh before its deadline in every arm of every
run. A gate refusal or a declined approval falls back to charging naively — never
to charging less, later than the deadline, or not at all.

## Consequences

- The scenario cannot become unsafe under a stricter budget. It can only become less effective. `results/charging.md` states this in its Notes.
- A refused verdict withholds the *optimisation*, not the electricity — which is what makes a tight budget acceptable here.
- The constraint is by construction, not by configuration: there is no flag that turns discharge on, because there is no discharge code.
- The savings are therefore a lower bound on what a richer mechanism could achieve. That is the intended trade.

## Alternatives considered

- **Model bidirectional charging.** Larger savings on paper, and outside the line this work draws around the patented mechanism.
- **Model partial charging.** Would let the simulation "save" carbon by delivering less energy, which is not a saving.

## Status note (2026-08-31, audit)

Measured on the committed traces: an *ungated* argmin-only shift avoids 32.85%
(winter) and 16.53% (summer) against the governed 32.51% and 16.04% — in this
scenario the gate can only reduce the saving, because `block`/`terminate` fall back
to naive charging and the other rungs all yield the same shift (limitation R13). The
saving is the scheduler's; what the gate adds here is the audit trail, the budget
pacing and the human port. Also: 4.44% (winter) and 2.34% (summer) of sessions end up
in a window that is dirtier on the national actual than charging at plug-in, because
the window is chosen on the peer forecast — the aggregate saving still held on every
seed.
