# Audit C (paper alignment + scenarios) — key findings, 2026-09-02

Baseline PASSED: all v1.0.0 numeric leaves reproduce (one recorded exception: fleet.chargerKW removal); links all resolve; 179 claims green.

HIGH:
1. Withdrawn anti-herd claim ("capacity semantics is the lever") still asserted at: loop.js finding-4 renderer (=> results/loop.md:162), ROADMAP:40+:377-378, EXECUTIVE-CASE:81-82, OVERVIEW:75+:77 ("designed but not built"). Fix at renderer + 4 prose sites: "both conjectures tested and disproven; no anti-herd property claimed".
2. README:135-137 "gate's allocation role is load-bearing, not decorative" — disproven by WP-12/12b; end at "only by paying grams" + add tested-twice clause.
3. CHANGELOG fitness chain wrong: :25 "14,981" should be 15,028 (13,366+F7(24→40)+F12(33→179)+F13 1,500); :98/:104 need 165→179/13→14 step; register CHANGELOG totals in check-numbers (2 entries). Checkpoint :8 vs :56 inconsistent, ":28 Totals 14,983→15,028 (F7 35→37)" arithmetic wrong.
4. LIMITATIONS.md stale: R1 (WP-15 did the real trace), R11 (WP-12b built capacity term, made it worse), R12 (plane consumes documents; format half closed); heading ":12 R1 to R17"→R18; ":63 ARCHITECTURE §11 R1–R17"→R18. Use bold Done/Tested style like R13/R15/R18.
5. PRODUCT.md:65+:175 and RESEARCH-QUESTIONS.md:70 still say forecast port "designed, not built" — WP-3 built it; replace with delivered artifact + true residual (manual capture; E2 still reads cached trace).
6. actuation.feature "full charge" scenario is a tautology (sessions ≡ plan.length×vehicles). Fix: accumulate deliveredKWh + finishSlot in charging.js governed() and assert; or carry "by construction" into feature prose.
7. "Twelve" (spelled) fitness functions at PRODUCT:176, ARCHITECTURE:31/:76/:158/:178, RESEARCH-QUESTIONS:25, RESEARCH:271 → thirteen. F13 missing from breakdowns: RESEARCH:216, RESEARCH-QUESTIONS:37+:42-54; RQ:75 "Add F13 and beyond" stale.
8. Two unrecorded v1.0.0 divergences for RESEARCH.md Corrections: core "under 70 lines" → now 104/57; charging floor "13%" → now printed 12.8%.

MED:
- RESEARCH.md a session behind: "What we found" lacks WP-12/12b, WP-17 publish-load, WP-15, WP-14, WP-2, bounds/E5/E6; results table lacks plane.*; Versions stops at v1.1.0, F13 unexplained; ":314 eighteen ADRs"→nineteen.
- EXECUTIVE-CASE:114 "without synchronising into shadow peaks" — retracted by measurements.
- ROADMAP C-matrix has no status column: C6/C8/C17 delivered, C12 needs descope marker, C14 cites disproven mechanism; §6 rows WP-1/2/3/14 still show estimates; WP-12 row tail "Designed, not built" contradicts WP-12b row; :41 "WP-17 remains open"; :1175-1178 stale 60/137/12; §4 gaps 1/2/4/5/6 still open → add CLOSED lines.
- PRODUCT.md: FR-8 "24 static checks"→40; NFR-3 four files >150 lines → twelve (list, and ADR-001:27 lists four); FR-9 "four policies" stale; :28 two byte-reproducible scripts → seven; Implementation Map four ports → six, missing rows for features/, ports/, DYNAMICS, SPATIAL-ADVISORY, bounds/loop/routing/plane, chaos.test.js.
- Staleness honesty half-done: no code path makes verdicts stricter on stale signal, no honesty note; add ## Staleness clause to FORECAST.md + one line "age measured and reported, never acted on".
- FITNESS-FUNCTIONS:144-146 "does not have one" (metering port) vs METERING.md; LIMITATIONS:30 "four ports"; ROADMAP:404-407+:1196-1199 publication port "never contracted or tested" — tested, only PUBLICATION.md contract missing.
- human.feature:43 identity-by-construction framing.

LOW: E5 label used for both loop and WP-17 (ROADMAP:1270); C17 cites "ADR-018" meaning upstream kaiban ADR; LIMITATIONS "where stated" index omits newer files; forecast.feature doesn't walk forecast→gate seam (noted as Gap 5 elsewhere).

3 most valuable additions: (1) renderer sentence retiring anti-herd claim + propagate; (2) LIMITATIONS R1/R11/R12 Done/Tested clauses; (3) register CHANGELOG totals + fix 14,981/15,011→15,028, 165/13→179/14.
