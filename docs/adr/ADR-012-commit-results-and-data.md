# ADR-012 — Results and cached data are committed on purpose

- **Status:** Accepted
- **Date:** 2026-08-22

## Context

A replication package that only ships scripts asks every reader to run everything
before they can check anything. Worse, some inputs cannot be re-fetched
identically later: a live gateway changes, and a log retention window of about a
week closes behind you.

## Decision

Commit both the inputs and the outputs.

- `data/simulation/W1.json`, `W2.json` — the cached grid traces, with provenance.
- `data/dataplane/` — the fetched index, one saved response body per subject, and the raw request-log capture.
- `results/*.json` — the full machine-readable output of each run.
- `results/*.md` — a short plain reading of each, rendered by code, recomputing nothing.

Each result file states what is real, what is a reference implementation, and what
is synthetic, and carries the provenance of its inputs.

## Consequences

- A reader can check every number in the article without running a single script, and without a network connection.
- A reader who does run the scripts gets byte-identical JSON back for everything except the live measurement — which is itself a check on the determinism claim.
- The repository carries data files. This is accepted: they are small, and they are the evidence.
- Regeneration is manual and ordered. There is no single command that rebuilds everything and checks the Markdown against the JSON; that is recorded as debt in ARCHITECTURE.md section 11. *(Status 2026-08-31: closed in v1.1.0 — `npm run all` rebuilds everything and `npm run check:docs`, run as fitness function F12 inside `npm test`, checks the Markdown against the JSON. ARCHITECTURE.md section 11 lists it under "Fixed in v1.1.0".)*

## Alternatives considered

- **Ship scripts only.** Smaller repository, unverifiable claims.
- **Ship a database or an archive.** Harder to read in a browser and harder to diff in a review.
