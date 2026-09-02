# ADR-019 — A rung may act on capacity, not only on run / defer / refuse

- **Status:** Accepted
- **Date:** 2026-09-02

## Context

WP-12 ran three anti-herd mechanisms head to head in E5 (`results/loop.md`) and
disproved this repository's own conjecture that "a paced budget is a staggering
mechanism". A binding budget with skip-k rungs **sheds** (6.55–11.31% of work dropped in winter, 13.99–20.89% in summer,
top-5%-slot share *rises*); the same budget with the gate's true defer semantics
**reshuffles** inside the same cheap band (~41%); the SI 2021/1467-intent stagger arm
is **inert** at slot resolution. What bounded the herd in every row was not a rung at
all — it was the per-system slot cap, a static model parameter.

That pointed at a gap in the ladder's vocabulary. ADR-004 gives four thresholds on one
pacing ratio, but says nothing about what a rung *does*: the implementations all read
`degrade` as "run smaller", `block` as "defer or refuse". Nothing in the ladder makes a
rung able to say **"run no wider"** — which is the one thing measured to matter, and is
what CarbonFlex enforces as a cluster capacity limit with no governance meaning
attached.

## Decision

A rung may act on **capacity**: the concurrency a system is permitted, not only whether
an individual action runs, waits or is refused. The same pacing ratio drives the same
four thresholds; only the verdict's effect changes. The mapping, implemented as the
`capacity` arm of `simulation/loop.js`:

| ratio | rung | effect on the per-slot cap |
|---|---|---|
| < 0.8 | allow | full cap |
| ≥ 0.8 | degrade | cap **halved** |
| ≥ 1.0 | escalate | cap **quartered** |
| ≥ 1.1 | block | cap = **1 unit per slot** |
| ≥ 1.25 | terminate | cap = **0 for the rest of the period** |

Work that no longer fits its preferred slot **spills** to the next cheapest feasible
slot. Below `terminate` nothing is lost at the committed parameters, and the tests
now prove it by CAUSE (the spill counter `droppedNoFeasibleSlot` is asserted zero in
every cell) rather than by implication; the spill-fails branch exists in the code but
is structurally unreachable while a day's units (24) cannot fill its slots (48) at a
minimum cap of 1 — stated so no one mistakes dead code for a measured property. The
first four rungs narrow a system, they do
not refuse its work. Only `terminate` may drop it, and the arm records `terminateFired`
per cell so that property is assertable rather than asserted.

## Consequences

- **The pacing ratio is an estimate, priced at the argmin slot** — exactly as E2's
  gate decides on an estimate and commits actuals: when a narrowed cap spills a unit
  to a costlier slot, the ratio the NEXT decision reads was computed from the argmin
  price, and the spilled cost is committed after. Both arms share this convention,
  so the head-to-head stays fair.

- **The ladder stays five-rung and stays totally ordered.** Capacity is a second
  *effect* of the existing verdicts, not a sixth rung and not a second axis; concurrent
  policies still aggregate to one answer (ADR-004), and `terminate` stays absolute
  (ADR-006).
- **Spill is the new semantics to get right.** A narrowed system must have somewhere to
  put displaced work; with a deadline and no feasible slot left, the unit drops, which
  is the same "deadline passed" case E2 already reports. In E5 that case never arose
  below `terminate`.
- **At `slotCap` = 4 the escalate and block rungs coincide** at one unit per slot. That
  collapse is a property of the cap's size, not a modelling choice, and it is stated
  rather than papered over with a fifth invented value.
- **The measured outcome is negative — disproven again** (`results/loop.md`, WP-12b).
  At the blind-herd corner the top-5%-slot share went 33.33% → **36.56%** (W1) and
  33.33% → **40%** (W2): up, not down. Across all eight corners the change against the
  matching plane cell ran −0.68 to +3.23 pt (W1) and −1.47 to +6.67 pt (W2), and peak
  concurrency ratio rose 1 → 1.33 and 1 → 1.62. At that corner the capacity arm lands on
  *exactly* the skip-k budget arm's share and drop rate — bit-identical before rounding, which is stronger than the rounded tables suggest — differing in grams paid and in peak concentration (1.33 vs 1.22 winter, 1.62 vs 1.31 summer).
  **So this ADR records new rung semantics that work as designed and do not deliver the
  effect they were designed for.** The corrected §2h.2 claim — "the gate's anti-herd
  lever is capacity semantics, not budget depletion" — is **not** established by this
  model either, and the package claims no anti-herd property for the gate.
- **What the fitness functions do not yet check.** F3 pins the four rung *values*;
  nothing pins the rung → *effect* mapping, nothing asserts the spill rule, and nothing
  asserts "no loss below terminate" outside `simulation/loop.test.js`. The shipped
  governor still emits run/defer/refuse verdicts only: capacity is measured in E5 and
  **not implemented in the gate**. Any adopter reading this ADR as a shipped feature
  would be wrong.
- **What would have to change for the anti-herd claim to survive.** Every system here is
  identical, so narrowing all of them narrows none of them relative to the others. A
  mechanism that spreads a crowd has to make different actors choose *differently* —
  heterogeneous caps, per-actor phase, or an allocator that can see the crowd. None is
  measured, so none is claimed.

## Alternatives considered

- **A sixth rung ("throttle").** Breaks ADR-004's total order and the runtime's own
  vocabulary for one effect that the existing rungs can carry.
- **Capacity as a separate, parallel policy.** Two ladders, two audit records, and the
  aggregation question re-opened — exactly what ADR-004 exists to avoid.
- **Leaving the ladder alone after WP-12.** Tempting, but it would leave the disproven
  conjecture with no successor to test; a negative result about a mechanism nobody built
  is weaker than a negative result about one that exists and was measured.
