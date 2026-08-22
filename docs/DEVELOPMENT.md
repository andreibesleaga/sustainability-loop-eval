# Development guide

How to run this package, how to extend it, and the rules that keep it honest and
reproducible. Written for someone who has just cloned the repository.

## Getting set up

```bash
node -v          # must be 22 or newer
npm install      # installs exactly one runtime dependency
```

The one dependency is `kaiban-distributed@2.0.0`. It ships the real action gate
and the hash-chained audit log this package evaluates. Nothing here mocks it.

## Running things

| Command | What it does | Network |
|---|---|---|
| `npm test` | The nine architecture fitness functions, through the real gate | none |
| `npm run fitness` | The same nine functions | none |
| `node fitness/report.js` | Re-runs the same nine properties and writes `results/fitness.json` | none |
| `npm run dataplane` | Fetches and checks every document the public gateway serves | live gateway |
| `npm run fetch-traces` | Fetches and caches the real grid-carbon traces. Run once. | NESO API |
| `npm run simulate` | Experiment E2 — the governor versus two baselines | none, reads the cache |
| `npm run charging` | Experiment E3 — the gated charging shift | none, reads the cache |
| `npm run demo` | One real document, one decision, one verdict | one document, with a fixture fallback |
| `npm run agent` | The same with a real language model, and you on the human port | gateway plus the OpenRouter API |
| `npm run arch` | Draws the import graph with `madge` | none |
| `npm run all` | fitness, then dataplane, then simulate, then charging | as above |

`npm run agent` is the only command that needs a key. Export
`OPENROUTER_API_KEY` in a `.env` file at the repo root (gitignored) or in your shell. Never commit it. Without a key the script
explains that and exits rather than failing obscurely.

## Coding rules

These are short on purpose. They are what keeps the package checkable.

1. **One file, one purpose, about 150 lines.** If a file is growing past that, it is doing two things. The governor core stays under 70.
2. **No new runtime dependencies.** The single dependency is the artifact under test; adding a second one weakens the argument as well as the install. Development-only tools (`madge`, the Anthropic SDK for the optional agent run) are a separate matter and should still be justified.
3. **No wall clock.** Nothing that affects a result may call `Date.now()` or `new Date()` without an argument. Pass a clock in, or use a fixed date. The gate already takes an injected clock.
4. **No unseeded randomness.** Use the seeded generator. `Math.random()` does not belong in this repository.
5. **No live network at run time except where it is the point.** `fetch-traces`, `dataplane`, `demo` and `agent` may. Nothing else may.
6. **Check at the boundary.** Anything coming from outside — an estimate, a document, a JSON field — is checked with `Number.isFinite` or an equivalent before it is used. Bad input becomes `block`, not an exception and not a silent zero.
7. **Comments explain why, for a human.** Every fitness property carries a comment saying why it matters architecturally, not what the code does. Keep that habit.
8. **Labels are not optional.** Anything synthetic says so, in the code and in the output. If you add a stipulated number, put it in the parameters object at the top of the file so it lands in the results JSON.
9. **The core imports nothing.** Ever. F7 will catch you, but the point is not to get caught.

## Extending

### Add a fitness function

1. Write `f10YourProperty()` in `fitness/props.js`, returning `{ id, property, cases, passed, notes }` like the others.
2. Put a comment above it saying **why the property matters architecturally**, in the same voice as F1 to F9.
3. Add `fitness/f10.test.js`, about fifteen lines, asserting on `passed`.
4. Add the call to the `results` array in `fitness/report.js`.
5. Add a row to [`FITNESS-FUNCTIONS.md`](FITNESS-FUNCTIONS.md).

Keep it real: the property must exercise the actual shipped code path — the real
`ActionGate` — not a reimplementation of it. A property that only tests the
reference core proves less than it looks like it does.

### Add a policy

Policies live in `simulation/run.js` as functions with the same shape as `runP0`,
`runP1` and `runP2`: take the task list and the window, return a tally. Then add
it to the `policies` object in `main()`. It will be replayed on the identical task
list per seed, so any difference from the other policies is a policy difference.

If the policy makes gated decisions, route them through `gated(gate, estimate)`
like `runP2` does. If it does not go through the gate, say so in its comment —
P0 and P1 do not, and that is why their rows have `n/a` in the audit column.

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

## How results are regenerated

In this order, from the repository root:

```bash
npm run fitness          # the nine properties, as tests
node fitness/report.js   # writes results/fitness.json
npm run dataplane        # live; writes results/dataplane.{json,md} and refreshes data/dataplane/
npm run simulate         # writes results/simulation.{json,md}
npm run charging         # writes results/charging.{json,md}
```

Two things are not produced by these commands and are refreshed by hand:

- `results/kaiban-upstream-tests.json` — the runtime's own governance suite, run inside a checkout of `kaiban-distributed` (`npx vitest run tests/unit/governance --config vitest.config.mts`), recording the package version, the commit and every case name.
- `data/dataplane/railway-logs.jsonl` — the raw HTTP access-log capture, pulled read-only with the Railway CLI. `dataplane/logs.js` only reads that file; it never shells out.

Each `results/*.md` is rendered from its JSON by report code that recomputes
nothing, so the Markdown and the JSON cannot drift apart. Do not hand-edit a
result file. If a number needs to change, change what produced it.

## How to cite

Cite the article, and cite this package as its replication material:

> A. N. Besleaga, "The Cybernetic Sustainability Loop: Governed Agentic Systems on a Sustainability Data Plane," submitted to *IEEE Software*, 22 August 2026; preprint doi:10.5281/zenodo.22056747. Replication package: `sustainability-loop-eval` v1.0.0, doi:10.5281/zenodo.22056634.

Machine-readable metadata is in `CITATION.cff` at the repository root; GitHub
renders a ready-made citation from it. Release v1.0.0 is archived on Zenodo as
doi:10.5281/zenodo.22056634 (concept DOI 10.5281/zenodo.22056633 for all versions).

Two licences apply and they are not the same:

- **Code** — MIT. See `LICENSE`.
- **Carbon-intensity data** — © National Energy System Operator, CC BY 4.0. The attribution travels with the data: it is in the cached trace files and copied into every simulation results JSON. Carry it forward in anything derived from these results.

## Dependency advisories

`npm audit` reports advisories (21 on 2026-08-22: 12 moderate, 9 high) that all
sit in transitive dependencies of the one direct dependency, `kaiban-distributed`
(kaibanjs → LangChain / langsmith / OpenTelemetry / uuid / fast-xml-parser). None
is in code this package exercises — the evaluation imports `ActionGate`,
`AuditLog` and `GATE_ACTION_SEVERITY` and nothing else — and none is fixable
here without forking the runtime. They are resolved upstream when
kaiban-distributed bumps kaibanjs; re-run `npm audit` after any version bump.
