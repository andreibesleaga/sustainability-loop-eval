# Data-plane measurement (E1)

Two scripts, run in order, measuring the LIVE sustainability data-plane
gateway (`https://sustainability.up.railway.app/`) for the IEEE Software
evaluation package. Nothing here is simulated or fabricated — every number
either comes from a live HTTP GET made at run time, or from raw Railway log
lines pulled with the read-only Railway CLI.

## Part A — live gateway measurement

```bash
npm run dataplane   # runs dataplane/measure.js, then dataplane/logs.js
```

Both, in that order, on purpose: `measure.js` rewrites `results/dataplane.json` and
`results/dataplane.md` from scratch, and `logs.js` then merges Part B back into them.
Running `measure.js` alone would leave the results without Part B; running `logs.js`
twice is harmless, because it replaces its own section rather than appending a copy.

What it does (see comments in `dataplane/measure.js` for the full list):
GETs `/index.json`, then GETs every subject document (plus the gateway's own
root document) 5 times sequentially each, checks each document against the
mandatory/optional member lists of `draft-besleaga-sustainability-wellknown-05`,
validates each document with the reference consumer library
(`sustainability-wellknown-consumer` — real JTD-schema validation via `ajv`, not
a hand-rolled check), times
discover+fetch+parse for 3 subjects through that same library, and reads the
live negative-findings register served at `index.json["no-machine-readable-data"]`.

Outputs:
- `data/dataplane/index.json` — raw `/index.json` body + `fetchedAt`.
- `data/dataplane/docs/<subject>.json` — one saved response body per subject
  (plus `_gateway-root.json` for the gateway's own document).
- `results/dataplane.json` — full machine-readable results (summary +
  per-subject rows + provenance).
- `results/dataplane.md` — one table, an 8-line plain reading, and caveats.

**Live vs cached**: everything under `data/dataplane/` and `results/` is a
snapshot from the run that produced it (`fetchedAt` timestamp in both files).
Re-running `npm run dataplane` makes fresh live requests and overwrites these
files. Latency numbers will differ between runs; member presence, schema
validity, and freshness (computed against the fixed reference date
2026-08-21, not wall-clock) are stable as long as the gateway's underlying
data hasn't changed.

### The consumer library is optional, and resolved at run time (ADR-017)

It is deliberately **not** a dependency of this package — "one dependency" is an
architectural claim fitness function F7 checks. `measure.js` resolves it in this order:

1. `SUSTAINABILITY_CONSUMER_URL`, if set — any URL a local build can be imported from;
2. the bare specifier `sustainability-wellknown-consumer`, if it happens to be installed:
   `npm i --no-save sustainability-wellknown-consumer@0.5.2`;
3. neither → schema conformance is reported as **not measured**, never as 0%, and no
   conformance claim is made.

Conformance is counted over the documents actually *analysed*: a body that never parsed
is not a failed schema check, it is a document with no schema claim to make. Both counts
are in `results/dataplane.json`.

## Part B — real Railway request logs

The Railway CLI (`railway`, already authenticated) is used **read-only**:

```bash
# one-time, read-only link (no deploy/write commands were used):
railway link -p sustainability-registry   # or -p <project-id>

# pull HTTP access logs (edge/proxy level) to a raw file:
railway logs --http --json --since 7d \
  -p <projectId> -s <serviceId> -e <environmentId> \
  > data/dataplane/railway-logs.jsonl

# analyze the raw file and merge results into results/dataplane.json/.md:
node dataplane/logs.js
```

`dataplane/logs.js` does not shell out to `railway` itself — it only reads
the already-pulled `data/dataplane/railway-logs.jsonl` (one JSON object per
HTTP request: method, path, httpStatus, totalDuration, clientUa, `srcIpHash`, ...)
and computes: time span covered, total requests, requests to
`*/.well-known/sustainability-data` paths, distinct subjects/clients/UAs
requested, 2xx/4xx/5xx split, and healthcheck share.

**Privacy.** The committed capture carries **no client IP addresses**. Each `srcIp` was
replaced once by `srcIpHash` — the first 16 hex characters of `sha256(salt + ip)` under a
random salt that was never written down — so the mapping is irreversible and only
"same client / different client" survives. That is what the reported 26 distinct clients
is a count of. Railway's `deploymentId`, `deploymentInstanceId` and `upstreamAddress` (an
internal IPv6 address) were dropped for the same reason. `clientUa` is **kept**: the
user-agent strings are not personal data here, and the crawler caveat in the write-up
depends on them. `logs.js` applies the same treatment to any future capture at ingest,
with a fresh salt per run; an entry that already carries `srcIpHash` passes through
untouched, so re-running is idempotent and the count is stable.

At capture time, `--since 7d`, `--since 30d`, and `--since 45d` all returned
the identical set of log lines — the plan's actual log retention is roughly
one week, so this is effectively the full available history, not a slice we
chose. The captured window necessarily includes this evaluation run's own
traffic (the `curl` probes used during investigation and `measure.js`'s own
GETs); it is left in, not filtered out, because filtering it would be a form
of cherry-picking real server traffic.

**What was actually run**: `railway list`, `railway status`, `railway link` (a
read-only association) and `railway logs`, and nothing else — no `deploy`, `up`, `down`,
`variables set`, `variables delete` or `unlink`. That is a statement about the commands
used, not a guarantee the CLI enforces.

## Files

| file | role |
|---|---|
| `measure.js` | Part A — the live GETs, the timings, and the summary written to `results/` |
| `doc-check.js` | pure document checking: the draft's mandatory/optional member lists, the disclaimer, freshness. No network, no clock |
| `logs.js` | Part B — parsing and counting the already-pulled Railway log lines |
| `report.js` | markdown rendering for both parts; recomputes nothing |
| `measure.test.js` | unit tests for the pure helpers, against a committed fixture document (no network) |

Member lists were verified on 2026-08-22 against both revision 05 (the revision the
article cites) and revision 06 of `draft-besleaga-sustainability-wellknown`, which define
the same 8 mandatory and 16 optional members, and cross-checked against the draft's own
`schemas-validators/response-schema.json`.

No extra npm dependencies: Node built-ins and `shared/stats.js` for the median/p95
definitions used everywhere else in this package. The reference consumer library is
optional and resolved at run time (see above); it is the one external library fitness
function F7 permits an adapter to import, and it is named there explicitly so a second
one cannot slip in unnoticed.
