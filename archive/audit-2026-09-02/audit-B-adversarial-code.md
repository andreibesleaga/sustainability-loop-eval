# Audit B (adversarial code/test) — key findings 2026-09-02
Determinism verified (md5s stable ×2, results byte-identical). Append-only WP-12b exact. Registry 14 new entries all sound. Chaos harness genuine; 15/17 pins non-vacuous; both headlines accurate (consumer lib not installed → conformance would be null on re-run; understated).
F1 HIGH: WP-15 "survives real workload shape" unsupported — equal/skewed share controls give same answer (±0.01pp). True claim: saving invariant to decision granularity k∈{1,2,6,12} (≤0.07pp). Report equal-share control.
F2 HIGH: ~5.9× humans = k by construction (linear in k within 2% over 12×). Drop "measured support"/"does not survive". Register ratio as computed claim.
F3 HIGH: "nothing lost below terminate" vacuous — spill=-1 unreachable at committed params; terminateFired true in all 16 cells; loop.test 151-159 cannot fail. Fix: count drops by cause (droppedNoFeasibleSlot) + assert 0; soften ADR-019.
F4 MED: "differing only in grams" false — peak 1.33vs1.22/1.62vs1.31, oscillation differ; share+drops BIT-identical (stronger than claimed — say so).
F5 MED: energy-conservation identity tautological — call it "by construction; assertion guards future edits". Real check = token-sum vs provenance (keep).
F6 MED: no test that md == render(json); observed live drift. Fix: export renderers + identity test (loop + simulation).
F7 MED: subtask ordering load-bearing but unenforced — assert extract first/aggregate last/deps precede.
F8 MED: chaos.test 3 vacuous asserts: :374 (literal array — add source pin for filter), :286 delete, :474 delete/real payload.
F9 LOW: P2real table units — label "(subtasks)".
F10 LOW: capToday → terminatedToday rename.
F11 LOW: pacing ratio prices argmin slot not taken slot — one sentence in ADR-019.
Clean: same-budget exact (1875/1405), trace provenance fully consistent, CAP_RUNGS faithful, DISPROVEN AGAIN supported (+3.23/+6.67 wrong direction).
