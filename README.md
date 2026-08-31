# sustainability-loop-eval

The evaluation package for *The Cybernetic Sustainability Loop: Governed
Agentic Systems on a Sustainability Data Plane* (Andrei N. Besleaga, 2026;
submitted to *IEEE Software* on 22 August 2026 — preprint DOI
[10.5281/zenodo.22056747](https://doi.org/10.5281/zenodo.22056747)). It contains
the code, the data and the results behind every number the article states, so
you can check them or re-run them yourself.

> **The full research write-up — methods, tests, tables, caveats and
> conclusions — is one page: [RESEARCH.md](RESEARCH.md).** This README is the
> short version.

## The idea in plain words

- Websites already publish `robots.txt`. Imagine they also published how much energy they use and how dirty that energy is.
- The address is `/.well-known/sustainability-data` — one small JSON file per system.
- Then any software can *read* how clean another system is running.
- An agent uses that reading to decide whether to do a piece of work now, later, smaller, or not at all.
- The decision is not a yes/no. It is a **ladder**: allow, degrade, escalate, block, terminate — in that order, worst always wins.
- One **gate** applies the ladder to every action, records the decision, and never fails open.
- Doing the work changes how much energy the system used — which changes what it publishes next. That is the loop.

![Context](docs/architecture/c4/c4-context.png)

### The five verdicts

| Rung | Who decides | What happens |
|---|---|---|
| **allow** | nobody has to — it is automatic | The work runs, as proposed. |
| **degrade** | automatic | The work runs smaller, or waits for a cleaner hour. |
| **escalate** | a person | Nothing happens unless a person approves the smaller/later version. |
| **block** | a person, but only for a fallback | The work as proposed does not happen. A person may authorise the smaller or later version instead — nothing else. |
| **terminate** | nobody can | Nothing runs. It cannot be overridden, not even with an approval. |

The exact per-experiment semantics are in
[RESEARCH.md](RESEARCH.md#what-each-rung-actually-means) and
[ADR-006](docs/adr/ADR-006-human-port-and-stop-rungs.md).

## Try it in 30 seconds

```bash
node -v          # 22.9 or newer
npm install      # one dependency: the real governance gate
npm run demo     # one real document -> all five verdicts
npm run agent    # optional: a real model proposes, the real gate decides (OPENROUTER_API_KEY in .env)
```

Demonstration only — no number in `results/` comes from the demos.
`npm install` prints advisories from the one dependency's own tree; they are
explained in [RESEARCH.md](RESEARCH.md#try-it-in-30-seconds). `npm test` runs
everything: 33 unit tests, the twelve architecture checks through the real
gate, and a check that every number in these pages still matches `results/`.

## Headline results

- **The safety properties hold in shipped code.** 12/12 green over 13,392 cases against the real `kaiban-distributed` gate: worst verdict always wins, bad input refuses instead of allowing, nothing above `degrade` runs without a human, `terminate` never runs at all, and the audit log catches tampering.
- **The data plane is real and cheap to read.** 12 documents, 100% valid, median 44.6 ms and about 1.3 kB per fetch; 120 requests from 26 clients in the log window — reachability shown, adoption not yet.
- **The governor cuts emissions — by also doing less work.** At an 80% budget: **−16.45%** carbon in winter and **−20.27%** in summer versus always running, against −1.54% and −2.97% for plain threshold deferral. About 15% of tasks run reduced and a few are dropped; read the emissions next to the completed counts, never alone.
- **Charging:** 32.51% of session emissions avoided in winter and 16.04% in summer at full approval (25.93% and 12.77% at 80% approval) — cars only shift *when* they charge, never how much, and every car still charges fully.
- **The whole core is** [`carbon-governor.js`](governor/carbon-governor.js) (104 lines, imports nothing) plus a 44-line actuation harness.

The honest catches — the governor paces a budget rather than capping it,
humans are the bottleneck (~19–30 approvals/day simulated), the workload is
synthetic, the gateway is the author's own — are spelled out with every number
in [RESEARCH.md](RESEARCH.md#what-we-found) and
[docs/LIMITATIONS.md](docs/LIMITATIONS.md), which also carries seven further
limitations measured in a 2026-08-31 audit (R11–R17): shifted load synchronises
onto one slot, no experiment consumes the gateway's own documents as its signal,
and in the charging run the saving is the scheduler's, not the gate's.

**Real:** the gate, the audit log, the gateway documents, the grid traces.
**Synthetic:** the workload, the EV fleet, the approver.
**Designed, not built:** the forecast port, the board wiring. Full labels:
[RESEARCH.md](RESEARCH.md#what-is-real-and-what-is-simulated--read-this-first).

## Run the evaluation

| Question | Command | Results |
|---|---|---|
| Does the architecture hold its properties? | `npm test` | [results/fitness.md](results/fitness.md) |
| Is the data plane usable as a signal? | `npm run dataplane` | [results/dataplane.md](results/dataplane.md) |
| What does the governor do on real grid data? | `npm run simulate` | [results/simulation.md](results/simulation.md) |
| Can gated charging shift help? | `npm run charging` | [results/charging.md](results/charging.md) |

Simulation and fitness are deterministic (fixed windows, seeded randomness) and
reproduce `results/` byte for byte; only the live data-plane run varies. All
commands, keys and environment details: [RESEARCH.md](RESEARCH.md#run-the-evaluation)
and [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## All the research, one hop each

| Page | What it answers |
|---|---|
| [**RESEARCH.md**](RESEARCH.md) | The full write-up: findings, numbers, corrections, versions, everything below in context |
| [Research questions](docs/RESEARCH-QUESTIONS.md) | The three questions, what would falsify each, the current answers |
| [Results: fitness](results/fitness.md) · [data plane](results/dataplane.md) · [simulation](results/simulation.md) · [charging](results/charging.md) | The four experiments' full tables and caveats |
| [Limitations](docs/LIMITATIONS.md) | Every limitation, once, canonically |
| [Architecture (arc42)](docs/architecture/ARCHITECTURE.md) · [C4 diagrams](docs/architecture/c4/README.md) | How it is built and why |
| [Product design](docs/architecture/PRODUCT.md) | Who it is for, requirements, use cases |
| [Decision records](docs/adr/) | Eighteen short "why" notes |
| [Fitness functions](docs/FITNESS-FUNCTIONS.md) | What each of the twelve checks proves |
| [Search protocol](docs/SEARCH-PROTOCOL.md) | How the novelty claims were tested by trying to refute them |
| [Artifact inventory](docs/ARTIFACT-INVENTORY.md) | Every artifact the article cites and how it was checked |
| [Development guide](docs/DEVELOPMENT.md) | Run, extend, regenerate, cite |
| [Changelog](CHANGELOG.md) | What changed between v1.0.0 (the article's snapshot) and now |


![The loop](docs/architecture/c4/loop-overview.png)

## Versions and corrections

The article cites **v1.0.0** (Zenodo
[10.5281/zenodo.22056634](https://doi.org/10.5281/zenodo.22056634)); this
branch is **v1.1.0**, a hardening pass — no headline number changed. The
correction is stated openly in
[RESEARCH.md → Corrections](RESEARCH.md#corrections-relative-to-the-submitted-article-v100).

## Cite and license

Machine-readable citation: [`CITATION.cff`](CITATION.cff). Package concept DOI:
[10.5281/zenodo.22056633](https://doi.org/10.5281/zenodo.22056633).

Three licences apply: **code** GPL-3.0-only ([LICENSE](LICENSE)); **docs,
figures and write-ups** © Andrei N. Besleaga, all rights reserved; **grid
data** © National Energy System Operator, CC BY 4.0. Details:
[RESEARCH.md → Citation and license](RESEARCH.md#citation-and-license).
