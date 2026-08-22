# Inventory of the public artifacts the article cites (verified 2026-08-22)

These are the author's public artifacts that the article's status table lists as "Released" or
"Released prototypes". They are NOT evaluated by the scripts in this package; this file records
where each one lives and how its stated figure was checked, so that every cell of the article's
table has a traceable source.

| Artifact | Where | Figure stated in the article | How verified |
|---|---|---|---|
| IETF Internet-Draft | https://datatracker.ietf.org/doc/draft-besleaga-sustainability-wellknown/ | revision 05; IANA registration pending | datatracker page |
| `sustainability-wellknown-publisher` | https://www.npmjs.com/package/sustainability-wellknown-publisher | version 0.5.2 | `npm view sustainability-wellknown-publisher version` → 0.5.2 (2026-08-22) |
| `sustainability-wellknown-consumer` | https://www.npmjs.com/package/sustainability-wellknown-consumer | version 0.5.2; used by `dataplane/measure.js` for schema validation | `npm view sustainability-wellknown-consumer version` → 0.5.2 (2026-08-22) |
| Reference gateway | https://sustainability.up.railway.app/ | 12 documents (9 real organizations, 2 synthetic, its own) | measured live — `results/dataplane.json` |
| `kaiban-distributed` (governance gate under test) | https://github.com/andreibesleaga/kaiban-distributed · npm `kaiban-distributed` 2.0.0 | ladder + gate implemented and tested | imported by `governor/gate.js`; upstream unit suite re-run — `results/kaiban-upstream-tests.json` (71/71, commit 17ad362) and upstream end-to-end suite re-run against a real Redis broker in Docker — `results/kaiban-upstream-e2e.json` (69/69, 11 files, same commit) |
| `ocpi-sdk-mcp` (OCPI 2.2 live operations) | https://github.com/andreibesleaga/ocpi-sdk (packages/mcp-server) · npm `ocpi-sdk-mcp` 0.8.1-beta | 47 per-endpoint tools (incl. reserve_now, start_session, stop_session, charging profiles) | tool list read from the package's MCP server source, 2026-08-20; repository marked [Deprecated] (generator discontinued) — prototype status stated in the article |
| `ochp-mcp` (OCHP 1.4 / OCHP-Direct) | https://github.com/andreibesleaga/ochp-mcp | 22 tools (plus 5 resources) | registered tool names counted in `src/server.ts`, 2026-08-22 (an earlier read gave 13; the article's table no longer prints tool counts) |
| `ocm-mcp` (Open Charge Map) | https://github.com/andreibesleaga/ocm-sdk · npm `ocm-mcp` 0.11.0-beta | 6 tools (station discovery, reference data) | package tool list, 2026-08-20; live demo ocm-demo.up.railway.app |
| `oscp-mcp` (OSCP capacity signaling) | https://github.com/andreibesleaga | prototype | repository listing, 2026-08-20 |
| Patent WO2025172639A1 | https://patents.google.com/patent/WO2025172639A1/en | provenance only (priority 2024-02-15, published 2025-08-21, applicant Liikennevirta Oy) | Google Patents record |

The kaiban-distributed end-to-end run (2026-08-22) used the repository's own
`vitest.e2e.config.mts`, whose `globalSetup` starts and stops a Docker Redis container; that
config excludes the Kafka, live and chaos suites. A **full Docker stack (Kafka + Zookeeper,
board and agent services) was deliberately not run**: no claim in the article or in this
evaluation package depends on it — the gate under evaluation is exercised in-process here
(`fitness/`, `simulation/`) and against a real broker upstream. Running the full stack is
future work.

Counts for the MCP servers are as published on 2026-08-20 and may change; the article describes
them as prototypes and the evaluation does not depend on them (the charging scenario is a
simulation through the governor and gate, not a live MCP wire — stated in the article).
