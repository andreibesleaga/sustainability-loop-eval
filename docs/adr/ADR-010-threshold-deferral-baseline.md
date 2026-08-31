# ADR-010 — Threshold deferral is the simple baseline

- **Status:** Accepted
- **Date:** 2026-08-22

## Context

"The governor reduces emissions" is meaningless without something to compare
against. Two comparisons are needed: doing nothing, and doing the ordinary
carbon-aware thing that existing tools already do.

## Decision

Four policies (three, plus the P1t variant added in v1.1.0) replay the identical task list per seed, so any difference between
them is a policy difference and not sampling noise:

- **P0, always run.** Every task runs the moment it arrives. The zero line.
- **P1, threshold deferral.** The ordinary carbon-aware-scheduling baseline: defer deferrable work while the peer signal is above its own 28-day median; fall back to the deadline if it never gets clean enough.
- **P1t, threshold deferral without lookahead.** The same rule with a *trailing* 7-day median of the peer signal instead of the whole-window one. Reported as an extra row.
- **P2, the governor.** Every task is a gated action; the returned rung is executed.

**Disclosure about the threshold.** P1's threshold is the median of the peer
signal over the *entire* 28-day window. That is a small piece of lookahead: on day
one, P1 is using a number that depends on day twenty-eight. It is the standard way
this baseline is written up, and it flatters the baseline rather than the
governor, so it was left in place — but it is lookahead, and a reader should not
have to discover that by reading the code. P1t exists so the reader can see what
the baseline does with information it could actually have had. P2, the governor,
uses no lookahead at all: it reads only the current slot's signal and the
forward-looking forecast the peer signal itself publishes.

## Consequences

- The comparison is fair on inputs and explicitly *unfair* on output: P0 and P1 complete every task, P2 does not. Total grams must be read next to completed, degraded and dropped. Every result file says this.
- The baseline turns out weak on these traces — around 1.5% in winter and 3.0% in summer — and the reason is visible rather than hidden: half the workload cannot move, and a median threshold sends work to the first *acceptable* slot rather than the cleanest one.
- A weak baseline flatters the governor. Saying exactly why it is weak is the mitigation; a reader can judge whether a better baseline would close the gap.

## Alternatives considered

- **No baseline.** Any number would look impressive and mean nothing.
- **A perfect-foresight optimum.** A useful upper bound, but it needs the national actual in advance, which no agent has.
- **Dropping P1 in favour of P1t only.** P1 is the version other work reports, so removing it would make the comparison harder to place. Both are reported.
