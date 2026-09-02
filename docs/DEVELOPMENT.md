# Development guide

> **At a glance.** One dependency, plain JavaScript, deterministic everywhere, and a
> single `npm test` that runs the unit suites, the fitness functions through the
> real gate, the feature specs and the number-binding check — all offline. Clone,
> install, test: everything reproduces byte for byte.

How to run this package, how to extend it, and the rules that keep it honest and
reproducible. Written for someone who has just cloned the repository.

## Getting set up

```bash
node -v          # must be 22.9 or newer
npm install      # installs exactly one runtime dependency
```

The one dependency is `kaiban-distributed@2.0.0`. It ships the real action gate
and the hash-chained audit log this package evaluates. Nothing here mocks it.
22.9 is the floor because the scripts use Node's own `--env-file-if-exists`.

One command has an **optional** extra. `npm run dataplane` validates each fetched
document against the draft's schema using the published reference consumer
library. It is deliberately not a dependency (ADR-017). To include that check:

```bash
npm i --no-save sustainability-wellknown-consumer@0.5.2
```

Without it the run still measures status, latency, size, member coverage,
disclaimers and freshness, and reports schema conformance as **"not measured"** —
never as 0%.

## Running things

| Command | What it does | Network |
|---|---|---|
| `npm test` | The 89 adapter unit tests, then the thirteen architecture fitness functions through the real gate, then `check:docs` | none |
| `npm run fitness` | The thirteen fitness functions on their own | none |
| `npm run fitness:report` | Re-runs the same thirteen properties and writes `results/fitness.json` **and** `results/fitness.md` | none |
| `npm run check:docs` | F12: compares every hand-typed headline number in the docs against `results/` | none |
| `npm run dataplane` | Fetches and checks every document the public gateway serves, then summarises its request logs | live gateway |
| `npm run fetch-traces` | Fetches and caches the real grid-carbon traces. Run once. | NESO API |
| `node simulation/fetch-forecast.js` | MANUAL, live network: capture NESO's forward forecast to `data/forecast/` (add `--grade <capture>` after ≥48 h to write the by-lead-time error file) | NESO API |
| `npm run simulate` | Experiment E2 — the governor versus the baselines | none, reads the cache |
| `npm run charging` | Experiment E3 — the gated charging shift | none, reads the cache |
| `npm run bounds` | The maximum-optimisation calculus: deterministic ceilings for every scenario, written to `results/bounds.json` + `results/bounds.md` | none |
| `npm run routing` | E6/E6b: routed EV charging (when AND where) and geo-migration, forecast-scored, written to `results/routing.*` | none |
| `npm run loop` | E5: the multi-party closed loop — N systems publishing and reading each other's documents, written to `results/loop.*` | none |
| `npm run plane` | WP-17: the closed loop run with real gateway-shaped documents, written to `results/plane.*` | none |
| `npm run demo` | One real document, one decision, all five verdicts | one document, with a fixture fallback |
| `npm run agent` | The same with a real language model, and you on the human port | gateway plus the OpenRouter API |
| `npm run arch` | Checks for circular imports with `madge` | none |
| `npm run arch:graph` | Draws the whole import graph with `madge` — this is what produced `results/madge.txt` | none |
| `npm run all` | `fitness:report`, then `simulate`, `charging`, `bounds`, `routing`, `loop`, `plane`, then `dataplane` | the live step is last, deliberately: everything deterministic finishes before anything touches the network |

### Environment variables

Every one of these is optional. Nothing that produces a number in `results/`
needs any of them.

| Variable | Read by | Default | What it does |
|---|---|---|---|
| `OPENROUTER_API_KEY` | `demo/agent.js` | none | The key for the optional live agent run. Without it the script explains that and exits. Put it in a gitignored `.env` at the repository root, or export it in your shell. Never commit it. |
| `OPENROUTER_MODEL` | `demo/agent.js` | `anthropic/claude-sonnet-5` | Which model proposes the action (ADR-018). |
| `DEMO_SUBJECT` | `demo/demo.js` | `cloudflare.com` | Which subject's document the demo reads. Must match `/^[a-z0-9.-]+$/i`; if no fixture exists for it, the script says which ones do. |
| `SUSTAINABILITY_CONSUMER_URL` | `dataplane/measure.js` | none | Points at a local build of the reference consumer library. If unset, the bare specifier `sustainability-wellknown-consumer` is tried; if that is not installed either, schema conformance is reported as "not measured" (ADR-017). |

`npm run agent` is the only command that spends money. It is never part of
`npm run all` or `npm test`.

## Coding rules

These are short on purpose. They are what keeps the package checkable.

1. **One file, one purpose, about 150 lines.** That is a target, not a ceiling nothing enforces. Twelve source files are above it today — the experiment files (one experiment each), the two registries (`fitness/props.js`, `tools/check-numbers.js`), the report renderers and the capture tools — each listed in ADR-001 with a written reason. If you take another file over the target, add it to that list with a reason, or split it.
2. **No new runtime dependencies.** The single dependency is the artifact under test; adding a second one weakens the argument as well as the install. Tools fetched on demand with `npx` (`madge`, the Mermaid CLI) are a separate matter and should still be justified. The optional reference consumer library is the one documented exception, and it is opt-in rather than installed (ADR-017). The live agent run uses no SDK at all — it is a plain `fetch` POST (ADR-018).
3. **No wall clock in a conclusion.** Nothing that affects a *conclusion* may call `Date.now()` or `new Date()` without an argument. Pass a clock in, or use a fixed date. The gate already takes an injected clock. There is exactly one documented exception: `fetchedAt` in the live data-plane run, which records when a live fetch actually happened (ADR-007). Adding a second exception needs an ADR.
4. **No unseeded randomness.** Use the seeded generator. `Math.random()` does not belong in this repository.
5. **No live network at run time except where it is the point.** `fetch-traces`, `dataplane`, `demo` and `agent` may. Nothing else may.
6. **Check at the boundary.** Anything coming from outside — an estimate, a document, a JSON field — is checked with `Number.isFinite` or an equivalent before it is used. Bad input becomes `block`, not an exception and not a silent zero.
7. **Comments explain why, for a human.** Every fitness property carries a comment saying why it matters architecturally, not what the code does. Keep that habit.
8. **Labels are not optional.** Anything synthetic says so, in the code and in the output. If you add a stipulated number, put it in the parameters object at the top of the file so it lands in the results JSON.
9. **The core imports nothing.** Ever — `governor/carbon-governor.js` and `governor/harness.js` both. F7 will catch you, but the point is not to get caught.
10. **Actuate through the harness.** If a new adapter runs a task, it calls `execute()` from `governor/harness.js`. F7 checks that every actuating adapter imports it. Running a task any other way means the file has its own private idea of what `terminate` means.
11. **Numbers in prose are checked.** If you type a headline number into `README.md` or a doc, register it in `tools/check-numbers.js` so F12 keeps it honest. If you cannot register it, it probably should not be stated as a number.

## Extending

### Add a fitness function

1. Write `f14YourProperty()` in `fitness/props.js`, returning `{ id, property, cases, passed, notes }` like the others.
2. Put a comment above it saying **why the property matters architecturally**, in the same voice as F1 to F12.
3. Add `fitness/f14.test.js`, about fifteen lines, asserting on `passed`.
4. Add the call to the `results` array in `fitness/report.js`.
5. Add an entry to [`FITNESS-FUNCTIONS.md`](FITNESS-FUNCTIONS.md).
6. Give it its own fixed PRNG seed if it generates cases.

Keep it real: the property must exercise the actual shipped code path — the real
`ActionGate` — not a reimplementation of it. A property that only tests the
reference core proves less than it looks like it does.

### Add a policy

Policies live in `simulation/run.js` as functions with the same shape as `runP0`,
`runP1`, `runP1t` and `runP2`: take the task list and the window, return a tally.
Then add it to the `policies` object in `main()`. It will be replayed on the
identical task list per seed, so any difference from the other policies is a
policy difference.

If the policy makes gated decisions, route them through `gated(gate, estimate)`
like `runP2` does, and actuate through `execute()` from `governor/harness.js`. If
it does not go through the gate, say so in its comment — P0, P1 and P1t do not,
and that is why their rows have `n/a` in the audit column.

If the policy uses a threshold or a median, say in its comment whether it looks
ahead. P1 uses the median of the whole window, which is a small piece of
lookahead; P1t uses a trailing 7-day median and does not (ADR-010).

### Add a region or a window

Both live at the top of `simulation/fetch-traces.js`:

- `WINDOWS` — the two 28-day windows, as fixed past `from`/`to` dates.
- `PEERS` — the three Great Britain regions modelled as peer systems, by region id and name.

Change either, re-run `npm run fetch-traces` once, then re-run the simulations.
Keep the windows in the past and fixed; a rolling window would break
reproducibility.

Note what changes downstream: `results/*.md` states the window dates, the slot
count and the gap count, and the results JSON carries the exact source URLs. Both
follow automatically, because the report code recomputes nothing.

### Swap the signal source

Any endpoint serving `/.well-known/sustainability-data` is a peer. The simulation
currently stands peers in with regional forecasts; a real peer's published
`carbon-intensity-gCO2e-per-kWh` drops into the same place.

## Keeping determinism

Before you commit a change to anything under `simulation/`, `fitness/` or
`governor/`:

```bash
npm run simulate && npm run charging
git diff --stat results/
```

If the diff is empty and you did not intend to change behaviour, you are fine. If
the diff is non-empty and you did not intend to change behaviour, something reads
the clock, the network, or an unseeded random source — find it before committing.

The live data-plane run is the one exception: `results/dataplane.json` will always
differ, because latency and `fetchedAt` change. Its member counts, schema
validity and freshness should not, as long as the gateway's data is unchanged.
`fetchedAt` is the only real wall-clock read in the package that lands in a
result file, and it is deliberate (ADR-007).

## How results are regenerated

In this order, from the repository root:

```bash
npm run all
```

which is exactly, and in this order:

```bash
npm run fitness:report   # writes results/fitness.{json,md}
npm run simulate         # writes results/simulation.{json,md}
npm run charging         # writes results/charging.{json,md}
npm run bounds           # writes results/bounds.{json,md}
npm run routing          # writes results/routing.{json,md}
npm run loop             # writes results/loop.{json,md}
npm run plane            # writes results/plane.{json,md}
npm run dataplane        # live; writes results/dataplane.{json,md} and refreshes data/dataplane/
```

The live step is last on purpose: everything deterministic is finished and
diffable before anything touches the network.

Two things are not produced by these commands and are refreshed by hand:

- `results/kaiban-upstream-tests.json` — the runtime's own governance suite, run inside a checkout of `kaiban-distributed` (`npx vitest run tests/unit/governance --config vitest.config.mts`), recording the package version, the commit and every case name.
- `data/dataplane/railway-logs.jsonl` — the raw HTTP access-log capture, pulled with `railway logs --http --json`. `dataplane/logs.js` only reads that file; it never shells out. Client IP addresses are replaced on ingest by the first 16 hex characters of a salted SHA-256 hash, and the salt is generated per run and never stored, so the addresses cannot be recovered. The count of distinct clients is a count over those hashes.

Each `results/*.md` is rendered from its JSON by report code that recomputes
nothing, so the Markdown and the JSON cannot drift apart. Do not hand-edit a
result file. If a number needs to change, change what produced it.

## Versions

| Version | What it is |
|---|---|
| **v1.0.0** — Zenodo [10.5281/zenodo.22056634](https://doi.org/10.5281/zenodo.22056634) | The snapshot the article cites. Nine fitness functions, 9/9 green over 10,994 cases; every number the article prints comes from this tag. The archive's files carry an MIT licence file; the Zenodo record's licence metadata was later set by the author to GPL-3.0 (Zenodo lists it as `gpl-3.0-or-later`). |
| **v1.1.0** — `main`, Zenodo [10.5281/zenodo.22068404](https://doi.org/10.5281/zenodo.22068404) (the concept DOI 10.5281/zenodo.22056633 resolves here) | A hardening pass: the rung semantics written down once and enforced, the actuation harness moved into `governor/`, three new fitness functions (F10, F11, F12), a portable data-plane run, client IPs hashed, and a documentation pass. Code licensed GPL-3.0-only from this version. |

`CHANGELOG.md` lists every change and says explicitly which numbers moved. The
short answer: none of the headline simulation, charging or data-plane numbers
did. The fitness totals changed because properties were added.

## How to cite

Cite the article, and cite this package as its replication material:

> A. N. Besleaga, "The Cybernetic Sustainability Loop: Governed Agentic Systems on a Sustainability Data Plane," submitted to *IEEE Software*, 22 August 2026; preprint doi:10.5281/zenodo.22056747. Replication package: `sustainability-loop-eval` v1.0.0, doi:10.5281/zenodo.22056634.

Cite **v1.0.0** when you are checking a number the article prints. Cite `main` or
v1.1.0 when you are reusing the code.

Machine-readable metadata is in `CITATION.cff` at the repository root; GitHub
renders a ready-made citation from it. Release v1.0.0 is archived on Zenodo as
doi:10.5281/zenodo.22056634 (concept DOI 10.5281/zenodo.22056633 for all versions).

Three licences apply and they are not the same:

- **Code** — GNU GPL v3.0 only, from v1.1.0 onward. See `LICENSE`. The v1.0.0 archive on Zenodo (10.5281/zenodo.22056634) contains an MIT licence file as released; the record's licence metadata was later set by the author to GPL-3.0 (Zenodo lists it as `gpl-3.0-or-later`; the code in this repository is GPL-3.0-*only*).
- **Documentation, text, diagrams, figures and result write-ups** — © Andrei N. Besleaga, all rights reserved. Not covered by the GPL. Cite the article and the Zenodo DOI when using them.
- **Carbon-intensity data** — © National Energy System Operator, CC BY 4.0. The attribution travels with the data: it is in the cached trace files and copied into every simulation results JSON. Carry it forward in anything derived from these results.

The one runtime dependency, `kaiban-distributed@2.0.0` on npm, is published under
Apache-2.0, which is compatible with GPL-3.0.

## Dependency advisories

`npm audit` reports advisories (21 on 2026-08-22: 12 moderate, 9 high). All of
them sit in transitive dependencies of the one direct dependency,
`kaiban-distributed` (kaibanjs → LangChain / langsmith / OpenTelemetry / uuid /
fast-xml-parser).

Stated precisely, because "not in code this package exercises" is easy to say and
worth being exact about:

- **Importing the package root loads its whole dependency tree**, including the advisory-bearing LangChain modules. They are in the process.
- **Nothing here invokes them.** This package uses `ActionGate`, `AuditLog` and `GATE_ACTION_SEVERITY`. No script calls LangChain, calls a model through it, or parses untrusted input with those libraries.
- **They were checked for load-time side effects.** The advisory-bearing modules were verified not to patch `fs`, `http` or `fetch` on import.
- **None is fixable here** without forking the runtime. They resolve upstream when kaiban-distributed bumps kaibanjs. Re-run `npm audit` after any version bump.
