# Data-Plane Live Measurement

Gateway: https://sustainability.up.railway.app — fetched 2026-08-22T09:31:34.013Z. Reference date for freshness math: 2026-08-21T00:00:00.000Z (fixed, not wall-clock).

| subject | kind | HTTP status(es) | median latency ms | median bytes | schema valid | mandatory | optional | disclaimer | updated age (days) |
|---|---|---|---|---|---|---|---|---|---|
| _gateway-root | gateway-self | 200 | 43.5 | 724 | true | 8/8 | 8 | false | 20 |
| akamai.com | real-org | 200 | 42.3 | 1733 | true | 8/8 | 12 | true | 23 |
| automattic.com | real-org | 200 | 42.1 | 1247 | true | 8/8 | 5 | true | 23 |
| cloudflare.com | real-org | 200 | 42.8 | 1326 | true | 8/8 | 8 | true | 23 |
| fastly.com | real-org | 200 | 43.5 | 1318 | true | 8/8 | 10 | true | 23 |
| hetzner.com | real-org | 200 | 41.6 | 1407 | true | 8/8 | 8 | true | 23 |
| microsoft.com | real-org | 200 | 49 | 1697 | true | 8/8 | 11 | true | 23 |
| mozilla.org | real-org | 200 | 47.9 | 1275 | true | 8/8 | 9 | true | 23 |
| ovhcloud.com | real-org | 200 | 46.2 | 1663 | true | 8/8 | 11 | true | 23 |
| retailer.example | synthetic | 200 | 44.4 | 1120 | true | 8/8 | 13 | false | 201 |
| saas-platform.example | synthetic | 200 | 47.4 | 1091 | true | 8/8 | 12 | false | 201 |
| wikimedia.org | real-org | 200 | 44 | 1217 | true | 8/8 | 9 | true | 23 |

## Reading (plain)

1. 11 subjects served, 9 mapped from real organizations' public disclosures, 2 deliberately synthetic (`*.example`), plus the gateway's own self-description document — 12 documents measured in total.
2. Every document returned HTTP 200 on every one of 5 sequential GETs (60 GETs in total); no transient failures observed during this run.
3. Schema conformance (real JTD validation via the reference consumer library + ajv): 12/12 parseable documents valid (100%).
4. Mandatory-member coverage is 100%: every document carries all 8 mandatory members.
5. Latency across every individual GET (60 samples): median 44.6 ms, p95 60.6 ms; median body size 1296.5 bytes.
6. In-band "not published/authorized/endorsed" disclaimer present on 9/9 real-organization documents.
7. Freshness: median age of the `updated` timestamp is 23 days relative to the fixed reference date; median reporting-period-end age is 233 days.
8. Optional members are where publishers differ: 3 of 12 documents carry `carbon-intensity-gCO2e-per-kWh` (the member an agent needs to act on) and 1 carries an SCI score.
9. Negative-findings register (live, served in index.json): 2 organizations looked up and honestly reported as publishing no machine-readable data (digitalocean.com, github.com).

## Caveats

- This gateway is the article author's own reference deployment (operator: Andrei Besleaga), not an independent third party's.
- Documents for real organizations are **illustrative mappings prepared by the gateway operator from those organizations' own public reports** — they are not published, reviewed, authorized, or endorsed by the named organizations. This is stated in-band in the gateway's `notice` field and (per-document) in most `provider` fields.
- Latency/timing numbers are live and will vary between runs; member presence, schema validity, and freshness (relative to the fixed reference date) are stable given unchanged server-side data.
- Consumer-library timing (available) measures discover+fetch+parse end-to-end from this machine, not the gateway's raw serve time.

## Part B — Railway HTTP access logs (real traffic)

Source: `railway logs --http --json` (read-only Railway CLI, project linked read-only), saved to `data/dataplane/railway-logs.jsonl`. Log kind: **HTTP access logs (edge/proxy level: railway logs --http --json), one JSON object per request**.

| span start | span end | total requests | well-known requests | distinct subjects requested | distinct client IPs | distinct user-agents | 2xx | 4xx | 5xx | healthcheck share |
|---|---|---|---|---|---|---|---|---|---|---|
| 2026-08-15T08:48:21.944Z | 2026-08-22T08:11:25.390Z | 120 | 58 | 35 | 26 | 13 | 79 | 41 | 0 | 1.7% |

Subjects requested (from `*/.well-known/sustainability-data` paths): _gateway-root, akamai.com, automattic.com, basic.example, carbontxt-demo.example, climatiq-demo.example, cloudflare.com, co2js-demo.example, data-source.example, device.example, digitalocean.com, extended.example, fastly.com, grid-intensity-demo.example, hetzner.com, kepler-demo.example, microsoft.com, minimal.example, mozilla.org, ms-sustainability-demo.example, organization-trend.example, organization.example, origin-annual.example, ovhcloud.com, partial.example, product.example, retailer.example, saas-platform.example, salesforce-nzc-demo.example, service.example, tenant.example, watershed-demo.example, wikimedia.org, yearly-monthly-target.example, yearly.example.

Top paths by request count: `/robots.txt` (23), `/` (16), `/favicon.ico` (7), `/.well-known/sustainability-data` (6), `/index.json` (5), `/cloudflare.com/.well-known/sustainability-data` (5), `/carbon.txt` (4), `/.well-known/carbon.txt` (4), `/yearly.example/.well-known/sustainability-data` (3), `/healthz` (2), `/carbontxt-demo.example/.well-known/sustainability-data` (2), `/ovhcloud.com/.well-known/sustainability-data` (2), `/hetzner.com/.well-known/sustainability-data` (2), `/akamai.com/.well-known/sustainability-data` (2), `/saas-platform.example/.well-known/sustainability-data` (2).

Caveat: This capture includes this evaluation run's own traffic (curl probes and dataplane/measure.js's GETs against the live gateway), visible as clientUa "curl/*" and "node". It is not filtered out because that would itself be a form of cherry-picking; it is real traffic the gateway actually served. `--since 7d`, `--since 30d`, and `--since 45d` all returned the same set of log lines at capture time, meaning this is effectively the full log retention window available on this plan (~1 week), not a slice we chose.
