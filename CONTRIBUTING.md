# Contributing

> **At a glance.** The package is complete, verified and **parked** until the
> article is published. Contributions are welcome as issues and pull requests, but
> nothing merges automatically and nothing is on a schedule. What keeps the package
> honest is a short set of rules, all of them checked by `npm test`.

## Before you start

- Read [docs/OVERVIEW.md](docs/OVERVIEW.md) (the whole system in plain words) and
  [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) (how to run and extend it, and the
  coding rules).
- The article's snapshot is tag `v1.0.0`. It is never edited and never re-tagged.
  Everything since is additive, and every number that moved is named in the
  [CHANGELOG](CHANGELOG.md).
- Security problems go through [SECURITY.md](SECURITY.md), not the issue tracker.

## What a good contribution looks like

1. **A reproduction problem.** A result that does not regenerate byte for byte, a
   document number that does not match `results/`, a failing `npm test` on a
   supported Node line. These are the most valuable reports; use the issue template.
2. **A correction with evidence.** A statement in a document that is inaccurate,
   with the source that shows it.
3. **A new fitness function, feature scenario or experiment.** Follow the pattern in
   `fitness/props.js`, `features/` or `simulation/` and the rules below.

## The rules, checked by the suite

- **No new runtime dependency.** The one dependency is the artifact under test.
  Development tools are pinned exactly (`.npmrc` sets `save-exact`).
- **No wall clock in a conclusion, no unseeded randomness, no live network** outside
  the four commands allowed it (`fetch-traces`, `dataplane`, `demo`, `agent`).
- **Every hand-typed number in a document is bound to `results/`** in
  `tools/check-numbers.js`; every relative link must resolve (`tools/check-links.js`).
- **Results are regenerated, never edited.** If your change moves a number, say so
  in the CHANGELOG under "Which numbers changed and which did not".
- **Plain language.** Negative results are stated as "disproven" or "did not
  survive the test"; nothing is oversold and nothing is undersold.

Run `npm test`, then regenerate what you touched and confirm `git diff results/` is
empty (or intended). CI runs the same on Node 22 and 24 and byte-diffs `results/`.

## Licensing of contributions

- **Code** (`*.js`, `package.json`, `tools/`) is GPL-3.0-only. By submitting code you
  agree it is licensed under the same terms (inbound = outbound).
- **Documentation, text, diagrams and result write-ups** are © Andrei N. Besleaga,
  all rights reserved. By submitting a documentation change you grant the author a
  perpetual, irrevocable, worldwide, royalty-free licence to use, modify and
  redistribute it as part of this work under those terms.
- **Data** keeps its own licence (see `LICENSE`, notes after the GPL text, and
  [NOTICE](NOTICE)).

## Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md).
