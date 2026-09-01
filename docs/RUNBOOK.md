# Runbook — how to implement, test and present everything in ROADMAP §5

This is the execution manual for the work packages in [ROADMAP](ROADMAP.md) §5, written
so that a future session — or a delegated agent — can pick up any package cold and
finish it without re-deriving the repository's discipline. Every agent brief below is
ready to paste. **The standing constraints come first because every brief inherits
them.**

## 0. Standing constraints (paste into EVERY agent brief)

```text
CONSTRAINTS (non-negotiable, from the repository's own rules):
- The submitted article is FROZEN. Never edit anything under the paper's tree; the
  repo's tag v1.0.0 is the paper snapshot. Divergences are documented in README
  "Corrections" + CHANGELOG, never fixed backwards.
- NEVER run git commit/push/tag. Hand the exact commands to the owner at the end.
- Determinism: no wall clock, no network in tests, every random draw from
  shared/prng.js mulberry32 with fixed seeds; simulations must re-run byte-identical
  (verify with md5sum before/after re-run). Live fetches happen once, by hand, and
  their outputs are committed fixtures.
- Architecture: hexagonal. New code in simulation/dataplane/demo may import ONLY
  governor/, shared/, node:* and its own folder (fitness F7 enforces this
  structurally and auto-scans new files). Anything that actuates goes through
  governor/harness.js.
- Every hand-typed number in any doc must be registered in tools/check-numbers.js
  (F12). After changing the registry: run `npm run fitness:report`, read the printed
  total, update every doc site stating the old total, then run fitness:report TWICE
  (the first re-reads stale JSON), then `npm test`.
- unitTestCount counts `^test(` at column 0 in simulation/ + dataplane/ *.test.js —
  keep test() calls top-level or the doc count breaks. F7's case count grows with
  every new adapter/test file; the sites that state it are RESEARCH-QUESTIONS.md
  ("which F7's N") and ARCHITECTURE.md Q7 ("| F7, N checks |").
- Numbers never cited from memory: anything external is fetched, quoted, URL'd, or
  marked UNVERIFIED. The existing verified literature lives in
  ~/work/susloop-literature-verification-A.md / -B.md and the session scratch files.
- Finish = `npm test` fully green + determinism proof + CHANGELOG entry + commit
  command handed to the owner.
```

## 1. Per-package briefs

Each brief assumes the constraints block above is prepended. Session estimates are in
ROADMAP §6.

### WP-1 — E2b horizon and objective sweep
```text
TASK: In simulation/run.js's world, add arms: argmin objective (not threshold) over
horizon ∈ {6,12,24,48} h × deferrableFraction ∈ {0.5,1.0}, deciding on the peer
signal, scored on the national actual, same seeds. Compare each cell against its
ceiling in results/bounds.json (e2Potential) — an arm above its ceiling is a bug;
report the achieved fraction of ceiling. Update results/simulation.* rendering with
the new arms; register headline numbers; expect low single digits at 6 h per the
literature (ROADMAP §3b) and say plainly what the knee is.
```

### WP-2 — E2c decomposition
```text
TASK: Re-run P2 with (a) drop disabled, (b) degrade disabled, (c) both disabled, same
seeds, and attribute P2's saving exactly into drop/degrade/timing. Replace ROADMAP
§2b's arithmetic table with the measured split (keep the old table as "the arithmetic
predicted"). Register the measured numbers.
```

### WP-14 — Tiered governance
```text
TASK: Add a policy layer (own module in governor/ or simulation/, F7-clean):
standing audited rule = block-on-deferrable auto-defers (rule is itself a validator
with an audit record; never bypasses the gate). Tiers: T0 fully-auto rungs, T1
rules-with-audit, T2 human-required (terminate always T2; physical actuation T2).
Re-run E2/E3; report human-decisions/day per tier (baseline already measured:
545.7→442.9 W1, 853→637 W2 under rule one). BDD-style acceptance sentence per tier
in the results md.
```

### WP-3 — Forecast port + adapter
```text
TASK: Define ports/forecast contract (one page: interface, failure modes, staleness
semantics). Adapter: NESO /intensity/{from}/fw48h + regional fw48h (endpoints
verified live 2026-09-01 — see susloop-literature-verification-B.md §1). One manual
fetch committed as data/forecast/ fixtures; tests offline. First deliverable: the
prospective fw48h error capture protocol (the committed-trace MAPE 6.55%/8.25% is
NOT a 48h figure — say so wherever quoted).
```

### WP-15 — Real workload trace
```text
TASK: One live run of a kaiban-distributed-examples workflow (repo at
~/work/AI/kaiban-distributed-examples; OpenRouter key in .env — never commit it).
Record per-task durations, token counts, arrival gaps, natural deadlines. Anonymise
→ commit as data/workloads/real-trace.json with provenance block. Replay through E2
machinery as a new arm beside the synthetic workload; register the comparison.
```

### WP-12 — Herding arm (headline, with WP-17)
```text
TASK: Extend simulation/loop.js (E5) with the GATE arm: same dynamic, but each
system's governor paces a daily budget (f × its own median day) so depletion staggers
the crowd — the "paced budget is a staggering mechanism" claim (ROADMAP §2h.2).
Compare against: blind herd (α=0), plane-only (α>0, existing), randomised-delay
(SI 2021/1467-style uniform 0–600 s jitter arm — closes R18), and gate+plane.
Metrics unchanged (intensity paid, top-5% share, oscillation). The question: does
allocation beat information, and does governance beat mandated randomness? Register
the verdict numbers; update R11/R18 rows to "measured, with control".
```

### WP-17 — E5 full closed loop
```text
TASK: Upgrade loop.js documents from histograms to full Draft-shaped Basic documents
(publisher/consumer npm packages already exist — sustainability-wellknown-*); run one
arm where documents transit the REAL gateway locally (closing R12: a measured run
consuming published documents end to end). Then the E1↔E2 seam test (old WP-8) is
this arm's smallest case. Sweep cadence {30 min, 1 d, 7 d, 23 d(E1's measured
median)}; keep the three findings' framing (spread-costs-grams, cobweb, N-washout)
and test whether the gate arm from WP-12 changes them. Specify ports/publication
contract (the sixth port) with attestation hooks (R15).
```

### WP-5 / WP-6 / WP-7 — contracts, features, diagrams
```text
TASK (WP-5): ports/metering contract page + adapter test; wire F13's guarantee text
to it. TASK (WP-6): one Gherkin .feature per port (6 files, ≤1 page each) executed
against the real adapters via a thin runner (no framework, no parallel impl); the E3
safety invariant and the E6 "refusal withholds optimisation, never power/charge"
sentences are scenarios. TASK (WP-7): committed Mermaid — C4 L3 component view; two
sequence diagrams (E2 decision, E3 session incl. publish-back); task state machine;
budget dynamics sawtooth.
```

### WP-16 — Price-signal twin
```text
TASK: Check licence of a GB half-hourly day-ahead price source (Agile tariff API or
N2EX/EPEX — verify terms BEFORE fetching; if blocking, write the limitation and
stop). Fetch once → commit like carbon traces. Score every existing arm in £
alongside gCO2e; report agree/conflict slots; add the curtailment/plunge `expedite`
arm (C12). This also doubles as the second-signal-adapter proof for §2i's honesty
note.
```

### WP-4 / WP-9 / WP-13 / WP-10 / WP-11
```text
WP-4: one-page spatial advisory spec; ceiling already in results/bounds.json.
WP-9: chaos tests — malformed gateway JSON, timeouts, absurd intensities, hostile
registry entries (the measure.js hardening finally gets its test).
WP-13 (optional): NESO data source PR to GSF Carbon Aware SDK (gap verified —
only WattTime/ElectricityMaps exist there).
WP-10: only if a GB marginal series is shown to exist; else the limitation stands.
WP-11: final addendum — README Corrections, CHANGELOG, "what changed after
submission" note; runs LAST.
```

## 2. Verification recipe (every package ends with this)

```bash
npm test                        # 37+ unit, 13 fitness, check:docs — all green
npm run simulate && npm run charging && npm run bounds && npm run routing && npm run loop
npm run fitness:report && npm run fitness:report
git diff --stat results/        # only intended changes
# determinism: md5sum results/*.json, re-run the block above, md5sum must match
```

## 3. Presentation plan (after the science, not instead of it)

1. **The runnable story** (exists today): `npm run demo` (live document → real gate →
   verdict), `npm run loop`, `npm run routing`, `npm run bounds` — each prints its
   findings in sentences, not just tables.
2. **A visual results page** — one self-contained page rendering results/*.json:
   the ceiling curves (§2f), the E5 damp/oscillate table as a heat grid, E6's
   routed-vs-drive trade, E6b's migration timeline, the fifteen scenarios as a card
   grid with status badges. Built from committed JSON only, no live calls; it is a
   *view* of results/, so F12 keeps it honest by keeping its inputs honest.
3. **The demo's publish-back edge** (WP-17 item): after the gated decision, the demo
   prints the updated document it would publish — the loop closed on screen in ten
   seconds.
4. **For the article's venue**: the addendum note (WP-11) summarising what moved
   from "designed" to "measured" after submission, with the three E5 findings and
   the E6 novelty statement, each tied to its results file.

## 4. Delegation notes

- One package per agent; paste §0 verbatim at the top of every brief.
- Agents doing literature work write incrementally to a scratch file and mark
  UNVERIFIED honestly — the pattern that produced
  ~/work/susloop-literature-verification-A/B.md.
- Agents never run git writes, never touch .env, never edit the paper, and always
  end by handing the owner a commit command and a one-paragraph summary of what
  changed in results/.
