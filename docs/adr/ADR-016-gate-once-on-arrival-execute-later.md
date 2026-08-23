# ADR-016 — Gate once on arrival, execute later: the deferral queue

- **Status:** Accepted
- **Date:** 2026-08-23

## Context

When a task is deferred to a cleaner slot, is it gated again when it finally
runs? Nothing said. If it were, one task would produce two verdicts and two audit
records, and "human decisions per day" would stop meaning anything.

## Decision

A task is gated **exactly once, on arrival**. That is the audited decision. If it
is deferred, it waits in the **deferral queue** and runs at its slot, at full
energy, without being re-evaluated.

A deferred task is a **paused** task: authorised, not refused, not stopped.

## Consequences

- One task, one verdict, one audit record.
- The budget is committed when the work runs, so deferred work can push the next day over budget. That is the pacing-not-capping property (ADR-004, R3).
- The decision uses a forecast and nothing re-checks it if conditions change.
- The queue is in memory for one simulated arm. A production "pause and rehydrate" would belong in the runtime's `WorkflowOrchestrator` / `CheckpointStore`, which already do checkpoint-and-resume. Not implemented here.

## Alternatives considered

- **Re-gate at execution.** More responsive, and it doubles the audit records, makes the human-decision count ambiguous, and allows defer-and-re-defer forever.
- **Gate only at execution.** Loses the point: the decision to wait *is* the governed decision.
