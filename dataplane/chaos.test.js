// SPDX-License-Identifier: GPL-3.0-only
/**
 * dataplane/chaos.test.js — WP-9: adversarial/negative suite for the data-plane
 * adapters. Everything the gateway, the registry and the access logs hand this
 * package is third-party-shaped and untrusted; this file attacks the code that
 * receives it and pins what actually happens.
 *
 * The invariant under test everywhere is ADR-005, fail closed: hostile input must be
 * REFUSED (throw), QUARANTINED (null / analyzable:false / valid:false) or, at the very
 * last boundary, REFUSED BY THE GOVERNOR — it must never silently become a number an
 * agent acts on. Where the current code does NOT hold that line, the test pins the
 * present behaviour and says so in a loud `// FINDING:` comment rather than fixing it.
 *
 * Surface. doc-check.js and logs.js export their pure functions and are driven
 * directly. measure.js exports NOTHING (see FINDING 1), so its four hardening paths —
 * the registry-entry guard, the streaming byte cap, the per-request cancellation
 * signal, and the "invalid vs. not measured" split — are compiled out of measure.js's
 * OWN BYTES with `new Function` and driven with an injected `fetch`. That runs the real
 * source text, not a re-implementation: if a guard is renamed, moved or weakened, the
 * extraction fails loudly here. simulation/lib.js and simulation/forecast.js are NOT
 * used: measure/doc-check/logs left more than enough surface.
 *
 * Timeouts. measure.js arms `AbortSignal.timeout(15_000)` on every request. Whether it
 * FIRES cannot be observed offline without a 15-second wall-clock wait, which ADR-007
 * forbids, and no injectable clock exists — so it is not faked. What is checked is that
 * every fetch is handed a live, unaborted AbortSignal and that the constant is 15_000.
 *
 * Deterministic and offline: fixed inline fixtures plus the committed snapshot in
 * data/dataplane/docs/, an injected fetch stub, a fixed hash salt, no clock, no writes.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzeDoc, reportingPeriodEndDate, MANDATORY_MEMBERS, DISCLAIMER_RE } from "./doc-check.js";
import { analyzeLogLines, hashIps, subjectOf } from "./logs.js";
import { renderLogsMd } from "./report.js";
import { createCarbonGovernor, carbonValidator } from "../governor/carbon-governor.js";
import { median } from "../shared/stats.js";

const REF = new Date("2026-08-21T00:00:00Z");
const SALT = Buffer.from("fixed-chaos-test-salt"); // never random: results must be byte-identical
const MEASURE_SRC = readFileSync(new URL("./measure.js", import.meta.url), "utf8");
const fixture = (name) => JSON.parse(readFileSync(new URL(`../data/dataplane/docs/${name}.json`, import.meta.url), "utf8"));

// ── harness: compile measure.js's private hardening out of its own source ──────
//
// FINDING 1 (testability, not a leak): dataplane/measure.js has NO `export`. Its
// hardening — SUBJECT_RE/subjectFrom, readCapped's 1 MiB cap, timedGet's abort signal,
// validate's "not measured" split — is unreachable from a test as the module stands.
// Rather than copy the logic (which would test the copy), the declarations are sliced
// out of the real file and compiled. Exporting these four functions would let this
// harness be deleted; until then, the slicing below is the pin.
const declOf = (marker) => {
  const i = MEASURE_SRC.indexOf(marker);
  assert.notEqual(i, -1, `measure.js no longer declares \`${marker}\` — the chaos harness must be re-pointed (or the function exported)`);
  const end = MEASURE_SRC.indexOf("\n}\n", i);
  assert.notEqual(end, -1, `\`${marker}\` no longer ends at a column-0 brace — re-point the chaos harness`);
  return MEASURE_SRC.slice(i, end + 2);
};
const lineOf = (marker) => {
  const i = MEASURE_SRC.indexOf(marker);
  assert.notEqual(i, -1, `measure.js no longer declares \`${marker}\` — the chaos harness must be re-pointed`);
  return MEASURE_SRC.slice(i, MEASURE_SRC.indexOf("\n", i));
};
const HARNESS_SOURCE = [
  lineOf("const SUBJECT_RE"),
  lineOf("const FETCH_TIMEOUT_MS"),
  lineOf("const MAX_BODY_BYTES"),
  lineOf("const GETS_PER_DOC"),
  declOf("function subjectFrom"),
  declOf("async function readCapped"),
  declOf("async function timedGet"),
  declOf("async function measureDocument"),
  declOf("function validate"),
].join("\n\n");

/** Compile the extracted declarations with `fetch` and `median` injected. */
function measureInternals(fetchStub = async () => { throw new Error("no fetch expected"); }) {
  const build = new Function("fetch", "median", `${HARNESS_SOURCE}
    return { SUBJECT_RE, FETCH_TIMEOUT_MS, MAX_BODY_BYTES, GETS_PER_DOC,
             subjectFrom, readCapped, timedGet, measureDocument, validate };`);
  return build(fetchStub, median);
}

/** A Response-shaped object whose body is an async iterable of Buffers, like undici's. */
const fakeResponse = (text, { status = 200, contentType = "application/json", chunk = 4096 } = {}) => ({
  status,
  headers: { get: () => contentType },
  body: (async function* () {
    const buf = Buffer.from(String(text), "utf8");
    for (let i = 0; i < buf.length; i += chunk) yield buf.subarray(i, i + chunk);
  })(),
});

test("hostile registry entries never become a URL or a file name", () => {
  const { subjectFrom } = measureInternals();

  // Path traversal, scheme smuggling, host re-pointing, homoglyphs, oversize, junk.
  const refused = [
    "../../etc/passwd", "..", "../", "./..", "a/../../b", "a..b", ".",
    "..%2f..%2fetc%2fpasswd", "%2e%2e%2f", "..\\..\\windows\\system32",
    "javascript:alert(1)", "file:///etc/passwd", "data:text/html,<script>",
    "http://evil.example", "//evil.example", "evil.example/x", "@evil.example",
    "cloudflare.com@evil.example", "cloudflare.com:8080", "cloudflare.com?x=1",
    "cloudflare.com#frag", "cloudflare.com/../../etc/passwd",
    "cloudflare.com\n../x", "cloudflare.com\n", "cloudflare.com\r\nHost: evil",
    "cloudflare.com\u0000.evil", "cloud flare.com", "\u0000", "\uFEFFcloudflare.com",
    "\u0441loudflare.com",            // Cyrillic 'с' homoglyph
    "cloudflare\u3002com",            // ideographic full stop, a real IDN dot
    "xn--e1afmkfd.\u0440\u0444",      // punycode label + Cyrillic TLD
    "", " ", "-x.com", ".x.com", "x".repeat(254), "a".repeat(1_000_000),
    `${"a.".repeat(100_000)}com`, "aux.com/..",
  ];
  for (const domain of refused) {
    assert.throws(() => subjectFrom({ domain }), /unusable domain/,
      `domain ${JSON.stringify(domain.slice?.(0, 40) ?? domain)} must be refused`);
  }

  // Wrong shapes: nulls, missing members, objects, non-string scalars.
  for (const entry of [null, undefined, {}, { domain: null }, { domain: undefined },
    { domain: {} }, { domain: { toString: () => "../x" } }, { domain: [] },
    { domain: ["a", "b"] }, { domain: [] }, { domain: Symbol.iterator }, { domain: -1 },
    "cloudflare.com", ["cloudflare.com"], 42]) {
    assert.throws(() => subjectFrom(entry), /unusable domain/,
      `registry entry ${JSON.stringify(entry) ?? String(entry)} must be refused`);
  }

  // What IS accepted, pinned so a widening of the guard is visible.
  assert.equal(subjectFrom({ domain: "cloudflare.com" }), "cloudflare.com");
  assert.equal(subjectFrom({ domain: "CLOUDFLARE.COM" }), "cloudflare.com", "case is folded, by design");
  // FINDING 2 (low severity, no traversal): the guard runs on String(entry.domain), so
  // several non-string shapes are COERCED into an accepted host name instead of being
  // refused for having the wrong type. Every one of them still yields a host-shaped,
  // traversal-free name, so nothing escapes the file name or the URL — but a registry
  // entry of the wrong TYPE is silently normalised rather than rejected.
  assert.equal(subjectFrom({ domain: ["cloudflare.com"] }), "cloudflare.com");
  assert.equal(subjectFrom({ domain: 12345 }), "12345");
  assert.equal(subjectFrom({ domain: true }), "true");
  assert.equal(subjectFrom({ domain: NaN }), "nan");
  assert.equal(subjectFrom({ domain: Infinity }), "infinity");

  // The URL is built from the validated name, never from a registry-supplied path.
  assert.match(MEASURE_SRC, /\$\{GATEWAY\}\/\$\{subject\}\/\.well-known\/sustainability-data/);
  assert.equal(/\$\{[^}]*\.path[^}]*\}/.test(MEASURE_SRC), false,
    "no registry `path` member may ever be interpolated into a fetch URL");
});

test("an oversized body is refused mid-stream, and every fetch is handed a live abort signal", async () => {
  const { readCapped, MAX_BODY_BYTES, FETCH_TIMEOUT_MS } = measureInternals();

  // The cap is enforced while streaming, so an over-large reply never reaches disk.
  await assert.rejects(() => readCapped(fakeResponse("x".repeat(MAX_BODY_BYTES + 1))),
    /exceeded 1048576 bytes/, "a body one byte over the default cap must be refused");
  assert.equal((await readCapped(fakeResponse("y".repeat(MAX_BODY_BYTES)))).length, MAX_BODY_BYTES,
    "exactly at the cap is allowed — the bound is strict `>`");
  for (const [text, cap] of [["0123456789A", 10], ["\u00e9\u00e9\u00e9\u00e9\u00e9\u00e9", 10]]) {
    await assert.rejects(() => readCapped(fakeResponse(text, { chunk: 1 }), cap), /exceeded/,
      "the cap counts BYTES, not characters, and trips on the chunk that crosses it");
  }
  // Missing / hostile body shapes are quarantined as an empty string, not a crash.
  assert.equal(await readCapped({ body: null }), "");
  assert.equal(await readCapped({}), "");
  await assert.rejects(() => readCapped({ body: 42 }), TypeError, "a non-iterable body is a loud failure");

  // Timeouts: the FIRING of AbortSignal.timeout cannot be observed offline without a
  // real 15 s wall-clock wait (ADR-007 forbids that, and measure.js exposes no
  // injectable clock or fetch), so it is NOT simulated. What is provable offline is
  // that a live cancellation signal is attached to the request.
  const seen = [];
  const { timedGet } = measureInternals(async (url, init) => { seen.push({ url, init }); return fakeResponse('{"a":1}'); });
  const r = await timedGet("https://gateway.invalid/x");
  assert.equal(seen.length, 1);
  assert.ok(seen[0].init.signal instanceof AbortSignal, "every request must carry an AbortSignal");
  assert.equal(seen[0].init.signal.aborted, false, "the signal must still be live when the request is made");
  assert.equal(r.status, 200);
  assert.equal(r.bytes, 7);
  assert.ok(Number.isFinite(r.ms) && r.ms >= 0);
  assert.equal(FETCH_TIMEOUT_MS, 15_000, "the request deadline is a pinned constant");

  // Source-shape pin: no fetch in measure.js may be issued without a timeout signal.
  const calls = [...MEASURE_SRC.matchAll(/(?<![\w.])fetch\(/g)];
  assert.ok(calls.length >= 2, "measure.js still issues the registry and document GETs");
  for (const c of calls) {
    assert.match(MEASURE_SRC.slice(c.index, c.index + 200), /AbortSignal\.timeout\(FETCH_TIMEOUT_MS\)/,
      "a fetch without a timeout signal would be an unbounded hang");
  }
});

test("malformed, truncated and hostile gateway JSON never becomes a parsed document", async () => {
  const one = (body, opts) => measureInternals(async () => fakeResponse(body, opts)).measureDocument("s", "https://gateway.invalid/s");

  const broken = [
    "", " ", "\n", "{ broken", "{", "[", "}", "{}}", '{"a":1,}', "{'a':1}", "{a:1}",
    '{"a":1', '{"a":}', '{"a" 1}', "undefined", "NaN", "Infinity", "-Infinity",
    "01", "+1", ".5", "0x10", "1e", '"unterminated', "<html>503</html>",
    "<?xml version=\"1.0\"?><rss/>", "\uFEFF{\"a\":1}", "\u0000{}", "null\nnull",
    "{}{}", '{"a":1}trailing', "]", "\\", "%", "{\"a\":\"\\uZZZZ\"}",
  ];
  for (const body of broken) {
    const m = await one(body);
    assert.equal(m.parsed, null, `${JSON.stringify(body)} must not parse`);
    assert.equal(typeof m.parseError === "string" || !m.lastGoodBody, true,
      `${JSON.stringify(body)} must be quarantined`);
  }
  // Pinned nuance: an EMPTY 200 body is quarantined by the `if (lastGoodBody)` guard
  // before JSON.parse is ever reached, so it is refused with no reason attached.
  const empty = await one("");
  assert.equal(empty.parsed, null);
  assert.equal(empty.parseError, null, "an empty body is refused silently, not with a parse error");

  // Truncation: EVERY proper prefix of a real committed document must fail to parse.
  const whole = JSON.stringify(fixture("cloudflare.com"));
  for (let n = 1; n < whole.length; n++) { // n = 0 is the empty-body case pinned above
    const m = await one(whole.slice(0, n));
    assert.equal(m.parsed, null, `a document truncated to ${n} bytes must not parse`);
    assert.equal(typeof m.parseError, "string", `truncation at ${n} bytes must report a reason`);
  }
  const good = await one(whole);
  assert.equal(good.parseError, null);
  assert.deepEqual(good.parsed, fixture("cloudflare.com"));

  // A non-200 body is never parsed, however well-formed — an error page cannot become
  // a document. Statuses are all reported, and the last GOOD body is what survives.
  for (const status of [204, 301, 400, 403, 404, 418, 429, 500, 502, 503]) {
    const m = await one('{"version":"1.0"}', { status });
    assert.equal(m.parsed, null, `HTTP ${status} must not yield a parsed document`);
    assert.equal(m.lastGoodBody, null);
    assert.deepEqual(m.statuses, [status]);
  }
  const seq = ['{"n":1}', "{ broken", '{"n":2}', "{ broken", "{ broken"];
  let i = 0;
  const mixed = await measureInternals(async () => fakeResponse(seq[i++], { status: i % 2 ? 200 : 500 }))
    .measureDocument("s", "https://gateway.invalid/s");
  assert.equal(mixed.gets.length, 5, "all five GETs are recorded even when they disagree");
  assert.deepEqual(mixed.statuses, [200, 500]);
  assert.equal(mixed.parsed, null, "the last 200 body was malformed, so nothing parsed");
  assert.equal(typeof mixed.parseError, "string");

  // FINDING 3 (inherent to JSON.parse, pinned so it is a known quantity): a document
  // with DUPLICATE keys is not an error — the last occurrence silently wins. A gateway
  // could therefore serve one document that reads differently to a line-oriented
  // reader than to this parser. Nothing downstream detects it.
  const dup = await one('{"carbon-intensity-gCO2e-per-kWh":10,"carbon-intensity-gCO2e-per-kWh":900}');
  assert.equal(dup.parsed["carbon-intensity-gCO2e-per-kWh"], 900);
  assert.equal(dup.parseError, null);

  // Prototype-pollution payloads parse into an OWN "__proto__" member and do not
  // pollute anything — this one the code gets right.
  const poll = await one('{"__proto__":{"version":"pwned"},"constructor":{"prototype":{"target":"x"}}}');
  assert.equal({}.version, undefined, "Object.prototype must be untouched");
  assert.equal(analyzeDoc(poll.parsed, { refDate: REF }).mandatoryComplete, false,
    "an inherited-looking member must not count as published");
});

test("schema conformance reports 'not measured' rather than a number it does not have", () => {
  const { validate } = measureInternals();

  // ADR-017: with no consumer library, valid is null — never false, never a 0% rate.
  const none = validate(null, { version: "1.0" });
  assert.equal(none.valid, null, "an absent validator must never be reported as invalid");
  assert.match(none.errors[0], /not run/);
  for (const consumer of [null, undefined, 0, "", false]) {
    assert.equal(validate(consumer, { version: "1.0" }).valid, null);
  }

  // A body that never parsed is invalid, and says why.
  const ok = { validateDocument: () => ({ valid: true, errors: [] }) };
  for (const parsed of [null, undefined, 0, "", NaN, false]) {
    const v = validate(ok, parsed);
    assert.equal(v.valid, false, "an unparseable body is not a conformant document");
    assert.deepEqual(v.errors, ["no parseable body"]);
  }

  // FINDING 4: `validate` neither wraps the consumer library in try/catch nor
  // normalises its answer. A validator that THROWS takes the whole measurement run
  // down (loud, so fail-closed in effect, but it aborts rather than marking the one
  // document unmeasured), and a validator that returns a truthy non-boolean has that
  // value copied verbatim into `schemaValid` in results/dataplane.json.
  assert.throws(() => validate({ validateDocument: () => { throw new Error("boom"); } }, { a: 1 }), /boom/);
  assert.throws(() => validate({}, { a: 1 }), TypeError, "a consumer without validateDocument throws");
  for (const rogue of [{ valid: "yes" }, { valid: 1 }, { valid: [] }, { valid: {} }]) {
    assert.equal(validate({ validateDocument: () => rogue }, { a: 1 }).valid, rogue.valid,
      "a non-boolean verdict is passed through unchanged");
    // The saving grace is pinned by the source-shape assertion below: measure.js
    // counts conformance with `=== true`, so a truthy-but-not-true verdict is NOT
    // counted as conformant.
  }
  assert.match(MEASURE_SRC, /d\.schemaValid === true/, "conformance must be counted by identity, not truthiness");
});

test("doc-check quarantines non-documents, and pins that it checks PRESENCE only", () => {
  // Nothing that is not a JSON object is analyzable.
  for (const doc of [null, undefined, [], [{}], "", "{}", 0, 1, NaN, Infinity, true, false,
    () => {}, Symbol.iterator]) {
    const a = analyzeDoc(doc, { refDate: REF });
    assert.equal(a.analyzable, false, `${String(doc)} must not be analyzable`);
    assert.equal(a.mandatoryPresentCount, undefined, "a refused document publishes no counts at all");
  }
  // Pinned: the guard is "object and not array", so an exotic non-plain object (a Date,
  // a Map, a RegExp) IS analyzable. Harmless — it publishes none of the 8 members —
  // but it is a shape JSON.parse cannot produce, so nothing real reaches this branch.
  for (const exotic of [new Date(0), new Map(), /re/]) {
    assert.equal(analyzeDoc(exotic, { refDate: REF }).mandatoryPresentCount, 0);
  }

  // Wrong shapes and hostile values inside an object are still refused per-member.
  const homoglyph = { "versi\u043En": "1.0", "updat\u0435d": "2026-01-01" }; // Cyrillic о / е
  assert.equal(analyzeDoc(homoglyph, { refDate: REF }).mandatoryPresentCount, 0,
    "a homoglyph member name is not the draft's member");
  assert.equal(analyzeDoc({ updated: 20260101 }, { refDate: REF }).updatedAgeDays, null);
  for (const updated of ["", " ", "not-a-date", "2026-13-45", "0000-00-00", "yesterday",
    "1e308", "\u0000", "x".repeat(100_000)]) {
    assert.equal(analyzeDoc({ updated }, { refDate: REF }).updatedAgeDays, null,
      `updated=${JSON.stringify(updated.slice(0, 20))} must not become an age`);
  }
  assert.equal(analyzeDoc({ updated: ["2026-01-01"] }, { refDate: REF }).updatedAgeDays, null,
    "a non-string updated is refused rather than coerced");
  // Pinned: Date parsing ignores a trailing NUL, so a smuggled terminator does not
  // invalidate the timestamp — it produces the same age as the clean string.
  assert.equal(analyzeDoc({ updated: "2026-08-21T00:00:00Z\u0000" }, { refDate: REF }).updatedAgeDays, 0);

  // FINDING 5 (headline): the mandatory-member check is `m in doc` — PRESENCE only.
  // A document whose eight mandatory members are all null, or all empty arrays, is
  // scored as 100% mandatory coverage, which is the number README/results report.
  const nulls = JSON.parse(`{${MANDATORY_MEMBERS.map((m) => `"${m}":null`).join(",")}}`);
  assert.equal(analyzeDoc(nulls, { refDate: REF }).mandatoryComplete, true);
  assert.equal(analyzeDoc(nulls, { refDate: REF }).mandatoryPresentCount, 8);

  // FINDING 6 (not reachable via JSON.parse, so defensive only): `in` walks the
  // prototype chain, so INHERITED members count as published. JSON.parse never
  // produces such an object, which is why this is a note and not a live hole.
  const inherited = Object.create(Object.fromEntries(MANDATORY_MEMBERS.map((m) => [m, "x"])));
  assert.equal(analyzeDoc(inherited, { refDate: REF }).mandatoryComplete, true);

  // FINDING 7: the in-band disclaimer is matched against JSON.stringify(doc), so ANY
  // occurrence anywhere — including in a KEY, or in an unrelated free-text member —
  // satisfies it. It is a presence signal, never an authenticity one.
  const phrase = "NOT published, reviewed, authorized, or endorsed by the reporting subject";
  assert.equal(analyzeDoc({ [phrase]: 1 }, { refDate: REF }).hasDisclaimer, true);
  assert.equal(analyzeDoc({ "unrelated-note": `see ${phrase}` }, { refDate: REF }).hasDisclaimer, true);
  assert.equal(DISCLAIMER_RE.test("not endorsed by anyone"), false);
});

test("freshness maths: absurd and impossible calendar strings", () => {
  // Refused outright: anything that is not one of the three calendar forms.
  for (const p of [null, undefined, 2025, [], {}, true, "", " ", "Q1 2026", "2026/12",
    "26-12", "2026-1", "2026-012", "202-12", "FY2026", "2026-12-",
    "\uFF12\uFF10\uFF12\uFF16",   // fullwidth digits: the shape regexes are ASCII-only, so refused
    " 2026", "2026 ", "2026\n", "2026\t"]) {
    assert.equal(reportingPeriodEndDate(p), null, `${JSON.stringify(p)} must not become a date`);
  }
  assert.equal(reportingPeriodEndDate("2025").toISOString(), "2025-12-31T00:00:00.000Z");

  // FINDING 8: the YYYY-MM branch validates the SHAPE but not the calendar. Out-of-range
  // months are silently rolled over by Date.UTC instead of refused, so a document can
  // claim a reporting period that ends in a different year than it names.
  assert.equal(reportingPeriodEndDate("2026-13").toISOString(), "2027-01-31T00:00:00.000Z");
  assert.equal(reportingPeriodEndDate("2026-00").toISOString(), "2025-12-31T00:00:00.000Z");
  assert.equal(reportingPeriodEndDate("2026-99").toISOString(), "2034-03-31T00:00:00.000Z");
  assert.equal(analyzeDoc({ "reporting-period": "2026-13" }, { refDate: REF }).reportingPeriodAgeDays, -163,
    "an impossible month becomes a NEGATIVE (future-dated) freshness age");

  // FINDING 9 (a NaN escapes): the YYYY-MM-DD branch returns whatever `new Date` makes
  // of the string. "2026-12-32" is an Invalid Date OBJECT — truthy — so analyzeDoc's
  // `periodEnd ? ... : null` takes the arithmetic branch and reports NaN, not null.
  // measure.js's summarize() then filters that pool with `x !== null`, which NaN
  // passes, so the reported median is NaN (serialised into JSON as `null`). The
  // published number is not wrong, but it arrives by accident, not by refusal.
  const invalidDay = reportingPeriodEndDate("2026-12-32");
  assert.notEqual(invalidDay, null, "an out-of-range day is NOT refused with null");
  assert.ok(Number.isNaN(invalidDay.getTime()), "it is an Invalid Date object instead");
  assert.ok(Number.isNaN(analyzeDoc({ "reporting-period": "2026-12-32" }, { refDate: REF }).reportingPeriodAgeDays),
    "and NaN reaches the reported field");
  // The causal link pinned at the SOURCE, not on a literal: summarize()'s filter
  // is null-based, so the NaN produced above sails through it into median().
  assert.match(MEASURE_SRC, /filter\(\(x\) => x !== null\)/, "summarize() must still filter by `!== null` for this finding to hold — if this fails, re-verify FINDING 9");
  // Out-of-range DAYS within a valid month roll over silently, like the months above.
  assert.equal(reportingPeriodEndDate("2026-02-31").toISOString(), "2026-03-03T00:00:00.000Z");

  // FINDING 10: absurd but syntactically valid instants are accepted verbatim, so a
  // hostile `updated` produces an absurd finite age rather than a refusal.
  assert.equal(analyzeDoc({ updated: "+275760-09-13T00:00:00.000Z" }, { refDate: REF }).updatedAgeDays, -99979314);
  assert.equal(analyzeDoc({ updated: "-271821-04-20T00:00:00.000Z" }, { refDate: REF }).updatedAgeDays, 100020686);
  assert.equal(reportingPeriodEndDate("9999").toISOString(), "9999-12-31T00:00:00.000Z");
  // One millisecond past the representable range IS refused, by Date rather than by us.
  assert.equal(analyzeDoc({ updated: "+275760-09-14T00:00:00.000Z" }, { refDate: REF }).updatedAgeDays, null);
});

test("an absurd published intensity is never acted on: the governor is the line that holds", () => {
  // doc-check reports PRESENCE of the member an agent acts on and never bounds its
  // value — including values JSON can produce that JavaScript cannot represent.
  const hostile = [
    ["negative", -250],
    ["overflow to Infinity", JSON.parse('{"v":1e400}').v],
    ["absurd finite", 1e308],
    ["string", "250"],
    ["numeric string with junk", "250; DROP TABLE"],
    ["null", null],
    ["array", [250]],
    ["object", { value: 250 }],
    ["boolean", true],
    ["empty string", ""],
  ];
  for (const [name, v] of hostile) {
    const a = analyzeDoc({ "carbon-intensity-gCO2e-per-kWh": v }, { refDate: REF });
    // FINDING 11: presence-only again — every one of these is reported as a document
    // that carries the actionable member. doc-check.js applies NO bounds at all.
    assert.equal(a.hasCarbonIntensity, true, `${name} is counted as "carries carbon intensity"`);
  }

  // ADR-005 is upheld at the boundary that matters: the governor refuses to turn any
  // of these into an allow. Nothing hostile becomes a permissive verdict.
  const gov = createCarbonGovernor({ budgetG: 1000 });
  const check = carbonValidator(gov).check;
  for (const [name, v] of hostile) {
    const d = gov.decide(v);
    assert.notEqual(d.action, "allow", `${name} must never be allowed`);
    assert.notEqual(d.action, "degrade", `${name} must never be softened to degrade`);
    if (Number.isFinite(v) && v >= 0) {
      assert.equal(d.action, "terminate", `${name} is finite but absurd: the top rung, not a soft one`);
    } else {
      assert.equal(d.action, "block", `${name} must fail closed to block`);
      assert.ok(Number.isNaN(d.ratio));
      assert.equal(d.reason, "invalid carbon estimate");
    }
    assert.equal(check({ payload: { estimatedGramsCO2e: v } }).action, d.action, "the adapter agrees with the core");
    if (!(Number.isFinite(v) && v >= 0)) {
      assert.throws(() => gov.commit(v), /finite, non-negative/, `${name} must never be absorbed as spend`);
    }
  }
  // A missing payload, a missing context, a traversal string: all block, none throw.
  for (const ctx of [undefined, null, {}, { payload: null }, { payload: {} },
    { payload: { estimatedGramsCO2e: "../../etc/passwd" } }]) {
    assert.equal(check(ctx).action, "block");
  }
  assert.equal(gov.spentG, 0, "no hostile value was ever committed to the budget");

  // FINDING 16 (silent, and the one hostile value the ladder cannot see): a published
  // intensity small enough to UNDERFLOW is not a refusal — JSON.parse turns 1e-400
  // into exact 0, indistinguishable from a genuine zero-carbon claim, so the governor
  // allows it. Fail-closed cannot help here; only a plausibility bound upstream could.
  const underflow = JSON.parse('{"v":1e-400}').v;
  assert.equal(underflow, 0);
  assert.equal(gov.decide(underflow).action, "allow");
  assert.equal(analyzeDoc({ "carbon-intensity-gCO2e-per-kWh": underflow }, { refDate: REF }).hasCarbonIntensity, true);
});

test("hostile access-log lines: unparseable counted, JSON-valid non-objects crash the analyser", () => {
  const line = (o) => JSON.stringify(o);
  const junk = ["", " ", "{ not json", "}", "[", '{"a":', "<html>", "\u0000", "NaN", "undefined", "'a'"];
  const r = analyzeLogLines([...junk, line({ timestamp: "2026-08-15T10:00:00Z", path: "/healthz", httpStatus: 200, totalDuration: 4 })]);
  assert.equal(r.parseErrors, junk.length, "every unparseable line is counted, never guessed at");
  assert.equal(r.totalRequests, 1, "and none of them becomes a request");

  // FINDING 12: a line that is VALID JSON but not an object (`null`, `123`, `"x"`,
  // `true`) is not caught by the parse guard — hashIps then does `"srcIp" in e` and
  // throws an uncaught TypeError, taking the whole logs.js run down. Loud, so it is
  // fail-closed in effect, but it is a crash where the code clearly intended a count.
  for (const bad of ["null", "123", '"x"', "true", "false", "-1", "1e400"]) {
    assert.throws(() => analyzeLogLines([bad]), TypeError,
      `a JSON-valid non-object line (${bad}) currently throws rather than counting`);
  }
  // Arrays and bare objects DO pass through and are counted as requests.
  const shapes = analyzeLogLines(["[]", "{}", '[{"srcIp":"1.1.1.1"}]']);
  assert.equal(shapes.totalRequests, 3, "shapeless entries are counted as real requests");
  assert.deepEqual(shapes.statusSplit, { "2xx": 0, "4xx": 0, "5xx": 0, other: 3 },
    "an absent or hostile status lands in `other`, never in 2xx");
  assert.equal(shapes.spanStart, null, "no timestamp means no span, not an invented one");

  // Hostile status codes never create a bucket and never inflate 2xx.
  const statuses = analyzeLogLines([-1, 0, 99, 199, 600, 1e9, NaN, "__proto__", "constructor",
    "200; rm -rf", null, [], {}, "2e2"].map((httpStatus) => line({ httpStatus, path: "/x" })));
  assert.deepEqual(Object.keys(statuses.statusSplit), ["2xx", "4xx", "5xx", "other"],
    "the bucket set is closed — no log line can add a key");
  assert.equal(statuses.statusSplit["2xx"], 1, "only the coercible 2e2 lands in 2xx");
  // A real pollution attempt through the same parse path: __proto__ as a KEY.
  const proto = JSON.parse('{"__proto__": {"polluted": 1}}');
  assert.equal({}.polluted, undefined, "JSON.parse must not pollute Object.prototype");
  assert.equal(Object.getPrototypeOf(proto), Object.prototype, "__proto__ from JSON is a plain own key, not a prototype set");

  // FINDING 13: durations are kept if `Number.isFinite(Number(x))` — a finiteness
  // filter, never a plausibility one. A negative duration and an astronomically large
  // one both survive into the reported median.
  const absurd = analyzeLogLines([-1e9, 1e308].map((totalDuration) => line({ totalDuration, path: "/x" })));
  assert.equal(absurd.totalDurationMsMedian, (-1e9 + 1e308) / 2, "a negative and an absurd duration are averaged, not refused");
  // Genuinely non-numeric durations ARE dropped...
  const clean = analyzeLogLines(["abc", "NaN", "", {}, []].map((totalDuration) => line({ totalDuration, path: "/x" })));
  assert.equal(clean.totalDurationMsMedian, 0, "but Number('') and Number([]) are 0, so two of those become zero-ms requests");
  assert.equal(analyzeLogLines(["abc", "NaN", {}].map((totalDuration) => line({ totalDuration, path: "/x" }))).totalDurationMsMedian, null,
    "with no coercible duration, no median is invented");
  // ...and so, silently, does a JSON `null`: Number(null) is 0, not NaN. JSON.stringify
  // also writes NaN and Infinity as `null`, so all three arrive as a 0 ms request.
  const nulls = analyzeLogLines([null, NaN, Infinity].map((totalDuration) => line({ totalDuration, path: "/x" })));
  assert.equal(nulls.totalDurationMsMedian, 0, "a null/NaN/Infinity duration becomes 0 ms rather than being dropped");

  // Absurd timestamps: unrepresentable ones are dropped; representable ones are kept.
  const times = analyzeLogLines([line({ timestamp: "not-a-date", path: "/x" }), line({ timestamp: 1e400, path: "/x" }),
    line({ timestamp: "+275760-09-13T00:00:00.000Z", path: "/x" })]);
  assert.equal(times.spanEnd, "+275760-09-13T00:00:00.000Z", "an absurd but valid instant is reported verbatim");
  // FINDING 17: "not-a-date" is correctly dropped (NaN), but an out-of-range NUMERIC
  // timestamp is serialised by the capture as JSON `null`, and `new Date(null)` is the
  // Unix epoch — so a hostile timestamp silently anchors the reported span at 1970
  // instead of being discarded.
  assert.equal(times.spanStart, "1970-01-01T00:00:00.000Z");
  assert.equal(analyzeLogLines([line({ timestamp: "not-a-date", path: "/x" })]).spanStart, null,
    "an unparseable timestamp string, by contrast, yields no span at all");
});

test("no client IP survives ingest however hostile the entry, but untrusted paths reach the report verbatim", () => {
  // hashIps: whatever shape srcIp arrives in, the raw member must not survive.
  const entries = [
    { srcIp: "1.1.1.1" }, { srcIp: "1.1.1.1", srcIpHash: "attacker-supplied" },
    { srcIp: "x".repeat(100_000) }, { srcIp: { toString: () => "1.1.1.1" } },
    { srcIp: ["1.1.1.1"] }, { srcIp: "\u0000" }, { srcIp: "../../etc/passwd" },
    { srcIp: true }, { srcIp: 1234 }, { srcIp: {} },
    { srcIp: "1.1.1.1", path: "/x", clientUa: "curl/8" },
  ];
  const hashed = hashIps(entries, SALT);
  for (const e of hashed) {
    assert.equal("srcIp" in e, false, "srcIp must never survive ingest");
    assert.match(String(e.srcIpHash), /^[0-9a-f]{16}$/, "and what replaces it is an irreversible digest");
  }
  const last = hashed.length - 1;
  assert.equal(hashed[0].srcIpHash, hashed[last].srcIpHash, "the same client hashes the same way");
  assert.equal(hashed[1].srcIpHash, hashed[0].srcIpHash, "an attacker-supplied srcIpHash is overwritten, not trusted");
  assert.notEqual(hashed[1].srcIpHash, "attacker-supplied");
  assert.equal(hashed[last].path, "/x", "other members are untouched");
  // Everything that STRINGIFIES to the same address hashes the same — the object with
  // a toString and the one-element array both collide with the plain "1.1.1.1" here.
  assert.equal(new Set(hashed.map((e) => e.srcIpHash)).size, 7);
  // Falsy srcIp values are passed through as-is; none of them is an address.
  const falsy = hashIps([{ srcIp: "" }, { srcIp: 0 }, { srcIp: null }, { srcIp: undefined }, { srcIp: NaN }], SALT);
  assert.deepEqual(falsy, [{ srcIpHash: "" }, { srcIpHash: 0 }, { srcIpHash: null }, { srcIpHash: undefined }, { srcIpHash: NaN }]);
  assert.ok(falsy.every((e) => !("srcIp" in e)));
  assert.equal(analyzeLogLines([JSON.stringify({ srcIp: "", path: "/x" })]).distinctClientIps, 0,
    "a falsy hash is not counted as a distinct client");

  // FINDING 14: subjectOf applies NONE of the host-name validation that measure.js's
  // subjectFrom applies, so a request path invented by any client becomes a "subject"
  // in subjectsRequestedList. It is never used as a file name, so this is a reporting
  // integrity issue rather than a traversal — but the two code paths disagree.
  assert.equal(subjectOf("/../../etc/passwd/.well-known/sustainability-data"), "../../etc/passwd");
  assert.equal(subjectOf("/<script>alert(1)</script>/.well-known/sustainability-data"), "<script>alert(1)</script>");
  assert.equal(subjectOf("/x".repeat(10_000) + "/.well-known/sustainability-data").length, 19_999);
  // And on a path that does not contain the suffix at all, indexOf(-1) silently
  // truncates the last character instead of refusing.
  assert.equal(subjectOf("/no-suffix-here"), "no-suffix-her");
  const spoofed = analyzeLogLines([JSON.stringify({ path: "/../../etc/passwd/.well-known/sustainability-data", httpStatus: 200 })]);
  assert.deepEqual(spoofed.subjectsRequestedList, ["../../etc/passwd"]);

  // FINDING 15: report.js interpolates those untrusted strings into markdown with no
  // escaping, so a crafted request path can inject headings, table rows or code-span
  // breaks into results/dataplane.md.
  const md = renderLogsMd(analyzeLogLines([JSON.stringify({
    timestamp: "2026-08-15T10:00:00Z", path: "/`x` | injected |\n\n## Forged heading\n", httpStatus: 200, totalDuration: 1,
  })]));
  assert.ok(md.includes("## Forged heading"), "a forged heading reaches the rendered report verbatim");
  assert.ok(md.includes("| injected |"), "so does a forged table cell");
});
