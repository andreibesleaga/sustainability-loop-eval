// SPDX-License-Identifier: GPL-3.0-only
/**
 * simulation/workload-real.js — WP-15: the real workload template, offline.
 *
 * `data/workloads/real-trace.json` is ONE live run of a kaiban-distributed
 * social-media-team workflow (6 tasks: extract → 4 parallel composers →
 * aggregate), captured 2026-09-02 with the run-logger's own per-task token and
 * timestamp records; answers were stripped, structure kept. Network and money
 * were spent exactly once, at capture — replays are deterministic.
 *
 * The replay design keeps the comparison honest by changing exactly one thing:
 * each synthetic E2 task is replaced by the template's 6 subtasks, which inherit
 * the parent's arrival, deadline and deferrable flag, and split the parent's
 * energy by the run's measured token shares (input+output per task over the run
 * total). Totals are conserved BY CONSTRUCTION — shares sum to 1 by definition,
 * so the run-time identity assertion in run.js guards against future edits to
 * this splitter, not against the arithmetic. What changes is DECISION
 * GRANULARITY: the governor gates six real, unequal pieces per arrival instead
 * of one synthetic whole — and an equal-share control arm runs beside it so the
 * reader can see how much of the outcome the measured shares are responsible for
 * (the honest answer, printed with the results: very little).
 *
 * Two modelling notes, stated rather than hidden: (1) the live run took 20.4 s
 * end to end — far below one 30-minute slot — so the template's internal timing
 * cannot shift work across slots and is deliberately not replayed; (2) when
 * siblings of one run receive different verdicts, a deferred subtask may execute
 * in a later slot than a sibling that ran on arrival, which would violate the
 * pipeline's phase order; the carbon and decision accounting are unaffected, and
 * the results note says so.
 */
import { readFileSync } from "node:fs";

const TRACE_URL = new URL("../data/workloads/real-trace.json", import.meta.url);

/** The committed template: 6 tasks with token-derived energy shares. */
export function loadRealTemplate() {
  const doc = JSON.parse(readFileSync(TRACE_URL, "utf8"));
  const totalTokens = doc.tasks.reduce((a, t) => a + t.inputTokens + t.outputTokens, 0);
  if (totalTokens !== doc.provenance.totalTokens) {
    throw new Error(`trace inconsistent: tasks sum ${totalTokens} tokens, provenance says ${doc.provenance.totalTokens}`);
  }
  // The subtask ORDER is load-bearing (same-slot execution follows array order,
  // which is what keeps the pipeline's phase order), so a re-captured trace that
  // serialised tasks differently must fail here, not silently reorder the arm.
  const ids = doc.tasks.map((t) => t.id);
  if (ids[0] !== "extract" || ids.at(-1) !== "aggregate") {
    throw new Error(`trace order broken: expected extract first and aggregate last, got ${ids.join(", ")}`);
  }
  for (let i = 0; i < doc.tasks.length; i++) {
    for (const dep of doc.tasks[i].dependsOn) {
      if (ids.indexOf(dep) >= i) throw new Error(`trace order broken: ${ids[i]} precedes its dependency ${dep}`);
    }
  }
  return {
    source: "data/workloads/real-trace.json",
    capturedAt: doc.provenance.capturedAt,
    runDurationMs: doc.provenance.runDurationMs,
    totalTokens,
    tasks: doc.tasks.map((t) => ({
      id: t.id,
      dependsOn: t.dependsOn,
      tokens: t.inputTokens + t.outputTokens,
      share: (t.inputTokens + t.outputTokens) / totalTokens,
    })),
  };
}

/**
 * Replace every synthetic task with the template's subtasks. Arrival, deadline
 * and deferrable are inherited; energy is split by token share. The subtask list
 * preserves the template's dependency order (extract first, aggregate last) so
 * same-slot execution keeps the pipeline's phase order.
 */
export function realizeWorkload(tasks, template = loadRealTemplate()) {
  const out = [];
  for (const t of tasks) {
    for (const s of template.tasks) {
      out.push({ ...t, energyKWh: t.energyKWh * s.share, subtask: s.id });
    }
  }
  return out;
}
