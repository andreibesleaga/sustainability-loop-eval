# E3 — Gated EV-charging shift

Real 30-minute UK grid-carbon traces; synthetic fleet of 50 EVs (20 kWh each, 3 h charge, plug in 18:00 ± 1 h, full by 07:00).
The agent proposes the cleanest 3-hour window it can see in the **peer signal**; emissions are scored on the **national ACTUAL** series. Sessions are decided in plug-in order, so the nightly budget is paced chronologically.

**Safety constraint (by construction):** start-time shifting only — no vehicle-to-grid, no discharge, no state-of-charge logic. Every vehicle receives its full charge before its deadline in every arm, including when the gate refuses or the human declines.

## W1 (winter) 2026-01-05T00:00Z → 2026-02-02T00:00Z — 27 nights x 50 EVs = 1350 sessions

| arm | total gCO2e | gCO2e / session | % avoided vs naive | sessions shifted | approvals requested | approvals granted | gate refused shift | mean shift (h) | nights over budget | audit valid |
|---|---|---|---|---|---|---|---|---|---|---|
| naive (charge on plug-in) | 4439083 ± 8175 | 3288.2 ± 6.1 | — | 0 | 0 | 0 | 0 | 0 | n/a | n/a |
| governed, approval rate 1.00 | 2995957 ± 194 | 2219.2 ± 0.1 | **32.51 ± 0.13** | 1299 ± 0 | 1299 ± 0 | 1299 ± 0 | 51 ± 0 | 6.39 ± 0.03 | 7 ± 0 of 27 | true |
| governed, approval rate 0.80 | 3287987 ± 17304 | 2435.5 ± 12.8 | **25.93 ± 0.34** | 1034.9 ± 10 | 1287.8 ± 1.2 | 1034.9 ± 10 | 62.2 ± 1.2 | 6.4 ± 0.04 | 9.8 ± 0.63 of 27 | true |

Gate verdicts at approval rate 1.00 (nightly budget 137467 ± 229 gCO2e = 0.8 x median naive night): allow 1183, degrade 90.2, escalate 25.8, block 23.6, terminate 27.4 — 1350 ± 0 audited decisions per seed, one per session.

## W2 (summer) 2026-06-29T00:00Z → 2026-07-27T00:00Z — 27 nights x 50 EVs = 1350 sessions

| arm | total gCO2e | gCO2e / session | % avoided vs naive | sessions shifted | approvals requested | approvals granted | gate refused shift | mean shift (h) | nights over budget | audit valid |
|---|---|---|---|---|---|---|---|---|---|---|
| naive (charge on plug-in) | 4266697 ± 3479 | 3160.5 ± 2.6 | — | 0 | 0 | 0 | 0 | 0 | n/a | n/a |
| governed, approval rate 1.00 | 3582297 ± 2227 | 2653.6 ± 1.6 | **16.04 ± 0.04** | 989.2 ± 5 | 1219 ± 1.8 | 1219 ± 1.8 | 131 ± 1.8 | 8.94 ± 0.03 | 13 ± 0 of 27 | true |
| governed, approval rate 0.80 | 3721787 ± 6977 | 2756.9 ± 5.2 | **12.77 ± 0.16** | 788.1 ± 11.2 | 1212.9 ± 2.7 | 972.9 ± 11.6 | 137.1 ± 2.7 | 8.95 ± 0.04 | 13.7 ± 0.48 of 27 | true |

Gate verdicts at approval rate 1.00 (nightly budget 129066 ± 353 gCO2e = 0.8 x median naive night): allow 1071.3, degrade 103.2, escalate 44.5, block 44.2, terminate 86.8 — 1350 ± 0 audited decisions per seed, one per session.

## Notes

- A refused gate verdict (block/terminate) or a declined approval does **not** withhold charge; it withholds the *optimisation*, and the car charges naively. That is why a stricter budget cannot make this scenario unsafe, only less effective.
- The nightly budget is deliberately tight (0.8 x the median naive night), so the cars that plug in late in the evening find the budget largely committed and lose their shift. This is the visible cost of pacing a budget that a must-serve load cannot actually respect — the nights-over-budget column shows it never respects it.
- Sensitivity: dropping human approval from 100% to 80% is a direct, near-linear haircut on the saving — the human is the bottleneck in the loop, not the model.
- The gate is asked about the *proposed* clean window, and the budget is then charged with the grams actually emitted by whatever window was used.
- Synthetic: fleet size, plug-in distribution, energy per session, and the approver. Real: the carbon intensity.
