# E2 — Carbon-Verdict Governor vs baselines

Real 30-minute UK grid-carbon traces (National Energy System Operator (NESO) Carbon Intensity API); synthetic workload.
Emissions are always computed from the **national ACTUAL** series; the **peer signal** is the mean of 3 peer systems' published **regional FORECAST** intensity (that endpoint has no actual). Scheduling never looks at the actual series.

Workload: Poisson(lambda=6) tasks per 30-min slot, 0.05 kWh each, 50% deferrable by up to 6 h, degraded mode = 40% energy. 10 seeds, mean ± sd.

## W1 (winter) 2026-01-05T00:00Z → 2026-02-02T00:00Z — 1344 slots over 28 days, 0 gaps carried forward

Peer-signal vs national-actual Pearson r = **0.96** (peer mean), 0.965 (peer max). Mean peer signal 126.8 vs national actual 152.9 gCO2e/kWh.

| policy | total gCO2e | % vs P0 | completed | dropped | degraded | deferred | mean delay of deferred work (min) | p95 delay of deferred work | human decisions | days over budget | audit valid |
|---|---|---|---|---|---|---|---|---|---|---|---|
| P0 | 61868 ± 524 | 0 ± 0 | 8075.1 ± 57.5 | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 | n/a | n/a |
| P1 | 60916 ± 522 | -1.54 ± 0.13 | 8075.1 ± 57.5 | 0 ± 0 | 0 ± 0 | 2028 ± 61 | 315.9 ± 1.4 | 360 ± 0 | 0 ± 0 | n/a | n/a |
| P1t | 61297 ± 510 | -0.92 ± 0.15 | 8075.1 ± 57.5 | 0 ± 0 | 0 ± 0 | 1951.6 ± 55.2 | 312.5 ± 2.7 | 360 ± 0 | 0 ± 0 | n/a | n/a |
| P2_f0.6 | 46264 ± 553 | -25.22 ± 0.68 | 7481.9 ± 73.7 | 593.2 ± 57.5 | 1491.7 ± 56.5 | 1340.4 ± 45.5 | 268.4 ± 4.4 | 360 ± 0 | 1212.6 ± 34.5 | 20.3 ± 0.82 of 28 | true |
| P2_f0.7 | 49492 ± 479 | -20 ± 0.55 | 7846.1 ± 71.4 | 229 ± 46.2 | 1401 ± 63.9 | 1290.7 ± 51.7 | 278.9 ± 5 | 360 ± 0 | 952.6 ± 66.8 | 17.8 ± 0.79 of 28 | true |
| P2_f0.8 | 51691 ± 517 | -16.45 ± 0.48 | 7996.6 ± 61.7 | 78.5 ± 30.1 | 1238.2 ± 48.5 | 1163.6 ± 58 | 286.1 ± 5.8 | 360 ± 0 | 545.7 ± 67.7 | 14 ± 0.67 of 28 | true |
| P2_f0.9 | 53587 ± 414 | -13.38 ± 0.42 | 8061.6 ± 59.5 | 13.5 ± 12.6 | 1047 ± 46.9 | 1004.6 ± 52.1 | 285.8 ± 4.5 | 360 ± 0 | 287.1 ± 45.4 | 9.2 ± 1.23 of 28 | true |
| P2_f1.0 | 55147 ± 420 | -10.86 ± 0.4 | 8075.1 ± 57.5 | 0 ± 0 | 846.2 ± 34.3 | 821.3 ± 53.9 | 282.8 ± 4.4 | 360 ± 0 | 137.7 ± 28.5 | 5.2 ± 0.63 of 28 | true |
| P2tiered_f0.8 | 51691 ± 517 | -16.45 ± 0.48 | 7996.6 ± 61.7 | 78.5 ± 30.1 | 1238.2 ± 48.5 | 1163.6 ± 58 | 286.1 ± 5.8 | 360 ± 0 | 442.9 ± 56.1 | 14 ± 0.67 of 28 | true |

Tasks per seed: 8075.1 ± 57.5. P1 threshold (28-day median peer signal, computed over the whole window — see ADR-010): 123.5 gCO2e/kWh. P1t uses a trailing 7-day median instead, so it never looks ahead.

Delay columns describe DEFERRED work only (tasks that ran later than they arrived); `completed` and on-time completion are equal by construction — BY CONSTRUCTION, not a finding: deadlines are clamped to the window (lib.js) and no policy ever runs a task after its deadline, so completedOnTime always equals tasksCompleted.

### Tiered governance (WP-14, f = 0.8)

One standing rule is active in the `P2tiered` arm: a `block` on DEFERRABLE work is authorised by the rule ("standing-rule:T1-auto-defer-blocked-deferrable" in the approval object), not a person. The physical outcome, the gate decision and the audit record are unchanged — emissions are identical to P2 by construction — and the only movement is who authorised what.

| tier | what it covers | decisions per window |
|---|---|---|
| T0 — automatic | `allow` and `degrade` rungs | (the rest of the workload) |
| T1 — standing rule, audited | `block` on deferrable work → auto-defer | 102.8 ± 17.2 |
| T2 — a person | escalations + `block` on non-deferrable work | 442.9 ± 56.1 |
| — absolute | `terminate`: no authoriser exists, rule or human | 78.5 ± 30.1 dropped |

Acceptance, in one sentence: **given the same workload and budget, when the standing rule authorises deferral of blocked deferrable work, then total emissions equal P2's exactly (51691 ± 517 vs 51691 ± 517 gCO2e) and human decisions fall from 545.7 ± 67.7 to 442.9 ± 56.1** — the number the untired run could only report as a sensitivity is now the measured behaviour of a mechanism.

### Where P2's saving comes from (WP-2 — exact attribution, f = 0.8)

Every task's contribution is split identically into drop (work never ran, priced at arrival), degrade (work made smaller, priced at arrival) and timing (what ran, moved to a different slot); the identity components ≡ P0 − P2 is enforced by a throw in the simulation, not assumed. Shares are per-seed, then mean ± sd.

| component | share of the saving |
|---|---|
| dropped work | 6.5 ± 2.4% |
| degraded work | 67.7 ± 2.2% |
| timing (deferral of what ran) | 25.8 ± 1% |

Total saving vs P0 at f = 0.8: 10177 ± 316 gCO2e.

### E2b — the horizon and objective sweep (WP-1)

P3 runs every deferrable task at the argmin of the peer signal inside its horizon — E3's objective applied to this workload — for regenerated workloads per cell (same seeds, same arrivals; only deadlines and deferrable flags change). Two comparisons per cell (e2Potential() exported by bounds.js — peer column = expectation of this policy; oracle column = the ceiling): the peer-column EXPECTATION is the calculus for this very policy, so agreement near 100% cross-validates simulation against calculus; the ORACLE column is the true ceiling (deciding on the truth), which no peer-deciding cell may beat beyond noise.

| horizon | deferrable | % vs P0 (seeded) | expectation (peer) | agreement | oracle ceiling | headroom to oracle (pp) | deferred | mean delay (min) |
|---:|---:|---|---:|---:|---:|---:|---|---|
| 6 h | 50% | -6.62 ± 0.16 | −6.58% | 100.6% | −7.29% | 0.67 | 3110.4 ± 74.1 | 234.2 ± 1.8 |
| 6 h | 100% | -13.2 ± 0.21 | −13.16% | 100.3% | −14.57% | 1.37 | 6206.3 ± 75.1 | 233.7 ± 1.3 |
| 12 h | 50% | -11.51 ± 0.23 | −11.38% | 101.1% | −12.26% | 0.75 | 3376.6 ± 67.8 | 434.5 ± 6 |
| 12 h | 100% | -22.89 ± 0.2 | −22.76% | 100.6% | −24.52% | 1.63 | 6729.4 ± 59.8 | 434.2 ± 4 |
| 24 h | 50% | -17.29 ± 0.33 | −17.14% | 100.9% | −18.09% | 0.8 | 3701.7 ± 68.2 | 774.2 ± 8.6 |
| 24 h | 100% | -34.39 ± 0.22 | −34.28% | 100.3% | −36.17% | 1.78 | 7365.7 ± 51.3 | 775.1 ± 3.3 |
| 48 h | 50% | -22.95 ± 0.42 | −22.86% | 100.4% | −24.03% | 1.08 | 3866.8 ± 65.4 | 1493.5 ± 11.6 |
| 48 h | 100% | -45.71 ± 0.27 | −45.73% | 100% | −48.06% | 2.35 | 7702.1 ± 60.1 | 1497.6 ± 5.7 |

Read against P1 above: at P1's own horizon and fraction (6 h, 50%), the argmin objective alone reaches -6.62 ± 0.16% — the objective, not the idea, was the bottleneck. The table tops out at -45.71 ± 0.27% (48 h, everything deferrable). Agreement sits within about a point of 100% in every cell — the seeded simulation and the analytic expectation are the same physics — and the headroom-to-oracle column prices what a perfect signal would add: little.

## W2 (summer) 2026-06-29T00:00Z → 2026-07-27T00:00Z — 1344 slots over 28 days, 0 gaps carried forward

Peer-signal vs national-actual Pearson r = **0.986** (peer mean), 0.958 (peer max). Mean peer signal 83.7 vs national actual 124.2 gCO2e/kWh.

| policy | total gCO2e | % vs P0 | completed | dropped | degraded | deferred | mean delay of deferred work (min) | p95 delay of deferred work | human decisions | days over budget | audit valid |
|---|---|---|---|---|---|---|---|---|---|---|---|
| P0 | 50045 ± 349 | 0 ± 0 | 8075.1 ± 57.5 | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 | n/a | n/a |
| P1 | 48559 ± 383 | -2.97 ± 0.24 | 8075.1 ± 57.5 | 0 ± 0 | 0 ± 0 | 2009 ± 50 | 298 ± 2.1 | 360 ± 0 | 0 ± 0 | n/a | n/a |
| P1t | 48914 ± 374 | -2.26 ± 0.19 | 8075.1 ± 57.5 | 0 ± 0 | 0 ± 0 | 1736.8 ± 42.1 | 299.3 ± 2.3 | 360 ± 0 | 0 ± 0 | n/a | n/a |
| P2_f0.6 | 33346 ± 571 | -33.37 ± 1.07 | 6994.7 ± 88.6 | 1080.4 ± 59.6 | 1478.9 ± 35.7 | 1066.7 ± 33.8 | 224.9 ± 4.1 | 360 ± 0 | 994.3 ± 33 | 19.2 ± 1.03 of 28 | true |
| P2_f0.7 | 36867 ± 604 | -26.33 ± 1.21 | 7402.4 ± 98 | 672.7 ± 79.3 | 1374.5 ± 22.5 | 950.3 ± 38.3 | 231.3 ± 5.1 | 360 ± 0 | 981.6 ± 48.4 | 17.3 ± 0.95 of 28 | true |
| P2_f0.8 | 39899 ± 651 | -20.27 ± 1.3 | 7698.8 ± 99.7 | 376.3 ± 76.1 | 1220.9 ± 30.8 | 816.9 ± 39 | 232.5 ± 5.7 | 360 ± 0 | 853 ± 52.4 | 14.4 ± 0.84 of 28 | true |
| P2_f0.9 | 42338 ± 512 | -15.4 ± 0.98 | 7864.9 ± 79.4 | 210.2 ± 47.7 | 997.9 ± 42.8 | 636.4 ± 47.8 | 234.5 ± 7 | 360 ± 0 | 648.2 ± 69.9 | 11.6 ± 0.97 of 28 | true |
| P2_f1.0 | 44180 ± 461 | -11.72 ± 0.83 | 7971.9 ± 73.3 | 103.2 ± 40.1 | 812.4 ± 36.1 | 499.4 ± 34.2 | 246.2 ± 8.7 | 360 ± 0 | 433.4 ± 70.7 | 9 ± 0.67 of 28 | true |
| P2tiered_f0.8 | 39899 ± 651 | -20.27 ± 1.3 | 7698.8 ± 99.7 | 376.3 ± 76.1 | 1220.9 ± 30.8 | 816.9 ± 39 | 232.5 ± 5.7 | 360 ± 0 | 637 ± 47.2 | 14.4 ± 0.84 of 28 | true |

Tasks per seed: 8075.1 ± 57.5. P1 threshold (28-day median peer signal, computed over the whole window — see ADR-010): 74.3 gCO2e/kWh. P1t uses a trailing 7-day median instead, so it never looks ahead.

Delay columns describe DEFERRED work only (tasks that ran later than they arrived); `completed` and on-time completion are equal by construction — BY CONSTRUCTION, not a finding: deadlines are clamped to the window (lib.js) and no policy ever runs a task after its deadline, so completedOnTime always equals tasksCompleted.

### Tiered governance (WP-14, f = 0.8)

One standing rule is active in the `P2tiered` arm: a `block` on DEFERRABLE work is authorised by the rule ("standing-rule:T1-auto-defer-blocked-deferrable" in the approval object), not a person. The physical outcome, the gate decision and the audit record are unchanged — emissions are identical to P2 by construction — and the only movement is who authorised what.

| tier | what it covers | decisions per window |
|---|---|---|
| T0 — automatic | `allow` and `degrade` rungs | (the rest of the workload) |
| T1 — standing rule, audited | `block` on deferrable work → auto-defer | 216 ± 19.2 |
| T2 — a person | escalations + `block` on non-deferrable work | 637 ± 47.2 |
| — absolute | `terminate`: no authoriser exists, rule or human | 376.3 ± 76.1 dropped |

Acceptance, in one sentence: **given the same workload and budget, when the standing rule authorises deferral of blocked deferrable work, then total emissions equal P2's exactly (39899 ± 651 vs 39899 ± 651 gCO2e) and human decisions fall from 853 ± 52.4 to 637 ± 47.2** — the number the untired run could only report as a sensitivity is now the measured behaviour of a mechanism.

### Where P2's saving comes from (WP-2 — exact attribution, f = 0.8)

Every task's contribution is split identically into drop (work never ran, priced at arrival), degrade (work made smaller, priced at arrival) and timing (what ran, moved to a different slot); the identity components ≡ P0 − P2 is enforced by a throw in the simulation, not assumed. Shares are per-seed, then mean ± sd.

| component | share of the saving |
|---|---|
| dropped work | 39.7 ± 4.6% |
| degraded work | 52.2 ± 4.4% |
| timing (deferral of what ran) | 8.2 ± 0.6% |

Total saving vs P0 at f = 0.8: 10146 ± 672 gCO2e.

### E2b — the horizon and objective sweep (WP-1)

P3 runs every deferrable task at the argmin of the peer signal inside its horizon — E3's objective applied to this workload — for regenerated workloads per cell (same seeds, same arrivals; only deadlines and deferrable flags change). Two comparisons per cell (e2Potential() exported by bounds.js — peer column = expectation of this policy; oracle column = the ceiling): the peer-column EXPECTATION is the calculus for this very policy, so agreement near 100% cross-validates simulation against calculus; the ORACLE column is the true ceiling (deciding on the truth), which no peer-deciding cell may beat beyond noise.

| horizon | deferrable | % vs P0 (seeded) | expectation (peer) | agreement | oracle ceiling | headroom to oracle (pp) | deferred | mean delay (min) |
|---:|---:|---|---:|---:|---:|---:|---|---|
| 6 h | 50% | -8.54 ± 0.22 | −8.44% | 101.2% | −9.05% | 0.51 | 3064.4 ± 41.2 | 255.6 ± 2.9 |
| 6 h | 100% | -16.93 ± 0.23 | −16.89% | 100.2% | −18.11% | 1.18 | 6099.1 ± 21.7 | 255.3 ± 1.9 |
| 12 h | 50% | -14.95 ± 0.41 | −14.89% | 100.4% | −15.51% | 0.56 | 3350.1 ± 45.4 | 465.7 ± 6.2 |
| 12 h | 100% | -29.68 ± 0.29 | −29.78% | 99.7% | −31.02% | 1.34 | 6676.9 ± 36.9 | 465.7 ± 3.6 |
| 24 h | 50% | -20.26 ± 0.48 | −20.18% | 100.4% | −20.86% | 0.6 | 3843.2 ± 50 | 774.3 ± 7.9 |
| 24 h | 100% | -40.28 ± 0.3 | −40.36% | 99.8% | −41.71% | 1.43 | 7658.9 ± 55.5 | 774.4 ± 5 |
| 48 h | 50% | -25.03 ± 0.58 | −24.94% | 100.4% | −25.61% | 0.58 | 3899.4 ± 50.4 | 1473.3 ± 15.4 |
| 48 h | 100% | -49.82 ± 0.33 | −49.88% | 99.9% | −51.22% | 1.4 | 7773.2 ± 58 | 1477.7 ± 13.2 |

Read against P1 above: at P1's own horizon and fraction (6 h, 50%), the argmin objective alone reaches -8.54 ± 0.22% — the objective, not the idea, was the bottleneck. The table tops out at -49.82 ± 0.33% (48 h, everything deferrable). Agreement sits within about a point of 100% in every cell — the seeded simulation and the analytic expectation are the same physics — and the headroom-to-oracle column prices what a perfect signal would add: little.

## What the numbers show

1. The peer signal tracks the national grid closely (Pearson r = 0.96 winter, 0.986 summer), so peers' self-published intensity is a usable proxy for deciding *when* to run — even though its absolute level is biased low (83.7 vs 124.2 gCO2e/kWh in summer, because one of the three peers sits in near-zero-carbon North Scotland).

2. Carbon-aware deferral alone (P1) is weak on these traces: -1.54% winter and -2.97% summer, at zero cost in completed work. Half the workload is non-deferrable, and a median threshold moves work to the first *acceptable* slot, not the cleanest one. P1's threshold is the median of the whole window, which a live scheduler could not know; the causal variant P1t, using a trailing 7-day median, gets -0.92% and -2.26%. The two are reported side by side so the reader can see what the lookahead was worth.

3. The governor (P2) cuts far more because it can also shrink the work: at f = 0.8 it reaches -16.45% (winter) and -20.27% (summer) versus always-run.

4. That reduction is not free. At f = 0.8, 1238.2 of ~8075 winter tasks run in degraded mode and 78.5 are dropped outright; the summer numbers are 1220.9 degraded and 376.3 dropped.

5. The budget factor f is the honest dial between emissions and service: from f = 1.0 to f = 0.6 the winter saving grows -10.86% → -25.22% while drops grow 0 → 593.2.

6. Even at f = 1.0 — a budget equal to the median day's uncontrolled emissions — the ladder still saves -10.86% (winter, 0 tasks dropped) and -11.72% (summer, 103.2 dropped), because the degrade rung fires at 80% of budget, well before the cap.

7. Governance has a human cost: at f = 0.8 the loop asks for 545.7 (winter) and 853 (summer) human decisions over 28 days — roughly 19 and 30 per day. That is every escalate and every block: the two rungs whose outcome only happens because a person authorised it. It is the number an operator has to budget staff for. Sensitivity: 102.8 (winter) and 216 (summer) of those were `block` verdicts on *deferrable* work, whose only physical outcome is a deferral — if deferring blocked work were automatic instead of approved, the count would be 442.9 and 637 (about 16 and 23 per day).

8. Deferred work is genuinely delayed: mean 286.1 min and p95 at the 360-min horizon cap. Every completed task still met its deadline — that is an invariant of the model, not a result: deadlines are clamped to the window and no policy runs anything past one.

9. Days over budget remain common (14 of 28 at f = 0.8, winter): the governor paces spend, it does not guarantee the cap. Three reasons, all visible in the code: deferred work commits into the following day; non-deferrable work is throttled but never fully stopped short of the terminate rung; and the estimate the gate sees is the peer signal, which is biased low against the national actual the run is charged at.

10. Every decision passed through the shipped kaiban-distributed ActionGate and its hash-chained audit log; the chain verified clean for all 10 seeds, every window, every f (8075 audited decisions per seed at f = 0.8, winter — one per task).

### Caveats

- **Real:** the carbon-intensity traces only. **Synthetic:** the workload, the task energy figure, the deferrable fraction, the degraded-mode cost, and the human approver (which always approves, deterministically).
- Regional series are **forecast-only** in this API, so the peer signal cannot be validated against a regional actual; only the national series has an actual.
- P2 is not a like-for-like comparison with P0/P1 on emissions alone: P2 does **less work**. Read total gCO2e together with completed / degraded / dropped.
- Each task is gated exactly once, on arrival. A deferred run is the execution of that already-audited decision, not a new ungated action; the budget is then charged with the actual grams emitted.
- `degrade`, `escalate` and `block` produce the same physical outcome here (defer if deferrable, otherwise run degraded). What differs is authority: the last two only happen because the simulated human approves them. `terminate` is the only rung that removes work.
- The budget is reset daily; a task deferred across midnight commits against the next day's budget. This is deliberate and is one reason days-over-budget is non-zero.
- Emissions are attributional (energy × grid intensity at run time). No embodied carbon, PUE, or hardware accounting.
