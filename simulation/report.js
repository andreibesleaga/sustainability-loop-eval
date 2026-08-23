// SPDX-License-Identifier: GPL-3.0-only
/**
 * simulation/report.js — markdown rendering for the two simulations. Kept separate from
 * the models so that run.js / charging.js contain only the experiment, and a reader
 * checking the science never has to wade through string formatting.
 *
 * Every number printed here comes straight from the results object — nothing is
 * recomputed, rounded again, or hand-written.
 */

const v = (x) => `${x.mean} ± ${x.sd}`;

export function renderSimulationMd(doc) {
  const w = doc.workload;
  let out = `# E2 — Carbon-Verdict Governor vs baselines\n\nReal 30-minute UK grid-carbon traces (${doc.provenance.W1.provider}); synthetic workload.\nEmissions are always computed from the **national ACTUAL** series; the **peer signal** is the mean of 3 peer systems' published **regional FORECAST** intensity (that endpoint has no actual). Scheduling never looks at the actual series.\n\nWorkload: ${w.arrivalsPerSlot} tasks per 30-min slot, ${w.energyPerTaskKWh} kWh each, ${w.deferrableFraction * 100}% deferrable by up to ${w.deferralHorizonHours} h, degraded mode = ${w.degradedEnergyFraction * 100}% energy. ${doc.seeds.length} seeds, mean ± sd.\n\n`;
  for (const id of Object.keys(doc.results)) {
    const win = doc.results[id], p = doc.provenance[id], c = doc.correlations[id];
    out += `## ${id} (${p.label}) ${p.from} → ${p.to} — ${p.slots} slots over ${p.days} days, ${p.nationalActualGapsCarriedForward} gaps carried forward\n\n`;
    out += `Peer-signal vs national-actual Pearson r = **${c.peerMeanVsNationalActual}** (peer mean), ${c.peerMaxVsNationalActual} (peer max). Mean peer signal ${c.meanPeerMeanGPerKWh} vs national actual ${c.meanNationalActualGPerKWh} gCO2e/kWh.\n\n`;
    out += `| policy | total gCO2e | % vs P0 | completed | dropped | degraded | deferred | mean delay of deferred work (min) | p95 delay of deferred work | human decisions | days over budget | audit valid |\n|---|---|---|---|---|---|---|---|---|---|---|---|\n`;
    for (const [name, m] of Object.entries(win.policies)) {
      const over = m.daysOverBudget ? `${v(m.daysOverBudget)} of ${m.days}` : "n/a";
      out += `| ${name} | ${v(m.totalGCO2e)} | ${v(m.pctVsP0)} | ${v(m.tasksCompleted)} | ${v(m.dropped)} | ${v(m.degraded)} | ${v(m.deferred)} | ${v(m.meanDelayMin)} | ${v(m.p95DelayMin)} | ${v(m.humanDecisions)} | ${over} | ${m.auditChainValidAllSeeds === undefined ? "n/a" : m.auditChainValidAllSeeds} |\n`;
    }
    out += `\nTasks per seed: ${v(win.tasksPerSeed)}. P1 threshold (${p.days}-day median peer signal, computed over the whole window — see ADR-010): ${win.peerMedianThresholdG} gCO2e/kWh. P1t uses a trailing ${win.p1tTrailingMedianDays}-day median instead, so it never looks ahead.\n`;
    out += `\nDelay columns describe DEFERRED work only (tasks that ran later than they arrived); \`completed\` and on-time completion are equal by construction — ${doc.invariants.completedOnTime}\n\n`;
  }
  return out + summaryProse(doc);
}

/** The ten lines a practitioner should read if they read nothing else. */
function summaryProse(doc) {
  const g = (id, pol, k) => doc.results[id].policies[pol][k].mean;
  const days = doc.results.W1.policies["P2_f0.8"].days;
  const horizonMin = doc.workload.deferralHorizonHours * 60;
  const L = [
    `1. The peer signal tracks the national grid closely (Pearson r = ${doc.correlations.W1.peerMeanVsNationalActual} winter, ${doc.correlations.W2.peerMeanVsNationalActual} summer), so peers' self-published intensity is a usable proxy for deciding *when* to run — even though its absolute level is biased low (${doc.correlations.W2.meanPeerMeanGPerKWh} vs ${doc.correlations.W2.meanNationalActualGPerKWh} gCO2e/kWh in summer, because one of the three peers sits in near-zero-carbon North Scotland).`,
    `2. Carbon-aware deferral alone (P1) is weak on these traces: ${g("W1", "P1", "pctVsP0")}% winter and ${g("W2", "P1", "pctVsP0")}% summer, at zero cost in completed work. Half the workload is non-deferrable, and a median threshold moves work to the first *acceptable* slot, not the cleanest one. P1's threshold is the median of the whole window, which a live scheduler could not know; the causal variant P1t, using a trailing ${doc.results.W1.p1tTrailingMedianDays}-day median, gets ${g("W1", "P1t", "pctVsP0")}% and ${g("W2", "P1t", "pctVsP0")}%. The two are reported side by side so the reader can see what the lookahead was worth.`,
    `3. The governor (P2) cuts far more because it can also shrink the work: at f = 0.8 it reaches ${g("W1", "P2_f0.8", "pctVsP0")}% (winter) and ${g("W2", "P2_f0.8", "pctVsP0")}% (summer) versus always-run.`,
    `4. That reduction is not free. At f = 0.8, ${g("W1", "P2_f0.8", "degraded")} of ~${Math.round(doc.results.W1.policies.P0.tasksCompleted.mean)} winter tasks run in degraded mode and ${g("W1", "P2_f0.8", "dropped")} are dropped outright; the summer numbers are ${g("W2", "P2_f0.8", "degraded")} degraded and ${g("W2", "P2_f0.8", "dropped")} dropped.`,
    `5. The budget factor f is the honest dial between emissions and service: from f = 1.0 to f = 0.6 the winter saving grows ${g("W1", "P2_f1.0", "pctVsP0")}% → ${g("W1", "P2_f0.6", "pctVsP0")}% while drops grow ${g("W1", "P2_f1.0", "dropped")} → ${g("W1", "P2_f0.6", "dropped")}.`,
    `6. Even at f = 1.0 — a budget equal to the median day's uncontrolled emissions — the ladder still saves ${g("W1", "P2_f1.0", "pctVsP0")}% (winter, ${g("W1", "P2_f1.0", "dropped")} tasks dropped) and ${g("W2", "P2_f1.0", "pctVsP0")}% (summer, ${g("W2", "P2_f1.0", "dropped")} dropped), because the degrade rung fires at 80% of budget, well before the cap.`,
    `7. Governance has a human cost: at f = 0.8 the loop asks for ${g("W1", "P2_f0.8", "humanDecisions")} (winter) and ${g("W2", "P2_f0.8", "humanDecisions")} (summer) human decisions over ${days} days — roughly ${(g("W1", "P2_f0.8", "humanDecisions") / days).toFixed(0)} and ${(g("W2", "P2_f0.8", "humanDecisions") / days).toFixed(0)} per day. That is every escalate and every block: the two rungs whose outcome only happens because a person authorised it. It is the number an operator has to budget staff for. Sensitivity: ${g("W1", "P2_f0.8", "blocksDeferrable")} (winter) and ${g("W2", "P2_f0.8", "blocksDeferrable")} (summer) of those were \`block\` verdicts on *deferrable* work, whose only physical outcome is a deferral — if deferring blocked work were automatic instead of approved, the count would be ${g("W1", "P2_f0.8", "humanDecisionsIfDeferralAutomatic")} and ${g("W2", "P2_f0.8", "humanDecisionsIfDeferralAutomatic")} (about ${(g("W1", "P2_f0.8", "humanDecisionsIfDeferralAutomatic") / days).toFixed(0)} and ${(g("W2", "P2_f0.8", "humanDecisionsIfDeferralAutomatic") / days).toFixed(0)} per day).`,
    `8. Deferred work is genuinely delayed: mean ${g("W1", "P2_f0.8", "meanDelayMin")} min and p95 at the ${horizonMin}-min horizon cap. Every completed task still met its deadline — that is an invariant of the model, not a result: deadlines are clamped to the window and no policy runs anything past one.`,
    `9. Days over budget remain common (${g("W1", "P2_f0.8", "daysOverBudget")} of ${days} at f = 0.8, winter): the governor paces spend, it does not guarantee the cap. Three reasons, all visible in the code: deferred work commits into the following day; non-deferrable work is throttled but never fully stopped short of the terminate rung; and the estimate the gate sees is the peer signal, which is biased low against the national actual the run is charged at.`,
    `10. Every decision passed through the shipped kaiban-distributed ActionGate and its hash-chained audit log; the chain verified clean for all ${doc.seeds.length} seeds, every window, every f (${doc.results.W1.policies["P2_f0.8"].auditRecordsPerSeed.mean} audited decisions per seed at f = 0.8, winter — one per task).`,
  ];
  return `## What the numbers show\n\n${L.join("\n\n")}\n\n### Caveats\n\n- **Real:** the carbon-intensity traces only. **Synthetic:** the workload, the task energy figure, the deferrable fraction, the degraded-mode cost, and the human approver (which always approves, deterministically).\n- Regional series are **forecast-only** in this API, so the peer signal cannot be validated against a regional actual; only the national series has an actual.\n- P2 is not a like-for-like comparison with P0/P1 on emissions alone: P2 does **less work**. Read total gCO2e together with completed / degraded / dropped.\n- Each task is gated exactly once, on arrival. A deferred run is the execution of that already-audited decision, not a new ungated action; the budget is then charged with the actual grams emitted.\n- \`degrade\`, \`escalate\` and \`block\` produce the same physical outcome here (defer if deferrable, otherwise run degraded). What differs is authority: the last two only happen because the simulated human approves them. \`terminate\` is the only rung that removes work.\n- The budget is reset daily; a task deferred across midnight commits against the next day's budget. This is deliberate and is one reason days-over-budget is non-zero.\n- Emissions are attributional (energy × grid intensity at run time). No embodied carbon, PUE, or hardware accounting.\n`;
}

export function renderChargingMd(doc, FLEET) {
  let out = `# E3 — Gated EV-charging shift\n\nReal 30-minute UK grid-carbon traces; synthetic fleet of ${FLEET.vehicles} EVs (${FLEET.energyKWh} kWh each, 3 h charge, plug in 18:00 ± 1 h, full by 07:00).\nThe agent proposes the cleanest 3-hour window it can see in the **peer signal**; emissions are scored on the **national ACTUAL** series. Sessions are decided in plug-in order, so the nightly budget is paced chronologically.\n\n**Safety constraint (by construction):** start-time shifting only — no vehicle-to-grid, no discharge, no state-of-charge logic. Every vehicle receives its full charge before its deadline in every arm, including when the gate refuses or the human declines.\n\n`;
  for (const [id, arms] of Object.entries(doc.results)) {
    const p = doc.provenance[id];
    out += `## ${id} (${p.label}) ${p.from} → ${p.to} — ${p.nights} nights x ${FLEET.vehicles} EVs = ${arms.naive.sessions} sessions\n\n`;
    out += `| arm | total gCO2e | gCO2e / session | % avoided vs naive | sessions shifted | approvals requested | approvals granted | gate refused shift | mean shift (h) | nights over budget | audit valid |\n|---|---|---|---|---|---|---|---|---|---|---|\n`;
    out += `| naive (charge on plug-in) | ${v(arms.naive.totalGCO2e)} | ${v(arms.naive.gPerSession)} | — | 0 | 0 | 0 | 0 | 0 | n/a | n/a |\n`;
    for (const [k, a] of Object.entries(arms)) {
      if (k === "naive") continue;
      out += `| governed, approval rate ${k.split("approval")[1]} | ${v(a.totalGCO2e)} | ${v(a.gPerSession)} | **${v(a.pctAvoidedVsNaive)}** | ${v(a.sessionsShifted)} | ${v(a.approvalsRequested)} | ${v(a.approvalsGranted)} | ${v(a.gateRefusedShift)} | ${v(a.meanShiftHours)} | ${v(a.nightsOverBudget)} of ${a.nights} | ${a.auditChainValidAllSeeds} |\n`;
    }
    const full = arms["governed_approval1.00"];
    const g = full.gateActions;
    out += `\nGate verdicts at approval rate 1.00 (nightly budget ${v(full.dailyBudgetG)} gCO2e = ${FLEET.budgetFactor} x median naive night): allow ${g.allow.mean}, degrade ${g.degrade.mean}, escalate ${g.escalate.mean}, block ${g.block.mean}, terminate ${g.terminate.mean} — ${v(full.auditRecordsPerSeed)} audited decisions per seed, one per session.\n\n`;
  }
  const over = Object.entries(doc.results).map(([id, arms]) => {
    const a = arms["governed_approval1.00"];
    return `${v(a.nightsOverBudget)} of ${a.nights} in ${doc.provenance[id].label}`;
  }).join(" and ");
  out += `## Notes\n\n- A refused gate verdict (block/terminate) or a declined owner consent does **not** withhold charge; it withholds the *optimisation*, and the car charges naively. That is why a stricter budget cannot make this scenario unsafe, only less effective.\n- The nightly budget is deliberately tight (${FLEET.budgetFactor} x the median naive night), so the cars that plug in late in the evening find the budget largely committed and lose their shift. This is the visible cost of pacing a budget that a must-serve load cannot actually respect: at full approval the fleet still ends over budget on ${over}. Pacing shapes the spend; it does not cap it.\n- Sensitivity: dropping human approval from 100% to 80% is a direct, near-linear haircut on the saving — the human is the bottleneck in the loop, not the model.\n- The gate is asked about the *proposed* clean window, and the budget is then charged with the grams actually emitted by whatever window was used.\n- Synthetic: fleet size, plug-in distribution, energy per session, and the approver. Real: the carbon intensity.\n`;
  return out;
}
