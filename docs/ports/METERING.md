# The metering port — contract

> **At a glance.** The contract that makes the verdict ladder mean something
> against a dishonest estimate: with a trusted meter, an under-declaring agent is
> bounded to one action of slack — a property proved by fitness function F13 and
> stated here where the port is defined.

The fifth of the six port contracts (ROADMAP §5, WP-5; closes limitation R15).
Modeled on `docs/ports/FORECAST.md`, the template the others follow. One page:
what the port promises, what it may assume, what it must never do, and how an
adapter proves conformance.

## Purpose

The gate decides on a number the acting agent supplies about *itself*: `decide()`
reads `payload.estimatedGramsCO2e`, a **self-declared estimate**, before the
action has run. Metering is what happens *after*: it reconciles that estimate
against the **actual** grams the action emitted, so the budget the next decision
is measured against is never the one the agent claimed. The port turns "trust the
agent's forecast of itself" into "trust the agent's forecast for exactly one
action, then correct it" — the only place in the architecture where the number
that gates a decision and the number that pays for it are allowed to differ.

## Interface

An adapter provides:

```js
{
  actualG,   // grams CO2e the action actually emitted, computed AFTER it ran —
             // never the value the acting agent declared before running it
}
```

- The reading is handed to the governor's own write side, `commit(actualG)`
  (`governor/carbon-governor.js`), which throws on a non-finite or negative value
  rather than absorbing a silent zero (ADR-005).
- There is no separate `metering.js` module in this package: the one reference
  call site is `simulation/run.js`'s `exec()`, which computes
  `energyKWh * W.actual[slot]` — energy at the actually-realised national
  intensity — and hands that straight to `gov.commit()`, never the
  `estimateG` that `decide()` saw. That inlined pair *is* the port's reference
  implementation today; "designed, not built" in `docs/LIMITATIONS.md` refers to
  there being no adapter *file*, not to the reconciliation being unproven — F13
  proves the property against exactly this call path.

## What the port may assume

- `decide()` never looks at the meter: it is a pure function of `spentG` and
  the declared `estimateG` (F11), so metering does not change what a decision
  looked like when it was made — only what the *next* decision is measured
  against.
- The reconciling call lands in `spentG` before the next `decide()` call touches
  the same budget. In `simulation/run.js`'s `runP2` this is structural, not
  timed: `gov.commit(exec(...))` runs synchronously inside the same `execute()`
  call that ran the action, before the loop reaches the next arrival.
- Today's reading is derived, not sensed: it comes from the committed national
  actual trace (`W.actual[slot]`), a trusted post-hoc record the simulation
  treats as ground truth — not a live physical meter (`docs/LIMITATIONS.md` R15:
  "the simulations take them from the trusted trace").

## What the port must never do

- **Never commit the declared estimate in place of a measured actual.** This is
  the failure mode F13's second arm demonstrates: charging `commit()` with the
  declared value (`gov.commit(0)` for a zero-declarer) lets every verdict stay
  `allow` while true emissions run past 1.25× the budget, undetected.
- **Never absorb a bad reading as a silent zero.** `commit(actualG)` throws on a
  non-finite or negative value (ADR-005) — a broken meter must fail loud, not
  fail permissive, because a silently-zeroed actual is indistinguishable from an
  honest zero-emission action.
- **Never defer reconciliation past the next gated decision on the same
  budget.** The one-action bound F13 proves depends on the actual landing in
  `spentG` before that next `decide()` call; a metering adapter that batches or
  delays its writes past that point widens the lag the guarantee promises.
- **Never present an unattested reading as verified.** No cryptographic
  attestation of a meter reading exists in this package yet (see below); an
  adapter must not claim otherwise.

## Conformance

An adapter passes if: (1) after an action executes, `spentG` reflects the same
energy-at-actual-intensity arithmetic `simulation/run.js`'s `exec()` computes
independently, never the `estimateG` the same action was gated on; (2)
`commit()` rejects a non-finite or negative reading rather than committing it;
(3) over a sequence of an honest and an under-declaring agent facing the same
true emissions, the liar's verdict at step *k* is never stricter than the
honest agent's at step *k*, and never laxer than the honest agent's verdict at
step *k*−1; (4) removing metering — committing the declared value instead of
the actual — demonstrably breaks that bound. `fitness/props.js`'s
`f13AdversarialEstimates()` is the reference proof for (3) and (4), over 1,000
and 500 random sequences respectively; `simulation/metering.test.js` is the
conformance suite exercising (1)–(3) against the real governor and `run.js`
code paths.

## The guarantee F13 proves

A strategic under-declaration is bounded to **one action**: because
reconciliation commits the actual grams to spent-actuals before the next gate
call touches the same budget, an under-declaring agent's verdict is never
lighter than an honest agent's would be at that same step, and never lags more
than one action behind the honest agent's own trajectory — the budget catches
up at the very next decision. Without metering — `commit()` charged with the
declared value instead — that bound disappears entirely: F13's second arm shows
a zero-declarer holding `allow` on every decision while true spend passes 1.25×
budget.

## What remains open

Limitation R15 (`docs/LIMITATIONS.md`): *"Estimates are self-declared, and no
trusted metering adapter exists — the validator reads the acting agent's own
`estimatedGramsCO2e`; an agent that under-declares is allowed, and monotonicity
(F11) is no defence against a strategically small number. The original four ports
named no metering port for the actual grams `commit()` needs — the simulations
take them from the trusted trace."* Two gaps follow directly: there is no adapter that
reads a real meter (this package's "actual" is a committed trace, trusted by
construction of the simulation, not measured live); and no cryptographic
attestation of a meter reading exists — the hooks for attestation live in the
publication document format, but, per R15's own fix column, no verifier has been
built. Until both exist, "trusted metering" describes what F13 proves is
*sufficient*, not what is *deployed*.
