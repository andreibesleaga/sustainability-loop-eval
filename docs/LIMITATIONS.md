# Limitations — the canonical list, and where else they are stated

This file exists so that a reader can check one thing: that every place this
repository admits a limit admits the *same* limit, in the same words. It adds no
new caveat. It is an index.

The canonical list is **R1 to R17** (R11–R17 added by the 2026-08-31 audit, each with a measured number where one could be measured), defined here and repeated in
[`ARCHITECTURE.md` section 11](architecture/ARCHITECTURE.md#11-risks-and-technical-debt).
If any other file disagrees with this one, this one and section 11 are right and
the other file is a defect.

## R1 to R17

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
| **R11** | **Shifted load piles onto one slot** | Every deferrable task and every vehicle picks the cleanest slot of the *same* shared signal, so shifted work synchronises. Measured at f = 0.8 (audit, 2026-08-31): 75.3% (winter) and 92.9% (summer) of deferred executions land in the busiest 5% of half-hours, with up to ~43 queued tasks in one slot against an arrival mean of 6; in the charging run all 50 cars start in the same slot on most nights, and one summer slot (04:00) takes 54.8% of all sessions. The signal is exogenous here, so the pile-up cannot feed back; at the adoption scale the architecture aims for, it would — the delay-and-threshold oscillation of systems dynamics, the "timer peak" of real time-of-use tariffs. Not modelled. | An endogenous-signal sensitivity arm (shifted load raising the intensity it shifts into), dispersion inside the clean window, and a capacity term in the governor |
| **R12** | **The two halves are joined by assumption** | No measured experiment consumes the gateway's documents as its control signal. E1 measures the availability of documents that are annual disclosures — median `updated` age 23 days, median reporting-period age 233 days, and only 3 of 12 carry the `carbon-intensity` member an agent would act on — while E2 and E3 consume a half-hourly signal (regional grid forecasts standing in for peers). That cadence gap is about three orders of magnitude, and only `npm run demo`, which produces no result, joins the two halves. The publish-back edge of the loop is never exercised. | Peers publishing intensity at a cadence near the grid's; an E2 arm whose signal is built from real gateway documents |
| **R13** | **In the charging run the gate can only reduce the saving** | E3's saving is the argmin scheduler's, not the governor's: `allow`, `degrade` and `escalate` all yield the same shift, while `block` and `terminate` fall back to charging at plug-in. Measured: an ungated argmin-only arm avoids 32.85% (winter) and 16.53% (summer) against the governed 32.51% and 16.04% — the budget mechanism costs 0.34 and 0.49 points. What the gate adds in E3 is the audit trail, the pacing and the human port, not grams. | Report the ungated arm alongside; give `degrade` a distinct physical meaning in E3 (a partial shift) so the ladder does work there |
| **R14** | **Rebound is unmodelled, and budgets are relative** | Nothing models induced demand: work that is cheaper in carbon (degraded, or shifted to a clean slot) classically invites more of it (Jevons). And every budget is relative — f × the median of the *same* workload's own uncontrolled day, an oracle a live operator would not have — not an absolute allocation from any science-based target. | A workload model with elastic demand; a normative layer that sets absolute budgets (designed, not built) |
| **R15** | **Estimates are self-declared, and there is no metering port** | The validator reads the acting agent's own `estimatedGramsCO2e`; an agent that under-declares is allowed, and monotonicity (F11) is no defence against a strategically small number. The four ports name no *metering* port for the actual grams `commit()` needs — the simulations take them from the trusted trace. Once published intensity is a control input for others, publishing becomes strategic (Goodhart): unlike `robots.txt`, a sustainability control plane pays under-reporters in workload. | A metering port with trusted measurement; attestation on published documents (hooks exist in the format, no verifier yet) |
| **R16** | **Arrival hour decides the verdict** | The budget resets at midnight and the pacing ratio grows through the day, so identical work is treated differently by when it arrives. Measured at f = 0.8: tasks arriving 00:00–06:00 are 100% allowed and 0% dropped in both windows; tasks arriving at 23:00 are allowed 20.5% (winter) / 11.5% (summer) and dropped 11.4% / 23.8%. A third to a half of deferred work crosses midnight (35.7% / 51.2%), and 4.4% / 6.4% of all grams are yesterday's work charged to today — R3's mechanism, with a number. No per-cohort fairness cut is reported. | A rolling budget window instead of a daily reset; a fairness column in the results |
| **R17** | **Average intensity, not marginal** | Emissions are attributional: energy × the grid's *average* intensity in that slot. Load shifted into a low-average hour is often served by the same marginal plant (in Great Britain, frequently gas), so system-level abatement can be smaller than the attributional number — the standard critique of carbon-aware scheduling. Embodied carbon, PUE and hardware were always stated as out of scope; the average-versus-marginal choice was not, until now. The traces are also CO2 from generation only, labelled gCO2e (ADR-015). | Re-score with a marginal-emissions series where one exists, and state both |

## Also stated, and not risks to a number

**Designed, not built:** the forecast port; the wiring from the gate to a real
approval board; the actuation edge to the charging tool servers; the normative
criteria a budget is judged against; persisting or rehydrating a deferred task.

**Known and open in the code:** the shipped gate passes a non-ladder action
through verbatim (this package normalises it to `block`); the audit log is
tamper-evident, not tamper-resistant, and truncation needs an external anchor;
`fetchedAt` is the one real wall-clock read that lands in a result file;
`data/dataplane/` is a snapshot that re-running overwrites; the log window is
evidence of reachability, not of demand; an audit anchor protects only the records
up to the anchored position — a tail rewritten and re-hashed *after* the anchor passes
both `verify()` and `verifyAnchored()`, so anchor after every batch that matters; the
gateway's real-organization mappings are not editorially uniform — `hetzner.com`
keeps a market-based `renewable-energy: 100` where `cloudflare.com` omits the member
for exactly that reason, so peers are not comparable on that member (gateway-side).

## Where each of these is stated

Every location below is expected to agree with the two lists above.

| File | What it carries |
|---|---|
| [`architecture/ARCHITECTURE.md`](architecture/ARCHITECTURE.md) §11 | R1–R17 in full, plus the technical-debt list |
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
