# ADR-006 — Escalation and block go to the human port; terminate is never overridable; the harness is the only actuation path

- **Status:** Accepted
- **Date:** 2026-08-22 (rewritten 2026-08-23; see CHANGELOG)

## Context

Rungs above `degrade` mean something only if the path from a verdict to running
something enforces them — and only if the three things a rung can mean are kept
apart. **Stopped, refused and paused are not the same.** The first version of this
ADR blurred them: it said "block on deferrable work simply defers, with no human
involved". That sentence was wrong. It is replaced.

## Decision

`governor/harness.js` is the single actuation path. Every adapter that runs
anything — `simulation/run.js`, `simulation/charging.js`, `demo/demo.js`,
`demo/agent.js` — calls its `execute(decision, task, approval)`. It imports
nothing, so no adapter can reach around it.

The core rule is three lines:

- `allow` and `degrade` run automatically.
- `escalate` and `block` run **only** with `approval.approved === true`.
- `terminate` **never** runs: `{ executed: false, reason: "terminate is not overridable" }`.

What each rung then means per adapter is one table, and it lives in one place:
[ARCHITECTURE section 8](../architecture/ARCHITECTURE.md#8-cross-cutting-concepts).
The README states it in plain words and `demo/meaning.js` prints it. Nothing
restates it a fourth time.

Two facts from that table are load-bearing elsewhere:

- **Human decisions = every `escalate` verdict + every `block` verdict** in E2. A blocked task never proceeds on its own; a human may authorise the fallback and nothing else. Because "block on deferrable work asks a human" is a choice and not a law, the run also reports `blocksDeferrable` and `humanDecisionsIfDeferralAutomatic`.
- **A deferred task is paused**: gated once on arrival, run later, never re-gated (ADR-016).

F4 checks the harness rule; F5 asserts `executed === (autoRun || approved)` and
that `terminate` never executed; F7 checks that every actuating adapter imports
the harness; `simulation/policies.test.js` checks that `terminate` refuses an
approved approval.

## Consequences

- Human approval sits where irreversibility begins, as a test rather than a convention.
- `block` and `terminate` stay different rungs. Without a human path, `block` would just be a slower `terminate`.
- The approvers in the simulations are simulated (R6).
- The runtime does not make these distinctions itself; the semantics are this package's (ADR-002).

## Alternatives considered

- **Route `terminate` to a human too.** Then it means the same as `block`.
- **Defer blocked deferrable work automatically.** Fewer approvals, and it quietly turns the fourth rung into the second for half the workload. Reported as a sensitivity number instead.
- **Let each call site honour the verdict.** That is the scattering one gate exists to prevent.

## Status note (2026-08-31, audit)

In E3 (`simulation/charging.js`) the *vehicle owner's* consent is the approval that
authorises an `escalate` verdict — a budget-pressure verdict whose natural authority
is the budget's operator. The two questions ("may the fleet exceed its pacing?" and
"may my car be shifted?") are answered by one coin. `block` and `terminate` are never
owner-approved there (they fall back to naive charging). This is a disclosed
simplification, kept because changing it would move the charging numbers the article
prints; the human port names no roles, and a role model (who may approve what, with
what latency) is designed, not built.
