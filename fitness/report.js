/**
 * Runs the same nine property functions used by fitness/fN.test.js (imported
 * from fitness/props.js, so there is no duplicated logic) and writes
 * results/fitness.json. Run after `npm run fitness`:
 *
 *   node fitness/report.js
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  f1TotalOrder,
  f2FailClosed,
  f3Monotonicity,
  f4HumanBinding,
  f5GateOnPath,
  f6AuditChainIntegrity,
  f7PortIsolation,
  f8Determinism,
  f9AggregationEquivalence,
} from "./props.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const results = [
  await f1TotalOrder(),
  await f2FailClosed(),
  f3Monotonicity(),
  f4HumanBinding(),
  await f5GateOnPath(),
  await f6AuditChainIntegrity(),
  f7PortIsolation(),
  await f8Determinism(),
  await f9AggregationEquivalence(),
];

const totals = {
  functions: results.length,
  allPassed: results.every((r) => r.passed),
  totalCases: results.reduce((s, r) => s + r.cases, 0),
};

const report = { functions: results, totals, kaibanVersion: "2.0.0" };

const outPath = path.join(ROOT, "results", "fitness.json");
fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n");

for (const r of results) {
  console.log(`FITNESS ${r.id} cases=${r.cases} passed=${r.passed} :: ${r.notes}`);
}
console.log(`\nwrote ${outPath} — ${totals.functions} functions, ${totals.totalCases} total cases, allPassed=${totals.allPassed}`);
