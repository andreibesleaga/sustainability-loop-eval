/**
 * demo/demo.js — the whole loop in one screen, with no simulation anywhere.
 *
 * ONE REAL DOCUMENT fetched from the live sustainability data plane, the REAL
 * kaiban-distributed gate from governor/gate.js, and an ILLUSTRATIVE daily carbon
 * budget invented for this demo. Three hypothetical agent actions of increasing size
 * are put to the gate; the verdicts are printed in plain words, then the audit chain
 * is verified. Run: npm run demo
 */
import { readFileSync } from "node:fs";
import { createCarbonGovernor } from "../governor/carbon-governor.js";
import { makeGate, gated } from "../governor/gate.js";

const SUBJECT = process.env.DEMO_SUBJECT ?? "cloudflare.com";
const URL_LIVE = `https://sustainability.up.railway.app/${SUBJECT}/.well-known/sustainability-data`;
const FIXTURE = new URL(`../data/dataplane/docs/${SUBJECT}.json`, import.meta.url);
const FALLBACK_INTENSITY = 250;   // gCO2e/kWh, illustrative, used only if the doc has none
const BUDGET_KWH_EQUIV = 3;       // illustrative daily budget, expressed in kWh of grid carbon
const DEGRADED_FRACTION = 0.4;    // what "degrade" costs, as a fraction of the full action
const ACTIONS = [                 // three hypothetical agent actions, increasing in size
  { name: "summarise one support ticket", kWh: 0.6 },
  { name: "re-index the knowledge base", kWh: 1.8 },
  { name: "retrain the ranking model", kWh: 3.0 },
];
const MEANING = {
  allow: "run it as planned",
  degrade: `run a reduced version (${DEGRADED_FRACTION * 100}% of the energy)`,
  escalate: "hold it and ask a human before anything runs",
  block: "refuse it; only an explicit human approval can override",
  terminate: "stop; nothing runs",
};

async function loadDocument() {
  try {
    const res = await fetch(URL_LIVE, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { doc: await res.json(), source: `LIVE ${URL_LIVE}` };
  } catch (e) {
    return { doc: JSON.parse(readFileSync(FIXTURE, "utf8")), source: `OFFLINE fixture data/dataplane/docs/${SUBJECT}.json (live fetch failed: ${e.message})` };
  }
}

const { doc, source } = await loadDocument();
const published = doc["carbon-intensity-gCO2e-per-kWh"];
const intensity = Number.isFinite(published) ? published : FALLBACK_INTENSITY;
const budgetG = BUDGET_KWH_EQUIV * intensity;

console.log(`Document : ${source}`);
console.log(`Subject  : ${doc.target} — period ${doc["reporting-period"]}, updated ${doc.updated}`);
console.log(`Published: carbon-footprint ${doc["carbon-footprint"] ?? "(none)"} ${doc["carbon-unit"] ?? ""}, carbon-intensity ${published ?? "(none published)"} gCO2e/kWh`);
console.log(`Intensity used: ${intensity} gCO2e/kWh ${Number.isFinite(published) ? "(from the document)" : "(ILLUSTRATIVE default — this document publishes no carbon-intensity member)"}`);
console.log(`Budget   : ILLUSTRATIVE ${budgetG.toFixed(0)} gCO2e/day (= ${BUDGET_KWH_EQUIV} kWh at that intensity)`);
console.log(`Gate     : REAL kaiban-distributed ActionGate + hash-chained audit log\n`);

const governor = createCarbonGovernor({ budgetG });
const { gate, audit } = makeGate(governor);

for (const a of ACTIONS) {
  const estimateG = a.kWh * intensity;
  const { action, verdicts } = await gated(gate, estimateG, { tool: a.name });
  const committed = ((governor.spentG + estimateG) / budgetG * 100).toFixed(0);
  console.log(`${a.name} — ${a.kWh} kWh ≈ ${estimateG.toFixed(0)} gCO2e (${committed}% of today's budget once spent)`);
  console.log(`   verdict: ${action.toUpperCase()} -> ${MEANING[action]}`);
  console.log(`   because: ${verdicts[0].reason}`);
  if (action === "allow") governor.commit(estimateG);
  else if (action === "degrade") governor.commit(estimateG * DEGRADED_FRACTION);
  console.log(`   spent so far: ${governor.spentG.toFixed(0)} / ${budgetG.toFixed(0)} gCO2e\n`);
}

const v = audit.verify();
console.log(`Audit: ${audit.records().length} decisions recorded, chain valid = ${v.valid}${v.valid ? "" : ` (broken at ${v.brokenAt})`}`);
console.log("Labels: one real document, one real gate, one invented budget. Nothing here is a measurement of Cloudflare or of any agent.");
