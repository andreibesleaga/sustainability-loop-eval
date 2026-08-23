// SPDX-License-Identifier: GPL-3.0-only
/**
 * demo/agent.js — a REAL LLM agent proposing a real task, judged by the REAL gate.
 *
 * One real peer document (live, fixture fallback), one real model call (via
 * OpenRouter, plain fetch, no SDK), and the shipped kaiban-distributed gate from
 * governor/gate.js. The daily carbon budget is ILLUSTRATIVE and the proposed task is
 * the model's, not a measurement of anything.
 *
 * You are the human port. On `escalate` you approve or refuse the task as proposed;
 * on `block` the only thing on offer is a REDUCED run, and you say yes or no to that;
 * `terminate` never asks you, because nobody can authorise it. Every one of those
 * paths goes through governor/harness.js's execute() — the same function the
 * simulations use — so the demo cannot be more permissive than the rest of the package.
 *
 * Anything the model or the fetched document says is treated as untrusted text: it is
 * stripped of control and ANSI escape sequences and length-clamped before it is printed
 * or interpolated into a prompt.
 *
 * Demonstration only: no number in results/ comes from this script.
 * Run: npm run agent   (needs OPENROUTER_API_KEY; Node 22.9+)
 */
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { createCarbonGovernor } from "../governor/carbon-governor.js";
import { makeGate, gated } from "../governor/gate.js";
import { execute } from "../governor/harness.js";
import { MEANING, DEMO_ACTION } from "./meaning.js";

const SUBJECT = "cloudflare.com";
const URL_LIVE = `https://sustainability.up.railway.app/${SUBJECT}/.well-known/sustainability-data`;
const FIXTURE = new URL(`../data/dataplane/docs/${SUBJECT}.json`, import.meta.url);
const MODEL = process.env.OPENROUTER_MODEL ?? "anthropic/claude-sonnet-5";
const FALLBACK_INTENSITY = 250; // gCO2e/kWh, illustrative, only if the doc publishes none
const BUDGET_G = 900, SPENT_G = 300; // ILLUSTRATIVE daily budget, and grams already spent today
const DEGRADED_FRACTION = 0.4;  // what a "reduced run" costs, as a fraction of the proposal
const HTTP_TIMEOUT_MS = 60000;  // a model call must not hang this script forever

// ANSI escape sequences, and every C0/C1 control character.
const ANSI_RE = /\u001b\[[0-9;?]*[ -\/]*[@-~]/g;
const CONTROL_RE = /[\u0000-\u001f\u007f-\u009f]/g;

/**
 * Untrusted text in, safe-to-print text out: drop ANSI escape sequences and control
 * characters (so nothing can move the cursor, clear the screen, or fake a prompt),
 * collapse whitespace, and clamp the length.
 */
function clean(value, max = 300) {
  const s = String(value ?? "").replace(ANSI_RE, "").replace(CONTROL_RE, " ").replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max)}...` : s;
}

/** A number from untrusted JSON, or null. Never NaN, never negative, never absurd. */
function cleanNumber(value, max = 1e6) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= max ? n : null;
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
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
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
  console.error(`OpenRouter returned ${res.status}: ${clean(data.error?.message) || "(no message)"}${hint ? ` — ${hint}` : ""}`);
  process.exit(1);
}

/** Ask the person at the terminal one yes/no question. */
async function confirm(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question(`${question} (y/n) `)).trim().toLowerCase();
  rl.close();
  return answer === "y" || answer === "yes";
}

async function main() {
  if (!process.env.OPENROUTER_API_KEY) {
    console.log("set OPENROUTER_API_KEY (e.g. in .env) to run the live agent — no model call was made, nothing was faked");
    return;
  }

  const { doc, source } = await loadDocument();
  const target = clean(doc.target, 80);
  const period = clean(doc["reporting-period"], 40);
  const published = doc["carbon-intensity-gCO2e-per-kWh"];
  const intensity = Number.isFinite(published) ? published : FALLBACK_INTENSITY;
  const remainingG = BUDGET_G - SPENT_G;

  console.log(`Document: ${source}`);
  console.log(`Peer    : ${target} — reporting period ${period}, carbon-intensity ${published ?? `(none published; using illustrative ${FALLBACK_INTENSITY})`} gCO2e/kWh`);
  console.log(`Model   : ${MODEL} via OpenRouter — one real call`);
  console.log(`Budget  : ILLUSTRATIVE ${remainingG} gCO2e left of ${BUDGET_G} today\n`);

  const raw = await ask(
    "You are an operations agent for a small video-encoding service. Reply with ONLY a JSON object, no prose, no code fences: {\"task\": string, \"estimatedKWh\": number, \"why\": string}.",
    `Propose ONE concrete task to run right now. A peer system (${target}) publishes carbon intensity ${intensity} gCO2e/kWh for reporting period ${period}. Your remaining carbon budget today is ${remainingG} gCO2e. Keep "why" under 25 words.`,
  );

  let proposal;
  try { proposal = JSON.parse(raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim()); }
  catch { console.error(`The model did not return parseable JSON. Raw reply:\n${clean(raw, 2000)}`); process.exit(1); }

  const task = clean(proposal?.task, 120);
  const why = clean(proposal?.why, 240);
  const kWh = cleanNumber(proposal?.estimatedKWh);
  if (kWh === null) { console.error(`The model proposed an unusable energy estimate: ${clean(proposal?.estimatedKWh, 40)}`); process.exit(1); }

  const estimateG = kWh * intensity;
  console.log(`Proposal: ${task}`);
  console.log(`  why   : ${why}`);
  console.log(`  energy: ${kWh} kWh x ${intensity} gCO2e/kWh = ${estimateG.toFixed(1)} gCO2e\n`);

  const governor = createCarbonGovernor({ budgetG: BUDGET_G });
  governor.commit(SPENT_G);
  const { gate, audit } = makeGate(governor);
  const decision = await gated(gate, estimateG, { agentId: "encoding-agent", tool: "run-task" });
  const { action, verdicts } = decision;
  console.log(`Gate verdict: ${action.toUpperCase()} — ${MEANING[action]}\n  because: ${verdicts[0].reason}\n  here    : ${DEMO_ACTION[action]}`);

  // The human port. `escalate` puts the task itself to you; `block` offers only the
  // reduced fallback; `terminate` asks nothing, and execute() refuses it either way.
  let approval;
  if (action === "escalate") {
    approval = { approved: await confirm("\nA human must decide. Approve this task as proposed?"), by: "terminal-user" };
  } else if (action === "block") {
    approval = { approved: await confirm(`\nBlocked. The only thing you can authorise is a REDUCED run (${DEGRADED_FRACTION * 100}% of the energy, ${(estimateG * DEGRADED_FRACTION).toFixed(1)} gCO2e). Authorise it?`), by: "terminal-user" };
  }

  const reduced = action === "block" || action === "degrade";
  const spendG = reduced ? estimateG * DEGRADED_FRACTION : estimateG;
  const { executed, reason } = execute(decision, () => {
    governor.commit(spendG);
    return reduced ? "reduced run" : "full run";
  }, approval);

  console.log(executed
    ? `\nRan: ${reduced ? "the REDUCED version" : "the task as proposed"}, charging ${spendG.toFixed(1)} gCO2e — ${approval ? "your approval is what authorised it" : "authorised automatically by the rung"}. Spent today: ${governor.spentG.toFixed(1)} / ${BUDGET_G} gCO2e.`
    : `\nNothing ran — ${reason}.`);

  const v = audit.verify();
  console.log(`\nAudit: ${audit.records().length} decision(s) recorded, chain valid = ${v.valid}`);
  console.log("Labels: one real document, one real model call, the real gate; the budget is illustrative and the task proposal is the model's. No number in results/ comes from this script.");
}

main().catch((e) => { console.error(e); process.exit(1); });
