# The Cybernetic Sustainability Loop — Product Design

> Companion document for the article *The Cybernetic Sustainability Loop: Governed Agentic Systems on a Sustainability Data Plane* (Andrei N. Besleaga, 2026). The product here is an *evaluation and replication package*, not a service. It is a reference architecture plus an early evaluation; nothing in it runs in production for anyone.

## 1. Summary

A small, plain-JavaScript package that makes the article's architecture runnable
and its claims checkable. One reference core (`governor/`, under 70 lines,
imports nothing) maps a carbon budget onto a five-rung verdict ladder
(`allow < degrade < escalate < block < terminate`) behind the real governance gate
shipped by **kaiban-distributed** 2.0.0 — the package's single runtime dependency,
imported from npm and not mocked. Three evaluations sit around that core: nine
**architecture fitness functions**, a **live measurement** of a public
sustainability data plane, and a **trace-driven simulation** on real half-hourly
Great Britain grid-carbon data. Everything is deterministic, everything is
committed, and every result file says which parts are real, which are a reference
implementation, and which are synthetic. Chosen toolchain: **Node 22 or newer**,
ES modules, Node's built-in test runner, no build step.

## 2. PRD — Product Requirements

- **Audience.** Reviewers of the article; software architects and engineers judging whether the design holds; anyone who wants to re-run the numbers, extend the package, or lift the governor core into their own system.
- **Problem.** Carbon-aware computing today listens but does not speak: systems consume grid feeds and publish nothing machine-readable about themselves, so no system can react to another. The architecture that closes that loop makes claims — a total-ordered verdict ladder, a fail-closed gate, a human bound to the top rungs, a portable core — and claims like those normally live in prose, where nothing can falsify them.
- **Goals.** (a) Make every architectural claim executable against the *shipped* gate, not a copy. (b) Measure whether the published data plane actually exists and is usable as a control signal. (c) Show what the governor does under real grid conditions, including what it costs. (d) Keep the whole thing readable: one dependency, no build, small files. (e) Make every run reproducible byte for byte. (f) Label real, reference and synthetic parts everywhere, including inside the result files.
- **Non-goals.** A production carbon governor. A merge into any released runtime. A multi-party deployment with third-party publishers. An evaluation of the charging-protocol MCP servers. A hard carbon cap. Any claim about human approvers' real behaviour.
- **Acceptance criteria.** (a) `npm install` installs exactly one runtime dependency. (b) `npm test` runs nine fitness functions against the real gate and all nine pass. (c) `npm run simulate` and `npm run charging` reproduce `results/*.json` byte for byte, offline. (d) `npm run dataplane` measures the live gateway and writes a result file whose only unstable numbers are latencies. (e) `npm run demo` reaches a real verdict from a real document in seconds, and falls back to a committed fixture offline while saying so. (f) Every number quoted in the article appears in `results/`.

## 3. SPEC — Functional and Non-Functional

**Functional**

| ID | Requirement | Acceptance criterion |
|---|---|---|
| FR-1 | The governor holds a carbon budget in grams CO2e, tracks what has been spent, and turns a *committed / budget* pacing ratio into a verdict. `decide()` has no side effects; `commit()` is the only thing that moves state. | F3 pins the four default rungs (0.8, 1.0, 1.1, 1.25) exactly and checks 2,000 non-decreasing ratio sequences never produce a lighter verdict |
| FR-2 | The verdict ladder is a total order and the gate always resolves to its most severe member, listed first. | F1, 2,000 random verdict multisets through the real gate |
| FR-3 | The package's reference aggregation rule agrees with what the shipped gate computes. | F9, 2,000 cases varying both the carbon verdict and the other validators' verdicts |
| FR-4 | A throwing validator and an invalid carbon estimate both resolve to `block`. A gate with `enabled: false` allows everything, consults nothing and records nothing. | F2, 75 cases across all three shapes |
| FR-5 | Nothing above `degrade` executes without an explicit human approval whose `approved` field is exactly `true`. | F4, 2,000 random decisions through `fitness/harness.js` |
| FR-6 | Every gate-defined operation type is routed through `evaluate()`; nothing executes unaudited. | F5, 2,100 cases; audit length must equal executed plus refused |
| FR-7 | The audit chain verifies over a real run, and changing one field of one record breaks `verify()` at that index. | F6, 500 decisions plus one tamper |
| FR-8 | The governance core imports nothing; the gate adapter imports only the runtime and the core; the simulation and data-plane adapters do not import each other. | F7, 15 static import checks of the real import graph |
| FR-9 | The simulation compares three policies on the identical task list per seed: always-run, threshold deferral, and the governor at five budget levels. | `simulation/run.js`; `results/simulation.md` |
| FR-10 | The charging scenario shifts start times only. No discharge, no vehicle-to-grid, no state-of-charge logic. Every vehicle receives its full charge before its deadline in every arm. | `simulation/charging.js`; stated in `results/charging.md` |
| FR-11 | The data-plane run fetches every document the gateway serves five times each and checks mandatory and optional members, schema validity, the in-band disclaimer, size, latency and freshness against a fixed reference date. | `dataplane/measure.js`; `results/dataplane.md` |
| FR-12 | The demo reaches a real verdict from one real document, and falls back to a committed fixture offline while saying so. The agent run puts a real language model in front of the same gate and a real person on the human port. | `demo/`, `agent/` |

**Non-functional**

| ID | Requirement | Acceptance criterion |
|---|---|---|
| NFR-1 | **Determinism.** Nothing that affects a result reads the wall clock, calls the network at run time, or uses unseeded randomness. | F8: two fresh gates, same 300-step sequence, byte-identical decisions *and* audit records. Re-running the simulations reproduces `results/*.json` byte for byte. |
| NFR-2 | **One dependency.** Exactly one runtime dependency, and it is the artifact under test. | `package.json` `dependencies` has one entry |
| NFR-3 | **Readability.** Files stay small and single-purpose; roughly 150 lines is the ceiling. The governor core stays under 70 lines. | Reviewed on every change; the import graph can be drawn with `npm run arch` |
| NFR-4 | **Traceability.** Every number in the article points at a file in `results/`. Artifacts the scripts do not measure are inventoried by hand. | [`docs/ARTIFACT-INVENTORY.md`](../ARTIFACT-INVENTORY.md) |
| NFR-5 | **Honest labelling.** Real, reference and synthetic parts are named in the docs *and* inside every result file. | Every `results/*.md` ends with a caveats section |
| NFR-6 | **Portability of the core.** The same core governs a data-centre workload and a charging fleet without change. | F7, plus the two simulations using the identical core |
| NFR-7 | **No unearned claims.** No wording implies a deployment, an adoption, or a merge that has not happened. | Reviewed on every change; the article's status table draws the same line |

**Out of scope**

- Persisting or signing the audit chain (it is in-memory and verifiable).
- Wiring the gate to a live approval board.
- Embodied carbon, power-usage-effectiveness, or hardware accounting. Emissions here are attributional: energy times grid intensity at run time.
- Any grid other than Great Britain.

## 4. User Stories

1. *As a reviewer of the article, I want every architectural claim to be executable, so that I can check it instead of believing it.*
   - Given a fresh clone, when I run `npm test`, nine fitness functions run against the shipped gate and report pass or fail per property.

2. *As a software architect, I want to read the whole policy in one sitting, so that I can judge whether the design is sound.*
   - Given `governor/carbon-governor.js`, when I open it, the budget, the pacing ratio and the four rungs are visible in under 70 lines with no imports to follow.

3. *As an engineer considering this pattern, I want to see what it costs as well as what it saves, so that I can decide honestly.*
   - Given `results/simulation.md`, when I read the tables, total emissions sit next to completed, degraded, dropped, delay and the number of human decisions per day.

4. *As someone meeting the idea for the first time, I want one command that shows the loop, so that I do not have to read anything first.*
   - Given `npm install`, when I run `npm run demo`, a real published document becomes a real verdict in seconds.

5. *As a replicator, I want the same numbers on my machine, so that I can trust the ones in the article.*
   - Given the committed cached traces, when I run `npm run simulate` offline, `results/simulation.json` comes back byte-identical.

6. *As a maintainer, I want adding a policy, a fitness function or a region to be a small, obvious edit, so that the package can grow without a rewrite.*
   - Given [`docs/DEVELOPMENT.md`](../DEVELOPMENT.md), when I follow the extension recipe, each addition is one file or one constant.

### Use-case scenarios

**UC-1 — Governed decision, allowed.**
*Given* a governor with a daily budget and little spent so far,
*when* an agent asks the gate about an action whose estimate keeps the pacing ratio below 0.8,
*then* the gate returns `allow`, an audit record is written, the action runs, and the actual grams are committed to the budget.

**UC-2 — Degrade.**
*Given* the pacing ratio would land at or above 0.8 but below 1.0,
*when* the action is evaluated,
*then* the gate returns `degrade`; deferrable work waits for the cleanest slot the peer signal predicts before its deadline, and non-deferrable work runs at 40% of its energy. No human is asked.

**UC-3 — Escalate to a human.**
*Given* the pacing ratio would land at or above 1.0 but below 1.1,
*when* the action is evaluated,
*then* the gate returns `escalate`, and `fitness/harness.js` refuses to run the action unless an approval object arrives with `approved: true`. In `npm run agent`, that approval is a real person typing at a terminal.

**UC-4 — Block or terminate, fail closed.**
*Given* a validator that throws, or a carbon estimate that is `NaN`, negative, missing or a string,
*when* the action is evaluated,
*then* the gate returns `block`, no exception escapes, nothing runs, and the refusal is audited. At a pacing ratio of 1.25 or above the verdict is `terminate`: the action stops outright and no human is asked.

**UC-5 — Measuring a peer.**
*Given* the public gateway's index,
*when* `npm run dataplane` runs,
*then* every subject document plus the gateway's own is fetched five times, checked against the draft's 8 mandatory and 16 optional members, validated against the schema by the reference consumer library, scanned for the in-band not-endorsed disclaimer, and aged against a fixed reference date rather than the wall clock.

**UC-6 — A charging night.**
*Given* fifty vehicles plugged in around 18:00 and due full by 07:00,
*when* the agent proposes moving each charge to the cleanest three-hour window the peer signal predicts and the gate evaluates the proposal,
*then* an `allow`, `degrade` or `escalate` verdict sends the proposal to the owner for approval, while `block` or `terminate` refuses the shift — and in every one of those cases the vehicle still receives its full charge before its deadline. What is withheld is the improvement, never the electricity.

## 5. Architecture

Full arc42 document: [`ARCHITECTURE.md`](ARCHITECTURE.md). Diagram sources and
rendering instructions: [`c4/README.md`](c4/README.md).

**The loop.**

![The Cybernetic Sustainability Loop](c4/loop-overview.png)

**Context (C4 level 1).**

![Context](c4/c4-context.png)

**Containers (C4 level 2).**

![Containers](c4/c4-container.png)

**Components (C4 level 3).**

![Components](c4/c4-component.png)

**Runtime — one governed decision.**

![Governed decision](c4/runtime-governed-decision.png)

**Runtime — one simulated day.**

![Simulated day](c4/runtime-simulated-day.png)

## 6. Implementation Map

| Article element | Implementation | Responsibility |
|---|---|---|
| Carbon-Verdict Governor (the hexagonal core) | `governor/carbon-governor.js` | Budget, pacing ratio, five-rung ladder, reference aggregation rule. Imports nothing. |
| The signal port | `carbonValidator()`, same file | Turns a governor decision into the shape the gate's validator interface wants |
| The actuation port, and the real enforcement point | `governor/gate.js` | Builds the shipped `ActionGate` with the governor registered and a real `AuditLog` behind it, on a deterministic injected clock |
| The human port | `fitness/harness.js` | The only path from a verdict to running something; `allow` and `degrade` run, anything higher needs an approved approval |
| Architecture fitness functions | `fitness/props.js`, `fitness/fN.test.js`, `fitness/report.js` | Nine properties, defined once, asserted by the test files and collected into `results/fitness.json` |
| Reproducible randomness | `shared/prng.js` (used by fitness and simulation) | Seeded mulberry32 |
| E1 — data-plane measurement | `dataplane/measure.js` | Live fetch and conformance check of every document the gateway serves |
| E1 part B — real traffic | `dataplane/logs.js` | Reads the already-pulled raw request-log capture and counts what it contains |
| E2 — governor versus baselines | `simulation/run.js`, `simulation/lib.js` | Three policies over the identical task list; five budget levels; ten seeds |
| E3 — gated charging shift | `simulation/charging.js` | Fifty vehicles, start-time shift only, two approval rates |
| Real grid traces | `simulation/fetch-traces.js` | The only script that touches the grid API; caches to `data/simulation/` |
| Result rendering | `simulation/report.js`, `fitness/report.js` | Markdown from JSON. Recomputes nothing. |
| The loop in one command | `demo/`, `agent/` | One real document to one real verdict; the agent variant puts a model in front and a person on the human port |
| Committed evidence | `data/`, `results/` | Cached inputs and shipped outputs, each with provenance and honesty labels |
| Novelty-claim hygiene | [`docs/SEARCH-PROTOCOL.md`](../SEARCH-PROTOCOL.md) | Sources, phrasings and dates of the adversarial prior-art search |
| Artifacts the scripts do not measure | [`docs/ARTIFACT-INVENTORY.md`](../ARTIFACT-INVENTORY.md) | Where each cited artifact lives and how its stated figure was checked |

## 7. Summary

This is the *evidence package*: nothing in it is a product, and every part of it
exists so that a specific sentence in the article can be checked or refuted.
Choosing the shipped gate over a mock, one dependency over a framework, committed
results over scripts-only, and a total-ordered ladder over a yes/no switch are the
four decisions that make the difference between a description and evidence. The
honest edges are drawn just as deliberately: the workload is synthetic, the peer
signal is biased low, the approvers are simulated, the gateway is the author's
own, and the governor paces a budget rather than capping it. Those limits are in
[`ARCHITECTURE.md`](ARCHITECTURE.md) section 11, in
[`docs/RESEARCH-QUESTIONS.md`](../RESEARCH-QUESTIONS.md), and in the caveats
section of every result file — not because a reviewer asked, but because a
replication package that hides them is not one.

## 8. References

- **Article.** A. N. Besleaga, "The Cybernetic Sustainability Loop: Governed Agentic Systems on a Sustainability Data Plane," submitted to *IEEE Software*, 2026.
- **IETF Internet-Draft.** A. N. Besleaga, "The `sustainability-data` well-known URI," `draft-besleaga-sustainability-wellknown`. https://datatracker.ietf.org/doc/draft-besleaga-sustainability-wellknown/
- **kaiban-distributed.** Open-source distributed agent runtime; ships the `ActionGate` and hash-chained `AuditLog` this package imports at npm version 2.0.0. https://github.com/andreibesleaga/kaiban-distributed
- **NESO Carbon Intensity API.** National Energy System Operator, Great Britain, 30-minute resolution, CC BY 4.0. https://carbonintensity.org.uk
- **Fitness functions.** N. Ford, R. Parsons and P. Kua, *Building Evolutionary Architectures: Support Constant Change*. O'Reilly, 2017.
- **Hexagonal architecture.** A. Cockburn, "Hexagonal architecture," 2005. https://alistair.cockburn.us/hexagonal-architecture
- **In this repository.** [`ARCHITECTURE.md`](ARCHITECTURE.md) · [`c4/`](c4/) · [`docs/adr/`](../adr/) · [`docs/DEVELOPMENT.md`](../DEVELOPMENT.md) · [`docs/RESEARCH-QUESTIONS.md`](../RESEARCH-QUESTIONS.md) · [`docs/FITNESS-FUNCTIONS.md`](../FITNESS-FUNCTIONS.md) · [`docs/SEARCH-PROTOCOL.md`](../SEARCH-PROTOCOL.md) · [`docs/ARTIFACT-INVENTORY.md`](../ARTIFACT-INVENTORY.md)
