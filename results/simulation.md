# E2 — Carbon-Verdict Governor vs baselines

Real 30-minute UK grid-carbon traces (UK National Grid ESO Carbon Intensity API); synthetic workload.
Emissions are always computed from the **national ACTUAL** series; the **peer signal** is the mean of 3 peer systems' published **regional FORECAST** intensity (that endpoint has no actual). Scheduling never looks at the actual series.

Workload: Poisson(lambda=6) tasks per 30-min slot, 0.05 kWh each, 50% deferrable by up to 6 h, degraded mode = 40% energy. 10 seeds, mean ± sd.

## W1 (winter) 2026-01-05T00:00Z → 2026-02-02T00:00Z — 1344 slots over 28 days, 0 gaps carried forward

Peer-signal vs national-actual Pearson r = **0.96** (peer mean), 0.965 (peer max). Mean peer signal 126.8 vs national actual 152.9 gCO2e/kWh.

| policy | total gCO2e | % vs P0 | completed | dropped | degraded | deferred | mean delay (min) | p95 delay | human decisions | days over budget | audit valid |
|---|---|---|---|---|---|---|---|---|---|---|---|
| P0 | 61868 ± 524 | 0 ± 0 | 8075.1 ± 57.5 | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 | n/a | n/a |
| P1 | 60916 ± 522 | -1.54 ± 0.13 | 8075.1 ± 57.5 | 0 ± 0 | 0 ± 0 | 2028 ± 61 | 315.9 ± 1.4 | 360 ± 0 | 0 ± 0 | n/a | n/a |
| P2_f0.6 | 46264 ± 553 | -25.22 ± 0.68 | 7481.9 ± 73.7 | 593.2 ± 57.5 | 1491.7 ± 56.5 | 1340.4 ± 45.5 | 268.4 ± 4.4 | 360 ± 0 | 1212.6 ± 34.5 | 20.3 ± 0.82 of 28 | true |
| P2_f0.7 | 49492 ± 479 | -20 ± 0.55 | 7846.1 ± 71.4 | 229 ± 46.2 | 1401 ± 63.9 | 1290.7 ± 51.7 | 278.9 ± 5 | 360 ± 0 | 952.6 ± 66.8 | 17.8 ± 0.79 of 28 | true |
| P2_f0.8 | 51691 ± 517 | -16.45 ± 0.48 | 7996.6 ± 61.7 | 78.5 ± 30.1 | 1238.2 ± 48.5 | 1163.6 ± 58 | 286.1 ± 5.8 | 360 ± 0 | 545.7 ± 67.7 | 14 ± 0.67 of 28 | true |
| P2_f0.9 | 53587 ± 414 | -13.38 ± 0.42 | 8061.6 ± 59.5 | 13.5 ± 12.6 | 1047 ± 46.9 | 1004.6 ± 52.1 | 285.8 ± 4.5 | 360 ± 0 | 287.1 ± 45.4 | 9.2 ± 1.23 of 28 | true |
| P2_f1.0 | 55147 ± 420 | -10.86 ± 0.4 | 8075.1 ± 57.5 | 0 ± 0 | 846.2 ± 34.3 | 821.3 ± 53.9 | 282.8 ± 4.4 | 360 ± 0 | 137.7 ± 28.5 | 5.2 ± 0.63 of 28 | true |

Tasks per seed: 8075.1 ± 57.5. P1 threshold (28-day median peer signal): 123.5 gCO2e/kWh.

## W2 (summer) 2026-06-29T00:00Z → 2026-07-27T00:00Z — 1344 slots over 28 days, 0 gaps carried forward

Peer-signal vs national-actual Pearson r = **0.986** (peer mean), 0.958 (peer max). Mean peer signal 83.7 vs national actual 124.2 gCO2e/kWh.

| policy | total gCO2e | % vs P0 | completed | dropped | degraded | deferred | mean delay (min) | p95 delay | human decisions | days over budget | audit valid |
|---|---|---|---|---|---|---|---|---|---|---|---|
| P0 | 50045 ± 349 | 0 ± 0 | 8075.1 ± 57.5 | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 | 0 ± 0 | n/a | n/a |
| P1 | 48559 ± 383 | -2.97 ± 0.24 | 8075.1 ± 57.5 | 0 ± 0 | 0 ± 0 | 2009 ± 50 | 298 ± 2.1 | 360 ± 0 | 0 ± 0 | n/a | n/a |
| P2_f0.6 | 33346 ± 571 | -33.37 ± 1.07 | 6994.7 ± 88.6 | 1080.4 ± 59.6 | 1478.9 ± 35.7 | 1066.7 ± 33.8 | 224.9 ± 4.1 | 360 ± 0 | 994.3 ± 33 | 19.2 ± 1.03 of 28 | true |
| P2_f0.7 | 36867 ± 604 | -26.33 ± 1.21 | 7402.4 ± 98 | 672.7 ± 79.3 | 1374.5 ± 22.5 | 950.3 ± 38.3 | 231.3 ± 5.1 | 360 ± 0 | 981.6 ± 48.4 | 17.3 ± 0.95 of 28 | true |
| P2_f0.8 | 39899 ± 651 | -20.27 ± 1.3 | 7698.8 ± 99.7 | 376.3 ± 76.1 | 1220.9 ± 30.8 | 816.9 ± 39 | 232.5 ± 5.7 | 360 ± 0 | 853 ± 52.4 | 14.4 ± 0.84 of 28 | true |
| P2_f0.9 | 42338 ± 512 | -15.4 ± 0.98 | 7864.9 ± 79.4 | 210.2 ± 47.7 | 997.9 ± 42.8 | 636.4 ± 47.8 | 234.5 ± 7 | 360 ± 0 | 648.2 ± 69.9 | 11.6 ± 0.97 of 28 | true |
| P2_f1.0 | 44180 ± 461 | -11.72 ± 0.83 | 7971.9 ± 73.3 | 103.2 ± 40.1 | 812.4 ± 36.1 | 499.4 ± 34.2 | 246.2 ± 8.7 | 360 ± 0 | 433.4 ± 70.7 | 9 ± 0.67 of 28 | true |

Tasks per seed: 8075.1 ± 57.5. P1 threshold (28-day median peer signal): 74.3 gCO2e/kWh.

## What the numbers show

1. The peer signal tracks the national grid closely (Pearson r = 0.96 winter, 0.986 summer), so peers' self-published intensity is a usable proxy for deciding *when* to run — even though its absolute level is biased low (83.7 vs 124.2 gCO2e/kWh in summer, because one of the three peers sits in near-zero-carbon North Scotland).

2. Carbon-aware deferral alone (P1) is weak on these traces: -1.54% winter and -2.97% summer, at zero cost in completed work. Half the workload is non-deferrable, and a median threshold moves work to the first *acceptable* slot, not the cleanest one.

3. The governor (P2) cuts far more because it can also shrink the work: at f = 0.8 it reaches -16.45% (winter) and -20.27% (summer) versus always-run.

4. That reduction is not free. At f = 0.8, 1238.2 of ~8075 winter tasks run in degraded mode and 78.5 are dropped outright; the summer numbers are 1220.9 degraded and 376.3 dropped.

5. The budget factor f is the honest dial between emissions and service: from f = 1.0 to f = 0.6 the winter saving grows -10.86% → -25.22% while drops grow 0 → 593.2.

6. Even at f = 1.0 — a budget equal to the median day's uncontrolled emissions — the ladder still saves -10.86% (winter, 0 tasks dropped) and -11.72% (summer, 103.2 dropped), because the degrade rung fires at 80% of budget, well before the cap.

7. Governance has a human cost: at f = 0.8 the loop asks for 545.7 (winter) and 853 (summer) human decisions over 28 days — roughly 19 and 30 per day. That is every escalate and every block: the two rungs whose outcome only happens because a person authorised it. It is the number an operator has to budget staff for.

8. Deferred work is genuinely delayed: mean 286.1 min and p95 at the 360-min horizon cap. Every completed task still met its deadline, because deadlines are hard by construction.

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
