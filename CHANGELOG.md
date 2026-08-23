# Changelog

All notable changes to this evaluation package. Dates are ISO. The one thing this file
exists to make unambiguous is **which numbers changed and which did not** — see the
section of that name under each release.

## [1.1.0] — 2026-08-23 — hardening pass

A review pass over v1.0.0. No experiment was re-run against new data; the grid traces, the
workload, the seeds and the live data-plane capture are all the same ones v1.0.0 used.
Properties were **added**, code was made harder to misuse, and one real defect was found
in the upstream gate.

### Licence

- **Code relicensed MIT → GPL-3.0-only from v1.1.0** (the v1.0.0 archive contains an MIT licence
  file; its Zenodo record was later set to GPL-3.0-only by the author); docs remain all rights reserved; dependency `kaiban-distributed@2.0.0` (npm) is
  Apache-2.0, GPL-compatible. `package.json` now declares `"license": "GPL-3.0-only"` and
  every `.js` file in the repository carries `// SPDX-License-Identifier: GPL-3.0-only` on
  its first line (after the shebang where there is one).
- `LICENSE` now carries the full GPL-3.0 text with a header stating the split (code GPL-3.0-only;
  README, docs, diagrams, figures and result write-ups all rights reserved; data under its own
  terms); `CITATION.cff` says `GPL-3.0-only`, `version 1.1.0`, concept DOI 10.5281/zenodo.22056633.

### Added

- `governor/harness.js` — the actuation harness, **moved** from `fitness/harness.js`.
  It is now part of the core hexagon, imports nothing, and `terminate` is refused before
  any approval is even looked at (`{executed: false, reason: "terminate is not
  overridable"}`).
- `governor/gate.js`: `chainAnchor(records)` → `{length, tipHash, anchorHash}` and
  `verifyAnchored(audit, anchor)`. An external anchor is what makes truncation of the
  audit chain detectable; `verify()` alone cannot see it.
- Fitness function **F10 — audit anchoring** (300 cases): random single-field edits are
  caught by `verify()`; random tail truncations are **not** (recorded honestly: 150/150
  truncated chains were reported valid by `verify()`) and are caught only by
  `verifyAnchored()` against a prior anchor.
- Fitness function **F11 — governor core invariants** (2,005 cases): `decide()` monotone
  in `estimateG` and side-effect free, `commit()` additive and loud on bad input,
  `reset()` clears, rung boundaries inclusive from below, and the shipped
  `GATE_ACTION_SEVERITY` order still agrees with `LADDER`.
- Fitness function **F12 — documentation agrees with `results/`** (33 registered claims):
  a static check, like F7. New `tools/check-numbers.js` holds a flat registry of
  `{docFile, label, regex, jsonPath}` covering the hand-typed headline numbers in
  `README.md`, `docs/RESEARCH-QUESTIONS.md`, `docs/ARTIFACT-INVENTORY.md`,
  `docs/architecture/ARCHITECTURE.md` and `docs/adr/ADR-013`, plus the governor's line
  count. `npm run check:docs` runs it standalone and reports every mismatch as
  `file:line`; `npm test` includes it.
- `results/fitness.md` is now **generated** by `npm run fitness:report` from the run that
  produced `results/fitness.json`. It used to be written by hand.
- **P1t** — a fourth E2 policy row: threshold deferral against a *trailing 7-day* median
  of the peer signal, i.e. the causal version of P1, which uses the median of the whole
  window (the lookahead ADR-010 discloses). Both rows are now reported side by side.
- `blocksDeferrable` and `humanDecisionsIfDeferralAutomatic` in `results/simulation.json`:
  how many of the human decisions were `block` verdicts on deferrable work, whose only
  physical outcome is a deferral, and what the count would be if that deferral needed no
  approval. The definition of `humanDecisions` itself is **unchanged**.
- `demo/meaning.js` — one shared plain-English gloss of the five rungs, used by both
  demos so they cannot drift apart.
- `npm run arch:graph` (the command that produces `results/madge.txt`) and
  `npm run check:docs`.
- Unit tests: `execute()` never runs `terminate` under any approval; `execute()` runs
  `allow`/`degrade` unasked and `escalate`/`block` only on `approved === true`;
  `commit()` throws on a bad value; P1t's trailing threshold and its cold start; the
  committed log capture carries no raw IP.

### Changed — safety and correctness

- **`gated()` fails closed on off-ladder verdicts** (see *Upstream defect* below), keeping
  the shipped answer as `rawAction` and the explanation as `normalisedReason`.
- **`mostSevere()` ranks an unrecognised action at `block` severity**, never `-1`. A new
  `severityOf()` export makes that rule usable elsewhere.
- **`commit(actualG)` now throws** on a non-finite or negative value instead of silently
  ignoring it. A silent zero under-counts the budget and makes the ladder fire later than
  it should.
- **Every actuation in the package goes through `execute()`**: `simulation/run.js`
  (including the delayed run of a deferred task, which executes the decision it was
  already gated and audited for on arrival), `simulation/charging.js` (owner consent
  first, harness as the floor), `demo/demo.js` and `demo/agent.js`. F7 now checks that
  statically, so the harness is provably the *only* actuation path rather than merely
  *an* actuation path.
- **F7's import scanner rewritten.** The old single regex could span from one statement
  into a later one and modelled only `import … from "…"`. The new scanner strips comments
  and string literals first, then matches each ESM form separately (`import x from`,
  `import {…} from`, `import "…"`, `export … from`, and dynamic `import("…")` with a
  string literal). It now also scans the adapters' `*.test.js` files under a relaxed rule,
  enumerates `governor/*.js` (so a new file there cannot escape the rule by not being
  listed), and names the single permitted external library in an adapter —
  `sustainability-wellknown-consumer` in `dataplane/measure.js` — together with that
  file's one `SUSTAINABILITY_CONSUMER_URL` dynamic import.
- **F1** now varies the carbon estimate across the whole ladder instead of always gating a
  zero-gram action. **F2** gained the rogue-validator sub-case. **F4** expects
  `autoRun || (approved && action !== "terminate")` and counts the terminate cases.
  **F5** now asserts that what executed is exactly what the harness rule permits, rather
  than only counting executions.
- **`dataplane/measure.js` consumer resolution** (ADR-017): `SUSTAINABILITY_CONSUMER_URL`
  → bare specifier `sustainability-wellknown-consumer` → neither, in which case
  conformance is reported as **not measured**, never as 0%. The hard-coded absolute path
  to a local build is gone. The library is still **not** a dependency: install it with
  `npm i --no-save sustainability-wellknown-consumer@0.5.2` if you want it.
- **Latency is now pooled unrounded**: the overall median and p95 are computed from the
  raw per-GET milliseconds and rounded once, at the end, instead of rounding every sample
  before aggregating. At the 0.1 ms resolution of the committed run this changes nothing.
- **Conformance is counted over `documentsAnalyzed`**, not over every document measured. A
  body that never parsed is a document with no schema claim to make, not a failed schema
  check. In the committed run the two denominators are the same (12).
- **Gate clock in both simulations is derived from the trace's own slot grid**
  (`W.slotStarts[slot]`), so an audit record is stamped with the simulated time the
  decision was taken. Deterministic; changes audit **timestamps** only.
- `simulation/fetch-traces.js`: a 20-second timeout and a bounded 3-attempt retry per
  request, and the `main().catch(…)` idiom now used by every runnable script.
- `demo/demo.js`: validates `DEMO_SUBJECT` against `/^[a-z0-9.-]+$/i`, prints a friendly
  message naming the fix when neither the live document nor a saved copy is available, and
  runs **five** actions sized relative to the budget so every rung of the ladder appears
  once, on any document.
- `demo/agent.js`: a 60-second timeout on the OpenRouter call; everything taken from the
  model or the fetched document is stripped of ANSI and control characters and
  length-clamped before it is printed or interpolated into the prompt; a non-numeric
  energy estimate is rejected; `escalate` prompts for the task as proposed, `block`
  prompts only for a **reduced** run, and `terminate` prompts for nothing.
- Report wording driven by data rather than asserted: the E2 table header now reads
  "mean delay of deferred work (min)", `completedOnTime` is labelled an invariant rather
  than a finding, the E2 prose reports P1t and the deferral-sensitivity number, and the
  E3 note about nights over budget now prints the actual counts instead of claiming the
  budget is "never" respected (it is respected on 20 of 27 winter nights at full
  approval).
- `package.json`: version `1.1.0`, `engines.node` `>=22.9` (the demos use
  `--env-file-if-exists`), `all` now runs `fitness:report && simulate && charging &&
  dataplane` so the live step is last.

### Changed — privacy

- `data/dataplane/railway-logs.jsonl` **no longer contains any client IP address.** Each
  `srcIp` was replaced once by `srcIpHash` — the first 16 hex characters of
  `sha256(salt + ip)` under a random salt that was generated for that rewrite and never
  written down — so the mapping is irreversible and only "same client / different client"
  survives. Railway's `deploymentId`, `deploymentInstanceId` and `upstreamAddress` (an
  internal IPv6 address) were dropped. `clientUa` is **kept**: the user-agent strings are
  not personal data here and the crawler caveat depends on them.
- `dataplane/logs.js` applies the same treatment to any future capture at ingest, with a
  fresh salt per run, and counts distinct clients over `srcIpHash`. An entry that already
  carries a hash passes through untouched, so re-running is idempotent — verified: the
  re-run reproduced `results/dataplane.json` and `results/dataplane.md` byte for byte
  apart from the new `railwayLogs.privacy` note.

### Fixed

- `simulation/charging.js`: `windowSignal()` gained the same bounds guard `emissions()`
  already had, so a candidate window that runs off the end of the trace throws instead of
  reading `undefined`.
- `FLEET.chargerKW: 7` was dead — nothing read it, and it contradicted the model, in which
  the rate is simply energy ÷ duration. Removed and replaced with the value that is
  actually true of the model: `impliedRateKW: 6.67`.

### Upstream defect found (kaiban-distributed@2.0.0)

The shipped `ActionGate` ranks verdicts with `GATE_ACTION_SEVERITY`, which has no entry
for an action that is not on the ladder. Its sort comparator then returns `NaN` and the
ordering silently degrades to insertion order. Measured: given the verdict set
`[allow, "not-a-rung", terminate]`, the shipped gate answers **`allow`**. So an off-ladder
verdict does not merely pass through — it can **mask a real `terminate`**.

`governor/gate.js`'s `gated()` therefore re-aggregates with the reference most-severe rule
(under which an unrecognised action ranks as `block`) whenever any verdict is off the
ladder, and keeps the shipped answer as `rawAction` so the gap stays visible instead of
being papered over. Nothing in this package acts on the masked verdict. **To be reported
upstream.** Recorded in `results/fitness.md`, ADR-002 and ARCHITECTURE section 11.

### Numbers that changed, and numbers that did not

**Did NOT change — every headline number the article cites.** `results/simulation.json`
and `results/charging.json` were regenerated and diffed key by key against the v1.0.0
files: **not one pre-existing numeric value differs.** That includes −16.45% / −20.27%
(governor at f = 0.8, winter / summer), −1.54% / −2.97% (P1), −10.86% / −11.72% (f = 1.0),
−25.22% / −33.37% (f = 0.6), 545.7 / 853 human decisions, 7996.6 / 7698.8 completed,
1238.2 / 1220.9 degraded, 14 / 14.4 days over budget, r = 0.96 / 0.986, and 32.51% /
16.04% / 25.93% / 12.77% avoided in E3. `results/dataplane.json` is unchanged in every
number too, including `distinctClientIps = 26` after the IP hashing. Both simulations
reproduce byte-identically across two runs and across Node 22.22.3 and Node 24.18.0.

**Changed — non-numeric fields and new keys only:**

| What | Where | Why |
|---|---|---|
| `provider` string → "National Energy System Operator (NESO) Carbon Intensity API" | `data/simulation/W{1,2}.json`, and therefore `provenance` in both simulation results | The operator's current name. The endpoint and the data are unchanged; the two cached windows were patched in place, **not** re-fetched (ADR-015) |
| `fleet.chargerKW: 7` removed, `fleet.impliedRateKW: 6.67` added, `fleet.note` reworded | `results/charging.json` | Dead parameter (see *Fixed*) |
| `blocksDeferrable`, `humanDecisionsIfDeferralAutomatic` on every policy; `P1t` policy row; `p1tTrailingMedianDays`; `policies` and `invariants` blocks | `results/simulation.json` | New reporting; nothing pre-existing recomputed |
| `railwayLogs.privacy` note | `results/dataplane.json` | Describes the IP hashing |
| `provenance.schemaValidator` no longer prints an absolute local filesystem path | `results/dataplane.json` | The path leaked one machine's home directory. The live measurement was **not** re-run; only this provenance string was rewritten to describe the same resolution |
| Audit-record **timestamps** inside both simulations | not serialised into `results/` | Slot-derived clock (see *Changed*) |

**Changed — fitness totals, because properties were added.** v1.0.0 was **9 functions over
10,994 cases**. v1.1.0 is **12 functions over 13,366 cases**: F10 (300), F11 (2,005) and
F12 (33 registered documentation claims) are new, F2 grew from 75 to 100 cases with the
rogue-validator sub-case, and F7 grew from 15 to 24 static checks with the `governor/`
enumeration, the adapter test files and the actuating-adapter rule. The difference is
properties **added**, not properties fixed: every v1.0.0 property still passes.

**Unchanged by design.** The definition of "human decisions" is still *every `escalate`
verdict plus every `block` verdict*, which is what the article's "19 and 30
escalate-or-block cases per day" refers to. The sensitivity number is reported *alongside*
it, not instead of it.

## [1.0.0] — 2026-08-22

The snapshot the article cites. Archived on Zenodo:
[10.5281/zenodo.22056634](https://doi.org/10.5281/zenodo.22056634) (concept DOI, all
versions: [10.5281/zenodo.22056633](https://doi.org/10.5281/zenodo.22056633)).
Nine fitness functions over 10,994 cases; all article numbers. Code MIT-licensed.
