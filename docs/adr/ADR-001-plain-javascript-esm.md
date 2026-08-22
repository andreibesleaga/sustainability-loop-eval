# ADR-001 — Plain JavaScript ES modules, zero framework

- **Status:** Accepted
- **Date:** 2026-08-22

## Context

This package exists so that a reader can check the article's claims. Anything that
stands between the reader and the code — a build step, a type system to learn, a
test framework to install, a bundler — is a cost paid by every reader and a place
where a claim could hide.

The code is small: a governor core of under 70 lines, nine property files of about
15 lines each, and four scripts of 130 to 300 lines.

## Decision

Write everything in plain JavaScript ES modules (`"type": "module"`), targeting
Node 22 or newer. Use Node's built-in test runner (`node --test`) rather than an
external framework. Keep exactly one runtime dependency, and let it be the thing
under test. Keep each file to roughly 150 lines and one purpose.

## Consequences

- `git clone`, `npm install`, `node whatever.js`. No build, no watch, no config.
- The install graph is tiny, so the "one dependency" claim is checkable at a glance.
- No static types. The code compensates with small files, explicit checks at the boundaries (`Number.isFinite`), and properties that test the real behaviour.
- Readers used to TypeScript get less editor help. Accepted: the audience for this repository is reading, not extending it at scale.

## Alternatives considered

- **TypeScript.** Better editor support, but adds a compiler, a config, and a build output that is not the code the reader reviews.
- **Vitest or Jest.** More features than nine property assertions need, and another dependency in a package whose dependency count is itself part of the argument.
