# ADR-009 — Synthetic workload parameters live at the top of their file

- **Status:** Accepted
- **Date:** 2026-08-22

## Context

The workload is the weakest part of the evaluation and the easiest place to hide
a favourable assumption. A reader who cannot find the assumptions cannot judge
them, and a reader who has to grep for them will not.

## Decision

Every knob is a named constant at the top of the file that uses it, in one object,
and every one of those objects is copied verbatim into the results JSON:

- `WORKLOAD` in `simulation/lib.js` — Poisson arrivals with lambda 6 per 30-minute slot, 0.05 kWh per task, half of the tasks deferrable by up to six hours, degraded mode at 40% of the energy. Its `note` field begins with the word `SYNTHETIC`.
- `SEEDS` and `F_VALUES` in `simulation/run.js` — ten seeds; budget factors 0.6, 0.7, 0.8, 0.9, 1.0.
- `FLEET` in `simulation/charging.js` — 50 vehicles, 20 kWh each delivered evenly over three hours, plug-in 18:00 plus or minus an hour, deadline 07:00, nightly budget factor 0.8, approval rates 1.00 and 0.80.
- `DEFAULT_RUNGS` in `governor/carbon-governor.js` — the ladder rungs.

## Consequences

- Every stipulated number is visible in one place, and again in the shipped results, so a reader never has to trust a summary.
- Changing a parameter is a one-line edit, which makes sensitivity checks cheap. The budget factor sweep is exactly that: it is the honest dial between emissions and service, and the results show both ends of it.
- Nothing stops someone tuning a parameter to a nicer number. The defence is that the parameters are printed next to the results, not that they cannot be changed.

## Alternatives considered

- **A config file.** One more file to open, and it drifts from what the run actually used unless it is echoed into the results anyway.
- **Command-line flags.** Convenient, and they make a committed result impossible to reproduce without also committing the exact command line.
