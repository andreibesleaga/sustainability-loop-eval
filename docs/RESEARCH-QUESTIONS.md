# Research questions

The article asks three questions and answers each with a different method. This
file states them as testable claims: what is being asked, what the package
measures, what result would prove the claim wrong, what the current answer is, and
what the answer does not cover.

The point of writing it this way is that a reader can disagree with a specific
sentence rather than with a mood. Every number below comes from a file in
`results/`; the source is named each time.

---

## RQ1 — Does the architecture hold the properties it claims?

**Question.** The design claims a governance gate that aggregates opinions onto a
total-ordered ladder, fails closed, binds a human to its top rungs, leaves a
tamper-evident record, keeps its core dependency-free, and behaves
deterministically. Do those properties actually hold in the code that ships?

**Hypothesis.** They hold in the shipped `kaiban-distributed` gate with the
Carbon-Verdict Governor plugged in as a validator — not merely in a description
of it, and not merely in a reimplementation written for this package.

**What the package measures.** Thirteen architecture fitness functions
(`fitness/props.js`), each testing one clause of the claim against the real
`ActionGate` and the real `AuditLog` imported from npm. Every property except the
two static ones (F7, F12) draws its cases from a seeded generator, so they are
reproducible. Separately, the runtime's own governance test suite is re-run
inside a checkout of that runtime and recorded.

**Whose property is whose.** F1, F2, F5, F6, F8 and F9 test *shipped upstream*
behaviour: aggregation, fail-closed on a validator error, the audit chain,
determinism. F3 and F4 test *this package's* rung semantics, because the runtime
ships the vocabulary `allow < degrade < escalate < block < terminate` but not its
meaning — its own default actor path treats the top three rungs identically and
has no human-approval port. F7, F10, F11 and F12 test this repository's structure, F13 tests what a trusted meter buys against a self-declared estimate,
invariants and documentation. A green table is not a claim that the runtime
guarantees the human-in-the-loop semantics; it guarantees the aggregation and the
record, and this package guarantees the rest.

**What would disprove it.** Any one of these:

- The gate resolves a verdict set to something other than its most severe member (F1), or the package's reference rule disagrees with the gate (F9).
- A throwing validator or an invalid estimate produces anything other than `block` (F2).
- Severity falls as budget pressure rises, or a default rung boundary is off (F3).
- Anything above `degrade` executes without an approved approval (F4).
- The audit length does not equal executed plus refused, so something ran unaudited (F5).
- `verify()` passes over a tampered chain, or fails to name where it broke (F6).
- The core imports anything, the adapters import each other, or an adapter that actuates does not go through `governor/harness.js` (F7).
- Two fresh gates given the same sequence disagree in decisions or in audit records (F8).
- An edit to the audit chain goes undetected by `verify()`, or a truncation goes undetected by `verifyAnchored()` against a prior anchor (F10).
- `decide()` is non-monotone in the estimate, or has a side effect, or a rung boundary is off by one (F11).
- A headline number typed into a document no longer matches the file it points at (F12).

**Current answer.** All thirteen pass, over **15,037** cases in total — of
which F7's 40 and F12's are static checks rather than generated cases. At
v1.0.0, the snapshot the article cites, it was nine functions over **10,994**
cases; the difference is properties added, not properties fixed. Upstream, the
same gate and audit code passes its own governance suite (4 files, **71** tests)
at commit `17ad362`, and an end-to-end suite of 69 tests against a real Redis
broker. Source: [`results/fitness.md`](../results/fitness.md),
`results/fitness.json`, `results/kaiban-upstream-tests.json`,
`results/kaiban-upstream-e2e.json`.

**Limitations.**

- One implementation of the ladder, in one process. A second independent implementation would be a stronger check.
- F4 checks the reference actuation harness in this package, `governor/harness.js`. As of v1.1.0 F7 also checks that every adapter which actuates imports it, so it is the *only* actuation path and not merely *an* actuation path. What is on the other end of the human port is still a simulated approver or a terminal prompt: **wiring the gate to a real approval board is designed, not built.**
- **The forecast port is built (WP-3: contract, committed capture, conformance-tested adapter), but no experiment decides through it yet.** The simulations still read the peer signal straight from the cached trace rather than through the adapter.
- The audit chain is in memory and verifiable. It is not persisted or signed. It is tamper-*evident* — `records()` returns the live objects, so code in the process can mutate them and `verify()` will notice, but nothing prevents the mutation. Truncation is invisible to `verify()` alone and needs an external anchor (F10).
- The shipped gate itself passes a verdict that is not on the ladder through verbatim rather than failing closed on it. This package normalises that to `block`; the upstream gap is real and is recorded (ADR-002, ARCHITECTURE section 11).
- A property can only test something you can state precisely. Properties nobody thought to state are not covered by a green table.

**How to extend.** Add F14 and beyond (the recipe is in
[`DEVELOPMENT.md`](DEVELOPMENT.md)); check the same properties against a second
runtime; run the gate under concurrency; persist and sign the chain and test the
verification path across a restart.

---

## RQ2 — Is a self-published sustainability data plane usable as a control signal?

**Question.** The architecture depends on systems publishing their own runtime
figures at a standard web address, and on other systems reading them. Does that
plane exist, is it conformant, is it fast and small enough to poll, and is anyone
actually reading it?

**Hypothesis.** A public gateway serving documents at
`/.well-known/sustainability-data` is conformant, cheap to fetch, honest about
provenance, and receives real traffic — enough to be usable as an input to a
control decision.

**What the package measures.** `dataplane/measure.js` fetches every document the
gateway serves, five times each, and records HTTP status, latency and size; checks
the draft's 8 mandatory and 16 optional members; validates each document against
the schema using the reference consumer library; looks for the in-band
not-endorsed disclaimer; computes freshness against a *fixed* reference date
rather than the wall clock; and reads the live negative-findings register.
`dataplane/logs.js` then summarises a raw capture of the gateway's real HTTP
access logs.

**What would disprove it.** Documents that fail schema validation; missing
mandatory members; latency or size large enough to make polling impractical;
documents stale by months; no disclaimer on documents mapped from third parties'
reports; or a log window showing no real traffic at all.

**Current answer.** **12** documents measured — 9 mapped from real organizations,
2 deliberately synthetic, plus the gateway's own — all returning HTTP 200 on every
one of 5 sequential GETs. Those twelve are the gateway's **subject registry**; the
gateway also serves a further 22 adapter and wire-format demonstration documents
which E1 does not measure and which no number here includes. Schema conformance
**12/12**, counted over the documents actually analysed, and reported as
"not measured" rather than as a rate if the reference consumer library is absent
(ADR-017). Mandatory-member coverage
**100%**: all 8 members on every document. Median latency **44.6 ms**, median body
**1296.5 bytes**. The in-band disclaimer is present on **9/9** real-organization
documents. Median `updated` age **23 days** against the fixed reference date. The
negative-findings register names **2** organizations honestly reported as
publishing no machine-readable data. The log capture covers
2026-08-15 to 2026-08-22 with **120** requests, **58** of them to well-known
paths, from **26** distinct clients. Source:
[`results/dataplane.md`](../results/dataplane.md), `results/dataplane.json`.

**What that log window is and is not evidence of.** It is evidence that the
gateway is reachable and is being crawled. It is not evidence of demand, and it
should not be read as any:

- 41 of the 120 requests were 4xx. The top paths are `/robots.txt` (23), `/` (16) and `/favicon.ico` (7) — crawler behaviour, not consumption.
- 35 distinct subjects were requested against 11 subjects actually served, so most subject requests were for documents that do not exist.
- The user agents are predominantly crawlers, and the capture **includes this evaluation's own probes** (`curl/*` and `node`), left in rather than filtered because filtering real server traffic is its own kind of cherry-picking.
- **No independent consumer was observed.** Discoverable is not the same as consumed, and nothing in this window shows the latter.
- Client addresses are stored only as a salted hash whose salt is discarded, so "26 distinct clients" is a count over hashes.

**Limitations.**

- **The gateway is the article author's own reference deployment.** Its real-organization documents are illustrative mappings prepared by the operator from those organizations' public reports — not published, reviewed, authorized or endorsed by them. Discovery and comparability are demonstrated; third-party adoption is not.
- The captured log window includes this evaluation's own traffic, left in deliberately rather than filtered, because filtering real server traffic is its own kind of cherry-picking.
- The retention window on that hosting plan is about one week, so the log evidence is thin by construction, not by choice.
- Schema validation proves conformance, not truth. Documents are self-declared, exactly as `robots.txt` is. Attestation hooks exist in the format; no operating verifier stands behind them.
- Latency is measured from one machine on one network.

**How to extend.** Get an independent organization to publish its own document;
measure across regions and networks; measure over months rather than a week; build
a verifier for the attestation hooks; poll live peers on the wire instead of a
curated gateway.

---

## RQ3 — What does the Carbon-Verdict Governor do under real grid conditions, and what does it cost?

**Question.** If every carbon-relevant agent action is routed through a carbon
budget and a verdict ladder, does that beat always running and beat the ordinary
carbon-aware-scheduling baseline — and what is given up to get there?

**Hypothesis.** The governor cuts emissions more than threshold deferral does,
because it can also shrink and drop work; the cut is not free; and the peer signal
that drives it is good enough to decide *when* to run.

**What the package measures.** `simulation/run.js` replays a synthetic agentic
workload over two 28-day windows of real Great Britain half-hourly carbon
intensity, under four policies on the identical task list per seed: always-run
(P0), threshold deferral (P1), threshold deferral on a trailing 7-day median with
no lookahead (P1t), and the governor at five budget levels (P2, budget factor 0.6
to 1.0), with every governor decision passing through the real gate and every
action through `governor/harness.js`. P1's threshold is the median of the peer
signal over the *whole* window, which is a small piece of lookahead in the
baseline's favour; P1t exists so a reader can see what the baseline does with
information it could actually have had. Its result: −0.92% (winter) and −2.26% (summer) against always-run, with 100% of tasks completed — below P1's −1.54% and −2.97%, which had the full-window median.
Ten seeds; mean and standard deviation reported. `simulation/charging.js` runs the
gated charging shift on the same traces. Emissions always come from the national
*actual* series; the peer signal is the mean of three regional *forecast* series
standing in for peers' published documents.

**What would disprove it.** The governor failing to beat P1; the peer signal
failing to track the national actual; the audit chain failing on any run; the
savings turning out to be entirely explained by dropped work at a budget level
where nothing is dropped; or the deferred work missing its deadlines.

**Current answer**, at budget factor 0.8, from
[`results/simulation.md`](../results/simulation.md):

| | winter (W1) | summer (W2) |
|---|---|---|
| Governor versus always-run | **−16.45% ± 0.48** | **−20.27% ± 1.3** |
| Threshold deferral versus always-run | −1.54% ± 0.13 | −2.97% ± 0.24 |
| Tasks completed (of about 8,075) | 7996.6 | 7698.8 |
| Tasks dropped | 78.5 | 376.3 |
| Tasks degraded | 1238.2 | 1220.9 |
| Human decisions over 28 days (every `escalate` + every `block`) | 545.7 | 853 |
| Of those, `block` verdicts on deferrable work | 102.8 | 216 |
| Days over budget (of 28) | 14 | 14.4 |
| Peer signal versus national actual, Pearson r | 0.96 | 0.986 |
| Audit chain valid, all 10 seeds | yes | yes |

And from [`results/charging.md`](../results/charging.md): the gated start-time
shift avoids **32.51% ± 0.13** of session emissions in winter and
**16.04% ± 0.04** in summer at full approval; at 80% approval those become
**25.93% ± 0.34** and **12.77% ± 0.16**.

Four things in that table matter as much as the headline:

1. **The governor paces a budget; it does not cap it.** Half the days still end over budget, because deferred work commits into the next day and non-deferrable work is throttled rather than stopped short of the top rung.
2. **The saving is not like-for-like.** P0, P1 and P1t complete every task; P2 does not. Total grams must be read next to completed, degraded and dropped.
3. **The peer signal is biased low in level even though it is excellent in shape.** Mean peer signal 83.7 against a national actual of 124.2 gCO2e/kWh in summer, because one of the three modelled peers sits in near-zero-carbon North Scotland. Good enough to choose *when* to run; not good enough to set an absolute budget without calibration.
4. **"Human decisions" means every `escalate` verdict and every `block` verdict.** A blocked task never proceeds on its own; a human may authorise the reduced or deferred fallback, and nothing else. Because "block on deferrable work asks a human" is a design choice rather than a law, the run also reports what the count would be if deferring blocked work needed no approval: 442.9 (winter) and 637 (summer) over 28 days — about 16 and 23 a day — against 545.7 and 853 when every block is approved; the difference is the 102.8 and 216 block verdicts on deferrable work.

**Limitations.**

- The workload is synthetic: arrivals, task energy, the deferrable half, and the cost of degraded mode are stipulated numbers. Absolute percentages will move with a real load.
- The fleet is synthetic too: size, plug-in distribution and energy per session.
- The approvers are simulated. In the workload simulation the approver always agrees; in the charging simulation it is a seeded coin at 100% and 80%. Real human friction, latency and fatigue are untested — and the 100%-to-80% comparison shows the human is the bottleneck, not the model.
- The regional series is forecast-only, so the peer signal cannot be checked against a regional actual.
- Ten seeds, two windows, one country.
- Emissions are attributional: energy times grid intensity at run time. No embodied carbon, no power-usage-effectiveness, no hardware accounting.
- The charging scenario shifts start times only. No discharge, no state-of-charge logic, and no live charging-protocol call — it runs through the governor and the gate, not over a real protocol wire. In it, `block` and `terminate` refuse the shift outright with no fallback and nobody asked; the car charges as it would have anyway.
- A deferred task is gated once, on arrival, and executed later without re-evaluation (ADR-016). If grid conditions change between the decision and the slot, nothing re-checks.

**How to extend.** Replace the Poisson workload wholesale with real traces (WP-15's captured run already replays beside it as a granularity control); add
regions, countries and seasons; run a study with real approvers and measure their
latency and refusal rate; put real multi-party peers on the signal port; wire the
charging scenario to a live protocol endpoint through the tool servers; and
compare against a perfect-foresight upper bound to see how much of the gap is
left.

---

## What none of these questions establish

The article names four patterns and claims that their *compositions* had no
located precedent. That claim rests on a documented adversarial search, on a
stated date, in stated sources — see [`SEARCH-PROTOCOL.md`](SEARCH-PROTOCOL.md).
It establishes absence of evidence in those sources on that date, and nothing
more. A reader who finds a prior composition is asked to open an issue.

Every limitation named above is indexed, with its canonical wording, in
[`LIMITATIONS.md`](LIMITATIONS.md).

Loop closure itself — actions changing consumption, changing the next published
document — is shown here by construction, and its sense → decide → gate → act half by
simulation. The publish-back half is now exercised in simulation: E5 (`npm run loop`) has every
system publishing what its own actions did and reading the crowd's documents back,
and WP-17 (`npm run plane`) does it in the gateway's own document shape — closing
the *format* half of limitation R12. What remains open is R5's half: it is not yet
shown by a live deployment with independent parties on both ends. That is the open problem, and it is why the
convention is published rather than kept.
