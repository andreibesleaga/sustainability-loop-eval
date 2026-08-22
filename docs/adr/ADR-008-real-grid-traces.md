# ADR-008 — Real NESO traces: national actual for emissions, regional forecasts as peer stand-ins

- **Status:** Accepted
- **Date:** 2026-08-22

## Context

The simulations need two different things, and confusing them would quietly
inflate the results:

1. **Ground truth** — what a task actually emitted, for accounting.
2. **The signal an agent can see** — what peers publish about themselves, which is what the architecture says a decision is based on.

The National Energy System Operator's Carbon Intensity API is free, keyless, and
CC BY 4.0. It offers a **national** series with both a forecast and a measured
actual, and **regional** series that are forecast-only.

## Decision

- Every gram reported anywhere in this package is `energy in kWh × national actual intensity at the slot the work ran in`. Ground truth is always the national actual.
- The **peer signal** is the mean of three peer systems, modelled as services sited in three Great Britain regions — North Scotland (region 1), London (13), South Wales (8) — each publishing its own region's forecast intensity. The maximum of the three is reported once as a sensitivity check.
- Both windows are 28 days, 1344 half-hour slots each, aligned onto a canonical slot grid. Gaps are carried forward and counted; both windows carried forward zero gaps.
- The provenance — provider, source URLs, units, gap counts, series type — is copied into every results JSON.

## Consequences

- The gap between what an agent can see and what really happened is modelled honestly rather than assumed away.
- That gap is measurable, and it is measured. The peer signal tracks the national actual closely in shape (Pearson r 0.96 winter, 0.986 summer) but sits low in level, because one of the three regions is near-zero-carbon in summer. `results/simulation.md` reading 1 says so.
- The regional series is forecast-only, so the peer signal cannot be validated against a regional actual. Stated as a caveat in the results and in ARCHITECTURE.md section 11.
- The results are Great Britain only. Other grids would move the numbers.

## Alternatives considered

- **Use the national forecast as the peer signal.** Simpler, but it would model peers as reading the same central feed the architecture is trying to replace.
- **Use the national actual for both.** Would make the agent clairvoyant and every result optimistic.
- **Synthesise peer documents.** Loses the only real thing about the peer signal.
