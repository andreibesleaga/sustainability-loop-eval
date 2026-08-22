#!/usr/bin/env node
/**
 * dataplane/logs.js — Part B of E1: analyse the REAL Railway HTTP access logs already
 * pulled for the sustainability-registry gateway service, and merge the counts into
 * results/dataplane.json + results/dataplane.md.
 *
 * This script never calls the Railway CLI itself. The raw file was captured once,
 * read-only, with:
 *   railway logs --http --json --since 7d -p <projectId> -s <serviceId> -e <environmentId> \
 *     > data/dataplane/railway-logs.jsonl
 * and is committed. Each line is one JSON object per HTTP request (timestamp, method,
 * path, httpStatus, totalDuration, requestId, host, clientUa, srcIp, edgeRegion, ...).
 *
 * Retention observed at capture time: `--since 30d`/`--since 45d` and `--since 7d`
 * returned the SAME set of lines, so this is effectively all available history, not an
 * arbitrary slice.
 *
 * Run after measure.js (which rewrites results/dataplane.json and .md); `npm run
 * dataplane` runs both in that order. Re-running this script alone is idempotent.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { median } from "../shared/stats.js";
import { renderLogsMd, PART_B_HEADING } from "./report.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAW_PATH = path.join(ROOT, "data/dataplane/railway-logs.jsonl");
const WELL_KNOWN_SUFFIX = "/.well-known/sustainability-data";

/** "/x/.well-known/sustainability-data" -> "x"; the gateway's own doc -> "_gateway-root". */
export function subjectOf(requestPath) {
  const prefix = requestPath.slice(0, requestPath.indexOf(WELL_KNOWN_SUFFIX)).replace(/^\/+/, "");
  return prefix === "" ? "_gateway-root" : prefix;
}

const statusBucket = (code) =>
  (code >= 200 && code < 300 ? "2xx" : code >= 400 && code < 500 ? "4xx" : code >= 500 ? "5xx" : "other");

/** Pure: turn raw log lines into the reported counts. */
export function analyzeLogLines(lines) {
  const entries = [];
  let parseErrors = 0;
  for (const line of lines) {
    try { entries.push(JSON.parse(line)); } catch { parseErrors++; }
  }
  const times = entries.map((e) => new Date(e.timestamp).getTime()).filter((t) => !Number.isNaN(t));
  const wellKnown = entries.filter((e) => typeof e.path === "string" && e.path.includes(WELL_KNOWN_SUFFIX));
  const subjects = new Set(wellKnown.map((e) => subjectOf(e.path)));
  const statusSplit = { "2xx": 0, "4xx": 0, "5xx": 0, other: 0 };
  for (const e of entries) statusSplit[statusBucket(Number(e.httpStatus))]++;
  const healthchecks = entries.filter((e) => e.path === "/healthz" || e.path === "/health");
  const durations = entries.map((e) => Number(e.totalDuration)).filter((n) => Number.isFinite(n));
  const pathCounts = new Map();
  for (const e of entries) pathCounts.set(e.path, (pathCounts.get(e.path) ?? 0) + 1);

  return {
    rawFile: "data/dataplane/railway-logs.jsonl",
    logKind: "HTTP access logs (edge/proxy level: railway logs --http --json), one JSON object per request",
    linesRead: lines.length,
    parseErrors,
    spanStart: times.length ? new Date(Math.min(...times)).toISOString() : null,
    spanEnd: times.length ? new Date(Math.max(...times)).toISOString() : null,
    totalRequests: entries.length,
    wellKnownRequests: wellKnown.length,
    distinctSubjectsRequested: subjects.size,
    subjectsRequestedList: [...subjects].sort(),
    distinctClientIps: new Set(entries.map((e) => e.srcIp).filter(Boolean)).size,
    distinctUserAgents: new Set(entries.map((e) => e.clientUa).filter(Boolean)).size,
    statusSplit,
    healthcheckCount: healthchecks.length,
    healthcheckShare: entries.length ? Math.round((healthchecks.length / entries.length) * 1000) / 10 : null,
    totalDurationMsMedian: durations.length ? median(durations) : null,
    topPaths: [...pathCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([p, n]) => ({ path: p, count: n })),
    caveat: "This capture includes this evaluation run's own traffic (curl probes and dataplane/measure.js's GETs against the live gateway), visible as clientUa \"curl/*\" and \"node\". It is not filtered out because that would itself be a form of cherry-picking; it is real traffic the gateway actually served.",
  };
}

function main() {
  if (!existsSync(RAW_PATH)) {
    console.error(`No raw log file at ${RAW_PATH}.`);
    console.error("Pull it first with (read-only Railway CLI):");
    console.error("  railway logs --http --json --since 7d -p <projectId> -s <serviceId> -e <environmentId> > data/dataplane/railway-logs.jsonl");
    process.exit(1);
  }
  const lines = readFileSync(RAW_PATH, "utf8").split("\n").filter((l) => l.trim());
  const railwayLogs = analyzeLogLines(lines);

  const resultsPath = path.join(ROOT, "results/dataplane.json");
  const existing = existsSync(resultsPath) ? JSON.parse(readFileSync(resultsPath, "utf8")) : {};
  existing.railwayLogs = railwayLogs;
  writeFileSync(resultsPath, JSON.stringify(existing, null, 2));

  // Replace any previous Part B rather than appending a second copy.
  const mdPath = path.join(ROOT, "results/dataplane.md");
  const partA = (existsSync(mdPath) ? readFileSync(mdPath, "utf8") : "").split(PART_B_HEADING)[0].trimEnd();
  writeFileSync(mdPath, `${partA}\n${renderLogsMd(railwayLogs)}`);

  console.log(`Analyzed ${railwayLogs.totalRequests} log entries (${railwayLogs.parseErrors} parse errors). Merged into results/dataplane.json and results/dataplane.md.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
