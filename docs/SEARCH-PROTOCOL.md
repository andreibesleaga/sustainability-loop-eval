# Search protocol behind the article's novelty claims

> **At a glance.** The novelty claims survived an adversarial prior-art search
> designed to refute them; this page shows the sweeps, the phrasings and the dates
> so anyone can repeat the attempt.

The article claims that four *compositions* (not their parts) had no located precedent — the
Sustainability Signal Plane, the Carbon-Verdict Governor, Gated Grid Actuation, and the Cybernetic
Sustainability Loop that composes them. Four claims, four sweeps, four rows in the table below. A
claim of absence is only as good as the search behind it, so the search is written down here.
Sources, phrasings and dates are those of the actual audits (2026-08-20); the full audit notes with
every near-miss are in the author's records and are summarized below.

## Method
- Role: hostile auditor — the explicit goal of each sweep was to REFUTE the claim.
- Each candidate pattern was searched with >= 3 phrasings (name, mechanism description, synonyms).
- Sources per sweep: general web search; academic corpus via Semantic Scholar and arXiv listings
  (2010–2026); IEEE Xplore / ACM DL result pages through those aggregators; GitHub and npm
  repository search (exact phrases); standards bodies (IETF datatracker, Open Charge Alliance, IEC,
  OpenADR Alliance); Google Patents for the provenance patent.
- A hit counts as a collision if it contains the *composition*; hits containing a part only are
  recorded as lineage and cited in the article.

## Sweeps and outcomes (2026-08-20)
| Claim under test | Phrasings tried (examples) | Near-misses found (cited, not collisions) | Outcome |
|---|---|---|---|
| Sustainability Signal Plane (well-known URI + runtime metrics + peer consumption) | "sustainability signal plane", "carbon signal plane", "well-known sustainability data", "self-published carbon metrics consumed by peers" | carbon.txt (pointer file, no metrics, by its spec); GSF Real Time Cloud (provider→customer reporting); AWS/Azure carbon APIs (provider-proprietary); arXiv 2604.09705 (centralized, telemetry-driven orchestration; no self-published peer signal, no well-known URI) | no collision; GitHub exact-phrase 0 results; only well-known-URI hit is the author's own draft |
| Carbon-Verdict Governor (carbon budget → total-ordered verdict ladder behind one gate) | "carbon governor", "carbon verdict", "carbon budget governor", "verdict ladder carbon", "degrade escalate block terminate carbon" | Sprout (degrade-on-carbon, EMNLP 2024); Ecovisor (per-app carbon caps, ASPLOS 2023); arXiv 2607.07196 (admissibility ladder, non-carbon); GSF Carbon Aware SDK, Carbon-Aware KEDA (scheduling) | no collision; GitHub "carbon verdict" 0, "carbon governor" 0 |
| Gated Grid Actuation (live e-mobility protocol operations as MCP tools behind a human gate) | "OCPI MCP server", "OSCP MCP", "charging session MCP tool", "LLM agent EV charging human approval" | Ko1103/ocpi-mcp-server, Bilgetek/ocpi-spec-mcp, nader0913/ocpp-rag (documentation/spec servers); RecomBot, ReChat (recommendations/chat, no live gate); Grid-Agent, GridMind (LLM grid control, not e-mobility protocols) | narrow, fast-expiring: live-operation servers found only in the author's repos |
| Cybernetic Sustainability Loop (whole composition) | "cybernetic sustainability loop", "carbon feedback loop between services", "peer-to-peer carbon-aware control" | Wiener, Beer/Cybersyn (lineage); PowerMatcher 2005, OpenADR, transactive energy; IETF GREEN WG; Kraken+Sierra (customer ops, not control loop); DOE Stormbreaker testbed | no collision; composition-level only |

## What the protocol does NOT establish
Absence of evidence in these sources on that date. Four sweeps, one date, one auditor. A reader who finds a prior composition is asked
to open an issue in this repository; the article's claims are worded to survive that ("to the best
of adversarial search", "introduced in this line of work").
