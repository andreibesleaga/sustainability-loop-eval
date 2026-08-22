# Architecture fitness functions — results

Ran against `kaiban-distributed@2.0.0`'s real `ActionGate` + `AuditLog` (not simulated), commit `17ad362632556a19ea6586f2ceea397ae8ceb6b8` (2026-07-30), with the Carbon-Verdict Governor (`governor/carbon-governor.js`) plugged in as a validator. Reproduce with `npm run fitness` (or `npm run fitness:report` for the JSON) at the repo root, and `npx vitest run tests/unit/governance --config vitest.config.mts` inside a kaiban-distributed checkout for the upstream row.

| Fn | Property | Cases | Passed |
|----|----------|------:|:------:|
| F1 | Total order / most-severe-wins | 2,000 | yes |
| F2 | Fail-closed (throw / invalid estimate / disabled) | 75 | yes |
| F3 | Monotonicity + exact rung boundaries | 2,004 | yes |
| F4 | Human binding on escalate/block/terminate | 2,000 | yes |
| F5 | Gate-on-path (one audit record per attempt, in order, with its own operation) | 2,100 | yes |
| F6 | Audit-chain integrity + tamper detection | 500 | yes |
| F7 | Port isolation (hexagonal import graph) | 15 checks | yes |
| F8 | Determinism across two fresh gates | 300 | yes |
| F9 | Aggregation equivalence (reference vs. shipped) | 2,000 | yes |
| **Total** | **9/9 fitness functions green** | **10,994** | **yes** |
| Upstream unit (kaiban-distributed) | 4 test files, `action-gate` / `audit-log` / `policy-engine` / `registry` | 71 | 71/71 |
| Upstream e2e (kaiban-distributed, real Redis) | 11 test files, board/HITL, A2A, routing, scaling, security | 69 | 69/69 |

Full machine-readable output: `results/fitness.json` (Part A), `results/kaiban-upstream-tests.json` (Part B, unit, including all 71 upstream case names) and `results/kaiban-upstream-e2e.json` + `results/kaiban-upstream-e2e-raw.json` (Part C, end-to-end).

## Reading this, plainly

The governance gate this package evaluates is not a mock: it is `kaiban-distributed`'s shipped `ActionGate`, exercised in-process with the Carbon-Verdict Governor as its validator. Across 10,994 property-test cases and static import checks, the gate held every property we could state precisely: it always resolves to the single most-severe verdict (F1, F9), it fails closed rather than open on both internal errors and bad input while treating `enabled:false` as an honest all-or-nothing deployment switch rather than a bypass (F2), its severity ladder is monotone with exact rung boundaries (F3), nothing above `degrade` ever runs without a real human approval (F4), every attempted operation leaves exactly one audit record carrying its own operation type (F5), its audit chain both verifies and catches tampering (F6), the governance core has zero dependencies and the adapters stay decoupled (F7), and it is fully deterministic and reproducible (F8).

## Upstream evidence (the same code, in its own repository)

Upstream, the same gate/audit code carries its own 71-case unit suite, passing cleanly with no Redis/Kafka/network dependency — independent evidence that the ladder and gate are implemented and tested where they ship, not just asserted here.

Beyond the unit suite, kaiban-distributed's end-to-end suite was also run on the same clone and commit (`npx vitest run --config vitest.e2e.config.mts`, 2026-08-22) against a **real Redis broker in Docker**, started and stopped by the suite's own `globalSetup`: **11 test files, 69 tests, 69 passed, 0 failed** — board/human-in-the-loop integration (10), security/governance integration (17), agent-to-agent protocol (5), fan-out/fan-in (7), the two global-research flows (13), blog-team flow (6), event isolation (4), completion routing (3), distributed execution (3) and horizontal scaling over BullMQ (1). That shows the runtime's gate, board/HITL and messaging paths work end-to-end with a real broker; it does **not** run the Carbon-Verdict Governor inside that runtime (this package does that in-process, see `fitness/` and `simulation/`), and it is not a deployment. Summary and raw vitest JSON: `results/kaiban-upstream-e2e.json`, `results/kaiban-upstream-e2e-raw.json`.

The e2e config deliberately excludes the Kafka, live and chaos suites, and a **full Docker stack (Kafka + Zookeeper, board and agent services) was deliberately not run**: no claim in the article or in this evaluation depends on it — the gate the article evaluates is exercised in-process here and against a real broker upstream. Running the full stack is future work.

## What was skipped or worth noting

Nothing was skipped in Part A: the audit chain's tamper sub-case (F6) is runnable because `AuditLog.records()` exposes live record objects, and F7's checks run against the real current layout of the repository (`governor/`, `shared/`, and the `simulation/`, `dataplane/`, `demo/` adapters), so adding a file to any of those folders extends the check automatically rather than silently escaping it.

One environment note, not a fitness-function issue: `node --test fitness/` (a bare directory argument) hits a Node v24 test-runner quirk where the directory fails to resolve. `package.json` therefore uses the shell-glob form, `node --test fitness/*.test.js`, which is verified green (9/9) on Node 22 and Node 24.
