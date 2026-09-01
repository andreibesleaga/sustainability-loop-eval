# Research — the full evaluation write-up

> This is the complete research page for **sustainability-loop-eval**: every
> experiment, every number, every test, every caveat and every conclusion, in
> full. For the short version, start at the [README](README.md).

## What this is

This is the evaluation package for the article *The Cybernetic Sustainability
Loop: Governed Agentic Systems on a Sustainability Data Plane* (Andrei N.
Besleaga, 2026; submitted to *IEEE Software* on 22 August 2026 — preprint DOI
[10.5281/zenodo.22056747](https://doi.org/10.5281/zenodo.22056747), record restricted until the editorial decision). It contains the code, the data and the results behind every
number the article states, so you can check them or re-run them yourself. It is a
reference architecture with an early evaluation — work in progress, not something
running in production anywhere.

## The idea in plain words

- Websites already publish `robots.txt`. Imagine they also published how much energy they use and how dirty that energy is.
- The address is `/.well-known/sustainability-data` — one small JSON file per system.
- Then any software can *read* how clean another system is running right now.
- An agent uses that reading to decide whether to do a piece of work now, later, smaller, or not at all.
- The decision is not a yes/no. It is a **ladder**: allow, degrade, escalate, block, terminate — in that order, worst always wins.
- One **gate** applies the ladder to every action, records the decision, and never fails open.
- Doing the work changes how much energy the system used — which changes what it publishes next. That is the loop.

### What each rung actually means

Stopped, refused and paused are three different things, and it is worth being
exact about which is which:

| Rung | Who decides | What happens |
|---|---|---|
| **allow** | nobody has to — it is automatic | The work runs, as proposed. |
| **degrade** | automatic | The work runs smaller. If it can wait, it is **paused** instead and runs later at full size, in the cleanest slot the signal predicts before its deadline. No one is asked. |
| **escalate** | a person | Nothing happens unless a person approves. If they do, the work runs smaller or waits — the same thing `degrade` would have done. |
| **block** | a person, but only for a fallback | The work as proposed does not happen. A person may authorise the smaller or later version instead, and nothing else. Without that, nothing runs. |
| **terminate** | nobody can | Nothing runs. No one is asked. It cannot be overridden, not even with an approval. |

A **paused** task is gated once, when it arrives — that is the decision that gets
audited — and then simply runs later. It has not been refused and it has not been
stopped. The full table, per experiment, is in
[ARCHITECTURE §8](docs/architecture/ARCHITECTURE.md#8-cross-cutting-concepts) and
[ADR-006](docs/adr/ADR-006-human-port-and-stop-rungs.md), and every word of the
vocabulary is in the [glossary](docs/architecture/ARCHITECTURE.md#12-glossary).

**Human decisions**, wherever this repository counts them, means *every escalate
verdict plus every block verdict*.

![The loop](docs/architecture/c4/loop-overview.png)

## What we found

The honest version, with the numbers and the catches together.

- **The safety properties hold in shipped code.** Thirteen executable checks against the real gate, all green over 14,966 cases. The gate always picks the worst verdict, refuses on bad input instead of allowing, never runs anything above "degrade" without a human, never runs "terminate" at all, and its audit log catches tampering. (Nine of the thirteen, over 10,994 cases, are what the article cites; four were added afterwards. See **Versions** below.)
- **The data plane is real and cheap to read.** Twelve live documents, all valid, median 44.6 ms and about 1.3 kB per fetch.
- **The governor cuts emissions.** About 16% less carbon in winter and 20% less in summer than just running everything, against 1.5% and 3.0% for ordinary carbon-aware scheduling.
- **But it does less work to get there.** Around 15% of tasks run in a reduced mode and some are dropped. Read the emissions column next to the completed and dropped columns, never alone.
- **It paces a budget; it does not cap it.** Half the days still end over budget, because work deferred past midnight spends the next day's allowance.
- **Humans are the bottleneck.** Roughly 19 to 30 approvals a day in the simulation. Dropping the approval rate from 100% to 80% cuts the charging saving almost proportionally.
- **The peer signal is biased.** It tracks the real grid closely in shape but sits low in level, so it is good for choosing *when* to run and not yet good for setting an absolute budget.
- **The workload is made up.** Task arrivals, energy per task and the EV fleet are stipulated numbers, not measurements. Real loads would move the percentages.
- **The gateway is the author's own.** No independent organization publishes into it yet. Discovery and comparability are shown; adoption is not — and the request log shows crawlers, not consumers.
- **The approvers are simulated.** Real human friction, delay and fatigue are untested.

Every limitation in this package is listed once, canonically, in
[`docs/LIMITATIONS.md`](docs/LIMITATIONS.md), with an index of every other place
it is stated.

## Try it in 30 seconds

```bash
node -v          # 22.9 or newer
npm install      # one dependency: the real governance gate
npm run demo     # one real document -> all five verdicts
npm run agent    # optional: a real model proposes, the real gate decides (OPENROUTER_API_KEY in .env)
```

**Demonstration only: no number in `results/` comes from `npm run demo` or
`npm run agent`.** They exist to show the loop, not to measure it.

`npm install` prints advisories (21 as of 2026-08-22). All are in transitive
dependencies of `kaiban-distributed` (its kaibanjs / LangChain tree), not in this
package. Importing the package root loads its whole dependency tree, including
the advisory-bearing LangChain modules — they are in the process. Nothing here
invokes them: this package uses only `ActionGate`, `AuditLog` and the severity
table. They were verified not to patch `fs`, `http` or `fetch` on import. Bumping
them is upstream's job.

## What happens when you run it

| Command | What it does | Headline result |
|---|---|---|
| `npm run demo` | Reads one real document from the public gateway, turns its carbon figure into estimates for five actions, sends them through the real gate, prints all five verdicts and what each one means. Falls back to a saved copy offline, and says so. | A real verdict in seconds |
| `npm run agent` | A real language model (`anthropic/claude-sonnet-5` via OpenRouter, plain HTTPS, no SDK) reads a real peer document and proposes a task. The proposal goes through the same real gate. If the verdict is `escalate`, **you** approve or refuse at the terminal; if it is `block`, you are asked whether to authorise a reduced run instead; if it is `terminate`, you are not asked at all. Needs `OPENROUTER_API_KEY` (put it in a gitignored `.env`); without one it explains and exits. | You are the human in the loop |
| `npm test` | 46 unit tests for the adapters' own arithmetic, then the thirteen architecture checks through the real `kaiban-distributed` gate, then `check:docs`. | 13/13 green over 14,966 cases; the runtime's own governance suite (4 files, 71 tests) passes at commit `17ad362` |
| `npm run fitness` | The thirteen architecture checks on their own. | as above |
| `npm run dataplane` | Fetches and checks every document in the gateway's subject registry, five times each, then summarises the gateway's real request logs. | 12 documents, 100% valid, all 8 mandatory fields on each, median 44.6 ms and 1296.5 bytes, not-endorsed notice on 9/9 real-organization documents, 2 organizations honestly recorded as publishing nothing, 120 requests from 26 clients over the roughly one-week log window |
| `npm run simulate` | Replays a made-up agent workload over real Great Britain grid data, January and July 2026, under the policies and ten random seeds. | At an 80% budget: **−16.45%** carbon in winter and **−20.27%** in summer versus always running, against **−1.54%** and **−2.97%** for plain threshold deferral. 7996.6 and 7698.8 of about 8075 tasks completed; 1238.2 and 1220.9 run reduced; 545.7 and 853 human decisions over 28 days (about 19 and 30 a day); 14 and 14.4 of 28 days over budget. Peer signal matches the real grid at r = 0.96 and 0.986. |
| `npm run charging` | Fifty electric cars shift *when* they charge, never how much, under the gate and an owner's approval. The patented demand-shaping mechanism the article cites as provenance is **not** implemented or simulated here (ADR-011). | **32.51%** of charging emissions avoided in winter and **16.04%** in summer at full approval; **25.93%** and **12.77%** at 80% approval |
| `npm run fetch-traces` | Fetches and caches the real grid data. Run once. | Two 28-day windows, 1344 half-hour slots each, zero gaps |
| `npm run check:docs` | Re-reads every hand-typed headline number in this README and the docs and compares it with `results/`. | Fails if a document has drifted from the file it points at |
| `npm run arch` | Checks for circular imports. | None |
| `npm run arch:graph` | Draws the whole import graph. | Shows the core has no edges out — this is what produced `results/madge.txt` |

Every number above is produced by a script and written to `results/`. Read
[`results/fitness.md`](results/fitness.md),
[`results/dataplane.md`](results/dataplane.md),
[`results/simulation.md`](results/simulation.md) and
[`results/charging.md`](results/charging.md) for the full tables and the caveats
that go with them.

> **Note on E1.** The schema check in `npm run dataplane` uses the published
> reference consumer library, which is deliberately *not* a dependency of this
> package. Install it with `npm i --no-save sustainability-wellknown-consumer@0.5.2`
> to reproduce the conformance figure, or point `SUSTAINABILITY_CONSUMER_URL` at a
> local build. Without it the run still measures everything else and reports
> conformance as **"not measured"** — never as 0%. See
> [ADR-017](docs/adr/ADR-017-consumer-library-optional.md).

## What this could mean — by the numbers (indicative, not a forecast)

All of this comes from `results/simulation.json` and `results/charging.json`. It
is a simulation on a made-up workload over one country's grid. Treat it as an
order of magnitude, not a prediction.

**Emissions, versus running everything immediately** (28-day windows, ten seeds,
percentage of tasks completed in brackets):

| Budget setting | Winter | Summer |
|---|---|---|
| Loosest budget (100% of the always-run median) — *worst case for saving, best for work done* | **−10.86%** (100% of tasks completed) | **−11.72%** (98.7% completed) |
| Middle budget (80%) | **−16.45%** (99.0% completed) | **−20.27%** (95.3% completed) |
| Tightest budget (60%) — *best case for saving, worst for work done* | **−25.22%** (92.7% completed) | **−33.37%** (86.6% completed) |
| Plain carbon-aware baseline (threshold deferral) | −1.54% (100% completed) | −2.97% (100% completed) |

**Charging shift, per session:** 32.51% avoided in winter and 16.04% in summer at
full approval; 25.93% and 12.77% at 80% approval. The worst of those four is
**12.8%**, and every car still charges fully either way.

**Energy (derived here, not a measured column).** A degraded run uses 40% of the
energy, so it saves 60%; a dropped task saves all of it. At the 80% budget:

- Winter: (1238.2 degraded × 0.6 + 78.5 dropped) ÷ 8075.1 tasks = **10.2%** of workload energy not spent.
- Summer: (1220.9 × 0.6 + 376.3) ÷ 8075.1 = **13.7%** not spent.

**Do not add these to the emissions figures.** The 10.2% and 13.7% are *inside*
the −16.45% and −20.27%, not on top of them: doing less work is part of why the
emissions fell. Same saving, two views.

**One normalized illustration.** The winter trace averages **152.9 gCO2e/kWh**
(`meanNationalActualGPerKWh` in `results/simulation.json`). So per **1,000 kWh of
requested agentic workload** on that grid:

- Always run it all: 1,000 × 152.9 g ≈ **153 kg CO2e**, and all 1,000 kWh is spent.
- Governor at the 80% budget: 153 × (1 − 0.1645) ≈ **128 kg**, about **25 kg avoided** — and only about 900 kWh is actually spent, because 1% of the work is dropped and 15% runs reduced.
- Governor at the loosest budget: 153 × (1 − 0.1086) ≈ **136 kg**, about **17 kg avoided**, with every task completed.

Money is not modelled here at all. Cost savings follow whatever you pay for
electricity, so any euro figure would be an assumption, not a result.

**The limits, once more:** synthetic workload, one grid, one country, two 28-day
windows, ten seeds, simulation. And scaling this across many services is the
*point* of the architecture — it is **not** measured here, and nothing in this
repository supports a worldwide or planet-scale number.

## Corrections relative to the submitted article (v1.0.0)

The article was submitted on 22 August 2026 and is frozen. Where checking this
package against it found something imprecise, the correction is stated here
rather than quietly fixed. Each one is small; none changes a headline number.

- **"Block withholds the action unless a human authorizes a degraded fallback."** The precise behaviour in this package is the rung table above. Deferrable work that is blocked is *rescheduled* — paused, then run later at full energy — rather than run degraded; only non-deferrable work runs reduced, and only on a human's authorisation. `terminate` is never overridable. In the charging experiment `block` has no fallback at all.
- **"Every document the public gateway serves (twelve)."** Twelve is the gateway's *subject registry*: nine mappings of real organizations, two synthetic `*.example` subjects, and the gateway's own document. The gateway also serves 22 adapter and wire-format demonstration documents. Experiment E1 does not measure those, and no figure in this package includes them.
- **"11–12% for the loosest budget, with 99–100% of work completed."** The measured figures are **10.86%** in winter and **11.72%** in summer, with **100%** and **98.7%** of work completed. The article's range rounds the winter figure up.
- **"120 requests from 26 clients."** That is correct as a count, and it is evidence of *reachability*, not of demand. Most of the traffic is crawlers — 41 of the 120 requests were 4xx, the top paths are `/robots.txt`, `/` and `/favicon.ico`, and 35 subjects were requested against 11 actually served — and the window includes this evaluation's own probes, left in rather than filtered. No independent consumer was observed.
- **Figure 2 draws the actuation-port → MCP-servers edge as solid, meaning implemented.** It is designed and simulated only, like the other actuation edges. Figure 1 shows the approval board and the Sustainability-First Consensus norms box as built: the action gate *is* built, but the approval-board wiring and the normative criteria are designed, not built.
- **"19 and 30 escalate-or-block cases per day."** That is exactly the definition this package uses: a human decision is every `escalate` verdict plus every `block` verdict. Since "block on deferrable work asks a human" is a design choice rather than a law, the simulation now also reports what the count would be if deferring blocked work were automatic: 442.9 (winter) and 637 (summer) over 28 days — about 16 and 23 a day — against 545.7 and 853 when every block is approved; the difference is the 102.8 and 216 block verdicts on deferrable work.
- **Upstream dependency licence.** `kaiban-distributed@2.0.0` **on npm** is Apache-2.0. The GitHub repository is GPL-3.0 dual-licensed; the npm artifact this package imports is the Apache-2.0 one.

## Run the evaluation

| Question in the article | Folder | Command | What it is |
|---|---|---|---|
| Does the architecture hold its properties? | `fitness/` | `npm test` | thirteen executable **architecture fitness functions** run through the *shipped* `kaiban-distributed` gate (npm 2.0.0) |
| Is the data plane usable as a control signal? | `dataplane/` | `npm run dataplane` | **live measurement** of every document in the gateway's subject registry, plus real request logs |
| What does the governor do on real grid conditions? | `simulation/` | `npm run simulate`, `npm run charging` | **trace-driven simulation** on real Great Britain half-hourly carbon intensity (NESO, CC BY 4.0), governor versus baselines; gated EV-charging shift |
| The reference core itself | `governor/` | — | [`carbon-governor.js`](governor/carbon-governor.js) (104 lines, imports nothing), [`harness.js`](governor/harness.js) (the human port, also imports nothing) and `gate.js` (wires the core into the real gate) |
| Why the novelty claims are worded as they are | [`docs/SEARCH-PROTOCOL.md`](docs/SEARCH-PROTOCOL.md) | — | sources, phrasings and dates of the adversarial prior-art search |

`npm run all` runs the fitness report, then simulate, then charging, then
dataplane. The live step is last on purpose: everything deterministic finishes and
can be diffed before anything touches the network.

Simulation and fitness are deterministic — fixed past windows, seeded random
numbers, an injected clock — so re-running reproduces `results/*.json` byte for
byte. The data-plane step is live: latency and the `fetchedAt` stamp will differ,
nothing else should.

## About kaiban-distributed

`kaiban-distributed` is an open-source distributed agent runtime. It ships the
`ActionGate` and the hash-chained `AuditLog` that this package imports from npm at
version 2.0.0 and uses as the real enforcement point. Nothing here mocks it.

**What is upstream's, and what is this package's.** The runtime ships the
aggregation rule (most-severe-wins), the fail-closed behaviour when a validator
throws, the hash-chained audit log, and the registry kill-switch. It does **not**
ship the meaning of the rungs: its default actor path treats `allow` and `degrade`
as "proceed" and sends `escalate`, `block` and `terminate` alike to a dead letter,
with no human-approval port. The rung semantics above — the human port, `block` as
a refusal a person may convert into a fallback, `terminate` as a stop nobody can
lift — are **this package's contribution**. So F1, F2, F5, F6, F8 and F9 test
shipped code; F3 and F4 test these semantics; F7, F10, F11 and F12 test this
repository's structure and honesty.

One upstream gap, recorded rather than hidden: the shipped gate ranks verdicts by a
severity table that has no entry for an action outside the ladder, so such an
action is passed through verbatim and can even outrank a real `terminate` (measured
in F2: `[allow, "not-a-rung", terminate]` came back `allow`). This package
re-aggregates fail-closed whenever any verdict is off the ladder, keeping the
shipped answer under `rawAction`. To be reported upstream.

The **carbon validator is a reference implementation living in this repository**.
It is not merged into the runtime and is not part of any release of it.

You do **not** need a full deployment of that runtime — Docker, Redis or Kafka
brokers, the board, running agents — to reproduce anything here. The gate is
in-process code and its semantics do not depend on a broker. A carbon-governance
example inside the runtime's own examples repository is future work.

## API keys and network

Everything runs offline from cached data except these:

| Command | Reaches | Key needed |
|---|---|---|
| `npm run dataplane` | the public gateway | none |
| `npm run fetch-traces` | the NESO Carbon Intensity API | none, keyless |
| `npm run demo` | one document from the gateway (saved copy if offline) | none |
| `npm run agent` | the gateway and the OpenRouter API | `OPENROUTER_API_KEY` (in `.env`, gitignored) |

Export the key in your shell; never commit it. If you keep it in a `.env` file,
that file is git-ignored. The full list of environment variables — all optional,
none needed by anything that produces a number — is in
[`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md).

## Where the budget's "should" comes from

The article's normative layer — the criteria a budget is judged against — comes from
the author's *Sustainability-First Consensus* framework (Communications of the ACM,
in press), generalized in the article from ledgers to any long-running software
system. This package evaluates the loop beneath that layer (signal plane, governor,
gate, actuation); it does not evaluate or reproduce the framework itself, and the
criteria themselves are designed, not built.

## What is real and what is simulated — read this first

- **Real:** the governance gate and audit log (shipped code, imported, not mocked); the gateway documents and their conformance; the request logs; the carbon-intensity traces.
- **Reference implementation:** the Carbon-Verdict Governor core and the actuation harness (`governor/`) — the article's specification made executable here; *not* merged into any released runtime.
- **Synthetic, and labeled as such in every result file:** the agentic workload, the EV fleet, the simulated human approver; the three regional "peer" series are the API's forecasts.
- **Designed, not built:** the forecast port, the wiring from the gate to a real approval board, the actuation edge to the charging tool servers, and the normative criteria above.
- The gateway is the author's own reference deployment; its real-organization documents are mapped by the author from public reports (each carries an in-band not-endorsed disclaimer).

## Folder map

| Folder | What is in it |
|---|---|
| `governor/` | The reference core, the actuation harness (the human port), and the adapter that plugs the core into the real gate |
| `fitness/` | Twelve architecture checks, the import-graph scanner, and the report renderer |
| `shared/` | The seeded random generator and one definition of median, p95 and standard deviation for the whole package |
| `simulation/` | The two trace-driven experiments and their shared plumbing |
| `dataplane/` | Live measurement of the gateway and analysis of its real request logs |
| `demo/` | `demo.js` — one document, five verdicts. `agent.js` — the same with a real language model, and you on the approval step |
| `tools/` | `check-numbers.js`: the script behind `npm run check:docs` |
| `data/` | Cached inputs: grid traces, fetched documents, raw request logs |
| `results/` | Committed outputs (see below) |
| `docs/` | Architecture, product spec, decision records, research questions, limitations, search protocol, inventory |

### What is in `results/`

| File | What it is |
|---|---|
| `fitness.json`, `fitness.md` | The thirteen properties, their case counts and their notes. Both rendered from the run; neither is hand-written. |
| `bounds.json`, `bounds.md` | The maximum-optimisation calculus: deterministic ceilings (per horizon, signal and deferrable fraction; perfect-signal, interruptible and spatial bounds) that every seeded arm must sit under. |
| `loop.json`, `loop.md` | E5 — the multi-party closed loop, measured: the published plane spreads the herd only by paying grams, fresh mutual observation oscillates, and the effect washes out at large N. |
| `routing.json`, `routing.md` | E6/E6b — routed charging (when AND where) and daily geo-migration, forecast-scored with the spatial-Goodhart warning stated by the tool itself. |
| `simulation.json`, `simulation.md` | Experiment E2: every policy, budget level, window and seed, and a plain reading of them. |
| `charging.json`, `charging.md` | Experiment E3: the gated charging shift at two approval rates. |
| `dataplane.json`, `dataplane.md` | Experiment E1: per-document measurements and the request-log summary. The only file whose numbers move between runs. |
| `kaiban-upstream-tests.json` | The runtime's own governance suite, summarised: 71 tests at commit `17ad362`. |
| `kaiban-vitest-raw.json` | The unedited vitest output behind that summary, so the summary can be checked. |
| `kaiban-upstream-e2e.json`, `kaiban-upstream-e2e-raw.json` | The runtime's end-to-end suite against a real Redis broker: 69 tests, 11 files, same commit. |
| `madge.txt` | The full import graph, produced by `npm run arch:graph`. The evidence behind "the core has no edges out". |

## Versions

- **v1.0.0** — Zenodo [10.5281/zenodo.22056634](https://doi.org/10.5281/zenodo.22056634). The snapshot the article cites: nine fitness functions, 9/9 green over 10,994 cases. Every number the article prints comes from this tag.
- **`main` / v1.1.0** — Zenodo [10.5281/zenodo.22068404](https://doi.org/10.5281/zenodo.22068404) (where the concept DOI now resolves). A hardening pass. The rung semantics written down once and enforced, the actuation harness moved into `governor/`, three new fitness functions (F10 audit anchoring, F11 core invariants, F12 documentation-agrees-with-results), a portable data-plane run, client IP addresses hashed, and a documentation pass.

None of the headline simulation, charging or data-plane numbers changed. The
fitness totals changed because properties were added, not because anything
failed. [`CHANGELOG.md`](CHANGELOG.md) lists every change and says which numbers
moved.

## Architecture docs

![Context](docs/architecture/c4/c4-context.png)

- [**Architecture (arc42)**](docs/architecture/ARCHITECTURE.md) — all twelve sections: goals, constraints, context, strategy, building blocks, runtime, deployment, cross-cutting concepts, decisions, quality, risks, glossary.
- [**Product design**](docs/architecture/PRODUCT.md) — what it is for, numbered requirements, user stories, use cases.
- [**C4 diagrams**](docs/architecture/c4/README.md) — six pictures with their Mermaid sources: [context](docs/architecture/c4/c4-context.png), [containers](docs/architecture/c4/c4-container.png), [components](docs/architecture/c4/c4-component.png), [a governed decision](docs/architecture/c4/runtime-governed-decision.png), [a simulated day](docs/architecture/c4/runtime-simulated-day.png), [the loop](docs/architecture/c4/loop-overview.png).
- [**Decision records**](docs/adr/) — eighteen short notes on why each choice was made.
- [**Development guide**](docs/DEVELOPMENT.md) — how to run, extend, keep determinism, regenerate results, and cite.
- [**Research questions**](docs/RESEARCH-QUESTIONS.md) — the three questions, what would prove each wrong, the current answers, the limits.
- [**Fitness functions**](docs/FITNESS-FUNCTIONS.md) — what each of the thirteen checks is, and why it matters.
- [**Limitations**](docs/LIMITATIONS.md) — the canonical list, and where every other file states it.
- [**Roadmap**](docs/ROADMAP.md) — the post-audit addendum: what this evaluation proved, what it did not, what a real "when and where" deferral mechanism would be, and the work packages that would settle it. Written after submission; it never edits the article.
- [**Executive case**](docs/EXECUTIVE-CASE.md) — one page: the measured numbers, the verified absences that make it new, the economics, and who it serves.
- [**Runbook**](docs/RUNBOOK.md) — the execution manual: standing constraints and a ready-to-paste agent brief per work package.
- [**Glossary**](docs/architecture/ARCHITECTURE.md#12-glossary) — every term, including the five rungs, the deferral queue, the budget factor, and pacing versus capping.
- [**Search protocol**](docs/SEARCH-PROTOCOL.md) — how the novelty claims were tested by trying to refute them.
- [**Artifact inventory**](docs/ARTIFACT-INVENTORY.md) — every artifact the article cites, where it lives, how its figure was checked.

## Principles

- **Hexagonal core.** The governor knows nothing about HTTP, charging protocols or approval boards. Swap every adapter and the core is unchanged. A check enforces it.
- **Fail closed.** A broken check, a nonsense input, or a verdict that is not on the ladder becomes `block`, never `allow`.
- **A human where it is irreversible.** Nothing above "degrade" runs without an explicit approval — and "terminate" does not run even with one.
- **One actuation path.** Every adapter runs its work through `governor/harness.js`. A check enforces that too.
- **Determinism.** No wall clock, no live network, no unseeded randomness in anything that produces a conclusion.
- **Honesty labels.** Real, reference, synthetic and designed-not-built are named everywhere, including inside the result files.
- **Simplicity.** One dependency, no build step, small files, a core you can read in one sitting.

## Status and roadmap

Work in progress. The data plane is live and measured; the ladder and gate are
implemented and tested where they ship; the carbon validator and the actuation
harness are reference implementations evaluated here and not merged anywhere; the
forecast port and the wiring from the gate to a real approval board are designed,
not built; the charging-protocol tool servers are separate prototypes and are not
evaluated here.

What would change the numbers, roughly in order of how much:

1. A real agentic workload replacing the made-up one.
2. Real approvers instead of simulated ones.
3. Independent organizations publishing their own documents, so the peer signal is not a stand-in.
4. More regions, more windows, more countries, more seeds.
5. A live charging-protocol call behind the gate instead of a simulated one.

The open problem is the loop actually closing between independent parties. That
is why the convention is published rather than kept.

## Original, verifiable work

The claims here rest on the author's own public artifacts and on numbers this
package regenerates: the IETF Internet-Draft with its live gateway and libraries,
the kaiban-distributed runtime and its shipped gate, the carbon-governor reference
implementation, the fitness functions, the live measurements, the simulations on
real grid data, and the co-invented patent cited as provenance. Every number can be
regenerated with one command, every property re-run, every artifact fetched. Judge
the work by what runs.

## Citation and license

Cite the article, and this package as its replication material. Machine-readable
metadata is in `CITATION.cff`.

- **Article (preprint, submitted version):** A. N. Besleaga, "The Cybernetic Sustainability Loop: Governed Agentic Systems on a Sustainability Data Plane," submitted to *IEEE Software*, 22 August 2026. Zenodo DOI [10.5281/zenodo.22056747](https://doi.org/10.5281/zenodo.22056747) (restricted until the editorial decision; replaced by the IEEE citation on acceptance).
- **This package:** archived release v1.0.0, Zenodo DOI
  [10.5281/zenodo.22056634](https://doi.org/10.5281/zenodo.22056634)
  (concept DOI, all versions:
  [10.5281/zenodo.22056633](https://doi.org/10.5281/zenodo.22056633)).

Copyright © 2026 Andrei N. Besleaga. Three licences apply and they are not the
same thing:

- **Source code** (all `*.js` files, `package.json`, `tools/`) — **GNU GPL v3.0 only**. See [`LICENSE`](LICENSE) for the full text. The v1.0.0 release archived on Zenodo (10.5281/zenodo.22056634) contains an MIT licence file; its Zenodo record's licence metadata was later set by the author to GPL-3.0 (Zenodo lists it as `gpl-3.0-or-later`); from v1.1.0 the code in this repository is GPL-3.0-only.
- **Documentation, text, diagrams, figures and result write-ups** (`README.md`, `CHANGELOG.md`, `docs/**`, `results/*.md`, `*.mmd`, `*.png`) — © Andrei N. Besleaga, **all rights reserved**. Not covered by the GPL. Please cite the article and the Zenodo DOI when using them.
- **Carbon-intensity data** — © National Energy System Operator, **CC BY 4.0**. The attribution travels with the data and must be carried forward in anything derived from these results.

The gateway snapshots under `data/dataplane/` are described in `LICENSE`: the
documents for real organizations are illustrative mappings prepared by the gateway
operator from those organizations' public reports, and are not published,
reviewed, authorized or endorsed by the organizations named in them.

The one runtime dependency, **`kaiban-distributed@2.0.0` on npm, is Apache-2.0**,
which is compatible with GPL-3.0. (The project's GitHub repository is GPL-3.0
dual-licensed; the npm artifact this package imports is the Apache-2.0 one.)
