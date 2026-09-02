# ADR-001 — Plain JavaScript ES modules, zero framework

- **Status:** Accepted
- **Date:** 2026-08-22

## Context

This package exists so that a reader can check the article's claims. Anything that
stands between the reader and the code — a build step, a type system to learn, a
test framework to install, a bundler — is a cost paid by every reader and a place
where a claim could hide.

The code is small: a governor core of 104 lines, one short property file per
fitness function, and a handful of experiment scripts.

## Decision

Write everything in plain JavaScript ES modules (`"type": "module"`), targeting
Node 22.9 or newer. Use Node's built-in test runner (`node --test`) rather than an
external framework. Keep exactly one runtime dependency, and let it be the thing
under test. Keep each file to one purpose.

On file size, state the rule as it is actually followed rather than as an
aspiration nothing enforces:

- **Roughly 150 lines is the target** for a source file. Past that, a file is usually doing two things.
- **A file over that target needs a written reason.** The accepted exceptions today, updated 2026-09-02 after the work-package sessions: `fitness/props.js` (every fitness property lives exactly once, and the test files and the report both call it — splitting it would duplicate the registry rather than the logic); the one-experiment-per-file rule — `simulation/run.js`, `simulation/charging.js`, `simulation/bounds.js`, `simulation/loop.js`, `simulation/plane.js`, `simulation/routing.js` (cutting an experiment in half hides the loop a reader came to read); `dataplane/measure.js` (one fetch-and-check pass, written out straight); `fitness/report.js` and `tools/check-numbers.js` (each IS a registry — splitting one duplicates it); `simulation/fetch-traces.js` and `demo/agent.js` (a whole capture/demonstration each, marginally over). Test files are exempt: a test registry reads top to bottom.
- Nothing else may cross it without being added to that list — and an earlier version of this list went stale while six experiment files crossed the line, which is exactly the drift this bullet exists to prevent; the audit that caught it is in the CHANGELOG.

The earlier wording said "roughly 150 lines is the ceiling" without listing the
files that were already above it. That was a rule the repository did not keep.

## Consequences

- `git clone`, `npm install`, `node whatever.js`. No build, no watch, no config.
- The install graph is tiny, so the "one dependency" claim is checkable at a glance.
- No static types. The code compensates with small files, explicit checks at the boundaries (`Number.isFinite`), and properties that test the real behaviour.
- The size rule is now checkable by reading it: either a file is under the target, or it is on the list above with a reason.
- Readers used to TypeScript get less editor help. Accepted: the audience for this repository is reading, not extending it at scale.

## Alternatives considered

- **TypeScript.** Better editor support, but adds a compiler, a config, and a build output that is not the code the reader reviews.
- **Vitest or Jest.** More features than a dozen property assertions need, and another dependency in a package whose dependency count is itself part of the argument.
- **A hard line-count lint rule.** It would either fail on the four files above, or be configured to ignore them — which is the list above, with the reasons deleted.
