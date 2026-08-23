// SPDX-License-Identifier: GPL-3.0-only
/**
 * Unit tests for the pure helpers behind the data-plane measurement — the ones that
 * turn a fetched document or a raw log line into a reported number. No network: the
 * document under test is the committed snapshot in data/dataplane/docs/, and the log
 * lines are inline fixtures.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzeDoc, reportingPeriodEndDate, daysBetween, MANDATORY_MEMBERS, OPTIONAL_MEMBERS, DISCLAIMER_RE } from "./doc-check.js";
import { analyzeLogLines, hashIps, subjectOf } from "./logs.js";
import { median, p95 } from "../shared/stats.js";

const REF = new Date("2026-08-21T00:00:00Z");
const fixture = (name) => JSON.parse(readFileSync(new URL(`../data/dataplane/docs/${name}.json`, import.meta.url), "utf8"));

test("the member lists are the draft's: 8 mandatory, 16 optional, no overlap", () => {
  assert.equal(MANDATORY_MEMBERS.length, 8);
  assert.equal(OPTIONAL_MEMBERS.length, 16);
  assert.equal(new Set([...MANDATORY_MEMBERS, ...OPTIONAL_MEMBERS]).size, 24);
});

test("a real gateway document is complete, dated, and carries the in-band disclaimer", () => {
  const a = analyzeDoc(fixture("cloudflare.com"), { refDate: REF, isRealOrg: true });
  assert.equal(a.analyzable, true);
  assert.equal(a.mandatoryComplete, true);
  assert.deepEqual(a.mandatoryMissing, []);
  assert.equal(a.mandatoryPresentCount, MANDATORY_MEMBERS.length);
  assert.equal(a.hasDisclaimer, true);
  assert.equal(a.isRealOrg, true);
  assert.equal(a.hasCarbonIntensity, false);           // published footprint, no intensity
  assert.equal(a.updatedAgeDays, 23);                   // 2026-07-29 -> 2026-08-21
  assert.equal(a.reportingPeriodAgeDays, 598);          // period "2024" ends 2024-12-31
  assert.ok(a.optionalPresent.includes("carbon-footprint"));
});

test("the gateway's own document publishes the member an agent acts on", () => {
  const a = analyzeDoc(fixture("_gateway-root"), { refDate: REF });
  assert.equal(a.hasCarbonIntensity, true);
  assert.equal(a.isRealOrg, false);
  assert.equal(a.hasDisclaimer, false); // the gateway describes itself; no subject to disclaim
});

test("a missing mandatory member is reported, and a non-object is not analyzable", () => {
  const { target, ...withoutTarget } = fixture("cloudflare.com");
  const a = analyzeDoc(withoutTarget, { refDate: REF });
  assert.equal(a.mandatoryComplete, false);
  assert.deepEqual(a.mandatoryMissing, ["target"]);
  assert.equal(a.mandatoryPresentCount, 7);
  assert.equal(analyzeDoc(null, { refDate: REF }).analyzable, false);
  assert.equal(analyzeDoc([{}], { refDate: REF }).analyzable, false);
  assert.equal(analyzeDoc({ updated: "not-a-date" }, { refDate: REF }).updatedAgeDays, null);
});

test("freshness uses the END of a reporting period, and rejects other forms", () => {
  assert.equal(reportingPeriodEndDate("2025").toISOString(), "2025-12-31T00:00:00.000Z");
  assert.equal(reportingPeriodEndDate("2026-02").toISOString(), "2026-02-28T00:00:00.000Z");
  assert.equal(reportingPeriodEndDate("2024-02").toISOString(), "2024-02-29T00:00:00.000Z"); // leap
  assert.equal(reportingPeriodEndDate("2026-07-15").toISOString(), "2026-07-15T00:00:00.000Z");
  assert.equal(reportingPeriodEndDate("Q1 2026"), null);
  assert.equal(reportingPeriodEndDate(2025), null);
  assert.equal(daysBetween(REF, new Date("2026-08-11T00:00:00Z")), 10);
});

test("the disclaimer regex matches the gateway's wording and nothing weaker", () => {
  assert.ok(DISCLAIMER_RE.test("... NOT published, reviewed, authorized, or endorsed by the reporting subject."));
  assert.equal(DISCLAIMER_RE.test("not endorsed by anyone in particular"), false);
});

test("median and p95 over a latency sample are the shared definitions", () => {
  const sample = [10, 20, 30, 40, 50];
  assert.equal(median(sample), 30);
  assert.equal(p95(sample), 48);          // (5-1)*0.95 = 3.8 -> 40 + 0.8*(50-40)
  assert.equal(median([10, 20, 30, 40]), 25);
});

test("log analysis counts requests, subjects, statuses and skips unparseable lines", () => {
  const lines = [
    JSON.stringify({ timestamp: "2026-08-15T10:00:00Z", path: "/.well-known/sustainability-data", httpStatus: 200, srcIp: "1.1.1.1", clientUa: "curl/8", totalDuration: 12 }),
    JSON.stringify({ timestamp: "2026-08-16T10:00:00Z", path: "/cloudflare.com/.well-known/sustainability-data", httpStatus: 200, srcIp: "1.1.1.2", clientUa: "node", totalDuration: 20 }),
    JSON.stringify({ timestamp: "2026-08-17T10:00:00Z", path: "/healthz", httpStatus: 200, srcIp: "1.1.1.1", clientUa: "railway", totalDuration: 4 }),
    JSON.stringify({ timestamp: "2026-08-18T10:00:00Z", path: "/nope", httpStatus: 404, srcIp: "1.1.1.3", clientUa: "curl/8", totalDuration: 8 }),
    "{ not json",
  ];
  const r = analyzeLogLines(lines);
  assert.equal(r.totalRequests, 4);
  assert.equal(r.parseErrors, 1);
  assert.equal(r.wellKnownRequests, 2);
  assert.deepEqual(r.subjectsRequestedList, ["_gateway-root", "cloudflare.com"]);
  assert.equal(r.distinctClientIps, 3);
  assert.equal(r.distinctUserAgents, 3);
  assert.deepEqual(r.statusSplit, { "2xx": 3, "4xx": 1, "5xx": 0, other: 0 });
  assert.equal(r.healthcheckCount, 1);
  assert.equal(r.healthcheckShare, 25);
  assert.equal(r.totalDurationMsMedian, 10);
  assert.equal(r.spanStart, "2026-08-15T10:00:00.000Z");
  assert.equal(r.spanEnd, "2026-08-18T10:00:00.000Z");
  assert.equal(r.topPaths[0].count, 1);
  assert.equal(subjectOf("/wikimedia.org/.well-known/sustainability-data"), "wikimedia.org");
  assert.equal(analyzeLogLines([]).totalDurationMsMedian, null);
});

test("no client IP survives ingest, and the committed capture carries none", () => {
  // hashIps replaces srcIp with an irreversible srcIpHash, and is stable per run.
  const salt = Buffer.from("fixed-test-salt");
  const hashed = hashIps([{ srcIp: "1.1.1.1", path: "/x" }, { srcIp: "1.1.1.1" }, { srcIp: "2.2.2.2" }], salt);
  assert.ok(hashed.every((e) => !("srcIp" in e)), "srcIp must not survive");
  assert.equal(hashed[0].srcIpHash, hashed[1].srcIpHash, "the same client hashes the same way");
  assert.notEqual(hashed[0].srcIpHash, hashed[2].srcIpHash, "different clients stay distinguishable");
  assert.match(hashed[0].srcIpHash, /^[0-9a-f]{16}$/);
  assert.equal(hashed[0].path, "/x", "other fields are untouched");
  // An already-hashed entry passes through unchanged, so re-running is idempotent.
  assert.deepEqual(hashIps([{ srcIpHash: "abc" }], salt), [{ srcIpHash: "abc" }]);

  const raw = readFileSync(new URL("../data/dataplane/railway-logs.jsonl", import.meta.url), "utf8");
  assert.equal(raw.includes('"srcIp"'), false, "the committed capture must contain no raw IP field");
  for (const key of ["deploymentId", "deploymentInstanceId", "upstreamAddress"]) {
    assert.equal(raw.includes(`"${key}"`), false, `${key} must not be committed`);
  }
  const lines = raw.split("\n").filter((l) => l.trim());
  const r = analyzeLogLines(lines);
  assert.equal(r.distinctClientIps, 26, "the reported distinct-client count is over hashes");
  assert.equal(r.totalRequests, 120);
});
