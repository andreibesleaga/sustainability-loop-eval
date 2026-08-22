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
- The cached trace files carry `provider`, `units` and the exact source URLs used to fetch each chunk.
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
