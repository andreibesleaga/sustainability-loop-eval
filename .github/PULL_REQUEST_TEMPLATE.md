## What this changes

<!-- One paragraph. Which file, which behaviour, why. -->

## Checklist (the package is parked — see CONTRIBUTING.md)

- [ ] `npm test` is green locally (unit tests, thirteen fitness functions, feature specs, number registry, link check)
- [ ] I regenerated the experiments I touched and `git diff results/` is empty, **or** this PR intentionally changes a result and the CHANGELOG says which numbers moved and why
- [ ] No new runtime dependency (docs/DEVELOPMENT.md, coding rule 2); anything added is pinned exactly
- [ ] No wall clock, no unseeded randomness, no live network outside the four commands that are allowed it
- [ ] Every new hand-typed number in a document is bound to `results/` in `tools/check-numbers.js`
- [ ] Code under GPL-3.0-only; documentation contributions per CONTRIBUTING.md
