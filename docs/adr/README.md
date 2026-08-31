# Architecture decision records

Eighteen decisions that shaped this package. Each one is short: context, decision,
consequences, alternatives considered. ADR-001 to ADR-015 are dated 2026-08-22,
the day the repository went public; ADR-016 to ADR-018 are dated 2026-08-23 and
were written during the v1.1.0 hardening pass, which also rewrote ADR-006. They
record decisions taken while the package was built, not proposals.

The format follows the one used in the `kaiban-distributed` repository.

| ADR | Decision | One-line reason |
|---|---|---|
| [ADR-001](ADR-001-plain-javascript-esm.md) | Plain JavaScript ES modules, zero framework | A reader should not need a toolchain to check a claim |
| [ADR-002](ADR-002-real-gate-not-a-mock.md) | The real `kaiban-distributed` ActionGate is the enforcement point | Testing a copy would prove nothing about the runtime |
| [ADR-003](ADR-003-core-imports-nothing.md) | The governor core imports nothing | "Hexagonal" must be a test, not a sentence |
| [ADR-004](ADR-004-five-rung-ladder-and-rungs.md) | Five-rung ladder driven by a pacing ratio, rungs 0.8 / 1.0 / 1.1 / 1.25 | One number, four thresholds, one total order |
| [ADR-005](ADR-005-fail-closed.md) | Fail closed on bad input and on validator errors | A gate that can break open is worse than no gate |
| [ADR-006](ADR-006-human-port-and-stop-rungs.md) | Escalation and block go to the human port; terminate is never overridable; the harness is the only actuation path | Stopped, refused and paused are three different things |
| [ADR-007](ADR-007-determinism.md) | Determinism by construction | A decision you cannot replay is a decision you cannot review |
| [ADR-008](ADR-008-real-grid-traces.md) | Real NESO traces: national actual for emissions, regional forecasts as peer stand-ins | Model the gap between what an agent sees and what happened |
| [ADR-009](ADR-009-synthetic-workload-parameters.md) | Synthetic workload parameters live at the top of their file | Assumptions a reader cannot find are assumptions a reader cannot judge |
| [ADR-010](ADR-010-threshold-deferral-baseline.md) | Threshold deferral is the simple baseline | A number without a comparison means nothing |
| [ADR-011](ADR-011-charging-start-time-shift-only.md) | The charging scenario shifts start times only | A hard safety and legal line, enforced by construction |
| [ADR-012](ADR-012-commit-results-and-data.md) | Results and cached data are committed on purpose | Some inputs cannot be re-fetched later |
| [ADR-013](ADR-013-fitness-functions-as-test-layer.md) | Fitness functions are the architecture test layer | Architectural claims should fail a test, not survive in prose |
| [ADR-014](ADR-014-demo-live-document-with-fixture-fallback.md) | The demo reads one live document, with a fixture fallback | Thirty seconds to a real verdict, and honest offline |
| [ADR-015](ADR-015-cc-by-attribution.md) | CC BY 4.0 attribution for the grid data | The code licence does not cover the data |
| [ADR-016](ADR-016-gate-once-on-arrival-execute-later.md) | Gate once on arrival, execute later: the deferral queue | One task, one verdict, one audit record |
| [ADR-017](ADR-017-consumer-library-optional.md) | The reference consumer library is resolved at run time; its absence is reported as "not measured" | A check you could not run is not a check that failed |
| [ADR-018](ADR-018-openrouter-for-the-agent-demo.md) | The optional agent demo calls OpenRouter over plain HTTPS, defaulting to `anthropic/claude-sonnet-5` | A demonstration must not cost a dependency |

## Writing a new one

Copy the shape of any file here. Number it in sequence, date it, mark it
**Accepted** (or **Superseded by ADR-0NN**), and keep it to one page. If a
decision changes, write a new ADR that supersedes the old one rather than editing
history.

One exception was made in v1.1.0: ADR-006 was **rewritten in place** rather than
superseded, because its old text contained a sentence that was simply wrong about
what the code did ("block on deferrable work simply defers, with no human
involved"). Superseding it would have left the wrong sentence in the repository as
though it had once been true. The rewrite is noted in the file's own header.
