# What the 2026-09-02 three-lens audit found, and what was done about it

Three independent read-only audits ran over the finished package (every work
package delivered): **A** — documentation consistency and alignment; **B** —
adversarial review of the code, tests and registry; **C** — alignment with the
submitted article and scenario coverage. Their condensed reports sit beside this
file. Every finding was either fixed or explicitly accepted; nothing was ignored.

## The verdicts, in one paragraph each

- **A:** the evidence layer (results tables vs their JSON, 231/231 links, the
  188-claim registry) was in excellent shape; the narrative layer had drifted in
  ~18 places where pre-delivery prose survived beside post-delivery prose.
- **B:** determinism, append-only discipline, the trace's provenance and the new
  registry entries all verified exactly; the WP-15 *interpretation* overclaimed
  (an equal-share control gives the same carbon answer, and the ~6× human-decision
  figure is k-by-construction), one WP-12b property test was vacuous, and three
  chaos-test assertions could not fail.
- **C:** every v1.0.0 headline number still reproduces byte-identically and every
  divergence bar two small ones was recorded; the one genuine overstatement was
  the surviving "capacity semantics is the anti-herd lever" claim that WP-12b's
  own measurement had withdrawn.

## The fixes (all applied 2026-09-02, verified by the full suite afterwards)

1. **The anti-herd story is now consistent everywhere**: both conjectures (budget
   depletion, capacity rungs) are stated as tested and disproven — in the loop
   renderer and regenerated `results/loop.md`, ROADMAP §0/§2h.2/§5, the executive
   case, the overview and the README (whose "allocation role is load-bearing"
   sentence was replaced with the tested-twice truth).
2. **WP-15 reframed to what it measures**: an equal-share control arm
   (`P2equal6_f0.8`) now runs and is printed beside the real one; the claim is
   granularity-invariance, the ~6× decision cost is stated as mechanics, and the
   tests pin the new wording (including that the old overclaim may not return).
3. **Vacuous tests made falsifiable**: WP-12b drops are now counted by cause
   (`droppedNoFeasibleSlot`, asserted zero everywhere); three chaos assertions
   were replaced with source-pinned or genuinely hostile versions; and two new
   identity tests prove `results/{loop,simulation}.md` are byte-equal to
   rendering their own JSON, so generator drift can never hide again.
4. **Stale labels corrected across ten documents**: the forecast port is built
   (WP-3), the metering contract exists (WP-5), the publication port is tested,
   six ports not four, thirteen fitness functions not twelve, nineteen ADRs,
   ROADMAP §4's six gaps carry CLOSED lines, §6's effort table matches §5's
   delivery rows, C-rows carry statuses, LIMITATIONS R1/R11/R12 record the work
   that addressed them (heading now R1 to R18), and the 150-line rule's exception
   list matches reality again (ADR-001).
5. **The accounting reconciles**: the CHANGELOG's fitness chain now closes
   arithmetically (13,366 + 1,500 F13 + 155 F12 growth + 16 F7 growth = 15,037)
   and the CHANGELOG itself is inside the registry net, along with the audit
   pass's new RESEARCH.md numbers — 188 claims across 15 documents.
6. **Structural guards added**: the CI byte-diff gate now covers all eight result
   sets (bounds, routing, loop, plane included — drift there had actually
   happened, invisibly); `FORECAST.md` gained the staleness clause the runbook
   had promised; the WP-15 trace loader enforces the dependency order it relies
   on; ADR-019 states the estimate-priced pacing convention and the dead spill
   branch honestly.
7. **Two article divergences recorded** in RESEARCH.md's corrections: the core
   grew from "under 70 lines" at the tag to 104 (57 of code), and the "13%"
   charging floor is now printed as 12.8% — a re-rounding, not a re-run.

## Accepted as-is (with reasons)

- The `charging.json` 3288.2 vs `bounds/routing` 3288.4 naive-arm difference:
  seeded simulation vs analytic calculus, each correctly labelled at source.
- `features/human.feature`'s decision-identity scenario mirrors a by-construction
  identity; kept because the surrounding scenarios carry the real property, and
  the identity is labelled as such in `run.js`.
- The actuation feature's full-charge assertion is by-construction (there is no
  partial-charge code path); the feature file, `results/charging.md` and ADR-011
  all say "by construction". A delivered-kWh meter remains future hardening.

Final verified state after all fixes: **89 unit tests / 13 fitness functions over
15,037 cases / 188 registered claims across 15 documents — all green; all eight
result sets byte-identical on regeneration.**
