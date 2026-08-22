/**
 * dataplane/report.js — markdown rendering for the two data-plane measurements
 * (Part A: live gateway GETs, Part B: real Railway access logs).
 *
 * Rendering only: every number printed here is read from the results object that
 * measure.js / logs.js already wrote to results/dataplane.json. Nothing is recomputed
 * and nothing is asserted that the data does not show.
 */
import { MANDATORY_MEMBERS } from "./doc-check.js";

export const PART_B_HEADING = "## Part B — Railway HTTP access logs (real traffic)";

export function renderMeasurementMd(out, { getsPerDoc }) {
  const s = out.summary;
  const rows = out.perSubject.map((d) => {
    const kind = d.isGatewaySelf ? "gateway-self" : d.synthetic ? "synthetic" : "real-org";
    return `| ${d.subject} | ${kind} | ${d.httpStatuses.join(",")} | ${d.medianLatencyMs} | ${d.medianBytes} | ${d.schemaValid ?? "unavailable"} | ${d.mandatoryPresentCount ?? "-"}/${MANDATORY_MEMBERS.length} | ${d.optionalPresentCount ?? "-"} | ${d.hasDisclaimer ?? "-"} | ${d.updatedAgeDays ?? "-"} |`;
  }).join("\n");

  const statusLine = s.allGetsReturned200
    ? `Every document returned HTTP 200 on every one of ${getsPerDoc} sequential GETs (${s.getsTotal} GETs in total); no transient failures observed during this run.`
    : `NOT every GET returned 200 — observed statuses across ${s.getsTotal} GETs: ${JSON.stringify(s.statusesObserved)}. See per-subject \`httpStatuses\` in results/dataplane.json.`;
  const schemaLine = s.schemaValidationAvailable
    ? `Schema conformance (real JTD validation via the reference consumer library + ajv): ${s.conformantCount}/${s.documentsAnalyzed} parseable documents valid (${s.conformanceRate}%).`
    : `Schema conformance: **not measured in this run** — the reference consumer library was unavailable (${out.consumerTiming.error}). No conformance claim is made from this run.`;

  return `# Data-Plane Live Measurement

Gateway: ${out.provenance.gateway} — fetched ${s.fetchedAt}. Reference date for freshness math: ${s.referenceDate} (fixed, not wall-clock).

| subject | kind | HTTP status(es) | median latency ms | median bytes | schema valid | mandatory | optional | disclaimer | updated age (days) |
|---|---|---|---|---|---|---|---|---|---|
${rows}

## Reading (plain)

1. ${s.subjectsTotal} subjects served, ${s.subjectsReal} mapped from real organizations' public disclosures, ${s.subjectsSynthetic} deliberately synthetic (\`*.example\`), plus the gateway's own self-description document — ${s.documentsMeasured} documents measured in total.
2. ${statusLine}
3. ${schemaLine}
4. Mandatory-member coverage is ${s.mandatoryCoverageComplete ? `100%: every document carries all ${MANDATORY_MEMBERS.length} mandatory members.` : "NOT 100% — see mandatoryMissing in results/dataplane.json."}
5. Latency across every individual GET (${s.latencySampleCount} samples): median ${s.latencyMedianMsOverall} ms, p95 ${s.latencyP95MsOverall} ms; median body size ${s.bytesMedianOverall} bytes.
6. In-band "not published/authorized/endorsed" disclaimer present on ${s.disclaimerCoverage} real-organization documents.
7. Freshness: median age of the \`updated\` timestamp is ${s.freshnessUpdatedAgeDaysMedian} days relative to the fixed reference date; median reporting-period-end age is ${s.freshnessReportingPeriodAgeDaysMedian} days.
8. Optional members are where publishers differ: ${s.carbonIntensityPresentCount} of ${s.documentsAnalyzed} documents carry \`carbon-intensity-gCO2e-per-kWh\` (the member an agent needs to act on) and ${s.sciPresentCount} carries an SCI score.
9. Negative-findings register (live, served in index.json): ${s.negativeFindingsCount} organizations looked up and honestly reported as publishing no machine-readable data (${s.negativeFindingsOrgs.join(", ")}).

## Caveats

- This gateway is the article author's own reference deployment (operator: Andrei Besleaga), not an independent third party's.
- Documents for real organizations are **illustrative mappings prepared by the gateway operator from those organizations' own public reports** — they are not published, reviewed, authorized, or endorsed by the named organizations. This is stated in-band in the gateway's \`notice\` field and (per-document) in most \`provider\` fields.
- Latency/timing numbers are live and will vary between runs; member presence, schema validity, and freshness (relative to the fixed reference date) are stable given unchanged server-side data.
- Consumer-library timing (${out.consumerTiming.available ? "available" : "UNAVAILABLE — see consumerTiming.error in dataplane.json"}) measures discover+fetch+parse end-to-end from this machine, not the gateway's raw serve time.
`;
}

export function renderLogsMd(r) {
  return `
${PART_B_HEADING}

Source: \`railway logs --http --json\` (read-only Railway CLI, project linked read-only), saved to \`data/dataplane/railway-logs.jsonl\`. Log kind: **${r.logKind}**.

| span start | span end | total requests | well-known requests | distinct subjects requested | distinct client IPs | distinct user-agents | 2xx | 4xx | 5xx | healthcheck share |
|---|---|---|---|---|---|---|---|---|---|---|
| ${r.spanStart} | ${r.spanEnd} | ${r.totalRequests} | ${r.wellKnownRequests} | ${r.distinctSubjectsRequested} | ${r.distinctClientIps} | ${r.distinctUserAgents} | ${r.statusSplit["2xx"]} | ${r.statusSplit["4xx"]} | ${r.statusSplit["5xx"]} | ${r.healthcheckShare}% |

Subjects requested (from \`*/.well-known/sustainability-data\` paths): ${r.subjectsRequestedList.join(", ")}.

Top paths by request count: ${r.topPaths.map((t) => `\`${t.path}\` (${t.count})`).join(", ")}.

Caveat: ${r.caveat} \`--since 7d\`, \`--since 30d\`, and \`--since 45d\` all returned the same set of log lines at capture time, meaning this is effectively the full log retention window available on this plan (~1 week), not a slice we chose.
`;
}
