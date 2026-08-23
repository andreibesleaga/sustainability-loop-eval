# ADR-017 — The reference consumer library is optional and resolved at run time

- **Status:** Accepted
- **Date:** 2026-08-23

## Context

`dataplane/measure.js` validates each document against the draft's schema using
the published `sustainability-wellknown-consumer` (npm 0.5.2, a real ajv
validation). It used to import that library by an absolute path on the author's
machine, so the run was not portable, and the failure looked like zero
conformance rather than a check that could not run.

Adding it to `dependencies` would break the one-dependency claim (ADR-002) for a
check only one of six commands needs.

## Decision

Resolve it at run time, and never silently score zero:

1. `SUSTAINABILITY_CONSUMER_URL` if set;
2. else the bare specifier `sustainability-wellknown-consumer` (`npm i --no-save sustainability-wellknown-consumer@0.5.2`);
3. else `null` — conformance is reported as **"not measured"**.

It stays out of `package.json`. It is the one named external import F7 allows in
an adapter; any other is a violation.

## Consequences

- `npm run dataplane` runs anywhere; without the library it measures everything else and says what it could not check.
- The committed `results/dataplane.json` is from a run where the library was present, so its 12/12 is real.
- The absolute path is gone from the committed provenance string.

## Alternatives considered

- **Make it a dependency.** Costs the one-dependency claim.
- **Vendor the schema.** Then the check tests our reading of the draft, not the published consumer.
