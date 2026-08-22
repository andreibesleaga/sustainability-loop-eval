# Architecture of `sustainability-loop-eval` (arc42)

This is the architecture document for the open evaluation and replication package
of the article *The Cybernetic Sustainability Loop: Governed Agentic Systems on a
Sustainability Data Plane* (Andrei N. Besleaga, 2026).

It follows the arc42 template: twelve short sections, in the usual order. Plain
words throughout. Where a number appears, it comes from a file in `results/`.

**Honest framing, stated once and meant everywhere below.** This package is a
*reference architecture* plus an *early evaluation*. Nothing here is running in
production for anyone. The carbon governor is a reference implementation, not a
shipped product feature. The work is in progress.

---

## 1. Introduction and goals

### What the package is for

The article describes a feedback loop: systems publish their own sustainability
figures at a standard web address, other systems read those figures, an agent
turns them into a decision, and one gate decides whether the action runs, runs
smaller, waits for a person, or does not run at all.

This repository is the evidence for that description. It answers three questions
with runnable code:

| Question | How it is answered | Where |
|---|---|---|
| Does the architecture hold the properties it claims? | Nine executable checks against the shipped gate | `fitness/`, [`results/fitness.md`](../../results/fitness.md) |
| Is the published data usable as a control signal? | Live measurement of every document on a public gateway | `dataplane/`, [`results/dataplane.md`](../../results/dataplane.md) |
| What does the governor do on real grid conditions? | Replay on real half-hourly grid-carbon traces | `simulation/`, [`results/simulation.md`](../../results/simulation.md), [`results/charging.md`](../../results/charging.md) |

### Quality goals

In priority order. When two of these pull against each other, the higher one wins.

| # | Goal | What it means here |
|---|---|---|
| 1 | **Honesty and traceability** | Every claim points at a file. Every number is produced by a script and written to `results/`. Real, reference, and synthetic parts are labelled everywhere, including inside the result files. |
| 2 | **Simplicity** | A reader should be able to check the core by reading it. The governor core is under 70 lines and imports nothing. No framework, no build step, no clever code. |
| 3 | **Determinism** | Same inputs, same outputs, byte for byte. Fixed past time windows, seeded random numbers, an injected clock, cached traces. |
| 4 | **Fail-closed safety** | A broken validator or a nonsense input resolves to `block`, never to `allow`. |
| 5 | **Human in the loop** | Nothing above `degrade` runs without an explicit human approval reaching the point where the action would actually happen. |
| 6 | **Portability of the core** | The governor knows nothing about HTTP, charging protocols or approval boards. Swap every adapter and the core is unchanged. |

### Who reads this

Software architects and engineers evaluating the design; reviewers of the
article; anyone who wants to re-run the numbers or extend the package.

---

## 2. Constraints

| Constraint | Why | Consequence |
|---|---|---|
| **Plain JavaScript, ES modules, Node 22 or newer** | A reader should not need a toolchain to check the code | No TypeScript, no transpiler, no bundler, no test framework beyond Node's built-in `node:test` |
| **Exactly one runtime dependency** | The one dependency is the thing under test: `kaiban-distributed@2.0.0`, which ships the real action gate and audit log | Nothing else may be added to `dependencies`. Everything else is a Node built-in. |
| **No wall-clock reads anywhere that affects a result** | Determinism | Time windows are fixed past dates; the gate is given an injected clock; freshness in the data-plane run is measured against a fixed reference date, not "now" |
| **Carbon data is CC BY 4.0** | The grid traces come from the National Energy System Operator's Carbon Intensity API | The attribution must appear in the repository and in anything derived from the data |
| **No claim of a deployment that does not exist** | Honesty | The gateway is the author's own reference deployment. No third party publishes into it. The wording never implies otherwise. |
| **The charging scenario may only shift start times** | The underlying demand-shaping mechanism is the subject of a patent application on which the author is a co-inventor; this work sits strictly above it | `simulation/charging.js` contains no discharge, no vehicle-to-grid, and no state-of-charge logic. Every vehicle always gets its full charge before its deadline. |
| **Files stay small and single-purpose** | Readability | Roughly 150 lines is the working ceiling for a source file |

---

## 3. Context and scope

![System context](c4/c4-context.png)

### What is inside this repository

- The **Carbon-Verdict Governor** reference core and the adapter that plugs it into the real gate (`governor/`).
- Nine **architecture fitness functions** (`fitness/`).
- **Live measurement** of the public data plane (`dataplane/`).
- **Trace-driven simulation**: an agentic workload and an EV-charging night (`simulation/`).
- A one-command **demo** and a **live agent run** (`demo/`, `agent/`).
- **Committed inputs and outputs** (`data/`, `results/`) so a reader can check the numbers without running anything.

### What is outside, and how this package touches it

| Outside system | What it is | How this package uses it |
|---|---|---|
| **The IETF Internet-Draft** | Defines the well-known address `/.well-known/sustainability-data` and the document format: 8 mandatory members, 16 optional | The data-plane measurement checks live documents against those member lists |
| **The reference gateway** | A public deployment serving conformant documents, operated by the article's author | Read over HTTP. Not part of this repository. |
| **`kaiban-distributed`** | An open-source distributed agent runtime. It ships the `ActionGate` and the hash-chained `AuditLog`. | Imported from npm at version 2.0.0 and used as the real enforcement point. Not mocked. |
| **NESO Carbon Intensity API** | Real half-hourly carbon intensity for Great Britain, free and keyless, CC BY 4.0 | Fetched once by `simulation/fetch-traces.js`, then cached under `data/simulation/` |
| **MCP servers for charging protocols** | Separate open-source prototypes exposing live charging operations as typed tools | **Not evaluated here.** The charging scenario is a simulation through the governor and the gate, not a live protocol call. Listed in [`docs/ARTIFACT-INVENTORY.md`](../ARTIFACT-INVENTORY.md). |
| **The OpenRouter API** | Used only by the optional live agent run | `demo/agent.js` asks a real model (`anthropic/claude-sonnet-5` by default) to propose a task; the proposal then goes through the same real gate |

### The larger system versus this package

The article's loop is bigger than this repository. The repository holds the
*decision* half of the loop and the *measurement* of the signal half. The
publishing half lives in separate packages and in the gateway; the physical
actuation half lives in separate prototype tool servers. This document is
careful about that line, and section 11 lists what it means for the results.

---

**Outside the repo, above the loop:** the article's normative criteria (the author's Sustainability-First Consensus framework, Communications of the ACM, in press) decide what a budget should be; this package takes a budget as an input and evaluates what the loop does with it.

## 4. Solution strategy

Five decisions carry the whole design.

1. **A hexagonal core with adapters at the edges.** The governor owns four ports:
   a *signal port* (peer and grid readings come in), a *forecast port* (load and
   generation forecasts), a *human port* (approvals), and an *actuation port*
   (decisions go out). Everything concrete — an HTTP client, a charging protocol,
   an approval board — is an adapter behind one of those ports. The core file
   imports nothing at all, and a fitness function checks that statically.

2. **One gate, one total order.** Every carbon-relevant decision goes through a
   single gate that aggregates all validator opinions to the most severe verdict
   on the ladder `allow < degrade < escalate < block < terminate`. Scattered
   per-component policies cannot aggregate and cannot fail closed; one ordered
   ladder can.

3. **The gate is the shipped one, not a copy.** The package imports
   `kaiban-distributed@2.0.0` and calls its real `ActionGate` in-process, backed
   by its real hash-chained `AuditLog`. Testing a reimplementation would prove
   nothing about the runtime.

4. **Evaluation on three legs.** Fitness functions test properties. Live
   measurement tests whether the signal exists and is usable. Simulation tests
   what the policy does under real grid conditions. No single leg would be
   convincing alone.

5. **Everything reproducible and committed.** Inputs are cached under `data/`,
   outputs are committed under `results/`, and every script is deterministic
   except the live network measurement, whose only unstable numbers are
   latencies.

---

## 5. Building block view

### Level 1 — the package

![Containers](c4/c4-container.png)

| Folder | Responsibility |
|---|---|
| `governor/` | The reference core and its gate adapter. The only part that is architecture rather than evaluation. |
| `fitness/` | Nine executable checks of architectural properties, plus the tiny actuation harness they check against. |
| `simulation/` | Two trace-driven experiments and their shared plumbing. |
| `dataplane/` | Live measurement of the public gateway and analysis of its real request logs. |
| `demo/` | A one-command walkthrough: one real document, one decision, one verdict. |
| `agent/` | An optional live run with a real language model in front of the same gate. |
| `data/` | Cached inputs: grid traces, fetched documents, raw request logs. |
| `results/` | Committed outputs: one JSON and one short Markdown reading per experiment. |
| `docs/` | This document, the product spec, the decision records, the fitness-function rationale, the search protocol, the artifact inventory. |

### Level 2 — key modules

![Components](c4/c4-component.png)

| Module | Responsibility | Notes |
|---|---|---|
| `governor/carbon-governor.js` | Holds a carbon budget in grams CO2e, tracks what has been spent, turns a *committed / budget* ratio into a verdict, and exposes the reference aggregation rule `mostSevere()` | Under 70 lines. Imports nothing. `decide()` has no side effects; `commit()` is the only thing that moves state. |
| `governor/gate.js` | Builds the real `ActionGate` with the governor registered as a validator and a real `AuditLog` behind it; gives it a deterministic injected clock | Imports exactly two things: `kaiban-distributed` and the core |
| `fitness/props.js` | The nine properties F1–F9, each an exported function returning `{ id, property, cases, passed, notes }` | The property logic lives here once; the test files and the report both call it |
| `fitness/fN.test.js` | One `node:test` file per property, asserting on `passed` | Nine files, about 15 lines each |
| `fitness/harness.js` | The human port: the only path in the package from a verdict to actually running something | About 20 lines. `allow` and `degrade` run automatically; anything higher needs an explicit approved approval object. |
| `shared/prng.js`, `shared/stats.js` | Seeded random numbers (mulberry32) and one definition of median/p95/sd for the whole package | So property cases are reproducible and every "p95" means the same thing |
| `fitness/report.js` | Runs the same nine properties and writes `results/fitness.json` | No duplicated logic |
| `simulation/fetch-traces.js` | Fetches and caches the real grid traces onto a canonical half-hourly grid | The only script in `simulation/` that touches the network |
| `simulation/lib.js` | Seeded random numbers, statistics, trace loading, and the synthetic workload generator with all its knobs in one object | |
| `simulation/run.js` | Experiment E2: three policies over the same task list — always-run, threshold deferral, and the governor at five budget levels | |
| `simulation/charging.js` | Experiment E3: a fleet of EVs shifting charge start times under the gate and a human approval | Start times only, by construction |
| `simulation/report.js` | Renders the Markdown readings. Recomputes nothing. | |
| `dataplane/measure.js` | Fetches every document the gateway serves, five times each, and checks members, schema, disclaimers, size, latency and freshness | Live network |
| `dataplane/logs.js` | Reads the already-pulled raw request log file and counts what it contains | Does not shell out to anything |

---

## 6. Runtime view

### 6.1 One governed decision through the real gate

![Governed decision](c4/runtime-governed-decision.png)

An agent is about to do something that will emit carbon. It hands the gate an
estimate in grams. The gate runs every validator it has, one of which is the
carbon validator wrapping the governor. The governor adds the estimate to what it
has already spent, divides by the budget, and reads the ratio off the ladder. The
gate takes the most severe verdict any validator returned, writes a hash-chained
audit record, and returns it. Then:

- `allow` or `degrade` — the action runs (smaller, in the degrade case), and the actual grams are committed to the budget.
- `escalate` — a human is asked. The action runs only if the human approves.
- `block` or `terminate` — the action does not run.

### 6.2 One simulated day

![Simulated day](c4/runtime-simulated-day.png)

`simulation/run.js` walks a 28-day window in 30-minute slots. At each midnight the
budget resets. In each slot, work queued for that slot runs first and commits its
real emissions; then newly arrived tasks each become a gated action. The estimate
the agent sends is *what a peer's published document would tell it* — the peer
signal — while the emissions actually charged come from the national actual
series. That difference is deliberate: it is the honest gap between what an agent
can see and what really happened. At the end of the run the audit chain is
verified.

### 6.3 One charging night

`simulation/charging.js` runs the same window as nights. Fifty vehicles plug in
around 18:00 and must be full by 07:00. For each vehicle the agent finds the
cleanest three-hour window the peer signal predicts, and asks the gate about
moving the charge there. If the gate says `allow`, `degrade` or `escalate`, a
human is asked; if the human agrees, the charge is moved. If the gate refuses, or
the human declines, the car charges the moment it was plugged in — it charges
either way. What is withheld is the improvement, never the electricity.

### 6.4 One data-plane measurement

`dataplane/measure.js` reads the gateway's index, then fetches every subject
document plus the gateway's own document five times each. For each document it
records status, latency and size, checks the mandatory and optional members
against the draft, validates against the schema using the reference consumer
library, looks for the in-band not-endorsed disclaimer, and computes freshness
against a fixed reference date. Then `dataplane/logs.js` reads the raw request-log
file that was pulled separately and summarises the real traffic the gateway served.

### 6.5 The demo, and the live agent run

`npm run demo` fetches one real document from the public gateway, turns its
carbon-intensity figure into an estimate for one action, sends that action through
the real gate, and prints the verdicts. If the network is unavailable it falls
back to a committed fixture and says so. `npm run agent` does the same with a real
language model proposing the action; when the verdict is `escalate` it asks *you*,
at the terminal, to approve. It needs an API key; without one it explains that and
exits.

---

## 7. Deployment view

There is one deployment: a developer's machine.

| Thing | Requirement |
|---|---|
| Runtime | Node.js 22 or newer |
| Install | `npm install` — one runtime dependency |
| Disk | The cached traces and documents are already committed; nothing large is downloaded |
| Operating system | Anything Node runs on |

### What touches the network

| Command | Network | Notes |
|---|---|---|
| `npm run fitness` / `npm test` | none | Pure in-process |
| `npm run simulate`, `npm run charging` | none | Read the cached traces |
| `npm run fetch-traces` | NESO Carbon Intensity API | Run once; keyless |
| `npm run dataplane` | the public gateway | Live; latency numbers will differ per run |
| `npm run demo` | one document from the gateway | Falls back to a committed fixture offline |
| `npm run agent` | the gateway and the OpenRouter API | Needs `OPENROUTER_API_KEY` (in `.env`, gitignored) |
| `npm run arch` | none | Draws the import graph with `madge` |

No server is deployed by this package. No broker, no database, no container. The
gate's semantics do not depend on any of that — it is in-process code — which is
why a full `kaiban-distributed` deployment is not needed to evaluate it.

---

## 8. Cross-cutting concepts

### The verdict ladder is a total order

`allow < degrade < escalate < block < terminate`. Because the order is total, any
set of validator opinions has exactly one most severe member, so concurrent
policies always aggregate to a single answer. Fitness functions F1 and F9 check
that the shipped gate really computes that maximum and that the package's
reference rule computes the same thing.

### The ladder is driven by a pacing ratio

The governor computes `(already spent + this action's estimate) / budget` and
reads the verdict off fixed rungs: `degrade` at 0.8, `escalate` at 1.0, `block` at
1.1, `terminate` at 1.25. This paces spending rather than capping it: `degrade`
fires well before the budget is used up, and work that is deferred across midnight
commits against the next day's budget. Section 11 says plainly what that costs.

### Fail-closed

A validator that throws, and an estimate that is not a finite non-negative number,
both resolve to `block`. There is exactly one legitimate bypass: a gate configured
with `enabled: false` allows everything and records nothing. That is a
deployment-time, all-or-nothing switch, not a per-request escape hatch, and F2
checks both halves of that statement.

### The audit chain

Every decision the gate makes is appended to a hash-chained log. `verify()`
recomputes the chain; changing one field of one record makes `verify()` fail and
name the index where it broke. F6 checks both. Every simulation arm verifies its
chain at the end and records the result.

### Determinism

Nothing that affects a result reads the wall clock, calls the network at run time,
or uses unseeded randomness. Random draws come from a seeded mulberry32 generator.
The gate is given an injected clock that counts synthetic seconds. Time windows
are fixed dates in the past. Freshness in the data-plane run is measured against a
fixed reference date. F8 checks that two fresh gates given the same inputs produce
byte-identical decisions *and* byte-identical audit records.

### The human port

`fitness/harness.js` is the only path in this package from a verdict to running
something. `allow` and `degrade` run on their own. Anything above them runs only
if an approval object is present and its `approved` field is exactly `true`.
F4 checks this over random decisions. The simulations use simulated approvers,
which is a real limitation and is named as such in section 11.

### Provenance labels

Three words are used consistently, in the docs and inside the result files:

- **Real** — the shipped gate and audit log; the live gateway documents; the real request logs; the grid-carbon traces.
- **Reference** — the Carbon-Verdict Governor core: the article's specification made executable, evaluated here, and *not* merged into any released runtime.
- **Synthetic** — the agentic workload, the EV fleet, the simulated human approvers. Also the two `*.example` subjects on the gateway, which are labelled synthetic there too.

One extra label matters: the three "peer" series in the simulation are the grid
API's *regional forecasts* standing in for peers' published documents. They are
real data used as a stand-in, not real peer publications.

---

## 9. Architecture decisions

Fifteen decisions are recorded in [`docs/adr/`](../adr/). Each one is short:
context, decision, consequences, alternatives considered.

| ADR | Decision |
|---|---|
| [ADR-001](../adr/ADR-001-plain-javascript-esm.md) | Plain JavaScript ES modules, zero framework |
| [ADR-002](../adr/ADR-002-real-gate-not-a-mock.md) | The real `kaiban-distributed` ActionGate is the enforcement point |
| [ADR-003](../adr/ADR-003-core-imports-nothing.md) | The governor core imports nothing |
| [ADR-004](../adr/ADR-004-five-rung-ladder-and-rungs.md) | A five-rung ladder driven by a pacing ratio, rungs 0.8 / 1.0 / 1.1 / 1.25 |
| [ADR-005](../adr/ADR-005-fail-closed.md) | Fail closed on bad input and on validator errors |
| [ADR-006](../adr/ADR-006-human-port-and-stop-rungs.md) | Escalation goes to the human port; block and terminate stop the action |
| [ADR-007](../adr/ADR-007-determinism.md) | Determinism by construction |
| [ADR-008](../adr/ADR-008-real-grid-traces.md) | Real NESO traces: national actual for emissions, regional forecasts as peer stand-ins |
| [ADR-009](../adr/ADR-009-synthetic-workload-parameters.md) | Synthetic workload parameters live at the top of their file |
| [ADR-010](../adr/ADR-010-threshold-deferral-baseline.md) | Threshold deferral is the simple baseline |
| [ADR-011](../adr/ADR-011-charging-start-time-shift-only.md) | The charging scenario shifts start times only |
| [ADR-012](../adr/ADR-012-commit-results-and-data.md) | Results and cached data are committed on purpose |
| [ADR-013](../adr/ADR-013-fitness-functions-as-test-layer.md) | Fitness functions are the architecture test layer |
| [ADR-014](../adr/ADR-014-demo-live-document-with-fixture-fallback.md) | The demo reads one live document, with a fixture fallback |
| [ADR-015](../adr/ADR-015-cc-by-attribution.md) | CC BY 4.0 attribution for the grid data |

---

## 10. Quality requirements

Each quality goal from section 1, as a scenario that a script can settle.

| # | Goal | Scenario | Settled by | Status |
|---|---|---|---|---|
| Q1 | Fail-closed safety | A validator throws, or the carbon estimate is `NaN`, negative, missing, or a string | F2, 75 cases | Green — [`results/fitness.md`](../../results/fitness.md) |
| Q2 | Fail-closed safety | Two validators disagree; one wants `allow`, one wants `terminate` | F1 and F9, 4,000 cases | Green |
| Q3 | Predictability | Budget pressure rises step by step; severity must never fall | F3, plus the four default rung boundaries pinned exactly | Green |
| Q4 | Human in the loop | A verdict of `escalate`, `block` or `terminate` arrives with no approval, or with a refusal | F4, 2,000 cases | Green |
| Q5 | Nothing runs unaudited | Actions of every operation type the gate defines are evaluated; the audit length must equal executed plus refused | F5, 2,100 cases | Green |
| Q6 | Evidence integrity | One field of one audit record is changed after the fact | F6, 500 decisions; `verify()` must fail at that index | Green |
| Q7 | Portability of the core | Static check of the import graph: the core imports nothing, the gate adapter imports only the runtime and the core, adapters do not import each other | F7, 15 checks | Green |
| Q8 | Determinism | The same estimate sequence through two fresh gates | F8, 300 steps; decisions and audit records must be byte-identical | Green |
| Q9 | Traceability | Every number in the article can be pointed at a file in `results/` | By construction; the inventory in [`docs/ARTIFACT-INVENTORY.md`](../ARTIFACT-INVENTORY.md) covers the artifacts the scripts do not measure | Maintained by hand |
| Q10 | Simplicity | The governor core stays readable in one sitting | Under 70 lines, zero imports; F7 keeps it that way | Green |

All nine fitness functions pass, over 10,994 cases in total. The same gate and
audit code carries its own upstream suite of 71 tests, which also passes
(`results/kaiban-upstream-tests.json`, commit `17ad362`).

---

## 11. Risks and technical debt

Written plainly, because these are the things that would change the conclusions.

| # | Risk | What it means | What would fix it |
|---|---|---|---|
| R1 | **The workload is synthetic** | Task arrivals, task energy, the deferrable half, and the cost of degraded mode are all stipulated numbers, not measurements. The percentages move with the workload. | Replay a real trace of a real agentic service |
| R2 | **The peer signal is biased** | The three "peers" are regional forecasts from the grid API. They track the national actual closely in *shape* (Pearson r 0.96 in winter, 0.986 in summer) but sit low in *level* — one region is near-zero-carbon all summer. An agent that used them to set an absolute budget would set it wrong. | Calibrate peer signals before using them as levels, and get real peers publishing |
| R3 | **The governor paces, it does not cap** | Days still end over budget, because deferred work commits into the next day and non-deferrable work is throttled but not stopped short of the top rung. This is a property of the design, not a bug. | Say so — the article and the result files do. A hard cap would need a different design and a different safety argument. |
| R4 | **Less emission means less work done** | The governor's savings are partly because it drops and degrades tasks. Total grams must always be read next to completed, degraded and dropped counts. | Read the tables together; never quote the emissions column alone |
| R5 | **The author measures his own gateway** | The gateway is the article author's reference deployment, and its real-organization documents are illustrative mappings prepared by the operator from public reports — not published or endorsed by those organizations. Discovery and comparability are demonstrated; third-party adoption is not. | An independent organization publishing its own document |
| R6 | **The approvers are simulated** | In the workload simulation the approver always agrees; in the charging simulation it is a seeded coin at 100% and 80%. Real human friction, latency and fatigue are untested. | A study with real approvers |
| R7 | **The MCP servers are not evaluated** | The charging scenario runs through the governor and the gate, not over a live charging protocol. The tool servers exist as separate prototypes and are inventoried, not measured. | A gated end-to-end run against a real protocol endpoint |
| R8 | **Ten seeds, two windows** | Ten seeds per configuration and two 28-day windows (one winter, one summer) in one country. The spread between seeds is reported, but this is not a wide sample. | More seeds, more windows, more regions, more countries |
| R9 | **The gate is one runtime** | The properties are checked against one implementation of the ladder, in one process. | A second independent implementation to check against |
| R10 | **The absence claims are search results** | The novelty claims rest on a documented adversarial search on a stated date. Absence of evidence in those sources, nothing more. | Documented in [`docs/SEARCH-PROTOCOL.md`](../SEARCH-PROTOCOL.md); readers are asked to open an issue if they find a prior composition |

### Technical debt

- `dataplane/measure.js` imports the reference consumer library by an absolute path on the author's machine. On any other machine that import fails, so `npm run dataplane` is not portable as written. The committed results and the saved documents are unaffected.
- The result files are regenerated by hand, in a fixed order. There is no single script that rebuilds everything and checks the Markdown against the JSON.
- `data/dataplane/` holds a snapshot from one run. Re-running the measurement overwrites it.

---

## 12. Glossary

| Term | Plain meaning |
|---|---|
| **Adapter** | A piece of code that plugs a concrete outside system into a port. Swap the adapter, the core is unchanged. |
| **Action gate** | The single place every consequential action must pass through. It collects validator opinions, picks the most severe, records the decision, and returns it. |
| **Audit chain** | An append-only log where each record's hash covers the previous record's hash. Editing an old record breaks the chain visibly. |
| **Carbon budget** | An allowance of grams of CO2-equivalent for a period, here a day or a night. |
| **Carbon intensity** | How dirty the electricity is right now, in grams of CO2-equivalent per kilowatt-hour. |
| **Carbon-Verdict Governor** | The reference core in `governor/`: it maps carbon-budget state onto the verdict ladder. |
| **Cybernetic Sustainability Loop** | The whole composition: publish, sense, decide, gate, act, publish again. |
| **Deferrable task** | Work that may run later, up to a deadline. Half the simulated workload is deferrable within six hours. |
| **Fitness function** | An automated, repeatable test of an *architectural* property, not of a feature. The term is from Ford, Parsons and Kua. |
| **Gated Grid Actuation** | The pattern of exposing physical operations to agents only as typed tools behind the same gate and the same human approval. Prototyped elsewhere; simulated here. |
| **Hexagonal architecture** | Ports and adapters, in Cockburn's sense: the domain logic in the middle, everything external plugged in at the edges. |
| **kaiban-distributed** | The open-source distributed agent runtime whose shipped action gate and audit log this package imports and tests against. |
| **National actual** | The measured grid carbon intensity for Great Britain. Ground truth for every gram reported here. |
| **Pacing ratio** | Spent plus this action's estimate, divided by the budget. The number the ladder reads. |
| **Peer signal** | What another system publishes about its own carbon intensity. Here, stood in for by regional forecasts. |
| **Port** | An interface the core owns: signal, forecast, human, actuation. |
| **Regional forecast** | The grid API's per-region prediction. There is no regional *actual* to check it against. |
| **Sustainability Signal Plane** | The publish-and-consume layer: every participating system is both a reporter and a sensor. |
| **Verdict ladder** | `allow < degrade < escalate < block < terminate`, in that order, always. |
| **Well-known URI** | A standard web address every site can serve, like `robots.txt`. Here: `/.well-known/sustainability-data`. |
