#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-only
/**
 * dataplane/measure.js — Part A of E1: live measurement of the sustainability
 * data-plane gateway (https://sustainability.up.railway.app/).
 *
 * All LIVE network calls, nothing fabricated:
 *   1. GET /index.json                           -> subject registry
 *   2. GET each subject doc + the gateway's own root doc, 5x -> status/latency/bytes
 *   3. Check each document against draft-besleaga-sustainability-wellknown
 *      (mandatory/optional members, in-band disclaimer, freshness, carbon-intensity
 *      and SCI presence — see doc-check.js) and validate it with the reference
 *      consumer library (real JTD validation via ajv, not a hand-rolled check)
 *   4. Time that library's discover+fetch+parse for 3 subjects (median of 5)
 *   5. Read the live negative-findings register served in index.json
 *
 * Output: data/dataplane/index.json, data/dataplane/docs/<subject>.json,
 * results/dataplane.json, results/dataplane.md.
 *
 * Determinism note: latency numbers are live and vary run to run; everything else
 * (member presence, schema validity, freshness against the FIXED reference date
 * below) is stable given the same server state.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { median, p95 } from "../shared/stats.js";
import { analyzeDoc, MANDATORY_MEMBERS } from "./doc-check.js";
import { renderMeasurementMd } from "./report.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GATEWAY = "https://sustainability.up.railway.app";
const REF_DATE = new Date("2026-08-21T00:00:00Z"); // fixed reference for freshness, not wall-clock
const GETS_PER_DOC = 5;
const TIMED_SUBJECTS = ["cloudflare.com", "microsoft.com", "wikimedia.org"];

// The reference consumer library (npm: sustainability-wellknown-consumer). It is
// deliberately NOT a dependency of this package — "one dependency" is an architectural
// claim F7 checks — so it is resolved at run time, in this order (ADR-017):
//
//   1. SUSTAINABILITY_CONSUMER_URL, if set (any URL a local build can be imported from)
//   2. the bare specifier "sustainability-wellknown-consumer", if it happens to be
//      installed:  npm i --no-save sustainability-wellknown-consumer@0.5.2
//   3. neither  ->  schema conformance is reported as NOT MEASURED, never as 0%.
const CONSUMER_PACKAGE = "sustainability-wellknown-consumer";

/** Try the override first, then the bare specifier. Returns {consumer, source, error}. */
async function resolveConsumer() {
  const attempts = [];
  const override = process.env.SUSTAINABILITY_CONSUMER_URL;
  if (override) {
    try { return { consumer: await import(override), source: `SUSTAINABILITY_CONSUMER_URL=${override}`, error: null }; }
    catch (e) { attempts.push(`SUSTAINABILITY_CONSUMER_URL=${override}: ${e.message}`); }
  }
  try { return { consumer: await import(CONSUMER_PACKAGE), source: `bare specifier "${CONSUMER_PACKAGE}"`, error: null }; }
  catch (e) { attempts.push(`bare specifier "${CONSUMER_PACKAGE}": ${e.message}`); }
  return { consumer: null, source: null, error: attempts.join(" | ") };
}

const round1 = (x) => Math.round(x * 10) / 10;

// Trust boundary: everything the gateway returns — the registry and every document —
// is third-party-shaped JSON and is treated as untrusted (as demo/agent.js already
// does for what it prints). A subject name must look like a host name before it is
// used in a file name; the fetch URL is built from that validated name and never from
// a path string the registry supplies; every fetch has a timeout and a body cap.
const SUBJECT_RE = /^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/; // lower-case host-name shape, ≤253 chars
const FETCH_TIMEOUT_MS = 15_000;
const MAX_BODY_BYTES = 1_048_576; // 1 MiB — the largest document measured is 1.7 kB

/** A subject from the registry, validated or refused loudly. */
function subjectFrom(entry) {
  const domain = String(entry?.domain ?? "").toLowerCase();
  if (!SUBJECT_RE.test(domain) || domain.includes("..")) {
    throw new Error(`registry entry has an unusable domain ${JSON.stringify(entry?.domain)} — refusing to use it in a URL or a file name`);
  }
  return domain;
}

/** Read a response body with a hard byte cap, streaming, so a huge reply cannot land on disk. */
async function readCapped(res, cap = MAX_BODY_BYTES) {
  const chunks = [];
  let total = 0;
  for await (const chunk of res.body ?? []) {
    total += chunk.byteLength;
    if (total > cap) throw new Error(`response body exceeded ${cap} bytes`);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function timedGet(url) {
  const t0 = performance.now();
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  const body = await readCapped(res);
  return {
    status: res.status, ms: performance.now() - t0, bytes: Buffer.byteLength(body),
    contentType: res.headers.get("content-type") || null, body,
  };
}

/** GET one document GETS_PER_DOC times (sequentially, by design) and parse the last good body. */
async function measureDocument(label, url) {
  const gets = [];
  let lastGoodBody = null;
  for (let i = 0; i < GETS_PER_DOC; i++) {
    const r = await timedGet(url);
    gets.push({ status: r.status, ms: r.ms, bytes: r.bytes, contentType: r.contentType });
    if (r.status === 200) lastGoodBody = r.body;
  }
  let parsed = null, parseError = null;
  if (lastGoodBody) {
    try { parsed = JSON.parse(lastGoodBody); } catch (e) { parseError = String(e.message); }
  }
  return {
    label, url, gets, lastGoodBody, parsed, parseError,
    statuses: [...new Set(gets.map((g) => g.status))],
    medianLatencyMs: median(gets.map((g) => g.ms)),
  };
}

/** Validate with the reference library, distinguishing "invalid" from "not measured". */
function validate(consumer, parsed) {
  if (!consumer) return { valid: null, errors: ["schema validation not run: consumer library unavailable"] };
  if (!parsed) return { valid: false, errors: ["no parseable body"] };
  return consumer.validateDocument(parsed);
}

/**
 * Steps 2+3: GET, save and check every document the registry lists, plus the root doc.
 * Returns the per-subject rows AND the pool of UNROUNDED per-GET latencies: the overall
 * median/p95 are computed from the raw milliseconds, so rounding happens once, at the
 * end, rather than to every sample before it is aggregated.
 */
async function measureAll(index, consumer) {
  // "_gateway-root" is this script's own label, not a registry value. Every other
  // subject is validated, and its URL is derived from the validated name — the
  // registry's `path` member is deliberately not spliced into the URL, because a
  // path such as "@evil.example/x" would re-point the request at another host.
  const targets = [
    { subject: "_gateway-root", url: `${GATEWAY}/.well-known/sustainability-data`, row: null },
    ...(index.subjects ?? []).map((s) => {
      const subject = subjectFrom(s);
      return { subject, url: `${GATEWAY}/${subject}/.well-known/sustainability-data`, row: s };
    }),
  ];
  const perSubject = [];
  const latencyPool = [];
  for (const t of targets) { // sequential, by design
    const m = await measureDocument(t.subject, t.url);
    const validation = validate(consumer, m.parsed);
    const analysis = analyzeDoc(m.parsed, { refDate: REF_DATE, isRealOrg: t.row?.synthetic === false });
    if (m.lastGoodBody) writeFileSync(path.join(ROOT, `data/dataplane/docs/${t.subject}.json`), m.lastGoodBody);
    latencyPool.push(...m.gets.map((g) => g.ms));
    perSubject.push({
      subject: t.subject, url: t.url,
      synthetic: t.row ? t.row.synthetic : null,
      isGatewaySelf: t.row === null,
      httpStatuses: m.statuses,
      rawLatenciesMs: m.gets.map((g) => round1(g.ms)),
      medianLatencyMs: round1(m.medianLatencyMs),
      bytes: m.gets.map((g) => g.bytes),
      medianBytes: median(m.gets.map((g) => g.bytes)),
      contentType: m.gets[0]?.contentType ?? null,
      parseError: m.parseError,
      schemaValid: validation.valid, schemaErrors: validation.errors,
      ...analysis,
    });
  }
  return { perSubject, latencyPool };
}

/** Step 4: time the reference library's discover+fetch+parse, median of 5 per subject. */
async function timeConsumer(consumer, index, error) {
  const timing = { available: !!consumer, subjects: [], error };
  for (const domain of consumer ? TIMED_SUBJECTS.filter((d) => index.subjects.some((s) => s.domain === d)) : []) {
    const times = [];
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now();
      const r = await consumer.fetchSustainability(`${GATEWAY}/${domain}`);
      times.push(performance.now() - t0);
      if (r.status !== "ok") console.error(`  consumer fetch of ${domain} returned status=${r.status}`);
    }
    timing.subjects.push({ domain, timesMs: times.map(round1), medianMs: round1(median(times)) });
  }
  return timing;
}

/** Every claim in the summary is computed from the rows above, never assumed. */
function summarize(perSubject, latencyPool, index, negRegister, { fetchedAt, schemaAvailable }) {
  const analyzed = perSubject.filter((d) => d.analyzable);
  const realDocs = perSubject.filter((d) => d.synthetic === false);
  const allStatuses = perSubject.flatMap((d) => d.httpStatuses);
  const ages = (key) => analyzed.map((d) => d[key]).filter((x) => x !== null);
  // Conformance is counted over the documents that could actually be ANALYZED: a body
  // that never parsed is not a failed schema check, it is a document with no schema
  // claim to make. Both counts are reported so the denominator is never in doubt.
  const conformant = analyzed.filter((d) => d.schemaValid === true).length;
  return {
    fetchedAt,
    gateway: GATEWAY,
    referenceDate: REF_DATE.toISOString(),
    subjectsTotal: index.subjects.length,
    subjectsReal: realDocs.length,
    subjectsSynthetic: perSubject.filter((d) => d.synthetic === true).length,
    documentsMeasured: perSubject.length, // subjects + gateway root
    documentsAnalyzed: analyzed.length,
    getsPerDocument: GETS_PER_DOC,
    getsTotal: latencyPool.length,
    statusesObserved: [...new Set(allStatuses)].sort(),
    allGetsReturned200: allStatuses.every((s) => s === 200),
    schemaValidationAvailable: schemaAvailable,
    conformantCount: conformant,
    conformanceRate: schemaAvailable && analyzed.length ? Math.round((conformant / analyzed.length) * 1000) / 10 : null,
    latencyMedianMsOverall: round1(median(latencyPool)),
    latencyP95MsOverall: round1(p95(latencyPool)),
    latencySampleCount: latencyPool.length,
    bytesMedianOverall: median(perSubject.map((d) => d.medianBytes)),
    mandatoryMemberCount: MANDATORY_MEMBERS.length,
    mandatoryCoverageComplete: analyzed.length > 0 && analyzed.every((d) => d.mandatoryComplete),
    disclaimerCoverage: `${realDocs.filter((d) => d.hasDisclaimer).length}/${realDocs.length}`,
    freshnessUpdatedAgeDaysMedian: median(ages("updatedAgeDays")),
    freshnessReportingPeriodAgeDaysMedian: median(ages("reportingPeriodAgeDays")),
    carbonIntensityPresentCount: analyzed.filter((d) => d.hasCarbonIntensity).length,
    sciPresentCount: analyzed.filter((d) => d.hasSci).length,
    negativeFindingsCount: negRegister.count,
    negativeFindingsOrgs: (negRegister.subjects ?? []).map((s) => s.domain),
  };
}

async function main() {
  mkdirSync(path.join(ROOT, "data/dataplane/docs"), { recursive: true });
  mkdirSync(path.join(ROOT, "results"), { recursive: true });

  const { consumer, source: consumerSource, error: consumerError } = await resolveConsumer();
  if (!consumer) console.error(`consumer library not resolved — schema conformance will be reported as NOT MEASURED (${consumerError})`);

  // Step 1: the subject registry.
  const fetchedAt = new Date().toISOString();
  const idxRes = await fetch(`${GATEWAY}/index.json`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!idxRes.ok) throw new Error(`GET ${GATEWAY}/index.json returned HTTP ${idxRes.status} — nothing measured`);
  const index = JSON.parse(await readCapped(idxRes));
  writeFileSync(path.join(ROOT, "data/dataplane/index.json"),
    JSON.stringify({ fetchedAt, url: `${GATEWAY}/index.json`, status: idxRes.status, body: index }, null, 2));

  const { perSubject, latencyPool } = await measureAll(index, consumer);
  const consumerTiming = await timeConsumer(consumer, index, consumerError);
  const negRegister = index["no-machine-readable-data"] ?? { count: 0, subjects: [] }; // step 5
  const summary = summarize(perSubject, latencyPool, index, negRegister, { fetchedAt, schemaAvailable: !!consumer });

  const output = {
    provenance: {
      generatedBy: "dataplane/measure.js",
      gateway: GATEWAY,
      draftSource: "draft-besleaga-sustainability-wellknown-05 (member lists identical in -06), rfc-sustainability-wellknown repository",
      schemaValidator: consumer
        ? `${CONSUMER_PACKAGE} (resolved via ${consumerSource}) — real JTD schema validation via ajv, not hand-rolled`
        : "not resolved in this run — no schema-conformance claim is made",
      fetchedAt,
    },
    summary, perSubject, consumerTiming, negativeFindingsRegister: negRegister,
  };
  writeFileSync(path.join(ROOT, "results/dataplane.json"), JSON.stringify(output, null, 2));
  writeFileSync(path.join(ROOT, "results/dataplane.md"), renderMeasurementMd(output, { getsPerDoc: GETS_PER_DOC }));
  console.log("Wrote data/dataplane/index.json, data/dataplane/docs/*.json, results/dataplane.json, results/dataplane.md");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
