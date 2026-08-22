# ADR-005 — Fail closed on bad input and on validator errors

- **Status:** Accepted
- **Date:** 2026-08-22

## Context

A governance gate that can be knocked into `allow` by an internal error is worse
than no gate, because it looks like protection. Two things can go wrong: a
validator throws, or a validator is handed something it cannot interpret — a
carbon estimate that is `NaN`, negative, missing, or a string.

## Decision

Both cases resolve to `block`.

- The governor returns `{ action: "block", ratio: NaN, reason: "invalid carbon estimate" }` when the estimate is not a finite number greater than or equal to zero. Its `verdictFor()` returns `block` for any ratio that is not a finite non-negative number.
- The gate catches a throwing validator and treats it as `block` rather than letting the exception escape or the action proceed.

There is exactly one legitimate bypass: a gate constructed with
`enabled: false` returns `allow`, consults no validator and records nothing. That
is a deployment-time, all-or-nothing switch, not a per-request escape hatch.

Fitness function F2 checks all three: 25 throwing-validator cases, 25 invalid
estimates, 25 disabled-gate cases.

## Consequences

- Nothing leaks through as `allow` because something upstream broke.
- The disabled switch is documented as honest rather than hidden. A reader can see that when governance is off, it is off completely — and that the audit log stays empty, so there is no illusion of a record.
- A bad estimate is loud rather than silent: the action is refused and the reason says why.

## Alternatives considered

- **Fail open on internal error.** Keeps the system running, and quietly removes the guarantee the gate exists to provide.
- **Throw on bad input.** Moves the decision to whoever catches the exception, which is exactly the scattering the single gate is meant to prevent.
