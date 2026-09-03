# Security

> **At a glance.** The safety properties of the governed system are not promised,
> they are *proved on every test run*: thirteen executable architecture fitness
> functions drive the real, shipped enforcement gate and its hash-chained audit
> log with hostile and malformed input, and the worst verdict always wins, bad
> input always refuses, nothing above `degrade` runs without a person, `terminate`
> can never be overridden, and tampering with the record is detected. The package
> itself runs offline, pinned, with no secrets, and every offline result is
> regenerated and byte-diffed in CI on two Node majors. This page says what is protected, how, what is known to be
> weak, and how to report something new.

## Reporting a vulnerability

Please report privately through
[GitHub Security Advisories](https://github.com/andreibesleaga/sustainability-loop-eval/security/advisories/new)
rather than a public issue. The author (ORCID
[0009-0001-3464-5283](https://orcid.org/0009-0001-3464-5283)) maintains the package
alone and it is parked; expect an acknowledgement, not a service level. A fix that
changes a version follows the [pinned-and-parked policy](docs/DEVELOPMENT.md#version-and-dependency-policy--pinned-and-parked):
it is merged only when CI proves nothing in `results/` moved.

## Supported versions

| Version | Status |
|---|---|
| `master` (1.1.0 + additive work, this repository) | supported: security fixes only, proved by CI |
| tag `v1.0.0` (the article's snapshot; Zenodo 10.5281/zenodo.22056634) | frozen forever, never patched — replication material, not a product |

## What this package is, in security terms

An **evaluation package**: offline experiments, fitness functions and a
measurement of a public gateway. It is not a service and it listens on no port.
It has **one runtime dependency**, `kaiban-distributed@2.0.0`, which is the
artifact under test, and it stores **no secrets**: the single optional key
(`OPENROUTER_API_KEY`, for the live demo only) is read from the environment or
a gitignored `.env`, and nothing that produces a number in `results/` needs it.

## The security and safety matrix — the whole cybernetic system

Each row is one part of the loop described in the article: what it protects
against, the mechanism, how the mechanism is proved, and what is honestly not
covered. "F-n" are the fitness functions in
[docs/FITNESS-FUNCTIONS.md](docs/FITNESS-FUNCTIONS.md); "R-n" the limitations in
[docs/LIMITATIONS.md](docs/LIMITATIONS.md); "FINDING n" the pinned weaknesses in
`dataplane/chaos.test.js`.

| Part of the system | Threat | Mechanism | Proof | Not covered |
|---|---|---|---|---|
| **Governor core** (`governor/carbon-governor.js`, imports nothing) | a wrong or lighter verdict; a validator that lies, throws or returns garbage | five-rung ladder, most-severe-wins, fail-closed on any error or unknown verdict, monotone in consumption; the core is dependency-free so nothing can be injected under it | F1 total order, F2 fail-closed, F3 monotonicity, F7 port isolation (import graph scanned), F8 determinism, F9 reference-model equivalence, F11 core invariants | the *estimate* it decides on is self-declared (next row) |
| **Metering port** | an agent under-declares its own carbon estimate to buy an `allow` | every rung is priced on the declared estimate; a trusted meter would bound the lie to one action ([docs/ports/METERING.md](docs/ports/METERING.md)) | F13: metering bounds the under-declaration to a single action; the contract states exactly what is and is not proved | **no trusted metering hardware exists here** — the traces stand in for it (R15) |
| **Enforcement gate and audit log** (`kaiban-distributed` ActionGate + AuditLog, shipped code) | bypassing the gate; editing, reordering or truncating the record after the fact | every significant action passes the gate on its path; every decision lands in a SHA-256 hash chain | F5 gate-on-path for all three operation types; F6 chain integrity (a single edited field is detected and localised to its index); F10 anchoring: edits caught, **truncation needs an external anchor** | one runtime, one process, one implementation of the ladder (R9); the chain must be anchored outside the process to catch truncation; enforcement has one deployment-wide off switch (`ActionGate` config `enabled:false`) — when it is off nothing is validated and nothing is audited, which F2 pins as an all-or-nothing deployment posture, never a per-request escape hatch |
| **Human port** | automation quietly acting where a person should decide; a person overriding a refusal that must be absolute | `escalate` and `block` never execute without a human decision; `terminate` accepts no override from anyone; a standing rule may move authority, never remove it | F4 human binding over random decisions (approval present or absent, approved true or false; `terminate` refused in every case); `features/human.feature` adds the malformed case — an `approved` field holding the text "true" rather than the value true — executed against the real harness | the approver is simulated; real latency, fatigue and pressure are not measured (R6); the approval-board wiring is designed, not built; approver identity is not authenticated — `approval.by` is recorded, never verified, so a forged approval is indistinguishable from a real one |
| **Actuation port** (EV charging) | a refusal that withholds energy from a vehicle; a partial charge nobody asked for | the gate only moves *when* a full charge starts, never how much; every vehicle charges fully by construction | `features/actuation.feature`, `results/charging.md`, ADR-011 | no delivered-kWh meter (future hardening); no live charging protocol (R7) |
| **Signal and forecast ports** | a stale, biased or fabricated grid signal steering the whole loop | forecast contract with a staleness clause ([docs/ports/FORECAST.md](docs/ports/FORECAST.md)); committed real captures with provenance; the bias of regional peers is measured, not assumed | conformance-tested adapter (`simulation/forecast.test.js`) and `features/forecast.feature` against the committed capture, which carries operator, instant and source URL for every series | the signal source is one operator's public API and its regional peers are biased stand-ins (R2); a compromised or adversarial upstream is out of scope (see below) |
| **Publication port and data plane** (consumer side: `dataplane/measure.js`, `doc-check.js`) | a hostile published document: oversized bodies, prototype pollution, non-object JSON, absurd or malformed dates, path-like subjects, markdown injection into reports | every fetch has a timeout and a body cap; documents are checked for the draft's mandatory members, in-band disclaimer and freshness; the chaos suite drives every pure function the consumer exposes — the document checker, the log analyser and the log renderer — with hostile input, and compiles the private hardening paths of `measure.js` out of its own source text | `dataplane/chaos.test.js` (hostile payloads, `__proto__`, non-object JSON), `measure.test.js`; **seventeen weaknesses pinned as FINDING 1–17** (presence-only member checks, shape-not-calendar dates, unvalidated `subjectOf`, unescaped strings in the markdown report) — each asserted so it cannot silently change | the findings are pinned, **none of them fixed**: the consumer is a measurement tool, not a production ingester |
| **Publication port** (publisher side: the author's reference gateway) | an organisation's document being mistaken for a statement *by* that organisation; client privacy in the logs | every gateway-prepared mapping carries the in-band "NOT published, reviewed, authorized, or endorsed" notice and the check fails without it; the committed log capture carries no client IP: each was replaced once, at capture time, by a salted hash whose salt was never written down (ADR-012) | measured on every document in `results/dataplane.*`; `dataplane/logs.js` applies the same hashing, with a fresh per-run salt, to any future capture at ingest | the gateway is the author's own; no independent organisation publishes yet (R5); a peer's *intensity* is its own achieved figure, so the loop should act on published **load** (`results/plane.md`) |
| **The loop between organisations** | herding: everyone shifting onto the same clean hour; a peer gaming the shared signal | measured, not asserted: both anti-herd conjectures (paced budget, capacity rungs) were tested and **disproven**; the package claims no anti-herd property | `results/loop.md`, ADR-019, `simulation/loop.test.js` | the herding problem the loop creates has no gate-side solution here (R11); the loop is closed in mechanism, not yet in society |
| **Live demo agent** (`demo/agent.js`) | key leakage; a model proposing an action that the gate should refuse | key from the environment only, `.env` gitignored, `.env.example` carries the key name with no value; the model only *proposes* — the real gate decides, with you on the human port; timeouts on every call | the demo is never part of `npm test` or `npm run all`; no number comes from it | the key is the user's to rotate; the model's output is untrusted by design |
| **Supply chain** | a dependency or CI action changing under the package; an unlocked tool fetched at build time | exact versions, integrity hashes for every package, `npm ci`, actions pinned by commit SHA, runner image pinned, least-privilege token, routine update PRs off, monthly scheduled re-proof, byte-diff of every result CI regenerates (all of `results/` except the live data-plane measurement and the committed upstream-test captures) | `.github/workflows/ci.yml`, `package-lock.json`, `.npmrc` | advisories in the dependency's own tree (next section) |
| **Reproducibility as a security property** | a result that cannot be reproduced cannot be audited | no wall clock, no unseeded randomness, no live network in anything that produces a number; results regenerate byte-identically on Node 22 and 24 | CI byte-diff; renderer-identity tests; F12 binds every *registered* headline number in the documents (the registry in `tools/check-numbers.js`) to `results/` | the live data-plane measurement is the one exception: `results/dataplane.*` carries a real `fetchedAt` wall-clock read and live latencies, is not regenerated in CI, and is committed as a snapshot (ADR-012, R5) |

## Known issues, stated plainly

- **Advisories in the dependency tree.** `npm audit` reports advisories, all in
  transitive dependencies of `kaiban-distributed` (LangChain, langsmith,
  OpenTelemetry, uuid, fast-xml-parser and similar). Importing the package root
  loads that tree into the process; nothing in this package calls those modules,
  parses untrusted input with them, and they were checked for load-time side
  effects. None is fixable here without changing the artifact under test.
  Dependabot security pull requests are raised for them, CI proves each harmless,
  and the owner merges. Details and the dated count:
  [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md#dependency-advisories).
- **The data-plane consumer has seventeen pinned findings** (FINDING 1–17 in
  `dataplane/chaos.test.js`): sixteen behavioural weaknesses and one testability
  note. They are documented, asserted and low severity for a measurement tool; they would need fixing before anyone used `doc-check.js` as a
  production ingester of untrusted documents.
- **Truncating the audit chain is only caught with an external anchor** (F10).
  Anchoring is the deployer's job; the package shows exactly where the anchor goes.
- **Estimates are self-declared** (R15). The gate is only as honest as the number
  it is given; the metering contract exists, the meter does not.

## Out of scope

Denial of service against the public gateway; the security of the upstream
grid-carbon API; the model behind the live demo; and anything in the
`kaiban-distributed` runtime beyond the gate and audit-log surface this package
exercises (report those to that project).

## Related pages

[docs/LIMITATIONS.md](docs/LIMITATIONS.md) · [docs/FITNESS-FUNCTIONS.md](docs/FITNESS-FUNCTIONS.md) ·
[docs/ports/](docs/ports/) · [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) · [NOTICE](NOTICE)
