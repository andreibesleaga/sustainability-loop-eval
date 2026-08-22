# Simulation (E2, E3)

Trace-driven evaluation of the Carbon-Verdict Governor for *The Cybernetic Sustainability
Loop: Governed Agentic Systems on a Sustainability Data Plane*.

Two experiments, both replayed over the **same real grid-carbon traces**:

| | question | script | output |
|---|---|---|---|
| **E2** | Does routing every agent action through a carbon budget + verdict ladder beat always-run and a carbon-aware-scheduling baseline, and at what cost in service? | `simulation/run.js` | `results/simulation.{json,md}` |
| **E3** | Can a gated, human-approved *start-time shift* of a fixed EV charge cut emissions without touching what the vehicle receives? | `simulation/charging.js` | `results/charging.{json,md}` |

## How to run

```bash
npm run fetch-traces   # once, needs network; writes data/simulation/W{1,2}.json
npm run simulate       # E2  (~18 s)
npm run charging       # E3  (~3 s)
npm test               # unit tests: statistics, PRNG, traces, policy semantics
```

`npm run all` runs the fitness suite and both experiments plus the data-plane
measurement, but deliberately **not** `fetch-traces`: the traces are already cached and
committed, and re-fetching them is a live network call that would rewrite the very inputs
the published numbers were computed from.

After the first fetch everything runs **offline** from the cache. Re-running either script
produces **byte-identical** JSON: no wall clock, no live network, no unseeded randomness.

## What is real, and what is not

**Real** — the carbon data, and the enforcement code:

* 30-minute carbon-intensity series from the UK National Grid ESO
  [Carbon Intensity API](https://api.carbonintensity.org.uk) (free, keyless), two 28-day
  windows: **W1** 2026-01-05 → 2026-02-02 (winter) and **W2** 2026-06-29 → 2026-07-27
  (summer). 1344 slots each; **0 gaps** had to be carried forward in either window.
* **National ACTUAL** intensity is the ground truth. Every gram reported anywhere in this
  package is `energy_kWh × national_actual(slot)`.
* The **peer signal** is what the architecture actually consumes: three *peer systems*
  publishing their own `carbon-intensity-gCO2e-per-kWh`. They are modelled as services
  sited in three GB regions — North Scotland (1), London (13), South Wales (8) — using
  each region's published intensity. **The regional endpoint is forecast-only**; there is
  no regional actual to validate against. Peer signal = mean of the three; the max is
  reported once as a sensitivity.
* The gate is not a mock. Decisions go through `ActionGate` from
  **kaiban-distributed@2.0.0** with the governor plugged in as a `GateValidator`, backed by
  the shipped hash-chained `AuditLog`. `audit.verify()` runs at the end of every arm and
  its result is recorded.

**Synthetic** — everything about the load, clearly flagged in the results JSON:

* E2 workload: Poisson(λ=6) task arrivals per 30-min slot, 0.05 kWh per task
  (LLM-inference-style job), 50% deferrable by up to 6 h, degraded mode = 40% of energy.
* E3 fleet: 50 EVs, 20 kWh delivered evenly over 3 h, plug-in 18:00 ± 1 h, deadline 07:00.
  Each night's sessions are decided in plug-in order, so the nightly budget is paced in
  chronological order rather than in vehicle-index order.
* The human approver. In E2 it always approves (deterministic). In E3 approval is a seeded
  coin at rate 1.00 and 0.80.

## Parameters

Every knob lives at the top of its file and is echoed verbatim into the results JSON:
`WORKLOAD` in `lib.js`, `SEEDS` / `F_VALUES` in `run.js`, `FLEET` in `charging.js`.

* Seeds: `101, 202, 303, 404, 505, 606, 707, 808, 909, 1010` — 10 per configuration,
  reported as mean ± sd.
* Verdict ladder rungs (from `governor/carbon-governor.js`): `degrade` 0.8, `escalate` 1.0,
  `block` 1.1, `terminate` 1.25 of the period budget committed.
* E2 daily budget `B = f × median(P0's own daily emissions)`, `f ∈ {0.6, 0.7, 0.8, 0.9, 1.0}`.
* E3 nightly budget `B = 0.8 × median(naive nightly fleet emissions)`.

## Safety constraint in E3 (non-negotiable)

`charging.js` shifts **start times only**. There is no vehicle-to-grid, no discharge, no
state-of-charge logic and no charge-vs-discharge decision anywhere in the file. Every
vehicle receives its full 20 kWh before its deadline in every arm — a gate refusal or a
declined approval withholds the *optimisation*, never the charge.

## Files

| file | role |
|---|---|
| `fetch-traces.js` | fetch + cache the real traces, aligned onto a canonical slot grid |
| `lib.js` | trace loading (with validation) and the workload generator |
| `run.js` | E2 — policies P0 / P1 / P2 and the metric aggregation |
| `charging.js` | E3 — fleet, proposal, gate, approver |
| `report.js` | markdown rendering only; recomputes nothing |
| `lib.test.js` | unit tests for the PRNG, Poisson draws, statistics, traces, workload |
| `policies.test.js` | hand-computed micro-scenarios per policy + conservation invariants |

The seeded PRNG and the statistics live one level up, in `shared/prng.js` and
`shared/stats.js`, so the fitness suite and the data-plane measurement use exactly the
same definitions of "p95", "sample sd" and "mulberry32".

## What P2 actually does with each rung

Each task is gated **exactly once**, when it arrives; the deferred run of an already-gated
task is the execution of that audited decision, not a new ungated action. The estimate the
gate sees is the peer forecast; the budget is charged with the grams the run actually emits
against the national actual series. Then:

* `allow` — run now, full energy.
* `degrade` / `escalate` / `block` — deferrable work moves to the cleanest slot the peer
  signal predicts before its deadline; non-deferrable work runs now at 40% energy. The
  three rungs pick the same physical action on purpose: what differs is **who authorises
  it**. `degrade` is automatic; `escalate` and `block` happen only because the simulated
  human approves, and each is counted as one human decision — so
  `humanDecisions == escalations + blocks` by construction.
* `terminate` — the task is dropped. This is the only rung that removes work.

## Reading the E2 tables honestly

P2 emits less partly because it *does less work*. Total gCO2e must be read next to
`completed`, `degraded`, `dropped` and `humanDecisions` — those columns are the price. P0
and P1 complete 100% of tasks; P2 does not. The per-experiment markdown ends with an
explicit caveats section.
