// SPDX-License-Identifier: GPL-3.0-only
/**
 * demo/demo.js — the whole loop in one screen, with no simulation anywhere.
 *
 * ONE REAL DOCUMENT fetched from the live sustainability data plane, the REAL
 * kaiban-distributed gate from governor/gate.js, and an ILLUSTRATIVE daily carbon
 * budget invented for this demo. Five hypothetical agent actions of increasing size
 * are put to the gate — sized so that every rung of the ladder appears once — the
 * verdicts are printed in plain words, and the audit chain is verified at the end.
 *
 * Actuation goes through governor/harness.js's execute(), like every other adapter
 * here, so what the demo prints as "ran" is what the harness actually permitted.
 * Nobody is at the terminal to approve anything in this demo, so escalate and block
 * simply do not run; `npm run agent` is the version where you decide.
 *
 * Demonstration only: no number in results/ comes from this script. Run: npm run demo
 */
import { readFileSync } from "node:fs";
import { createCarbonGovernor } from "../governor/carbon-governor.js";
import { makeGate, gated } from "../governor/gate.js";
import { execute } from "../governor/harness.js";
import { MEANING } from "./meaning.js";

const SUBJECT_RE = /^[a-z0-9.-]+$/i;
const SUBJECT = process.env.DEMO_SUBJECT ?? "cloudflare.com";
if (!SUBJECT_RE.test(SUBJECT)) {
  console.error(`DEMO_SUBJECT must look like a domain name (${SUBJECT_RE}); got: ${JSON.stringify(SUBJECT)}`);
  process.exit(1);
}

const URL_LIVE = `https://sustainability.up.railway.app/${SUBJECT}/.well-known/sustainability-data`;
const FIXTURE = new URL(`../data/dataplane/docs/${SUBJECT}.json`, import.meta.url);
const FALLBACK_INTENSITY = 250;   // gCO2e/kWh, illustrative, used only if the doc has none
const BUDGET_KWH_EQUIV = 3;       // illustrative daily budget, expressed in kWh of grid carbon
const DEGRADED_FRACTION = 0.4;    // what "degrade" costs, as a fraction of the full action

// Five hypothetical actions. Their sizes are chosen relative to the budget (not to any
// particular intensity) so the run walks the whole ladder: allow, degrade, escalate,
// block, terminate — in that order, whatever document is loaded.
const ACTIONS = [
  { name: "summarise one support ticket", kWh: 0.6 },
  { name: "re-index the knowledge base", kWh: 1.8 },
  { name: "render the quarterly video report", kWh: 1.7 },
  { name: "retrain the ranking model", kWh: 2.0 },
  { name: "back-fill embeddings for the whole archive", kWh: 2.5 },
];

async function loadDocument() {
  try {
    const res = await fetch(URL_LIVE, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { doc: await res.json(), source: `LIVE ${URL_LIVE}` };
  } catch (e) {
    try {
      return { doc: JSON.parse(readFileSync(FIXTURE, "utf8")), source: `OFFLINE fixture data/dataplane/docs/${SUBJECT}.json (live fetch failed: ${e.message})` };
    } catch {
      console.error(`Could not fetch ${URL_LIVE} (${e.message}), and there is no saved copy at data/dataplane/docs/${SUBJECT}.json.`);
      console.error(`Subjects with a saved copy: run \`ls data/dataplane/docs\`. Try DEMO_SUBJECT=cloudflare.com, or run \`npm run dataplane\` once while online to save the current set.`);
      process.exit(1);
    }
  }
}

async function main() {
  const { doc, source } = await loadDocument();
  const published = doc["carbon-intensity-gCO2e-per-kWh"];
  const intensity = Number.isFinite(published) ? published : FALLBACK_INTENSITY;
  const budgetG = BUDGET_KWH_EQUIV * intensity;

  console.log(`Document : ${source}`);
  console.log(`Subject  : ${doc.target} — period ${doc["reporting-period"]}, updated ${doc.updated}`);
  console.log(`Published: carbon-footprint ${doc["carbon-footprint"] ?? "(none)"} ${doc["carbon-unit"] ?? ""}, carbon-intensity ${published ?? "(none published)"} gCO2e/kWh`);
  console.log(`Intensity used: ${intensity} gCO2e/kWh ${Number.isFinite(published) ? "(from the document)" : "(ILLUSTRATIVE default — this document publishes no carbon-intensity member)"}`);
  console.log(`Budget   : ILLUSTRATIVE ${budgetG.toFixed(0)} gCO2e/day (= ${BUDGET_KWH_EQUIV} kWh at that intensity)`);
  console.log(`Gate     : REAL kaiban-distributed ActionGate + hash-chained audit log`);
  console.log(`Human    : nobody is at this terminal, so escalate and block get no approval\n`);

  const governor = createCarbonGovernor({ budgetG });
  const { gate, audit } = makeGate(governor);

  for (const a of ACTIONS) {
    const estimateG = a.kWh * intensity;
    const decision = await gated(gate, estimateG, { tool: a.name });
    const { action, verdicts } = decision;
    const committed = ((governor.spentG + estimateG) / budgetG * 100).toFixed(0);
    console.log(`${a.name} — ${a.kWh} kWh ≈ ${estimateG.toFixed(0)} gCO2e (${committed}% of today's budget once spent)`);
    console.log(`   verdict: ${action.toUpperCase()} -> ${MEANING[action]}`);
    console.log(`   because: ${verdicts[0].reason}`);

    // The one actuation path. No approval object is passed, so only allow and degrade
    // run — which is exactly the property F4 checks.
    const spend = action === "degrade" ? estimateG * DEGRADED_FRACTION : estimateG;
    const { executed, reason } = execute(decision, () => governor.commit(spend));
    console.log(`   ${executed ? `ran, charging ${spend.toFixed(0)} gCO2e to the budget` : `did NOT run — ${reason}`}`);
    console.log(`   spent so far: ${governor.spentG.toFixed(0)} / ${budgetG.toFixed(0)} gCO2e\n`);
  }

  const v = audit.verify();
  console.log(`Audit: ${audit.records().length} decisions recorded, chain valid = ${v.valid}${v.valid ? "" : ` (broken at ${v.brokenAt})`}`);
  console.log(`Labels: one real document, one real gate, one invented budget. Nothing here is a measurement of ${doc.target} or of any agent, and nothing in results/ comes from this script.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
