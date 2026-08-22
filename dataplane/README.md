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
(`sustainability-wellknown-consumer`, imported by absolute path from a local
build of the sibling RFC repository — real JTD-schema validation via `ajv`, not
a hand-rolled check; override the path with `SUSTAINABILITY_CONSUMER_URL`, and
if it cannot be imported the run reports schema validation as **not measured**
rather than as failed, and makes no conformance claim), times
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
HTTP request: method, path, httpStatus, totalDuration, clientUa, srcIp, ...)
and computes: time span covered, total requests, requests to
`*/.well-known/sustainability-data` paths, distinct subjects/IPs/UAs
requested, 2xx/4xx/5xx split, and healthcheck share.

At capture time, `--since 7d`, `--since 30d`, and `--since 45d` all returned
the identical set of log lines — the plan's actual log retention is roughly
one week, so this is effectively the full available history, not a slice we
chose. The captured window necessarily includes this evaluation run's own
traffic (the `curl` probes used during investigation and `measure.js`'s own
GETs); it is left in, not filtered out, because filtering it would be a form
of cherry-picking real server traffic.

**Read-only guarantee**: only `railway list`, `railway status`,
`railway link` (read-only association), and `railway logs` were run. No
`deploy`/`up`/`down`/`variables set`/`variables delete`/`unlink` command was
ever issued against this or any other Railway project.

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

No extra npm dependencies: Node built-ins, `shared/stats.js` for the median/p95
definitions used everywhere else in this package, plus the already-built
`sustainability-wellknown-consumer` package from the sibling `rfc-sustainability-wellknown`
repo (imported by absolute path, read-only, optional).
