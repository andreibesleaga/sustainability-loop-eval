# Audit A (docs consistency) — key findings 2026-09-02

Ground truth: 87 unit / 13 fitness / 15,028 / 179 claims / 14 docs / 19 ADRs / 6 ports / 6 features / 25 scenarios; gov 104 lines, harness 45. Links 231/231 OK (1 anchor L1, 2 orphans L5).

HIGH:
H1 anti-herd claim still owned: ROADMAP:40+:377, EXECUTIVE-CASE:81-82 (loop.md:162 renderer too). Rewrite as killed hypothesis; surviving claim = "running the comparison is unprecedented".
H2 loop.md:162 "no drops" for defer arm is FALSE (defer drops 11.4–16.07% W1 / up to 21.07% W2, MORE than paced). Also ROADMAP:1258, CHANGELOG:161. Fix: "no rung-driven drops — drops are deadline-driven (11–21%)".
H3 "designed, not yet built (WP-12b)" in loop.md:162 renderer + OVERVIEW:77 + ROADMAP:1258 tail + CHANGELOG:169.
H4 ROADMAP §4 gaps 1/2/4/5/6 written as open; add CLOSED-by-WP-n lines (esp :1213 Gap4, :1193 "None has a contract", :1181, :1229, :1222).
H5 ROADMAP:1175-1178 "60 tests…137 across 12…17+ ADRs" → 87/179/14/19.
H6 ROADMAP:404-406 publication port "no contract or test" → tested (publication.feature + plane.test.js); only contract page missing.
H7 ROADMAP:41 "WP-17 remains open" → delivered.
H8 "Twelve" fitness: RESEARCH:271, RESEARCH-QUESTIONS:25 → thirteen.
H9 RESEARCH:314 "eighteen" ADRs → nineteen.
H10 forecast port "designed, not built" in RESEARCH:341, RQ:70, ARCHITECTURE:117-118+555+581, PRODUCT:65+175, ADR-003:12.
H11 ARCHITECTURE:110 "four ports" + :117 "Three of those four" → six.
H12 npm run all misdescribed: DEVELOPMENT:50+:164-171, RESEARCH:192 (4 of 8 steps).
H13 150-line rule: DEVELOPMENT:71, PRODUCT:55, ADR-001:27 list 4 exceptions; 12 source files exceed. Update the lists/wording honestly.
H14 FITNESS-FUNCTIONS:106-110 registry "five documents" → 14.
H15 FITNESS-FUNCTIONS:143 "does not have one [metering port]" + "four ports" → contradicts :119-121.
H16 OVERVIEW:5-7+:95-96 "every number checked" false: register or soften ("every headline number"); unregistered: 0.5–2.4, ~23 days, /12 denominators, 13.
H17 RESEARCH-QUESTIONS:239-245 "publish-back not exercised" → E5+WP-17 do.
H18 CHANGELOG never records current totals (179/14/15,028/87); latest entries say 165/13/15,011/33. Add accounting line (+ audit C: fix :25 14,981→15,028 and register CHANGELOG totals).
H19 ROADMAP §6 rows WP-1/2/3/14 still show estimates (:1298,:1299,:1301,:1312) → done.

MED: M1 LIMITATIONS ":12 R1 to R17"→R18 + ":63 R1–R17"→R18; M2 R1/R11/R12 rows need Done/Tested clauses (= audit C H4); M3 WP-8 row no status (subsumed by WP-17), §6:1306 budget; M4 :1265 "reports WP-1…WP-10"→through WP-17; M5 dangling "§9" pointers :63 + :1339 (section removed; re-add tag command or point at CHANGELOG); M6 section order map :58-64 vs disk 3→3c→3d→3e→3b→4; M7 :1434 "five files"→six; M8 checkpoint :8-9 stale (70/165/13; ~55 paths); M9 loop.md:155 "differing only in grams" — peak differs too (1.33vs1.22, 1.62vs1.31); M10 loop.md:162 "~41%" is α=0 only; M11 plane.md:44-45 W2 rows identical — qualify both headline readings as W1; M12 CHANGELOG:7 Unreleased date 2026-08-31 → span through 09-02; M13 RESEARCH results table missing plane.*; M14 RESEARCH docs index missing OVERVIEW/DYNAMICS/SPATIAL-ADVISORY/ports; M15 simulation/README file table 7 of 20 files, run.js role stale; M16 F13 missing from RESEARCH:214-216 + RQ:32-37 tables; M17 FITNESS-FUNCTIONS:75 "four added in v1.1.0" vs three (F13 later); M18 FF:178-181 "three adapter test files" → twelve; M19 RUNBOOK:158 "37+"→87, recipe missing plane; M20 DEVELOPMENT:87-89 "f13YourProperty" → f14; M21 CI determinism gate misses bounds/routing/loop/plane (add to ci.yml:32 + RUNBOOK); M22 README run table missing bounds/loop/routing/plane rows; M23 WP-15 invisible in honesty labels: RESEARCH:63+:347, RQ:210+:219, OVERVIEW:35 "Simulated: the agent workload" — qualify with real-trace arm; M24 EXECUTIVE-CASE:120 "live doc checks" — offline; M25 ADR-019:10-11 "6.6–14%" range → per-window up to 11.31/20.89 (loop.md states right); also ROADMAP:1258.

LOW: L1 DYNAMICS TOC anchor #3; L2 ROADMAP escaped backticks :1380/:1406/:1434; L3 README:61 44→45-line harness; L4 ROADMAP:10 "ten sentences" = 11 items; L5 orphans (checkpoint unlinked — fine, will be archived; shared/README unlinked at LIMITATIONS:80); L6 "top-5%" really top-4.17% (2 of 48) — footnote; L7 loop.md:160 "maximum of 2" vs printed 2.003–2.052 — qualify; L8 simulation.md "within about a point" vs 1.1/1.2 — "within ~1.2"; L9 loop.md:168 "Not modelled here: budget pacing" contradicts WP-12 tables (renderer fix); L10 ADR-019 untracked (owner git add); L11 3288.2 vs 3288.4 naive (seeded vs analytic — fine, maybe one-line note).

Structural fixes: extend CI byte-diff to loop/bounds/routing/plane; register OVERVIEW stragglers.
Verdict: evidence layer excellent; narrative-sync debt ≈ half session.
