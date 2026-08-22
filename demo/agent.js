/**
 * demo/agent.js — a REAL LLM agent proposing a real task, judged by the REAL gate.
 *
 * One real peer document (live, fixture fallback), one real model call (via
 * OpenRouter, plain fetch, no SDK), and the shipped kaiban-distributed gate from
 * governor/gate.js. The daily carbon budget is ILLUSTRATIVE and the proposed task is
 * the model's, not a measurement of anything. On `escalate` a human — you, at the
 * terminal — decides. Run: npm run agent   (needs OPENROUTER_API_KEY; Node 22.9+)
 */
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { createCarbonGovernor } from "../governor/carbon-governor.js";
import { makeGate, gated } from "../governor/gate.js";

const SUBJECT = "cloudflare.com";
const URL_LIVE = `https://sustainability.up.railway.app/${SUBJECT}/.well-known/sustainability-data`;
const FIXTURE = new URL(`../data/dataplane/docs/${SUBJECT}.json`, import.meta.url);
const MODEL = process.env.OPENROUTER_MODEL ?? "anthropic/claude-sonnet-5";
const FALLBACK_INTENSITY = 250; // gCO2e/kWh, illustrative, only if the doc publishes none
const BUDGET_G = 900, SPENT_G = 300; // ILLUSTRATIVE daily budget, and grams already spent today
const MEANING = { allow: "would run (full)", degrade: "would run (degraded)", escalate: "needs a human decision", block: "refused — nothing runs", terminate: "stopped — nothing runs" };

if (!process.env.OPENROUTER_API_KEY) {
  console.log("set OPENROUTER_API_KEY (e.g. in .env) to run the live agent — no model call was made, nothing was faked");
  process.exit(0);
}

async function loadDocument() {
  try {
    const res = await fetch(URL_LIVE, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { doc: await res.json(), source: `LIVE ${URL_LIVE}` };
  } catch (e) {
    return { doc: JSON.parse(readFileSync(FIXTURE, "utf8")), source: `OFFLINE fixture data/dataplane/docs/${SUBJECT}.json (live fetch failed: ${e.message})` };
  }
}

async function ask(system, user) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/andreibesleaga/sustainability-loop-eval",
      "X-Title": "sustainability-loop-eval",
    },
    body: JSON.stringify({ model: MODEL, messages: [{ role: "system", content: system }, { role: "user", content: user }], max_tokens: 600, temperature: 0 }),
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok) return data.choices?.[0]?.message?.content ?? "";
  const hint = { 401: "check OPENROUTER_API_KEY", 402: "insufficient credits", 429: "rate limited" }[res.status] ?? "";
  console.error(`OpenRouter returned ${res.status}: ${data.error?.message ?? "(no message)"}${hint ? ` — ${hint}` : ""}`);
  process.exit(1);
}

const { doc, source } = await loadDocument();
const published = doc["carbon-intensity-gCO2e-per-kWh"];
const intensity = Number.isFinite(published) ? published : FALLBACK_INTENSITY;
const remainingG = BUDGET_G - SPENT_G;

console.log(`Document: ${source}`);
console.log(`Peer    : ${doc.target} — reporting period ${doc["reporting-period"]}, carbon-intensity ${published ?? `(none published; using illustrative ${FALLBACK_INTENSITY})`} gCO2e/kWh`);
console.log(`Model   : ${MODEL} via OpenRouter — one real call`);
console.log(`Budget  : ILLUSTRATIVE ${remainingG} gCO2e left of ${BUDGET_G} today\n`);

const raw = await ask(
  "You are an operations agent for a small video-encoding service. Reply with ONLY a JSON object, no prose, no code fences: {\"task\": string, \"estimatedKWh\": number, \"why\": string}.",
  `Propose ONE concrete task to run right now. A peer system (${doc.target}) publishes carbon intensity ${intensity} gCO2e/kWh for reporting period ${doc["reporting-period"]}. Your remaining carbon budget today is ${remainingG} gCO2e. Keep "why" under 25 words.`,
);

let proposal;
try { proposal = JSON.parse(raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim()); }
catch { console.error(`The model did not return parseable JSON. Raw reply:\n${raw}`); process.exit(1); }

const estimateG = Number(proposal.estimatedKWh) * intensity;
console.log(`Proposal: ${proposal.task}`);
console.log(`  why   : ${proposal.why}`);
console.log(`  energy: ${proposal.estimatedKWh} kWh x ${intensity} gCO2e/kWh = ${estimateG.toFixed(1)} gCO2e\n`);

const governor = createCarbonGovernor({ budgetG: BUDGET_G });
governor.commit(SPENT_G);
const { gate, audit } = makeGate(governor);
const { action, verdicts } = await gated(gate, estimateG, { agentId: "encoding-agent", tool: "run-task" });
console.log(`Gate verdict: ${action.toUpperCase()} — ${MEANING[action]}\n  because: ${verdicts[0].reason}`);

if (action === "escalate") {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question("A human must decide. Approve this task? (y/n) ")).trim().toLowerCase();
  rl.close();
  console.log(answer === "y" ? "Approved by you: the task would run, and the approval is what authorised it." : "Not approved: nothing runs.");
}

const v = audit.verify();
console.log(`\nAudit: ${audit.records().length} decision(s) recorded, chain valid = ${v.valid}`);
console.log("Labels: one real document, one real model call, the real gate; the budget is illustrative and the task proposal is the model's.");
