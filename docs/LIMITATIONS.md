# Limitations — the canonical list, and where else they are stated

This file exists so that a reader can check one thing: that every place this
repository admits a limit admits the *same* limit, in the same words. It adds no
new caveat. It is an index.

The canonical list is **R1 to R10**, defined here and repeated in
[`ARCHITECTURE.md` section 11](architecture/ARCHITECTURE.md#11-risks-and-technical-debt).
If any other file disagrees with this one, this one and section 11 are right and
the other file is a defect.

## R1 to R10

| # | Limitation | What it means | What would fix it |
|---|---|---|---|
| **R1** | **The workload is synthetic** | Task arrivals, task energy, the deferrable half, and the cost of degraded mode are all stipulated numbers, not measurements. The percentages move with the workload. | Replay a real trace of a real agentic service |
| **R2** | **The peer signal is biased** | The three "peers" are regional forecasts from the grid API. They track the national actual closely in *shape* (Pearson r 0.96 in winter, 0.986 in summer) but sit low in *level* — one region is near-zero-carbon all summer. An agent that used them to set an absolute budget would set it wrong. | Calibrate peer signals before using them as levels, and get real peers publishing |
| **R3** | **The governor paces, it does not cap** | Days still end over budget, because deferred work commits into the next day and non-deferrable work is throttled but not stopped short of the top rung. This is a property of the design, not a bug. | A hard cap would need a different design and a different safety argument |
| **R4** | **Less emission means less work done** | The governor's savings are partly because it drops and degrades tasks. Total grams must always be read next to completed, degraded and dropped counts. | Read the tables together; never quote the emissions column alone |
| **R5** | **The author measures his own gateway** | The gateway is the article author's reference deployment, and its real-organization documents are illustrative mappings prepared by the operator from public reports — not published or endorsed by those organizations. Discovery and comparability are demonstrated; third-party adoption is not. | An independent organization publishing its own document |
| **R6** | **The approvers are simulated** | In the workload simulation the approver always agrees; in the charging simulation it is a seeded coin at 100% and 80%. Real human friction, latency and fatigue are untested. | A study with real approvers |
| **R7** | **The MCP servers are not evaluated** | The charging scenario runs through the governor and the gate, not over a live charging protocol. The tool servers exist as separate prototypes and are inventoried, not measured. | A gated end-to-end run against a real protocol endpoint |
| **R8** | **Ten seeds, two windows** | Ten seeds per configuration and two 28-day windows (one winter, one summer) in one country. The spread between seeds is reported, but this is not a wide sample. | More seeds, more windows, more regions, more countries |
| **R9** | **The gate is one runtime** | The properties are checked against one implementation of the ladder, in one process. And the ladder's *meaning* — the human port, `block` as a refusal with a fallback, `terminate` as unoverridable — is this package's, not the runtime's; the runtime treats the top three rungs alike. | A second independent implementation, and the semantics merged upstream |
| **R10** | **The absence claims are search results** | The novelty claims rest on a documented adversarial search on a stated date. Absence of evidence in those sources, nothing more. | Documented in [`SEARCH-PROTOCOL.md`](SEARCH-PROTOCOL.md); readers are asked to open an issue if they find a prior composition |

## Also stated, and not risks to a number

**Designed, not built:** the forecast port; the wiring from the gate to a real
approval board; the actuation edge to the charging tool servers; the normative
criteria a budget is judged against; persisting or rehydrating a deferred task.

**Known and open in the code:** the shipped gate passes a non-ladder action
through verbatim (this package normalises it to `block`); the audit log is
tamper-evident, not tamper-resistant, and truncation needs an external anchor;
`fetchedAt` is the one real wall-clock read that lands in a result file;
`data/dataplane/` is a snapshot that re-running overwrites; the log window is
evidence of reachability, not of demand.

## Where each of these is stated

Every location below is expected to agree with the two lists above.

| File | What it carries |
|---|---|
| [`architecture/ARCHITECTURE.md`](architecture/ARCHITECTURE.md) §11 | R1–R10 in full, plus the technical-debt list |
| [`RESEARCH-QUESTIONS.md`](RESEARCH-QUESTIONS.md) | A "Limitations" block per research question, and "What none of these questions establish" |
| [`../RESEARCH.md`](../RESEARCH.md) | "What we found" (the honest version), "The limits, once more", "What is real and what is simulated", and "Corrections relative to the submitted article (v1.0.0)" — the [`README`](../README.md) carries the short "honest catches" summary |
| [`architecture/PRODUCT.md`](architecture/PRODUCT.md) | Non-goals, "Out of scope", and the closing paragraph of §7 |
| [`SEARCH-PROTOCOL.md`](SEARCH-PROTOCOL.md) | "What the protocol does NOT establish" — this is R10 |
| [`ARTIFACT-INVENTORY.md`](ARTIFACT-INVENTORY.md) | What was *not* run (the full Docker stack), and the prototype status of the MCP servers — this is R7 |
| [`../results/simulation.md`](../results/simulation.md) | Caveats: R1, R2, R3, R4, R6, R8 |
| [`../results/charging.md`](../results/charging.md) | Notes and caveats: R1, R6, R7, R8, and the start-time-only constraint |
| [`../results/dataplane.md`](../results/dataplane.md) | Caveats: R5, and the log-window caveat |
| [`../results/fitness.md`](../results/fitness.md) | What each property does and does not establish: R9, and the audit-anchoring limits |
| [`adr/ADR-006-human-port-and-stop-rungs.md`](adr/ADR-006-human-port-and-stop-rungs.md) | R6, and the block/terminate/defer distinction the rest of the docs depend on |
| [`adr/ADR-008-real-grid-traces.md`](adr/ADR-008-real-grid-traces.md) | R2 — why the peer signal is a stand-in, and what that costs |
| [`adr/ADR-009-synthetic-workload-parameters.md`](adr/ADR-009-synthetic-workload-parameters.md) | R1 — every stipulated number, and where to find it |
| [`adr/ADR-010-threshold-deferral-baseline.md`](adr/ADR-010-threshold-deferral-baseline.md) | Why the baseline is weak, and the lookahead disclosure |
| [`adr/ADR-011-charging-start-time-shift-only.md`](adr/ADR-011-charging-start-time-shift-only.md) | The start-time-only line, and why the savings are a lower bound |
| [`adr/ADR-016-gate-once-on-arrival-execute-later.md`](adr/ADR-016-gate-once-on-arrival-execute-later.md) | No re-gating; the queue is not persisted |
| [`adr/ADR-017-consumer-library-optional.md`](adr/ADR-017-consumer-library-optional.md) | Why conformance can read "not measured" |
| [`../simulation/README.md`](../simulation/README.md), [`../dataplane/README.md`](../dataplane/README.md), [`../demo/README.md`](../demo/README.md) | The same limits, restated where someone lands who opened a folder rather than the docs |

If you find a limitation stated in one of those files and not here, that is a
defect in this file. Please open an issue.
