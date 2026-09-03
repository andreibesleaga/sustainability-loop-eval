# Changelog

All notable changes to this evaluation package — a record of a package that only
grew: every change after the article's snapshot was additive, every number moved
is named, and the article's own numbers never changed. Dates are ISO. The one thing this file
exists to make unambiguous is **which numbers changed and which did not** — see the
section of that name under each release.

## [Unreleased] — 2026-08-31 → 2026-09-03 — audit pass, work packages, final audit, parked

A multi-lens audit of v1.1.0 (code correctness, documentation consistency, systems
theory and cybernetics, external references checked live, planetary-design and
engineering practice), with every finding disputed by an independent defence and
prosecution before anything was changed. No experiment was re-run against new data.

### Which numbers changed and which did not

- **No headline result changed.** `results/simulation.*` and `results/dataplane.*` are
  byte-identical to v1.1.0, and so is every pre-existing row of `results/charging.*`
  (re-verified by re-running the seeded experiments). Every number the article prints
  still reproduces.
- **`results/charging.*` gained one arm and lost nothing.** The new `argmin_ungated`
  key and its table row are pure additions; the `naive` and `governed_approval*` arms
  are unchanged value for value. It is the R13 comparison made runnable rather than
  asserted: **32.85% / 16.53% avoided by the scheduler alone** against **32.51% /
  16.04%** governed (winter / summer).
- **Fitness totals: 12/12 over 13,366 at v1.1.0 → 13/13 over 15,037 now.** All of it
  additive, and the arithmetic closes exactly: **F13** added (+1,500 cases), **F12**
  grew from 33 registered claims to **188 across 15 documents** (+155) as every
  hand-typed number in every document — the plain-words overview and the newest
  results included — was bound to `results/`, and **F7** grew from 24 to **40**
  static checks (+16) by auto-scanning the files added since. 13,366 + 1,500 + 155 + 16 = 15,037. (Two earlier interim totals quoted below in this section's history
  — 14,981 and 15,011 — were snapshots taken mid-growth; the registry now binds the
  final figures so this line cannot drift again.) Nothing failed; the suite got
  larger.
- **Adapter unit tests: 32 → 87.** One structural test at the audit (32 → 33), then
  the conformance, feature, chaos and workload suites added during the work-package
  sessions (forecast 3, metering 4, features 6, plane 5, loop +5 incl. the
  renderer-identity test, chaos 9, workload-real +5 incl. its identity test, and
  the earlier policy/sweep additions). The "26" the docs said at v1.1.0 was already
  stale then — the actual count was 32.

### Pinned and parked — 2026-09-03

No number changed. The package was locked so it keeps working unattended until the
article is published (policy: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md#version-and-dependency-policy--pinned-and-parked)):

- **`madge@8.0.0` became an exact `devDependency`** (it was fetched by `npx` at CI
  time, so its own tree was never locked); `package-lock.json` now carries every
  package with an integrity hash and its root metadata matches `package.json`
  (it still said version 0.1.0, MIT, Node ≥22). The runtime tree is unchanged
  package for package; the only other lockfile movement is the type-only
  `typescript` peer (7.0.2 → 5.9.3), which nothing executes.
- **`.npmrc`** (`engine-strict`, `save-exact`) and **`.nvmrc`** (22).
- **`tools/check-links.js`** — `npm run check:links`, now the last step of
  `npm test`: every relative Markdown link points at an existing file and every
  `#anchor` at a real heading (275 links on 2026-09-03, all resolve).
- **CI hardened**: actions pinned by commit SHA (`checkout` v5.1.0, `setup-node`
  v5.0.0 — both on the Node 24 action runtime, which removes the Node 20
  deprecation warning the v4 actions produced), runner `ubuntu-24.04`, least
  privilege (`contents: read`), timeouts, concurrency, `fail-fast: false`, the
  byte-diff gate widened to the whole of `results/`, a monthly scheduled run plus
  manual dispatch, and a separate informational `advisories` job that never blocks.
- **`.github/dependabot.yml`**: routine version-update pull requests switched off
  for npm and GitHub Actions; security updates still raised.
- **Final all-lens audit before parking (2026-09-03), fixes applied — no number
  changed**: `SECURITY.md`'s proof column corrected to what each fitness function
  literally asserts (F6 detects an edited field, F4 uses well-formed approvals and
  the feature file adds the malformed one, F12 binds *registered* numbers), its
  "not covered" cells now name the deployment-wide `enabled:false` off switch, the
  unauthenticated approver identity and the live `fetchedAt` exception; `LICENSE`'s
  data notes now cover `data/forecast/**` and `data/workloads/real-trace.json`;
  ADR-012 gained the IP-hashing privacy section that `dataplane/logs.js` and
  NOTICE already cited; `simulation/fetch-forecast.js` got the timeout every other
  live fetch already had; F12's property string names all four registered
  document groups (the one line that moved in `results/fitness.json`); CI
  checkouts set `persist-credentials: false` and the byte-diff step now also
  fails on a new untracked file under `results/`; `.gitattributes` added (LF
  normalisation, so the byte-diff gate cannot fail on line endings).
- **Professional package files added at the root**: `SECURITY.md` (private
  reporting, supported versions, and the security-and-safety matrix of every part
  of the cybernetic system — threat, mechanism, proof, not covered — plus the
  known issues stated plainly), `CONTRIBUTING.md`, `SUPPORT.md`,
  `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1), `NOTICE` (ownership, licences,
  third-party components, data sources, priority record), `.editorconfig`, and
  under `.github/`: `CODEOWNERS`, a pull-request template and two issue templates.

### Added — the final audit, the addendum, and the archive

- **WP-11 delivered — `docs/AFTER-SUBMISSION.md`**: the short addendum for a
  revision or follow-up paper. Number-free by design; every figure lives once in
  the linked, registry-checked pages.
- **A three-lens audit ran over the finished package** (documentation
  consistency; adversarial code/test review; paper alignment and scenarios) and
  every finding was fixed or explicitly accepted — the reports and the complete
  fix list are in `archive/audit-2026-09-02/`. The substantive fixes: the
  anti-herd story now states both disproven conjectures everywhere; WP-15 is
  reframed to what it measures (granularity-invariance, with a new equal-share
  control arm `P2equal6_f0.8`; the ~6× decision cost stated as k-by-construction);
  a vacuous WP-12b property test now counts drops by cause; three chaos
  assertions that could not fail were made able to fail; renderer-identity tests pin
  `results/{loop,simulation}.md` to their JSON; the CI byte-diff gate covers all
  eight result sets; ten documents lost their stale pre-delivery labels; and the
  CHANGELOG itself joined the registry (188 claims across 15 documents).
- **`archive/`** — session checkpoints and audit reports now live outside the
  docs layer, dated and frozen, so the living documentation stays clean.

### Changed — wording only

- **Negative results are now stated in plain language** (owner request,
  2026-09-02): the jargon verdict word for a refuted conjecture became
  "disproven / disproven again" everywhere, and the matching "what would … it"
  headings became "what would disprove it", across docs, the loop renderer and the tests that pin the verdict
  wording. No number, verdict, or result changed — `results/loop.json` is
  byte-identical; only `results/loop.md`'s phrasing moved with its renderer.

### Fixed

- **A wrong hand-typed number, caught by widening the registry.** The WP-17
  delivery notes here and in the ROADMAP claimed energy-consumption coverage of
  "12/12" on the committed gateway documents; the measured value in
  `results/plane.json` is **9/12 (75%)** (intensity: 3/12, 25%). The write-up in
  `results/plane.md` was always right; the two prose sites were wrong, and they
  were wrong precisely because `plane.json` was not yet wired into the F12
  registry. Both are corrected, and every WP-17 number is now registered
  (see *Added*), so this class of drift fails the build from now on.
- `results/plane.md` carried a duplicated "signal member" bullet — an editing
  accident in the renderer string in `simulation/plane.js`. Deduplicated and
  regenerated; `results/plane.json` is byte-identical.

### Descoped

- **WP-16 (price-signal twin) will not be implemented** (owner decision, 2026-09-02).
  A summary of how to build it, why it was cut, and when it would ever be needed is
  kept in ROADMAP §5's WP-16 row (and the original task text stays in the archived runbook).
  Consequences, stated where they bite: §2g's £ arithmetic stays labelled
  *illustrative*, the C3/C12 candidate experiments stay candidates, and the
  second-grid signal-adapter proof remains open — the portability claim is
  architectural, not empirical. No carbon result anywhere depends on WP-16.

### Added

- **WP-15 delivered — the real workload trace** (`data/workloads/real-trace.json`
  + `simulation/workload-real.js` + the `P2real_f0.8` arm in `npm run simulate`):
  one LIVE run of the kaiban-distributed `social-media-team` workflow (6 tasks:
  extract → 4 parallel composers → aggregate; real gateway + 6 worker processes,
  BullMQ, gpt-4o-mini via OpenRouter; 7,484 tokens, $0.002, 20.4 s, zero errors),
  captured by the runtime's own run-logger, anonymised (answers stripped,
  structure and token counts kept) and replayed offline: each synthetic arrival
  becomes the six real subtasks, energy split by measured token shares, totals
  equal by construction. **What it establishes, stated carefully: P2's saving is
  invariant to decision granularity (−16.39%/−20.21% vs −16.45%/−20.27%), and an
  equal-share control arm gives the same answer — so the measured shares are not
  what drives it, and the arm says nothing further about real workloads (one run,
  one workflow, timing not replayed). The ~6× human-decision multiplication
  (545.7 → 3208.3, 853 → 5095.3) is k-by-construction — the gate is asked six
  times per arrival — which is precisely the argument for run-level gating or
  WP-14's standing rules, stated as mechanics, not as a measurement.** Network and
  money were spent exactly once, at capture.
- **WP-12b delivered — capacity rungs, and a second conjecture disproven** (`capacity`
  arm in `npm run loop`, `wp12b` cells, ADR-019): rungs acting on the per-slot
  cap (degrade halves it, escalate quarters it, block = 1/slot, terminate = 0 for
  the day, spill to the next cheapest feasible slot) **also fail to spread the
  herd** — the blind-herd top-5% share rises 33.33% → 36.56% (W1) / 40% (W2) at
  6.55% / 13.99% dropped, exactly the skip-k budget arm's share and drop rate,
  and peak concurrency rises 1 → 1.33 / 1.62. The corrected §2h.2 anti-herd claim
  is withdrawn rather than defended. Append-only: every pre-existing
  `results/loop.json` cell is byte-identical.
- **WP-9 delivered — the chaos suite** (`dataplane/chaos.test.js`, 9 tests, ~250
  assertions + a full-prefix truncation sweep) driving the real registry guard,
  byte cap, JSON parse path, doc-check, governor boundary and log analyser with
  hostile input. The fail-closed core held everywhere it matters — the governor
  blocks or terminates every absurd published intensity, and `commit()` throws —
  and 17 weaknesses in the *reporting* plane are pinned as `// FINDING:` cases
  rather than silently fixed, the two significant ones being presence-only
  mandatory-member/intensity checks (a document of all-null members scores 100%
  coverage) and a NaN `reportingPeriodAgeDays` escaping a null filter.
- **WP-4 delivered — the spatial advisory spec** (`docs/SPATIAL-ADVISORY.md`):
  one page in the port-contract style — the advisory object, its never-do list
  (move work, claim a GB regional actual, drop the movement cost, present advice
  as a verdict, bypass the rungs), the honesty box (forecast-scored, R2), and a
  plain statement of which parts `routing.js` does not yet implement.
- **`docs/OVERVIEW.md` — the whole system in plain words**, one page for anyone:
  the invention, the five verdicts, what is real vs simulated vs designed-only,
  every headline finding with its honest caveat, and what is still open. Every
  number on the page is F12-registered, so the page cannot drift from `results/`.
- **The F12 registry grew from 137 claims in 12 documents to 165 in 13.**
  `results/plane.json` is now part of the registry's evidence; the WP-17
  staleness and coverage numbers (in the ROADMAP and the new overview) and every
  number `docs/OVERVIEW.md` quotes are bound. The staleness "+6.1%" is a
  *computed* registry value derived from its own two registered cadence rows, so
  the percentage can never drift from its numerator. Fitness totals therefore
  move 14,983 → **15,011 cases** — the difference is registry entries added,
  nothing else; F7 also grew 35 → 37 static checks by auto-scanning the two new
  test files.
- **WP-6 delivered — six Gherkin feature files, executed against the real code**
  (`features/*.feature` + `simulation/features.test.js`): one plain-English spec per
  port, ≤1 page each, readable by a reviewer or a regulator, and every one of the
  25 scenarios runs — a ~50-line Gherkin reader and a step table drive the shipped
  gate, `runP2`, the charging fleet, the forecast adapter and the plane's document
  functions; an unmapped sentence fails the suite loudly. The E3 safety invariant
  ("a refusal withholds the optimisation, never power or charge"), fail-closed,
  terminate-never-overridable, the one-action metering bound and
  stale-documents-never-invented are all acceptance criteria now, not prose.
- **WP-7 delivered — the dynamic views** (`docs/architecture/DYNAMICS.md`): five
  committed Mermaid diagrams (C4 L3 six-port component view with built vs
  designed-not-built named in the picture; the E2 decision sequence with ADR-016's
  gate-once-on-arrival visible; the E3/E6 session including WP-17's publish-back
  edge; the task state machine; the budget sawtooth), each with a what-to-notice
  caption and a grounding table to code and ADRs. All five blocks machine-validated
  with the Mermaid parser.
- **WP-5 delivered — the metering port contract** (`docs/ports/METERING.md` +
  `simulation/metering.test.js`, 4 offline cases): the self-declared-estimate /
  metered-actual reconciliation that F13 proves is now *stated where the port is
  defined* — a strategic under-declaration is bounded to one action because
  `commit()` is charged the actual grams before the next gate call. Tested against
  the real governor and the real `runP2` call path, not a mock. Closes the contract
  half of R15; trusted measurement and attestation stay open and are said so.
- **WP-17 delivered — the closed loop with REAL documents** (`npm run plane` →
  `results/plane.*`, `simulation/plane.js` + `plane.test.js`): systems publish and
  consume documents in the gateway's own shape, with the mandatory member set
  derived from the committed gateway documents at run time so a format drift fails
  the arm rather than passing quietly. Two findings. **Staleness costs carbon:** at
  E1's measured real-world median cadence (23 days) the loop pays 83.3 vs 78.51
  g/kWh at runtime cadence, +6.1%. **The signal member matters more than the
  cadence:** a peer's published `carbon-intensity` is its own ACHIEVED intensity, so
  a well-optimised peer always looks clean regardless of grid state — degenerate as
  a congestion signal — whereas `energy-consumption` (load) is the number that says
  the shared resource is busy; measured coverage on the committed documents is 3/12
  (25%) for intensity against 9/12 (75%) for energy-consumption. That yields a concrete
  recommendation for the Internet-Draft: **publishing load is cheaper, more widely
  available, and more useful for regulation than publishing intensity.** Closes the
  format half of limitation R12; R5 (no independent publishers) stays open and is
  named as an adoption problem.
- **WP-12 delivered — the anti-herd comparison, with a negative verdict stated as
  such.** `npm run loop` now runs three mechanisms head-to-head against the blind
  herd at the representative corners: a BINDING paced budget (calibrated to the
  herd's own achievable day — the first calibration, f x the uncontrolled mean,
  never fired a rung, which is itself recorded) with skip-k rung semantics — it
  **sheds** 6.6–14% of the work and the top-5% share *rises*; the same budget with
  the gate's true DEFER semantics — no rung-driven drops (11–21% still drop at
  their deadlines), and the crowd **reshuffles** inside
  the same cheap band (top share ~41%); and a STAGGER arm carrying SI 2021/1467's
  intent at slot resolution — **inert**, because near-ties within 1 g/kWh are rare
  on real intensity data (noted beside R18). The repository's own §2h.2 conjecture
  ("a paced budget is a staggering mechanism") is **disproven in this model class**
  and corrected in ROADMAP/EXECUTIVE-CASE rather than reworded; what bounds the
  herd in every row is the per-system slot cap, so the corrected claim is that the
  gate's anti-herd lever is **capacity semantics** (WP-12b: capacity rungs,
  designed, not built). Six new invariant tests pin the verdict.
- **WP-3 delivered — the forecast port** (`docs/ports/FORECAST.md` — the first of
  the six port contracts and the template for the rest; `simulation/fetch-forecast.js`
  — manual network capture of NESO's fw48h, national + the three peer regions, with
  the prospective grading protocol built in: `--grade` writes MAPE/MAE/bias by lead
  time once a capture settles, and regional series are declared ungradable rather
  than backfilled (R2); a first live capture committed under `data/forecast/`, which
  immediately yielded an honest observation — the available fw48h horizon varies by
  time of day (62 of 96 nominal periods at this capture hour); reference adapter
  `simulation/forecast.js` + conformance suite `forecast.test.js`). Nothing in
  `npm test` touches the network.
- **WP-14 delivered — tiered governance as a mechanism** (`P2tiered_f0.8` arm in
  `npm run simulate`, rendered with its own acceptance sentence in
  `results/simulation.md`): one standing rule ("standing-rule:T1-auto-defer-
  blocked-deferrable", named in the approval object) authorises what a person used
  to rubber-stamp; humans keep tier T2 (escalations + blocks on non-deferrable
  work); `terminate` remains authorisable by no one. Property-tested: emissions,
  completions, drops, degradations and deferrals are IDENTICAL to the untired run,
  the human count equals the previously reported sensitivity EXACTLY
  (545.7 → 442.9 winter, 853 → 637 summer), and the rule's coverage is precisely
  the blocked-deferrable set.
- **WP-2 delivered — the exact saving decomposition**, without ablation arms: P2 now
  attributes every task's contribution into drop (never ran, priced at arrival),
  degrade (made smaller, priced at arrival) and timing (what ran, moved), with the
  identity drop+degrade+timing ≡ P0−P2 enforced by a throw in `runP2` and asserted
  again from the committed results. Measured at f = 0.8: winter **6.5 / 67.7 /
  25.8%**, summer **39.7 / 52.2 / 8.2%** — the ROADMAP's arithmetic predicted the
  right story and understated it (timing is 8.2% of the summer saving; drops
  cluster in the dirty hours the budget runs out in). Rendered as its own block in
  `results/simulation.md`.
- **WP-1 delivered — E2b, the horizon and objective sweep** (`runP3` + `sweep` in
  `simulation/run.js`, rendered in `results/simulation.md`, 3 new invariant tests):
  P3 runs deferrable work at the argmin of the peer signal inside its horizon —
  E3's objective applied to E2 — across horizon {6,12,24,48} h × deferrable fraction
  {0.5,1.0}, same seeds. At P1's own settings the objective alone lifts the saving
  from −1.54%/−2.97% to **−6.62%/−8.54%**; the table tops out at
  **−45.71%/−49.82%** (48 h, all-deferrable). Every cell agrees with bounds.js's
  analytic expectation within ~1% (cross-validation of simulation against calculus;
  `e2Potential` is now exported and shared, not duplicated) and sits under the
  oracle ceiling with only 0.5–2.4 pp of headroom — a perfect signal buys little.
  The ROADMAP's pre-registered prediction ("low single digits at the comparable
  cell") held; the reconciliation note explains why the wide-open cells run higher
  (whole-day baseline, longer horizons, the 2026 grid's deeper troughs).
- **E5, E6 and E6b — the invention's first real simulations** (`npm run loop`,
  `npm run routing`; `simulation/loop.js` + `loop.test.js`, `simulation/routing.js` +
  `routing.test.js`; `results/loop.*`, `results/routing.*`). All deterministic, no
  PRNG, byte-identical re-runs. **E5 (the multi-party closed loop, the article's own
  open problem):** N systems publish per-slot energy histograms on their own cadence
  and place work against grid intensity plus α × the (stale) published crowd — three
  findings: the plane spreads the herd **only by paying grams** (every heeding cell
  pays more intensity than the blind herd — information alone cannot both spread and
  stay clean, the measured case for the gate's allocation role); fresh mutual
  observation **oscillates** (complete daily swaps at N ≥ 5 — the cobweb); the effect
  **washes out as N grows**. **E6 (routed charging, when AND where):** (region,
  window) argmin over the committed regional forecasts with the drive priced in —
  up to +78 pp over the best home window at zero move cost, forecast-scored, with the
  tool printing its own spatial-Goodhart warning (a region publishing zero attracts
  all the load; the summer table's ~100% rows are that warning, not a saving).
  Verified alongside (lit-E): no production system routes vehicles on grid carbon,
  and Northern Scotland took >86% of GB's 4.6 TWh H1-2025 wind curtailment (£116m) —
  the router keeps choosing the region the grid pays to switch off. **E6b
  (geo-migration):** a runtime re-homing daily avoids 64.42% vs a fixed London home
  with 3 moves in 28 winter days; the 0/5/20 kWh switch-cost sweep barely moves it.
  Forecast accuracy is now measured inside `npm run bounds` (national MAPE/MAE per
  window, horizon caveat in the output). Unit tests 37 → 46.
- **`docs/RUNBOOK.md` (new; archived 2026-09-02 as `archive/RUNBOOK-2026-09.md` once every package was delivered)** — the execution manual: the standing-constraints block
  and a ready-to-paste agent brief for every work package, the verification recipe,
  and the presentation plan.
- **`docs/EXECUTIVE-CASE.md` (new)** — one page: the honest measured numbers, the
  five verified absences that make the composition new, the economics with fetched
  anchors, who it serves, and the two Mermaid diagrams (the inter-system loop; the
  six-port hexagon).
- **`docs/ROADMAP.md` (fourth pass)** — §3d composition matrix C1–C17 (incl. routed
  EVs, green inference routing, geo-migrating kaiban networks, prosumer fleets);
  §3e the fifteen scenarios; "who could publish today" with verified telemetry
  (Kepler/RAPL/DCGM, Matter 1.3, OpenADR 3's marginal-GHG signals, IETF GREEN WG,
  RFC 9547) and adoption evidence (security.txt 1.25% of top-1M, llms.txt,
  Cloudflare); prosumer precedents (SEG, Octopus Outgoing, 7,000-Powerwall/37 MW SA
  VPP, SunSpec, bi-directional zonal DFS); WP-17 and the E5/E6 findings folded into
  the plan.
- **`docs/ROADMAP.md` (third pass) — the invention put back at the centre.** New §3c
  states what the article actually claims — the closed cybernetic loop *between*
  systems through documents published at `/.well-known/sustainability-data` (each
  participant a reporter and a sensor; stigmergic regulation through a shared medium,
  `robots.txt`-shaped, with no coordinator) — and that ARCHITECTURE §8's own words
  ("the outer loop … is open in every experiment") mean the invention has never been
  exercised end to end (R2/R5/R12 are three facets of that one fact). Adds the
  inter-system uses the earlier sections under-sold: agentic runtimes as mutual
  back-pressure (AI-to-AI ECN via well-known documents), datacenter↔tenant
  self-regulation, websites governing agentic crawl/inference load by publishing cost,
  Scope-3 cascades, device fleets as publishers. Names the **sixth port —
  publication** (the invention's defining edge; only implemented in the separate
  publisher packages, never contracted or tested here — §4 Gap 2 updated). New
  **WP-17 (E5, the closed-loop arm)**: N governed systems consuming each other's
  *published documents* — no exogenous trace — measuring whether mutual observation
  damps or amplifies the herd, vs publication cadence and staleness; subsumes WP-8,
  extends WP-12, and is the joint headline with it. Innovation inventory grows items
  9–11 (the multi-actor closed loop itself; the publication port; carbon back-pressure
  for the agentic web).
- **`npm run bounds` — the maximum-optimisation calculus** (`simulation/bounds.js` →
  `results/bounds.json` + `results/bounds.md`, with `simulation/bounds.test.js`, 4 unit
  tests): deterministic expectations over the committed traces — no PRNG, no network —
  computing the CEILINGS every experiment must sit under. E2 temporal potential by
  horizon (6/12/24/48 h) × deciding signal (causal peer vs oracle) × deferrable
  fraction; E3 perfect-signal and interruptible bounds (a perfect signal is worth ~1
  point over the free forecast; interruptibility ~0.3 pp in winter E3); the
  peak-avoidance vs clean-seeking decomposition as a run (winter 7.03 + 25.82 pp,
  summer 21.42 − 4.9 pp) — delivering roadmap WP-2b; the forecast-scored spatial
  ceiling; and the monetisable quantity 333.3 / 258 kWh per night moved out of the
  16:00–19:00 evening block. Unit tests 33 → 37.
- **`docs/ROADMAP.md` (second pass)** — the owner's answers to all eight questions
  folded in verbatim with a decision under each; a ten-sentence plain-words summary;
  the bounds calculus (§2f); the honest economics with verified anchors — UK ETS
  £58.27/t, EU ETS €83.45/t, Octopus Agile structure, 1 GW/150k-EV existence proof
  (§2g); the innovation inventory (§2h) including "a paced budget is a staggering
  mechanism" — governance as the anti-herd, to be tested against SI 2021/1467's
  mandated randomised delay; the emitters map onto verified global shares — 37.4 Gt
  fossil CO2 2024, 73.2% of GHG from energy, data centres 415 TWh → ~945 TWh by 2030 —
  with out-of-scope rows stated honestly (§2i); new work packages WP-14 tiered
  governance (rules first, humans for what matters; 545.7 → 442.9 and 853 → 637
  decisions per window under rule one), WP-15 real workload trace, WP-16 price-signal
  twin; publishing commands (§9; the paper snapshot is the existing v1.0.0 tag).
- **`docs/ROADMAP.md`** — a post-audit addendum answering, in plain language, what this
  evaluation proved, what it did not, and what to build next. It does **not** change the
  submitted article. Its core findings: pure deferral (P1) bought −1.54% / −2.97% while
  the governor's −16.45% / −20.27% is mostly `degrade` and `drop`; E3's shifting-only
  32.85% / 16.53% decomposes (arithmetic against the window's own mean intensity) into
  **21% peak-avoidance / 79% clean-seeking in winter but 129% / −29% in summer**, because
  Britain's cleanest summer hours are midday and an overnight deadline cannot reach them.
  Includes a literature section verified live on 2026-09-01 (Wiesner Middleware '21 —
  Great Britain 4.3% at ±2 h and 7.4% at ±8 h, and *why* GB is the flat case;
  Sukprasert EuroSys '24 — spatial migration dominates temporal; Google — a 1–2% *power*
  drop and no fleet-wide carbon figure at all; Meta — scheduling secondary to batteries;
  CarbonScaler/CarbonFlex — the large numbers come from elasticity and from South
  Australia, and both name the "thundering herd" without measuring it), a measurement of
  NESO's national forecast error from the committed traces (**MAPE 6.55% winter / 8.25%
  summer**, horizon caveat stated), and 13 work packages with session estimates and seven
  open questions.
- **Limitation R18 — the E3 fleet has no randomised delay.** `bestStart()` is a
  deterministic argmin, so every vehicle picks the same clean window; *The Electric
  Vehicles (Smart Charge Points) Regulations 2021* (SI 2021/1467) reg. 11 requires a
  random delay of up to 600 s (remote capability 1800 s) on every GB charge point for
  exactly that reason. The modelled fleet could not lawfully operate in Great Britain.
  Found by audit; expected effect on the headline numbers is small at 30-minute
  resolution, and it is now stated rather than left for a reviewer.
- **Fitness function F13 — self-declared estimates** (`fitness/props.js`,
  `fitness/f13.test.js`, 1,500 cases). The gate decides on a number the *acting agent*
  supplies about itself, so what the architecture can promise about that is now a
  property rather than a caveat. Proven both ways: **with** a trusted metering port
  (`commit()` charged the grams actually emitted) an under-declaring agent is never
  given a stricter verdict than an honest one and reaches every rung **at most one
  action late** — under-declaring buys exactly one action of slack per rung and no more;
  **without** one, an agent that declares zero is never caught, staying `allow` for
  every action while its true emissions run past 1.25 × budget. This is limitation R15
  in executable form and the argument for a metering port in the port inventory.
- **Ungated argmin arm in E3** (`simulation/charging.js`'s `argminUngated()`, reported
  as `argmin_ungated` in `results/charging.json` and as its own row in
  `results/charging.md`): the same scheduler with no gate, no budget and no owner
  consent. It isolates what the *scheduler* achieves so the governed arms can be read
  against it, and makes R13 measurable rather than argued — in this scenario the gate
  can only subtract carbon saving, and what it buys is authority, auditability and a
  bounded human cost.
- **Limitations R11–R17** in `docs/LIMITATIONS.md` and ARCHITECTURE §11, each with a
  number measured on the committed traces where one could be: synchronised shifting onto
  one slot (R11); the two experiments are joined by assumption — no measured run consumes
  the gateway's documents as its signal (R12); in E3 the gate can only reduce the saving,
  the ungated argmin arm avoids 32.85% / 16.53% against the governed 32.51% / 16.04%
  (R13); rebound unmodelled and budgets relative (R14); self-declared estimates and no
  metering port (R15); arrival hour decides the verdict (R16); average not marginal
  intensity, and the traces are CO2-only labelled gCO2e (R17).
- **ARCHITECTURE §8 "A control-theoretic reading"**: what kind of controller the governor
  is (integral pacing on own spend, quantised output, feedforward on the grid, daily
  reset), Ashby's requisite variety, the Conant–Ashby good-regulator theorem, and a
  Viable System Model mapping.
- **Perfect-signal test** (`simulation/policies.test.js`): with peer == actual, the
  governor never exceeds always-run and shifting never exceeds naive, by construction.
  The two existing real-trace assertions are now worded as what they are — empirical on
  the committed traces (4.44% / 2.34% of E3 sessions land in a window that is dirtier on
  the actual series; the aggregate still held on every seed).
- **`.github/workflows/ci.yml`**: `npm ci`, `npm test`, then the determinism proof
  (simulate, charging, `fitness:report` twice, `git diff --exit-code results/`) on Node
  22 and 24. Offline only — nothing live runs in CI.
- **`.env.example`**; `madge` pinned to 8.0.0 in `npm run arch` / `arch:graph`.
- **F12 registry**: the "13/13 green" numerator (from F1–F11's pass flags, never from
  F12's own), the "100% valid" half of the data-plane sentence, the 80%-approval
  charging figures, the unit-test count (counted from the test files), the quality-
  scenario case sums (Q2, Q4, Q6, Q10), the human-decisions sensitivity numbers, the "22
  demonstration documents" (from the committed registry snapshot), and the totals now
  repeated in `RESEARCH.md` and `docs/FITNESS-FUNCTIONS.md`.
- `chainAnchor()`'s `anchorHash` is now checked by `verifyAnchored()` (a corrupted anchor
  object is reported); the post-anchor-edit limit of any anchor is documented.

### Changed — safety and correctness

- **`dataplane/measure.js` treats the gateway as a trust boundary**: subject names from
  the registry are validated (lower-case host-name shape, ≤253 chars) before use in a
  file name; the fetch URL is built from the validated name and the registry's `path`
  member is no longer spliced in (a path such as `@evil.example/x` would have re-pointed
  every request at another host); every fetch has a 15 s timeout and a 1 MiB streamed
  body cap; the registry fetch checks its HTTP status.
- **`gated()`** now includes the decision's own action in the fail-closed re-aggregation.
  Unreachable through the shipped gate (its action is always one of its verdicts), it
  closes a corner where a foreign gate object with an off-ladder action and no verdicts
  would have resolved to `allow`.
- **Both demos sanitise every printed document member** through one shared `clean()` in
  `demo/meaning.js` (previously `demo.js` printed five members raw and `agent.js` printed
  a non-numeric `carbon-intensity` raw). `PROMPTS_HUMAN`, exported and unused, is gone.
- **`results/fitness.md`** now reads the upstream rows (71/71, 69/69, per-file counts,
  commit and date) from the committed capture JSONs instead of template literals; the
  v1.0.0 totals are the one labelled constant.

### Documentation corrections (stale since v1.1.0 unless noted)

- ADR-015 and DEVELOPMENT still said the code is MIT → status notes; the v1.0.0 Zenodo
  record's licence is described as Zenodo actually records it (`gpl-3.0-or-later`; the
  code here is GPL-3.0-*only*) in DEVELOPMENT, RESEARCH.md and LICENSE.
- "26 unit tests" → 32, then 33; `npm test` step order (fitness runs before `check:docs`).
- "gate.js imports exactly two specifiers" omitted `node:crypto` (five places + F7's note).
- "Three policies" (four, with P1t); "Five decisions" (six); ADR-005's F2 at 75 cases
  (100, four shapes); ADR-012's debt (closed in v1.1.0); `DEMO_SUBJECT` default
  (`cloudflare.com`); the ADR index's dangling CHANGELOG reference; "the one dotted
  arrow" (two); the anchor shape (three fields); "Node.js 22" (22.9); a dangling "D3".
- RESEARCH-QUESTIONS: loop closure is "shown by simulation" only for the sense → decide →
  gate → act half; the publish-back edge is never exercised (R12).
- ADR-006 / ADR-011 status notes: in E3 the vehicle owner's consent answers a
  budget-pressure `escalate`; the E3 saving is the scheduler's (R13).
- Units: NESO publishes gCO2/kWh (CO2 from generation only); the `gCO2e/kWh` label is
  kept for the draft's member naming and the discrepancy is recorded (ADR-008, ADR-015,
  `simulation/README.md`).
- README restructured into a short front page; the full write-up moved verbatim to
  `RESEARCH.md`.

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
