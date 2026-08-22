/**
 * dataplane/doc-check.js — the pure part of the data-plane measurement: what a
 * sustainability document must contain, and what one actually contains.
 *
 * No network, no filesystem, no clock: every function here is a pure function of its
 * arguments, which is what makes dataplane/measure.test.js able to check them against
 * a saved fixture document offline.
 *
 * Member lists are those of draft-besleaga-sustainability-wellknown, checked on
 * 2026-08-22 against both revision 05 (the revision the article cites) and revision 06
 * in the rfc-sustainability-wellknown repository — the two revisions define the same 8
 * mandatory and 16 optional members — and cross-checked against
 * schemas-validators/response-schema.json ("properties" / "optionalProperties").
 */

/** "Mandatory Response Fields" — all 8 must be present in a conformant document. */
export const MANDATORY_MEMBERS = [
  "version", "updated", "capabilities", "provider",
  "measurement-method", "methodology-uri", "reporting-period", "target",
];

/** "Optional Response Fields" — all 16, counted to show how much a publisher volunteers. */
export const OPTIONAL_MEMBERS = [
  "energy-consumption", "energy-unit", "carbon-footprint", "carbon-unit",
  "carbon-accounting", "scope-1", "scope-2", "scope-3", "sci-score",
  "functional-unit", "carbon-intensity-gCO2e-per-kWh",
  "estimated-annual-emissions-kgCO2e", "renewable-energy",
  "verifiable-attestation-uri", "disclosure-uri", "target-type",
];

/** The in-band notice a gateway-prepared mapping must carry about the named subject. */
export const DISCLAIMER_RE = /NOT published, reviewed, authorized, or endorsed by the reporting subject/i;

/** Whole days from `b` to `a`; positive when `b` is in the past relative to `a`. */
export const daysBetween = (a, b) => (a.getTime() - b.getTime()) / 86400000;

const round1 = (x) => Math.round(x * 10) / 10;

/**
 * Reduce a reporting-period string (YYYY / YYYY-MM / YYYY-MM-DD) to its END date, so
 * "freshness" for e.g. "2025" means age since 2025-12-31, not since 2025-01-01.
 * Returns null for anything that is not one of the three calendar forms.
 */
export function reportingPeriodEndDate(period) {
  if (typeof period !== "string") return null;
  if (/^\d{4}$/.test(period)) return new Date(`${period}-12-31T00:00:00Z`);
  if (/^\d{4}-\d{2}$/.test(period)) {
    const [y, m] = period.split("-").map(Number);
    return new Date(Date.UTC(y, m, 0)); // day 0 of month m+1 == last day of month m
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(period)) return new Date(`${period}T00:00:00Z`);
  return null;
}

/**
 * Describe one fetched document. `refDate` is a FIXED reference date supplied by the
 * caller, never the wall clock, so freshness numbers are reproducible.
 * `isRealOrg` says whether the registry marks this subject as a real organization.
 */
export function analyzeDoc(doc, { refDate, isRealOrg = false } = {}) {
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) return { analyzable: false };
  const mandatoryMissing = MANDATORY_MEMBERS.filter((m) => !(m in doc));
  const optionalPresent = OPTIONAL_MEMBERS.filter((m) => m in doc);
  const updated = typeof doc.updated === "string" ? new Date(doc.updated) : null;
  const updatedValid = updated !== null && !Number.isNaN(updated.getTime());
  const periodEnd = reportingPeriodEndDate(doc["reporting-period"]);
  return {
    analyzable: true,
    mandatoryPresentCount: MANDATORY_MEMBERS.length - mandatoryMissing.length,
    mandatoryMissing,
    mandatoryComplete: mandatoryMissing.length === 0,
    optionalPresentCount: optionalPresent.length,
    optionalPresent,
    updatedAgeDays: updatedValid ? round1(daysBetween(refDate, updated)) : null,
    reportingPeriodAgeDays: periodEnd ? round1(daysBetween(refDate, periodEnd)) : null,
    hasCarbonIntensity: "carbon-intensity-gCO2e-per-kWh" in doc,
    hasSci: "sci-score" in doc,
    isRealOrg,
    hasDisclaimer: DISCLAIMER_RE.test(JSON.stringify(doc)),
  };
}
