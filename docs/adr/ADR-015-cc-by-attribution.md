# ADR-015 — CC BY 4.0 attribution for the grid data

- **Status:** Accepted
- **Date:** 2026-08-22

## Context

Every emissions number in this package comes from the National Energy System
Operator's Carbon Intensity API for Great Britain. That data is published under
Creative Commons Attribution 4.0. The licence permits the use and requires the
attribution.

The package's code is MIT. The two are not the same thing and must not be blurred.

## Decision

State both licences, separately and in every place a reader might start:

- The repository README: code MIT; carbon-intensity data © National Energy System Operator, CC BY 4.0.
- The cached trace files carry `provider`, `units` and the exact source URLs used to fetch each chunk. The `provider` string is the operator's full name — **"National Energy System Operator (NESO) Carbon Intensity API"** — not an abbreviation, so an attribution copied out of a results file is complete on its own.
- Every simulation results JSON copies that provenance through, so a downstream reader of one file has the attribution too.
- The article cites the API as a reference.

Anything derived from these results carries the attribution forward.

## Consequences

- The attribution travels with the data rather than sitting only in a README a reader may never open.
- The source URLs are exact, so any figure can be traced back to the specific API call that produced it.
- A future contributor adding a different data source must check its licence and add its attribution the same way.

## Alternatives considered

- **One licence line for the whole repository.** Shorter, and wrong: the code licence does not cover the data.
- **Attribution in the README only.** Correct in letter, and easy to lose the moment a results file is copied elsewhere.

## Status note (2026-08-31, audit)

- The two sentences above that say the code is **MIT** describe v1.0.0. From v1.1.0 the
  code is **GPL-3.0-only** (`package.json`, `LICENSE`, `CITATION.cff`, `CHANGELOG.md`);
  the data remain CC BY 4.0 and the split this ADR insists on is unchanged. Left in place
  rather than rewritten, so the record shows what was decided when.
- **Units.** NESO publishes the intensity as **gCO2/kWh — CO2 from electricity generation
  only**, not a full CO2-equivalent. The cached traces and every result file label the
  series `gCO2e/kWh`, the unit name the well-known-URI draft uses for its
  `carbon-intensity-gCO2e-per-kWh` member, so that a peer document and a trace read
  alike. Read every gram in this package as CO2 from generation; the "e" slightly
  overstates the gas coverage. The label was left as is because changing it would
  rewrite the committed traces and results; the correction lives here, in
  `simulation/README.md` and in ADR-008.
