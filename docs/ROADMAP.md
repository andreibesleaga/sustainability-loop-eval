# Roadmap — what this evaluation proved, what it did not, and what to build next

> **Status:** addendum, written 2026-09-01 after the multi-lens audit. **The submitted
> article is not changed by anything in this file.** Where this document disagrees with
> the article, the article stands as the record of what was submitted and the
> disagreement is listed in the README's *Corrections* section. Everything here is
> either measured in `results/`, proved by a fitness function, or explicitly labelled as
> a proposal.

## 0. The whole thing in ten plain sentences

1. We built a safety gate for AI agents: before an agent acts, the gate says *yes / do
   it smaller / ask a person / no / stop*, and writes the reason where nobody can
   quietly edit it. That gate is real, shipped, and passed every one of 14,966 attack
   cases. It is the part that lasts.
2. We then asked the gate to keep an AI workload inside a daily carbon budget, on real
   British grid data. It worked — but most of the "carbon saved" came from doing less
   work, not from clever timing. We say that out loud now.
3. Moving work to cleaner hours *does* work when the work can actually move: shifting
   overnight EV charging avoided about a third of its emissions in winter.
4. But part of that win is just *not charging at the worst moment* — and in summer
   that is the **whole** win. "Avoid the peak" and "chase clean power" are different
   things, and we now measure them separately.
5. The ceiling calculus (new, `results/bounds.md`) says how much timing could *ever*
   save for this workload: roughly 13–18% at a 6-hour horizon, 23–30% at 12 hours,
   up to ~48–51% at 48 hours — if everything could move. Published research and our
   own results both sit far below their ceilings, mostly because most work can't move.
6. Money follows the same shape: shifted load lands in the cheap hours of time-of-use
   tariffs, so the same schedule that cuts grams cuts bills — that, not carbon prices,
   is where the real money is today.
7. The most original thing we found: everyone in the field *names* the stampede
   problem — every smart scheduler picking the same clean hour — and nobody has
   measured it across independent actors. We already partly measured it, Britain has
   already legislated against it for EV chargers, and our EV model itself lacks the
   legally required random delay (now limitation R18). The first measurement now
   exists: `npm run loop` shows the published plane spreads the herd only by paying
   grams, and fresh mutual observation oscillates — information alone is not enough,
   which is precisely the gate's job. Finishing that measurement (WP-12+WP-17) is our
   best shot at a genuinely new result.
8. The actual invention is bigger than scheduling: every system *publishes* its own
   sustainability data at a standard web address and *reads* everyone else's, so
   systems regulate each other — like `robots.txt`, but with numbers, for carbon. That
   between-systems loop is the article's named open problem, nobody anywhere has
   measured one, and this repository already holds all the parts (§3c, WP-17).
8b. The same loop — signal in, gate in the middle, audited action out — fits far more
   than AI jobs: EV fleets, heat pumps, smelters, water plants, data centres, websites
   throttling AI crawlers, supply chains. Section 2i maps it to the world's biggest
   emitters and says honestly where it applies and where it does not.
9. The paper stays frozen; a git tag pins the exact version it describes; everything
   new is additive and documented as a difference.
10. The plan below is ordered by value; the first three work packages are pure re-runs
   of committed data and each fits in half a session to a session and a half.

---

This file answers the questions the audit left open — what this is (§1), whether it is
worth it (§2, with the new maximum-optimisation calculus in §2f and the economics in
§2g), what a real "when and where" mechanism would be (§3), what the verified
literature says (§3b), what specs and tests are missing (§4) — and then gives the plan
(§5), session estimates (§6), the owner's answers and the decisions taken on them (§7),
what will never change (§8), and the exact commands to publish it all (§9). The
innovation inventory is §2h and the map onto the world's biggest emitters is §2i.

---

## 1. What this is, in plain language

Strip out the vocabulary and the system does one thing:

> **Before an automated agent does a piece of work, something else gets to say
> "yes / do it smaller / ask a person / no / stop", and the reason is written down
> where it cannot be quietly edited afterwards.**

That is the whole idea. The five answers are a **ladder** — `allow`, `degrade`,
`escalate`, `block`, `terminate` — and the two rules that make it a governance
mechanism rather than a switch are:

- **The worst answer wins.** If any check says `block`, the answer is `block`, no
  matter how many say `allow`. (Fitness functions F1 and F9 prove the shipped gate
  actually does this.)
- **The top rungs need a human.** Nothing above `degrade` happens without an approval
  object, and `terminate` cannot be overridden by anyone. (F4.)

The *carbon* part is one specific check plugged into that slot. It watches a budget:
if the work already done plus the work being proposed is past 80% of today's carbon
budget it says `degrade`, past 100% `escalate`, past 110% `block`, past 125%
`terminate`. Nothing more clever than that. The cleverness is deliberately *not* in
the governor.

**Is it needed?** Two honest halves:

- **The governance half: yes, and it is the durable contribution.** Agentic systems act
  without a person in the loop by design. Any constraint you want them to respect —
  carbon, spend, rate limits, data residency, safety — needs a place to be enforced
  that the agent cannot route around, plus a record a human can audit later. That place
  is architectural, not a feature. This package's real result is that such a place
  *exists in shipped code* and holds its properties under adversarial testing:
  13 fitness functions over 14,966 cases against the real `kaiban-distributed`
  `ActionGate`, not a mock. That result does not depend on carbon being the constraint.
- **The carbon half: needed, but currently over-claimed by the framing, not by the
  numbers.** See section 2 — the numbers in `results/` are honest; it is easy to *read*
  them as "governance saved 16–20% of emissions" when what they show is closer to
  "governance is the thing that made it legitimate to do 15% less work."

---

## 2. The honest answer to "is it worth it?"

You asked the sharpest question in the whole project: **if the saving comes only from
doing less work, what has actually been achieved?**

Here is what the committed results say, and I am not going to soften it.

### 2a. Deferral alone, in E2, saved almost nothing

| policy | what it does | winter | summer |
|---|---|---:|---:|
| **P1** | defer deferrable work below a median-intensity threshold (oracle threshold) | **−1.54%** | **−2.97%** |
| **P1t** | the same, causal — trailing 7-day median, no lookahead | **−0.92%** | **−2.26%** |
| **P2 (f=0.8)** | the full governor: defer *and* degrade *and* drop | **−16.45%** | **−20.27%** |

So pure "run it later, when the grid is cleaner" bought **about one to three percent**.
Everything else came from the other two rungs.

### 2b. And most of P2's saving is indeed doing less work

At f = 0.8, out of roughly 8,075 tasks per seed, the governor **degraded 1238.2 (winter)
and 1220.9 (summer)** to 40% energy and **dropped 78.5 and 376.3** outright. An arithmetic
attribution at mean grid intensity (an *approximation*, not a run — see WP-2) puts the
split at roughly:

| source of the saving | winter | summer |
|---|---:|---:|
| dropping work entirely | ~6% | ~23% |
| running work degraded | ~56% | ~45% |
| timing (deferral) + intensity weighting | ~38% | ~32% |

**Reading:** the majority of P2's headline number is the service getting smaller. The
package already says this — limitation R4, and the results file says "P2 is not a
like-for-like comparison on emissions alone: P2 does **less work**" — but it deserves
to be said in one sentence: *the article's biggest number is mostly a service-level
decision wearing a carbon coat.*

### 2c. But — and this is the important part — shifting is **not** the weak mechanism.
### The E2 workload was configured in a way that makes shifting look weak.

The same repository contains the counter-example, and the audit's new ungated arm makes
it unarguable. In **E3** (EV charging) pure start-time shifting, with **no** degrade and
**no** drop — every car receives its full charge in every arm, by construction —
avoided:

| E3, shifting only | winter | summer |
|---|---:|---:|
| ungated argmin scheduler (`argmin_ungated`) | **32.85%** | **16.53%** |
| the same, through the governance gate | 32.51% | 16.04% |

**Shifting alone: 32.85%.** Deferral is not a weak mechanism. What differs between the
two experiments is not the mechanism, it is the *room the mechanism was given*:

| | E2 (agentic workload) | E3 (EV charging) |
|---|---|---|
| how much work can move | **50%** (`deferrableFraction`) | **100%** |
| how far it can move | **6 hours** (`deferralHorizonHours`) | ~13 hours (18:00 → 07:00) |
| how it chooses | first slot **under a median threshold** | **argmin** — the cleanest window it can see |
| measured saving from shifting | −1.54% / −2.97% | −32.85% / −16.53% |
| mean realised shift | — | **6.29 h / 8.93 h** |

Three design choices, all of them stipulated rather than measured, each of which
suppresses the result:

1. **A 6-hour horizon is shorter than the grid's own cycle.** Great Britain's carbon
   intensity swings on a roughly diurnal period. A 6-hour window frequently cannot
   reach the clean part of the day at all. E3's realised mean shift was **6.29 hours in
   winter** — *larger than E2's entire horizon*. E2 was structurally unable to make the
   move that E3 proved was worth 32.85%.
2. **A median threshold is not an optimiser.** P1 moves work to the first *acceptable*
   slot, not the *best* one. E3 uses argmin. That is a different algorithm, and the gap
   between them is not small.
3. **Half the workload could not move at all** — though the literature says this is the
   *generous* assumption, not the conservative one. Meta's Carbon Explorer reports that
   offline data processing is **about 7.5% of their whole fleet** (of which 87.4% have
   SLOs over 4 hours), while their own modelling then assumes **40%** of workloads are
   delay-tolerant, citing a Google trace rather than their own measurement — a tension
   the paper does not reconcile. E2's `deferrableFraction: 0.5` is therefore *above*
   the only published fleet measurement I could verify. Sweeping it downward is as
   important as sweeping it up.

### 2c-bis. …but I have to argue against myself here, because the numbers do

The paragraph above is the optimistic reading, and the same results contradict part of
it. E3's baseline is not a neutral one: **the cars plug in at 18:00, into the evening
peak — the dirtiest part of the British day.** So some of that 32.85% is not "finding
clean power", it is "not charging at the worst possible moment". Splitting it against
the window's own mean intensity (arithmetic from `results/charging.json` and
`results/simulation.json`, not a separate run):

| E3, where the shifting saving actually comes from | winter | summer |
|---|---:|---:|
| naive baseline, gCO2e/kWh | 164.4 | 158.0 |
| the window's mean national actual intensity | 152.9 | 124.2 |
| what the shifted schedule achieved | 110.4 | 131.9 |
| **… of which: avoiding the evening peak** | **7.0 pp (21%)** | **21.4 pp (129%)** |
| **… of which: reaching cleaner-than-average slots** | **25.9 pp (79%)** | **−4.9 pp (−29%)** |
| total avoided | 32.85% | 16.53% |

Read the summer column again. **In summer, the whole saving — and more — is peak
avoidance. Seeking out clean slots actively *cost* 4.9 percentage points**, because the
overnight window (18:00 → 07:00) is 6.2% *dirtier* than the 24-hour average: Britain's
cleanest summer hours are the middle of the day, when the sun is up, and an overnight
charging deadline cannot reach them at all.

Three consequences, and they change the plan:

1. **"Shift work to when the grid is clean" and "shift work away from the peak" are
   different mechanisms with different sizes**, and this package has been reporting
   their sum. They should be separated and reported separately — that is now WP-2b.
2. **The horizon has to be able to reach the clean part of the day, not merely be
   long.** A 13-hour overnight window is long and still misses the summer optimum. This
   weakens the naive "just make the horizon longer" recommendation and strengthens the
   spatial one (WP-4): when time cannot reach clean power, place sometimes can.
3. **E2's baseline is the fairer one** (work runs on arrival, arrivals spread across the
   day), which means E2's −1.54% and E3's 32.85% were never comparable, and the
   optimistic reading in 2c overstated the gap. The honest statement is: *shifting is
   worth more than E2 measured and less than E3 advertises, and nobody in this
   repository has yet measured it on a fair baseline with a proper optimiser.*

**So the answer to "is it worth it" is: deferral is worth more than E2 measured and
less than E3's headline suggests, and settling it needs one experiment, not a new
model — run E2 again with a longer horizon, an argmin objective, and the peak-avoidance
and clean-seeking components reported apart.** That experiment does not exist yet. It
is WP-1 and WP-2b below, and it is the highest-value work left in this repository.

### 2d. What the gate contributes — measured, and it is not grams

The ungated arm settles a question the audit could previously only argue (limitation
R13):

> In E3 the governance gate **costs** 0.34 points (winter) and 0.49 points (summer) of
> carbon saving. It cannot add any. `allow`, `degrade` and `escalate` all produce the
> same physical shift, and `block`/`terminate` fall back to charging at plug-in.

That is not a defect; it is the honest shape of the contribution. **What the gate buys
is authority, auditability and a bounded, countable human cost** — 545.7 (winter) and 853 (summer)
human decisions over the E2 window, a number an operator can actually staff.
It does not buy grams. Any claim that governance *reduces emissions* should be read as
governance *legitimising and recording* a reduction that a scheduler produced.

### 2e. Verdict

| claim | status |
|---|---|
| A governance gate can hold ladder semantics, fail-closed, human binding and a tamper-evident record in shipped agentic runtime code | **Proved.** 13 fitness functions, 14,966 cases, real `ActionGate`. |
| Carbon can be one such constraint, end to end, from a published signal to an audited verdict | **Demonstrated**, on real grid traces and a live data plane. |
| Carbon-aware *deferral* is worth a large saving | **Under-measured, not disproved.** E3 says 32.85% with room to move; E2 says 1.54% with a 6-hour horizon. |
| The governor's headline 16–20% is a carbon saving from smarter timing | **No.** Mostly degrade and drop. Say so plainly. |
| Governance adds carbon saving | **No** — measured to *subtract* 0.34/0.49 points in E3. It adds authority and audit. |


### 2f. The calculus of maximum optimisation — computed, not argued

New this pass: `npm run bounds` (`simulation/bounds.js` → `results/bounds.json`,
`results/bounds.md`) computes the **ceilings** for every scenario as deterministic
expectations over the committed traces — no seeds, no network, byte-identical re-runs.
The seeded experiments must land under these numbers; any future arm that beats its
bound has a bug. The headline ceilings:

| best-possible saving for the E2 workload shape | winter | summer |
|---|---:|---:|
| 6 h horizon, half the work deferrable, causal (peer) signal | **6.58%** | **8.44%** |
| 12 h horizon, everything deferrable, causal signal | **22.76%** | **29.78%** |
| 48 h horizon, everything deferrable, oracle signal | **48.06%** | **51.22%** |

Four decisions fall straight out of the numbers:

- **The objective was the bottleneck, not the idea.** The measured P1 threshold policy
  got −1.54% (winter) where the same horizon's argmin ceiling is 6.58% — the optimiser
  is worth roughly **four times** the policy the article evaluated, before touching the
  horizon. That is M1, quantified.
- **A perfect signal is worth almost nothing here.** E3 with the oracle signal: 33.86%
  vs 32.85% on the peer forecast (winter) — about **one point**. The free public
  forecast is already good enough; there is nothing for an ML forecaster to win.
- **Interruptibility is worth almost nothing *in E3*** (34.13% vs 33.86% winter): an
  overnight window is long enough that the cleanest contiguous block nearly matches the
  cheapest scattered slots. (In E2-shaped workloads with short horizons the literature
  says otherwise — the bound settles it per scenario instead of by slogan.)
- **The spatial ceiling dwarfs the temporal one — with a loud caveat.** The per-slot
  cheapest peer region averages **54.72% below** the peer-signal mean in winter, and in
  summer North Scotland is the argmin in **100% of slots** (its forecast rounds to
  ~0 gCO2e/kWh). Forecast-scored only: Great Britain publishes no regional actual
  (limitation R2), so this is a ceiling on *advice*, not on delivered grams — and it is
  exactly the experiment the sustainability data plane exists to make possible.

### 2g. Is it profitable? The honest economics

Verified anchors (fetched 2026-09-01; sources in `~/work/susloop-literature-verification-*.md`
and `results/bounds.json` for the quantities): UK ETS allowance **£58.27/tCO2**
(settlement 19 Aug 2026), EU ETS **€83.45/tCO2** (1 Sep 2026); voluntary offsets
averaged **$4–6/t** asking in 2024; Octopus Agile is half-hourly day-ahead pricing with
a 100p/kWh cap and documented sub-2p and negative "plunge" troughs; AWS charges up to
~59% more for the same instance in its dearest region than in its cheapest.

Now the arithmetic, on this package's own measured quantities — labelled illustrative,
because every price is a parameter:

1. **Carbon priced as carbon is pennies.** E3's winter fleet avoids ~1,080 g/session ×
   50 sessions ≈ **54 kg CO2 per night**; at the UK ETS price that is ≈ **£3.15 a
   night** for 50 cars — and at voluntary-offset prices, cents. Nobody funds this loop
   from carbon prices at fleet scale. Said plainly so nothing downstream is built on it.
2. **The same schedule sold as *price* arbitrage is the real money.** The bounds run
   shows the argmin moves **333.3 kWh per night (winter) / 258 (summer)** out of the
   16:00–19:00 evening block — into exactly the hours where a half-hourly tariff is
   cheapest (the same fossil peaker that makes 4–7pm dirty makes it expensive; the
   carbon signal and the price signal largely agree in GB). At a spread of S p/kWh
   between evening and overnight, that is `333.3 × S / 100` pounds per night per
   50-car site — pick S from the tariff of the day; the tariff's own page documents
   troughs below 2p against a 100p cap. This is precisely the trade Octopus already
   runs at **1 GW across 150,000 EVs**, which is the existence proof that the money is
   real and the aggregation is the business.
3. **The governor is a spend-and-token budget enforcer with zero code changes.** The
   ladder never asks *what* the budget counts. Point `estimatedGramsCO2e` at pounds,
   tokens or GPU-hours and F1–F13 hold verbatim — worst-verdict-wins, fail-closed,
   human-bound, audit-chained, and F13's metering guarantee (the lie is bounded to one
   action *iff* commit() is charged the metered actual). The degrade rung alone removed
   ~60% of the energy of **1,238.2 winter tasks** (per-seed mean) in E2; the same rung on a token budget
   is an immediate, measurable API-bill reduction — Sprout (EMNLP 2024) is the
   published precedent that dirty-hour output-shortening works at >40% carbon effect.
4. **Cross-region price spreads make the spatial adapter pay twice.** The same
   where-to-run advice that chases clean regions can chase cheap ones — AWS's ~59%
   same-instance spread is the price-side analogue of North Scotland's carbon argmin.
5. **The durable business value is the audit, not the arbitrage.** SCI is now
   ISO/IEC 21031:2024; EU CSRD-era reporting wants exactly what the audit chain
   produces: per-action, tamper-evident, replayable records tying consumption to
   decisions. That is sold as compliance infrastructure, and it is the part with no
   commodity price attached.

**Verdict:** profitable as (2) + (3) today, as (5) structurally, with (1) honestly
disclosed as negligible. Time is priced too: every deferral minute is in the results
(mean delay, p95, deadline invariant), so the cost side of the trade is never hidden.

### 2h. The innovation inventory — what here is genuinely unoccupied

Checked against the verified literature pass (§3b), not against enthusiasm:

1. **Cross-actor herding, measured** — the field names the thundering herd
   (CarbonScaler: out of scope; CarbonFlex: within one cluster) and nobody measures
   independent actors on a shared public signal. R11 is a first partial measurement;
   WP-12 is the full one.
2. **The gate as the anti-herd** — the genuinely new framing this repository owns: a
   *paced budget is a staggering mechanism*. Britain's SI 2021/1467 mandates blind
   randomised delay; a carbon-budget gate staggers *by depletion* — later actors meet a
   spent budget and are pushed off the common argmin — while writing down why. WP-12
   tests whether governance beats mandated randomness at dissolving the herd. No
   published work makes that comparison.
3. **F13's metering theorem** — "with a trusted meter an under-declaring agent lags
   every rung by at most one action; without one a zero-declarer is never caught" — a
   property statement about self-declared estimates we found nowhere in the literature.
4. **The data plane as a spatial discovery mechanism** — peers *publishing* their own
   intensity is what turns "where" into a schedulable dimension; every published
   spatial result assumes a private multi-region operator instead.
5. **Bounds-as-refutation-device** — committing the analytic ceiling beside every
   seeded experiment (2f) so that any later result above its bound is automatically a
   bug. Cheap, portable methodology; we have not seen it done in this literature.
6. **Tiered governance with a measured human-cost curve** — WP-14: rungs priced in
   human decisions per day (545.7 → 442.9 winter under one rule, before further rules),
   not asserted qualitatively.
7. **A NESO data source for the GSF Carbon Aware SDK** (WP-13) — the standard tool
   cannot see Britain's free signal today; small, public, verifiable contribution.
8. **Forecast error measured from public pairs** (§3b) — NESO publishes no accuracy
   figure; the committed traces already yield MAPE 6.55%/8.25% with the horizon caveat
   stated, and WP-3's prospective capture turns that into the first public fw48h error
   series for GB.
9. **The multi-actor closed loop itself** — the article's own composition, marked "open
   problem" in its status table: mutually foreign systems publishing at a well-known
   URI and regulating *each other* through what they read there. Every closed loop in
   the verified literature is single-operator; every multi-actor signal (TOU pricing,
   Bailey et al.) is one-way. E5/WP-17 is the first measurement of the loop the paper
   names, including its stability (damp vs amplify) as a function of publication
   cadence and staleness (§3c).
10. **The publication port** — the sixth port, the invention's defining edge
   (act → publish → peers sense), currently the only one with no contract or test in
   this package. Specifying it (with attestation hooks, closing toward R15) makes
   "every reporter is a sensor" an interface instead of a slogan.
11. **Carbon back-pressure for the agentic web** — governors reading each other's
   well-known documents as mutual ECN marks (§3c uses 1–3). No precedent surfaced in
   the adversarial search or in our own pass; it is the `robots.txt`-shaped move for
   AI-to-AI and AI-to-web load, with the audit chain as its accountability layer.

### 2i. Where this applies at planetary scale — the emitters map

Verified frame (Global Carbon Budget 2024; OWID/Climate Watch sector split, data year
2016; IEA Energy & AI 2024): global fossil CO2 is **37.4 Gt** (China 32%, US 13%,
India 8%, EU27 7%); **73.2%** of GHG comes from energy use; data centres consumed
**415 TWh (~1.5% of electricity) in 2024, heading for ~945 TWh by 2030**.

The loop applies wherever three things coexist: an **electric load with slack**, a
**published signal**, and an **actor that must be governed rather than trusted**. The
honest map, biggest levers first — each row is a port-and-adapter instantiation of the
same hexagon (signal / forecast / human / actuation / metering around the unchanged
governor core):

| emissions domain | share of global GHG | the slack | adapter (exists → possible) | verified precedent |
|---|---|---|---|---|
| Road transport → EVs | 11.9% (road, 2016) | charge start time within plug-in→deadline | **E3, built** → depot & fleet adapters | Octopus: 1 GW shiftable across 150k EVs; SI 2021/1467 already regulates the actuation |
| Buildings heat | 17.5% | pre-heat hours ahead, coast through peaks | heat-pump adapter (thermal mass = the battery) | Homely in GB DFS: 440 W / 58% mean turn-down per home via pre-heating; 780 MWh over the first five DFS events |
| Data centres / AI | 415 TWh electricity, doubling by 2030 | batch/training deferral, degraded serving, spatial placement | **E2, built** → cluster queue adapter; token-budget governor (§2g.3) | Google VCCs in production; Meta/CarbonScaler/Sprout literature |
| Energy-using industry | 24.2% | smelter/electrolysis modulation, cold storage, grinding schedules | industrial DR adapter | Trimet aluminium "virtual battery", 1.12 GWh, in a $39M pilot |
| Water & wastewater | (within utilities' share) | pumping and aeration follow no clock | pumping-schedule adapter | Santa Rosa WWTP: up to 4.8% cost saving from load shifting (UC Davis CWEE) |
| Desalination | (growing) | RO trains as controllable load | desal adapter — **simulation-only today** | modelling literature only (IEEE PES GM '23; Desalination '19); no operating programme verified |
| Iron & steel, cement process CO2 | 7.2% + 3% | none for this loop — process chemistry, not schedulable electricity | — | honestly out of scope |
| Agriculture & land use | 18.4% | none for this loop (niche irrigation pumping aside) | — | honestly out of scope |
| Aviation & shipping | 1.9% + 1.7% | none for this loop | — | honestly out of scope |

And the brainstormed adapters that do not exist anywhere yet but are simulatable on
this architecture with the data already in hand (regional forecasts + the committed
trace patterns), each stated with its port wiring:

- **Routed-EV-to-datacenter adapter** (the owner's idea, and it composes two built
  cases): route willing EVs to chargers co-located with data centres in
  currently-clean regions — the datacenter's spatial signal doubles as the charging
  signal, the site soaks power that is clean *there now*, and one gate governs both
  loads against one budget. Simulatable today as E3 × the spatial bound; physically it
  is V1G siting advice, and reg. 11's randomised delay applies at the actuation edge.
- **Curtailment-soak adapter**: a signal port fed by curtailment/plunge events (Agile's
  negative prices are the public proxy) telling deferred work to run *now, here* —
  the inverse of a budget: a floor, not a cap. New rung semantics candidate:
  `expedite`, the only addition the ladder has ever tempted us into (kept out of the
  core; it is a validator's verdict on the same five rungs — allow with priority).
- **DFS-event port**: NESO's Demand Flexibility Service events as an escalation
  source — a grid emergency arrives as a signed document on the data plane and the
  gate's human port decides which loads answer it. The audit chain is then the
  settlement evidence the DFS already requires.
- **Fleet depot governor**: one governor, many vehicles, tiered per WP-14 — critical
  vehicles (ambulance, on-call) never leave `allow`; the rest ride the ladder. The
  herding arm (WP-12) is this adapter's safety case.
- **Smelter/cold-store adapter**: actuation port = power-modulation setpoint with the
  Trimet-style physical envelope as the harness's hard constraint (the E3 pattern:
  refusal degrades the *optimisation*, never the metal or the food).

One paragraph of honesty about the countries row: China (32%), the US (13%) and India
(8%) are where the grams are, and this package has verified a *public, keyless,
half-hourly* signal for exactly one grid — Great Britain. The loop's portability claim
is architectural (swap the signal adapter), not empirical, until a second grid's
adapter exists; that is WP-16's first deliverable, and no number in this file pretends
otherwise.

---

## 3. What a real "when and where" mechanism would be

You asked whether a different algorithm or ML should actually defer work to when and
where consumption is cleaner. My answer, before any literature is cited:

> **Yes to the mechanism. Mostly no to the ML.** The three things that would move this
> from 1.5% to something serious are a longer horizon, a proper objective, and a second
> dimension (place). None of them requires a learned model, because *the forecast is
> already published by the grid operator*. Building an ML forecaster here would be
> re-deriving a public input, and would add an unfalsifiable component to a package
> whose entire value is that every claim is checkable.

Four mechanisms, in descending order of value-per-effort:

### M1 — Optimise, don't threshold (no new data, no ML)
Replace P1's "first slot under the median" with E3's argmin over the visible window.
Same inputs, same data, strictly better objective. Cost: a few dozen lines. This is
the cheapest experiment in the whole plan and, on the E2-vs-E3 evidence above, likely
the largest single gain.

### M2 — Give the horizon room, and use the *published* forecast (no ML)
The National Grid ESO / NESO Carbon Intensity API publishes a forward forecast — this
package already consumes the API, but only ever uses it backwards. A **forecast port**
turns "how clean is it now" into "when in the next N hours is it cleanest", which is
the input an optimiser actually needs. Sweep the horizon (6 / 12 / 24 / 48 h) and
report saving as a function of it. That curve is the answer to "how much is deferral
worth", and no paper can give it for *this* workload.

### M3 — Add place, not just time (the data plane's natural strength)
This is the mechanism the architecture is *already shaped for* and has never used. The
package publishes and consumes a sustainability data plane across peer organisations;
today the peer signal is only ever averaged into a single scalar. But peers sit in
different regions with genuinely different intensity — the audit already noted one peer
in near-zero-carbon North Scotland dragging the mean down. **Choosing which peer's
region to run in is spatial shifting, and it is the one experiment only this package
can run**, because the peer documents are the mechanism by which a region becomes
selectable at all. It is also the strongest argument for why a *data plane* — rather
than one API call to one grid — needs to exist.

### M4 — Score against the marginal signal, not the average (a caveat with teeth)
Limitation R17: emissions here are attributional — energy × the grid's *average*
intensity. Shifting into a low-average hour may be served by the same marginal plant,
so real-world abatement can be smaller than the number. Re-scoring against a marginal
series where one exists would either confirm the result or shrink it, and either
outcome is publishable.

### Where ML *would* legitimately earn its place
Three narrow slots, all of them **out of scope until M1–M3 are done**, and all of them
requiring data this package does not have:

- **Learning the workload's own deferability** — which tasks a deadline actually
  permits to move — rather than stipulating `deferrableFraction: 0.5`.
- **Learning the estimate** (`estimatedGramsCO2e`) from observed execution instead of
  trusting the agent's self-declaration. Note that **F13 now proves this is the
  load-bearing trust assumption**: with a trusted meter an under-declaring agent lags
  every rung by at most one action; without one, an agent declaring zero is *never*
  caught, however far past `terminate` its real emissions run. A learned estimator is
  one implementation of that meter.
- **Correcting the published forecast** against realised intensity — a residual model
  on top of NESO's forecast, not a replacement for it.

Everything else that looks like an ML opportunity here is an optimisation problem with
a published input, and should be solved as one.


---

## 3c. The invention itself — and this roadmap had been under-selling it

Everything above optimises *one* system against *one* grid feed. That is not what the
article claims to have invented. Its abstract says it in one line: *"Carbon-aware
computing today is one-way: systems consume grid carbon-intensity feeds, but publish
nothing machine-readable about their own footprint, so no system can react to
another."* The invention is the **closing of that loop between systems**: every
participant publishes its own runtime sustainability data at
`/.well-known/sustainability-data` (the IETF Internet-Draft), every participant reads
its peers', a governed gate turns what it reads into action, and the action changes
what it publishes next. Four named patterns compose it — the **Sustainability Signal
Plane**, the **Carbon-Verdict Governor**, **Gated Grid Actuation**, and the
**Cybernetic Sustainability Loop** they plug into — and the article's honest status
table marks the composition's last row *"Multi-party closed loop — Open problem — no
third-party publisher yet."*

Said in systems terms: this is **regulation through a shared, published medium** — each
system is simultaneously a *reporter* and a *sensor* (the architecture's own glossary
line), and coordination happens the way stigmergic systems coordinate: not by command,
but by every actor reading the traces every other actor leaves in a common substrate.
`robots.txt` did this for crawl pressure; the data plane does it for carbon. No central
coordinator, no bilateral integration, no shared operator — which is exactly what none
of the verified literature has: Google's VCCs, Meta's Carbon Explorer, CarbonScaler,
CarbonFlex all close their loop *inside one operator*. The article's search found no
precedent for the assembled composition, and our own literature pass (§3b) found no
measurement of any *multi-actor* loop, open or closed.

ARCHITECTURE §8 already states, with unusual honesty, where the evaluation stands:
*"The outer loop — act → publish → peers sense → act — is open in every experiment: the
signal is an exogenous cached trace (R12)."* The inner budget loop is genuinely closed
(commit() feeds back measured grams); the **outer, inter-system loop — the invention —
has never been exercised end to end**. R2 (peers are regional-forecast stand-ins), R5
(the gateway is the author's own) and R12 (the seam) are all facets of that one fact.

### What closing it actually enables — the uses the sections above left out

Each is the same hexagon with the same governor; only the adapters change. Ordered by
how close this repository already is to demonstrating them:

1. **Agentic AI systems regulating each other.** Two (or N) agentic runtimes — e.g.
   separate `kaiban-distributed` boards owned by different teams — each publish their
   Basic document (energy, emissions, intensity, period) and each run the governor with
   the *others'* documents as the peer signal. When one system's intensity spikes, its
   peers see it in the next document and their gates tighten; the herd damps itself
   without any coordinator. This is mutual back-pressure for the agentic web — the
   AI-to-AI analogue of TCP congestion control, with the well-known document as the
   ECN mark — and it is buildable today from parts in this repository (E2's governor +
   the gateway's publisher + the consumer library E1 already uses).
2. **Datacenter ↔ tenant self-regulation.** A datacenter publishes its live intensity
   and headroom at the well-known path; tenants' schedulers read it as their signal
   port and defer or degrade; the datacenter's next document reflects the relief. The
   IEA numbers in §2i (415 → ~945 TWh by 2030) are the scale argument; the mechanism
   needs no bilateral API contract — only the convention.
3. **Websites and services governing agentic crawl and inference load.** A site
   publishes its sustainability document; well-behaved agents (crawlers, scrapers, RAG
   pipelines, browsing agents) read it and let their own governors throttle, defer, or
   degrade their visits when the target reports stress or dirty power — `robots.txt`
   asked *whether* to crawl; this says *what it costs*, machine-readably, and the
   agent's gate answers *whether it is worth it now*. A natural first adapter for
   ordinary web apps, not just infrastructure.
4. **Supply-chain (Scope 3) cascades.** A service's governor reads the published
   documents of the services *it* calls, so upstream carbon becomes a live control
   input rather than an annual PDF; each hop's gate decision propagates back-pressure
   one hop further. The RTC "carbon data supply chain" need the article cites, made
   executable.
5. **Device fleets as publishers.** Chargers, batteries, heat pumps (§2i's rows)
   publishing at the same path they are actuated through — so the fleet's *measured*
   response, not its modelled one, is what peers and regulators read. This is also the
   honest metering story: the publish-back edge is where attestation (R15) will live.
6. **Prosumer neighbourhoods and the grids that read them.** Households with rooftop
   solar and batteries are not just loads — they are *generators* with a document worth
   publishing: current generation, export headroom, battery state, willingness window.
   An aggregator (or the home's own agent) publishes; the grid side runs the same
   governor over the fleet's documents and *asks* — a gated, audited, human-escalatable
   request to export or soak, in place of blunt curtailment. The household's gate keeps
   authority local: `block` means "not my battery, not tonight," and it is recorded.
   The same ladder that paced a carbon budget paces a feeder's headroom; the same
   fairness measurement (R16) says which homes get asked first, which is exactly the
   question regulators will ask of any agentic grid. This is where "agentic AI for the
   grid" stops being a slogan: agents negotiate *within published, audited envelopes*,
   and every physical actuation keeps the E3 invariant — refusal withholds the
   optimisation, never the power.

### Who could publish this document *today* — verified, not imagined

The publication side is not hypothetical; the telemetry and the adoption pattern both
exist (all fetched 2026-09-01; sources in the literature files):

- **Servers, Kubernetes, AI jobs:** Kepler (CNCF sandbox) exports per-container/pod
  energy from RAPL to Prometheus; Scaphandre does it host-and-VM; Linux `powercap`
  exposes RAPL joules *and enforces limits* through one sysfs interface; NVIDIA DCGM
  gives per-GPU-job watts and joules with configurable power caps. Prometheus → Basic
  document is one adapter.
- **Devices:** Matter 1.3 gives any smart-home device real-time power and cumulative
  energy reporting, and its EVSE device type already optimises toward lowest-carbon
  windows; OpenADR 3 is plain REST/JSON and **already carries marginal-GHG signals**;
  IEEE 2030.5-2023 and EEBUS/SPINE cover DERs. Device fleets can speak energy now.
- **Networks:** the IETF's own **GREEN working group** is chartered to model
  energy/power of network devices in YANG (four adopted drafts), downstream of the
  e-impact programme (RFC 9547) — routers are becoming energy-legible too.
- **Clouds:** AWS, Azure and GCP all expose per-tenant, scope-split carbon data with
  APIs/exports — but **monthly, weeks delayed** (AWS publishes days 15–21 of the next
  month; Azure by day 19; GCP on day 15) and behind tenant auth, not at any public
  URI. The gap between "the data exists" and "a program at another organisation can
  read it" is precisely the draft's territory.
- **The adoption model is realistic, not viral:** `security.txt` reached 1.25% of the
  top million domains by 2025 (elite-skewed, growing); `llms.txt` ships with audits
  and is published by the major AI labs themselves; Cloudflare's one-click
  machine-readable crawl policies run on a million-plus sites. Slow, standards-shaped
  adoption is how well-known files win — and the closest comparable to this draft,
  the Technology Carbon Standard's `tcs.json`, is **explicitly annual estimates**,
  while W3C's Web Sustainability Guidelines recommend publishing files but define no
  metrics endpoint. Within everything checked: **no other standard defines a URI
  where systems self-publish runtime sustainability metrics.** The
  transport/discovery role is genuinely unoccupied.

### What this changes in the architecture and the plan

- **The port inventory gains its sixth and defining port: publication.** Signal,
  forecast, human, actuation, metering — and *publish*: the loop's output edge, the one
  that makes every participant legible to the others. It is the only port the invention
  cannot exist without, and the only one with no contract, no adapter interface in this
  package (the publisher lives in the separate npm packages), and no test. Gap 2 in §4
  now includes it.
- **WP-17 — E5, the closed-loop arm — becomes the invention's experiment** (and the
  natural completion of WP-8's seam test and WP-12's herding arm): N governed systems,
  each consuming the others' *published documents* (not a shared exogenous trace),
  each publishing after each commit. Measured: does mutual observation **damp** the
  herd (each sees the crowd forming in the next documents and backs off — negative
  feedback) or **amplify** it (all react to the same publication at once — the Bailey
  et al. shadow-peak, one publication cycle later)? Swept over the publication cadence
  and staleness (E1 measured median document age at 23 days; the loop needs minutes —
  that gap is itself a result), with and without the gate's pacing. Stability of a
  stigmergic carbon loop, measured — nothing in the verified record has done it.
- **The demo grows the publish-back edge**: after the agent's gated decision, the demo
  emits the *updated* document (energy spent, next intensity) alongside the verdict —
  so the README's ten-second story becomes the full loop: read peer → gate → act →
  **publish** → and the next reader sees it.


---

## 3d. The composition matrix — how ports, adapters and signals combine, and how each
## combination is testable in this framework today

The hexagon's whole point is that ports compose. One governor core; six ports (signal,
forecast, human, actuation, metering, publication); every row below is just a
different set of adapters plugged into the same six holes — and every row names how it
is (or becomes) **runnable in this repository**, because a combination that cannot be
tested here is a slide, not a plan.

| # | composition (what is combined) | signals in | what it maximises | how it is tested HERE | ceiling / evidence |
|---|---|---|---|---|---|
| C1 | **Time-only deferral** (built: E2) | national trace (→ NESO fw48h via WP-3) | carbon | `npm run simulate`; WP-1 sweeps horizon × fraction × objective | §2f: 6.58→22.76% causal ceilings |
| C2 | **Start-time shifting of physical load** (built: E3) | peer forecast, scored on actual | carbon, never service | `npm run charging`; bounds arms | 32.85%; perfect signal worth ~1 pp |
| C3 | **Carbon + price dual signal** (WP-16) | carbon trace + committed GB half-hourly price trace | £ AND carbon; exposes the hours where they fight | new arm beside every existing one, same seeds; report agreement/conflict slots | §2g: 333.3 kWh/night off-peak is the quantity; Agile documents the spread |
| C4 | **Tiered governance over any of these** (WP-14) | any + rung rules | human attention (the scarcest resource) | re-run E2/E3 with the auto-defer rule; report decisions/day per tier | 545.7→442.9 and 853→637 already measured |
| C5 | **Spatial advisory from the data plane** (WP-4) | per-peer regional forecasts | carbon (advice), £ (cross-region price) | bounds spatial section (done); one-page advisory spec | 54.72% below peer mean, forecast-scored |
| C6 | **EV routing between intervals — WHERE to charge, hour by hour** (owner's case) | per-region forecasts + plug-in windows | carbon + grid relief; directs demand to where energy needs a home | E3 extended: each session picks (region, window) argmin instead of window-only argmin, over the three committed regional series — a pure calculus arm first (bounds-style), a seeded arm second | spatial × temporal product of C2 and C5; precedent verification in flight (lit-E) |
| C7 | **Token/spend budget on agentic work** (§2g.3) | token meter instead of grams | £ and tokens directly | same governor, `estimatedGramsCO2e`→tokens; demo agent + WP-15's real trace replay | F1–F13 hold verbatim; Sprout is the degrade precedent |
| C8 | **Mutual regulation between agentic systems** (WP-17 core) | each other's published documents | herd stability, fairness, carbon | E5: N governors, publish-after-commit, consume peers' documents; damp-vs-amplify vs cadence | §3c; the article's open problem |
| C9 | **Datacenter publishes, tenants defer** (§3c.2) | one publisher's live doc as N tenants' signal | carbon + the datacenter's peak | E5 variant with one hub publisher (the gateway pattern E1 already measures) | IEA scale numbers; R12 closes |
| C10 | **Website governs agentic crawl/inference load** (§3c.3) | target site's published doc | the target's energy + the agent's tokens | demo extension: the agent reads a gateway doc and its governor throttles its own calls — the demo already reads real documents; add the throttle rung path | `npm run demo` + one new validator; no new data needed |
| C11 | **Human-attention router** (WP-14 × C8) | peers' documents + rung rules | escalations land on the right human across systems | E5 + tier rules: count cross-system escalations per day | extends C4's measured curve |
| C12 | **Curtailment-soak / expedite** (§2i brainstorm) | negative-price or curtailment events (public proxy: Agile plunge) | absorbing surplus clean energy — the inverse budget | WP-16's price trace gives the events; an `expedite`-as-validator arm on E2 | needs WP-16 first; no core change (stays five rungs) |
| C13 | **Prosumer households — rooftop solar and home batteries publishing and giving back** | home/aggregator published docs (generation, export headroom, battery state) + grid need | matching household surplus to grid need hour by hour; export revenue for the household | E5 variant: N small publishers with *generation* (negative intensity contribution) + one consumer grid-side governor; calculus arm first over synthetic-but-shaped export profiles against the committed regional series | precedent verification in flight (lit-E prosumer addendum); the E3 safety pattern carries over — a refused verdict withholds the *export optimisation*, never household power |
| C14 | **Grid-side agentic orchestration over published prosumer fleets** | thousands of C13 documents as the signal plane | grid balancing with auditable authority — every curtail/dispatch request a gated, recorded decision | E5 at larger N with one grid-side governor; herding + fairness metrics from WP-12 reused (which homes get asked first is R16's fairness question, now with money attached) | composes C8 + C13; the audit chain is the regulator-facing part |
| C15 | **Green inference routing — LLM/agent calls routed to the cleanest region** | per-region forecasts (later: datacenters' own published docs, C9) | carbon per token; datacenter peak relief | E6's machinery with the movement cost → ~0 (bits, not cars) plus a latency/SLO budget as the constraint: the moveKWh0 row IS this arm's ceiling; a seeded arm adds request arrivals and an SLO gate refusing routes that break latency | the one case where the spatial ceiling (54.72% below peer mean, forecast-scored) is nearly reachable, because requests travel free; Sukprasert's "spatial dominates" applies at full strength |
| C16 | **Green agentic networks — kaiban-distributed boards placed and loaded by region** | regions' (or each board's published) intensity | carbon of multi-agent work; mutual load balance | design + E5: one board per region, each publishing its document (C8); the A2A router prefers the board whose document is cleanest, the gate audits each cross-board handoff; ties to the kaiban roadmap §5 rung-controls | composes C8 + C15 on the runtime this package already tests upstream (71-test governance suite); needs no new science, needs the publication port |
| C17 | **Geo-migrating agentic runtimes — the system itself re-homes to green grids** | regions'/sites' published documents, all conditions in one signal | the runtime's own footprint; follows green power through the week | E6b (in `simulation/routing.js`): daily re-homing argmin with a switch cost and hysteresis, forecast-scored; the full version is C16 plus checkpointed migration (kaiban's CheckpointStore/ADR-018 is the mechanism a real migration would ride) | the strongest form of "dynamic agentic AI distributed geo-physically on green grids"; each migration is a gated, audited, reversible action with a cost the gate can refuse |

Reading the matrix honestly:

- **Rows C1–C5 and C7 are cheap** because they re-run committed data through existing
  machinery; every one has a bound or a measured number already attached.
- **C6 is the owner's routing case made concrete**: it composes two *built* things —
  E3's window argmin and the per-region series the spatial bound already reads — into a
  (region, window) argmin. The calculus version costs an afternoon inside
  `simulation/bounds.js`; the honest caveats are C5's (forecast-scored; advisory unless
  something physically routes) plus one more: routing a car burns energy to move, so
  the arm must charge a movement cost per region-switch or it will overclaim. The
  randomised-delay/R18 constraint applies at whatever charger the car lands on.
- **C15–C16 are the agentic-AI payoff of the whole matrix** — and the place the spatial
  ceiling stops being advisory-only in spirit: routing a *request* to a green region
  costs milliseconds, not kilowatt-hours of driving, so the C6 movement-cost objection
  collapses and the constraint becomes latency/SLO, which the gate already knows how to
  refuse on. C16 is this package's own runtime made green: kaiban boards per region,
  each a publisher and a reader, the A2A router steering work toward the cleanest
  board's document, every handoff gated and audited. The demo path exists end to end
  in parts: E6's argmin, E1's consumer, the upstream board/A2A suites.
- **C13–C14 extend the invention to generation**: the document format already carries
  the members a prosumer needs (energy, intensity, period — with export as negative
  net draw), the E3 safety inversion transfers whole (refusal never touches household
  power), and the open question is the same one E5 measures: stability and fairness
  when thousands publish and one side reads. Verified precedents are being fetched
  (lit-E addendum) before any number is claimed.
- **C8–C10 are the invention** (§3c): they need the publication port and E5, not new
  science. C10 is the smallest demonstration of the whole idea — the demo already
  fetches a real published document; letting the *agent's own governor* act on it turns
  the ten-second demo into the loop's first self-regulating consumer.
- **Where AI genuinely helps in these compositions** (and only here, per §3's rule):
  estimating a task's grams/tokens before the gate (the metering port's learned
  implementation, F13-bounded), learning per-task deferability for C1/C7 from WP-15's
  real trace, and residual-correcting the published forecast in C3. Everything else in
  the matrix is argmin over published numbers and needs no model.


---

## 3e. Fifteen scenarios that exist nowhere else — the invention, enumerated

Each scenario below composes the published-document loop (§3c) with ports and adapters
this repository defines. "Demonstrated" means runnable in this repo today;
"simulatable" means buildable on the committed data with existing machinery; "needs
partners" means the missing piece is adopters, not code. Novelty is claimed only where
our verified literature passes (§3b) and the article's own adversarial search found
nothing comparable — and it is claimed for the *composition*, not the ingredients.

1. **Mutual back-pressure between agentic AI systems** — N runtimes read each other's
   documents and their governors tighten as peers' intensity rises; congestion control
   for the agentic web, with the well-known document as the signal. *Demonstrated:
   `npm run loop` (E5) — and the three measured findings are sharper than the pitch:
   the plane spreads the crowd **only by paying grams** (every heeding cell pays more
   intensity than the blind herd — a signal alone cannot both spread and stay clean,
   which is the measured case for the gate's allocation role); fresh mutual
   observation **oscillates** (daily complete swaps — the cobweb — at N ≥ 5); and the
   spreading effect **shrinks as N grows**. Exactly Bailey et al.'s
   TOU-vs-managed-charging lesson, reproduced in a publication-medium model.*
2. **Datacenter publishes, tenants yield** — one hub document, N tenant governors;
   peak relief without bilateral contracts. *Simulatable: E5's one-publisher variant;
   the gateway E1 measures is the hub pattern live.*
3. **Websites governing AI crawl and inference load** — a site publishes cost and
   stress; visiting agents' own gates throttle, defer or degrade their calls.
   `robots.txt` said *whether*; this says *what it costs now*. *Demonstrated in parts:
   `npm run demo` already reads real published documents; C10 adds the throttle path.*
4. **Scope-3 back-pressure cascades** — a service's governor reads the documents of
   the services it calls; upstream carbon becomes a live input and gate decisions
   propagate one hop per document. *Simulatable: chain of E5 systems in a line instead
   of a mesh.*
5. **Routed EV charging — when AND where** — cars steered between charger regions on
   published regional intensity, with the drive priced in. *Demonstrated:
   `npm run routing` (E6), including the result that the drive can eat the benefit and
   the summer Goodhart warning. Verified this pass (lit-E): **no production system
   routes vehicles on grid carbon anywhere** — Google's eco-routing optimises the
   vehicle's own energy only, Tesla's Charge on Solar is home-temporal, Electroverse
   shows prices without steering — so E6 is, to the checked record, the first such
   simulation on real regional data. And the headroom is real money: GB paid
   **£1.7bn in thermal constraint costs in 2024/25** (NESO), with **4.6 TWh of wind
   curtailed in H1 2025, over 86% of it in Northern Scotland (£116m)** — the region
   E6's argmin keeps choosing is the one the grid pays to switch off.*
6. **Routed EVs as datacenter demand sponges** — the same cars steered to chargers
   co-located with datacenters in regions whose sites publish surplus/clean headroom;
   one gate governs both loads against one budget. *Simulatable: E6 × C9's hub
   documents.*
7. **Green inference routing** — LLM/agent calls routed to the cleanest region;
   movement is milliseconds, so the spatial ceiling is nearly reachable, and the SLO
   is the constraint the gate enforces. *Simulatable: E6 with moveKWh→0 + latency
   budget (its m0 row is already the ceiling).*
8. **Geo-migrating agentic runtimes** — the kaiban board itself re-homes to the
   greenest site when conditions hold long enough to pay the move; checkpointed
   migration as a gated, reversible, audited action. *Demonstrated: E6b in
   `npm run routing` — the re-homing calculus lands at **64.42% avoided vs a fixed
   London home with just 3 moves in 28 winter days** (the 0/5/20 kWh switch-cost
   sweep barely dents it: hysteresis is nearly free when moves are rare), and the
   summer table degenerates to ~100% into North Scotland's published zero — the
   Goodhart warning printed by the tool itself. The runtime mechanism a real
   migration would ride (CheckpointStore, ADR-018) already ships upstream.*
9. **Prosumer households publishing and giving back** — homes with solar and
   batteries publish generation, headroom and willingness; the export optimisation is
   gated, never the household's power. *Simulatable: E5 with generator-signed
   documents (C13). Precedents now verified (lit-E): GB's Smart Export Guarantee
   (Ofgem; suppliers must pay above zero for exports), Octopus Outgoing at 12p flat /
   Prime 16p-peak-9p, a 7,000-Powerwall / 37 MW Tesla VPP operating in South
   Australia, SunSpec Modbus as the inverter-telemetry standard a household agent
   could publish from, and **turn-UP is already paid in GB** — the DFS went
   bi-directional with zonal procurement across 12 zones (April 2026) and Agile's
   negative prices pay consumption. Every ingredient exists; the document convention
   is the missing wire.*
10. **Grid-side agentic orchestration with auditable authority** — thousands of
    prosumer documents on one side, a grid governor on the other; every dispatch or
    curtail request is a recorded, escalatable, refusable decision, and fairness
    (who gets asked first) is measurable the way R16 measures it. *Simulatable: E5 at
    large N with one asymmetric reader (C14).*
11. **Curtailment-soak / expedite** — the inverse budget: when a region publishes
    surplus (the plunge-price proxy), deferred work and charging are *invited* now,
    there; still five rungs, `expedite` is just a validator's allow-with-priority.
    *Simulatable after WP-16's price trace (C12).*
12. **The human-attention router** — tiered governance across systems: rules absorb
    the routine rungs, and the scarce resource — a person's attention — is routed to
    the escalations that genuinely need one, with the per-tier decisions/day curve
    measured. *Partly measured already (545.7 → 442.9, 853 → 637); WP-14 + E5 (C11).*
13. **Compliance-grade sustainability reporting as a by-product** — the audit chain
    already ties every action to its carbon decision; mapping chain segments onto
    CSRD-era, SCI-scored (ISO/IEC 21031:2024) reports turns regulation into an export
    format instead of a project. *Needs partners; zero new mechanism.*
14. **Sustainability-aware CI/CD and batch farms** — build/test/train pipelines defer
    and route on published signals under a repo-level carbon budget, with the gate as
    the merge-time authority; the everyday-developer face of C1+C15. *Simulatable:
    WP-15's real trace replayed through E2b.*
15. **Green mesh task markets** — agents choosing *counterparties* by published
    intensity: the same job offered to three provider organisations goes to the one
    whose document is cleanest this hour, gated and logged on both sides. Discovery
    through documents makes the market; the ladder makes it governable.
    *Simulatable: E5 mesh with per-system heterogeneous intensity (needs partner data
    for real levels).*

Two of these — **1 and 5** — moved from idea to measured result *today* (`npm run
loop`, `npm run routing`). The article's four patterns are the alphabet; this list is
the first fifteen words, and every one keeps the same spine: published signal in,
five-rung gated decision in the middle, audited reversible action out, publication of
the consequence back to the plane.

---

## 3b. What the literature actually says (verified 2026-09-01, not recalled)

Every claim below was checked against a page fetched on the date shown. Where I could
not confirm something, it says so. Nothing here is cited from memory, and nothing is
converted between metrics that the sources do not themselves convert.

### The single most relevant result: Great Britain is the *flat* case

Wiesner, Behnke, Scheinert, Gontarska & Thamsen, **"Let's Wait Awhile: How Temporal
Workload Shifting Can Reduce Carbon Emissions in the Cloud"**, Middleware '21
(arXiv:2110.13234; read in full at `ar5iv.labs.arxiv.org/html/2110.13234`). They shift
366 nightly 30-minute jobs across 2020, widening a window around a 1 am baseline:

| flexibility window (± around 1 am) | Great Britain | France | Germany | California |
|---|---:|---:|---:|---:|
| ±2 h | **4.3%** | 3.0% | — | — |
| ±6 h | — | — | — | 13.1% |
| ±8 h | **7.4%** | 4.1% | 11.2% | 33.7% |

And their explanation, verbatim, is the one that matters for this package:

> *"In France and Great Britain shifting potential is comparably low at night, because
> the mean carbon intensity at this time is already at its minimum. In contrast, in
> Germany and California, the potential grows significantly once the scheduler has the
> ability to shift workloads to the early morning or late evening hours, where they can
> benefit from solar energy generated during the day."*

**This independently explains section 2c-bis.** Britain's clean hours are already the
night; a scheduler whose window is the night has little left to find. It is why E3's
summer clean-seeking component came out *negative*, and it caps how much WP-1 can
possibly recover. A whole year of GB shifting at a ±8-hour window bought 7.4% — for
100% deferrable, non-interruptible work. E2 defers half its workload over 6 hours.
**Expect WP-1 to land in the low single digits for GB, not in the tens.** If it does
not, something is wrong with the experiment.

Two further findings from the same paper that bear directly on WP-1's design:
interruptibility is worth a lot (*"Experiments that make use of the interruptibility of
machine learning jobs are improving the achieved carbon savings by 24.2 to 36.6 % for
Germany, Great Britain, and France"* — a relative improvement over non-interrupting),
and the authors caution that *"Even when delays of a few hours are tolerable, the
expected potential for shifting is comparably small, as carbon intensity usually does
not change quickly in large electrical grids."*

### The limits are structural, and spatial beats temporal

Sukprasert, Souza, Bashir, Irwin & Shenoy, **"On the Limitations of Carbon-Aware
Temporal and Spatial Workload Shifting in the Cloud"**, EuroSys '24. Their conclusion,
verbatim:

> *"For temporal shifting, these limits derive from a lack of variability in carbon
> intensity at many locations. In addition, the locations with low variability — where
> temporal shifting is least effective — tend to be those with the highest absolute
> carbon emissions — where reducing carbon emissions is most important. Likewise,
> locations with significant variability tend to have low average carbon emissions, and
> thus adapting to such variations does not yield significant savings."*

That is a **trap**, and it is the strongest argument against the whole premise of this
line of work — it deserves to be stated in the package, not buried. And on the choice
between the two mechanisms: *"When combining spatial and temporal shifting, savings
from spatial migration dominate the overall savings, with limited additional benefits
from performing temporal shifting."* **This is the literature's endorsement of WP-4
over WP-1.** One caution against over-reading it for a GB-internal experiment: the same
group measures intra-*European* spatial gain at "a mere 24%" against 96% globally, so
their headline cannot be ported to shifting *within* Great Britain.

### What production systems actually report

- **Google** (Radovanović et al., arXiv:2106.11750), running this in production across
  its fleet, reports *"a power consumption drop of 1-2% at times with the highest carbon
  intensity."* I grepped the full text: **there is no fleet-wide percentage carbon
  saving in that paper at all.** Their mechanism needs *two* day-ahead forecasts —
  carbon intensity *and* demand — and their deadline discipline is ≤24 h with daily
  capacity preserved.
- **Meta** (Acun et al., Carbon Explorer, ASPLOS '23) report that carbon-aware
  scheduling *"increas[es] 24/7 coverage by 1% to 21% across geographic regions"* while
  *"requir[ing] 6% to 76% additional servers to support deferred computation"*, and
  conclude that *"any solution for 24/7 carbon-free operations … must include renewable
  energy and batteries."* Scheduling is the junior partner to storage in their analysis.
- The large numbers in the literature come from **elasticity, not deferral**.
  CarbonScaler (Hanafy et al., POMACS 7(3) Art. 57, DOI 10.1145/3626788) reports up to
  51% — but that is *"the Netherlands … for the highly scalable ML (ResNet18)"*, and
  where the workload scales badly *"most of the carbon savings … stem from time-shifting,
  yielding comparable savings to suspend-resume."* CarbonFlex (arXiv:2505.18357,
  **preprint — the PDF still carries the unmodified ACM "Conference'17" placeholder
  header**) reports ~57.5%, on **South Australia**, one of the highest-variability grids
  in the world, at an average job delay of 17.5 hours. In the same experiment, *pure
  temporal shifting* ("Wait Awhile") scores **10.3% (GPU) / 13.5% (CPU)**.

**The honest summary of all of it:** across the strongest published work, *pure deferral*
lands roughly between 2% and 13%, and it is the low end in low-variability grids like
Great Britain's. The tens-of-percent results come from elasticity, spatial choice,
storage, or doing less work — which is exactly the pattern this package's own results
show, and it means E2's −1.54% is **in the literature's range**, not an anomaly.

### Herding: the mechanism is named in peer-reviewed work, and never measured

Limitation R11 (75.3% / 92.9% of deferred runs landing in the busiest 5% of slots) turns
out to be a documented concern with no published measurement behind it:

- **CarbonScaler** (peer-reviewed, POMACS) states the mechanism as an expectation and
  declares it out of scope: *"as more and more customers try to increase their carbon
  efficiency, the compute and power demand will increase at certain periods beyond the
  datacenter capacity … The modeling of such dynamic pricing and carbon-aware fair
  shares and how CarbonScaler will respond is outside the scope of this paper."*
- **CarbonFlex** names it directly: *"Considering a capacity limit is important to avoid
  a 'thundering herd' problem where all jobs defer their execution to the same low-carbon
  time"*, and *"these individual job approaches do not consider the data center-wide
  capacity constraints, resulting in demand bursts at low carbon periods, also known as
  the stampede or the thundering herd problems."* Its citation for the *term* is Ruane's
  1990 UTS-kernel paper; its citation for the *effect* is Hanafy et al., "Going Green for
  Less Green", ASPLOS '24 (DOI 10.1145/3620666.3651374).
- Crucially, **CarbonFlex models it as a within-cluster capacity problem** — one
  operator's own jobs colliding — and solves it with a time-varying capacity limit. I
  grepped the paper: it does **not** model many *independent* schedulers across an
  economy converging on the same slots, and does not quantify any grid-level peak.
- Wiesner et al. measured their own consolidation and found peak concurrency up to
  **+42%** over baseline, judging that *"no unrealistic consolidation of workload took
  place"* — an acknowledgement, not a study.

#### The quantified analogue is in the EV literature, and Britain has already legislated against it

The computing literature names the herd and does not measure it. The **electric-vehicle**
literature measures it, in a field experiment, and the result transfers directly to E3:

Bailey, Brown, Myers, Shaffer & Wolak, **"Electric Vehicles and the Energy Transition:
Unintended Consequences of Time-of-Use Pricing"**, *American Economic Review: Insights*
7(4), December 2025, pp. 550–566, DOI 10.1257/aeri.20240476 (quantitative figures below
read from the NBER working-paper version, w32886). Their abstract:

> *"while TOU pricing is effective at shifting EV charging into off-peak hours, it
> unintentionally induces new and larger 'shadow peaks' of simultaneous charging. These
> shadow peaks lead to greater exceedance of local capacity constraints and advance the
> need for distribution network upgrades."*

Measured: peak-hour transformer constraint violations fell **51%**, but **off-peak
violations rose 133%**; the maximum demand on a 10-EV distribution transformer under
TOU was **24% higher** than control. And the sentence that transfers straight to
carbon-aware scheduling:

> *"Dynamic pricing, under which the retail price changes hourly in line with real-time
> wholesale market conditions[,] does not resolve the distribution network coordination
> challenge. Instead, it is likely to make it worse by narrowing the set of inexpensive
> hours in which to target charging."*

A carbon signal narrows the target set exactly as a price signal does. (Caveat to state
when citing: the experiment ran in Alberta, Canada, not the UK.)

**And Great Britain has already legislated against this reflex — for the very load E3
models.** *The Electric Vehicles (Smart Charge Points) Regulations 2021*, SI 2021/1467,
regulation 11, in force since 30 June 2022, requires every relevant charge point to
apply a **random delay of up to 600 seconds by default, with the capability to be set
remotely up to 1800 seconds** — and it applies not only at charge start but at *any*
increase or decrease in charging rate (reg 11(4)(b)). The Explanatory Memorandum gives
the reason:

> *"If charge points all turn on or off ('switch') simultaneously … this could cause
> grid instability, due to the sharp increase or decrease in electricity demand from EVs.
> To mitigate this, this instrument mandates that charge points should have a randomised
> delay function … This means charge points switch in a staggered way."*

> **This is a concrete gap in E3, and I would rather report it than let a reviewer find
> it.** `simulation/charging.js`'s `bestStart()` is a pure deterministic argmin: every
> vehicle that can reach the cleanest window picks *the same* window, with no
> randomisation anywhere in the model. A real GB fleet could not legally behave that
> way. The effect is small at 30-minute resolution (600 s is a third of a slot), so this
> is unlikely to move the headline numbers — but the model currently describes a
> non-compliant fleet, and limitation R11's herding measurement is the same phenomenon
> the regulator legislated against. **WP-12 should therefore include a randomised-delay
> arm**, which converts a modelling omission into a measurement of what the regulation
> actually buys.

For the record, what I could **not** verify: any primary NESO/Ofgem/DNO or peer-reviewed
source documenting an *observed* Economy 7 timer-driven demand spike at a tariff
boundary. The widely-repeated claim that Economy 7 switching times are staggered by
region to avoid a step change appears only in secondary commercial material. An
Ofgem-hosted presentation does confirm that the Radio Teleswitch System was introduced
as a load-management tool with the *"ability to spread [load] over different periods
through the day"* and that it switches meters in **groups**, but it records no measured
spike. That claim should not be made.

**So R11 is not a restatement of a known result. It is a small measurement of an effect
the field has named and stepped around.** That makes it one of the more publishable
things in this repository, and it argues for a dedicated arm (many independent gated
schedulers on one signal) rather than a limitation row.

### The signal: what Great Britain actually publishes

Checked against the live API and both NESO methodology PDFs (Bruce, Ruff, Kelloway,
MacMillan & Rogers, Issue May 2024) on 2026-09-01:

- **A 48-hour forward forecast exists and this package has never used it.**
  `GET /intensity/{from}/fw48h` nationally, and
  `GET /regional/intensity/{from}/fw48h/regionid/{id}` regionally — both confirmed live.
  `simulation/fetch-traces.js` only ever calls the historical `/intensity/{from}/{to}`
  and `/regional/intensity/{from}/{to}/regionid/{id}`. **WP-3 is therefore a matter of
  calling an endpoint that is already free, keyless and documented**, not of building a
  forecaster. This is the concrete basis for saying no ML is required.
- **The regional series has no ground truth, and the claim is stronger than the package
  states.** A live regional response carries `{"forecast":N,"index":"..."}` and **no
  `actual` key at all** — not null, absent, even for settled past periods. National
  carries `actual` (null only for the future). Limitation R2 and ADR-008 are correct.
- **The signal is CO2, not CO2e, and it is operational, not lifecycle.** The published
  factors give Nuclear, Wind, Solar, Hydro and Pumped Storage **0** gCO2/kWh, and
  Biomass 120. Imports are included with non-zero factors (French 53, Dutch 474, Irish
  458). This independently confirms ADR-015 and limitation R17: the package labels the
  unit gCO2e while the source is CO2 from generation only.
- **NESO publishes no forecast-accuracy figure.** I read both methodology PDFs end to
  end; there is no MAPE, MAE or error metric anywhere. The regional forecast is itself
  produced by *"an ensemble of state-of-the-art supervised Machine Learning (ML)
  algorithms"* — another reason for this package not to build one.
- **Measured here instead, from the committed traces** (`data/simulation/W1.json`,
  `W2.json`, which already carry both `national.forecast.values` and
  `national.actual.values`, 1,344 slots each, zero gaps carried forward):
  **MAPE 6.55% in winter and 8.25% in summer; MAE 8.8 and 8.9 gCO2/kWh**; the forecast
  runs high in 58.3% of winter slots and 45.1% of summer slots. **Caveat, and it is a
  real one:** these are the forecast values the historical endpoint returns beside the
  settled actual, whose issue horizon the API does not state — this is *not* a
  48-hour-ahead error. A true fw48h error needs the forecast captured prospectively,
  which is WP-3's first job. For scale, Wiesner et al. cite a 2020 NESO 48-hour MAE of
  10 gCO2/kWh (~5% of the yearly mean) from Bruce et al. 2021, so 8.8–8.9 is plausible
  but must not be reported as a 48-hour figure.

### Average versus marginal — and why WP-10 is probably not buildable

- The peer-reviewed source is Sukprasert, Bashir, Souza, Irwin & Shenoy, **e-Energy '24**,
  DOI 10.1145/3632775.3661953: **36 of 65 regions (55.4%)** show a negative correlation
  between average and marginal emissions. (Note for the record: the widely-quoted
  "7–50%" and the Denmark/Poland findings are **Electricity Maps' own** analysis, not
  this paper's — the two are easy to fuse and I nearly did.)
- **Electricity Maps discontinued marginal signals entirely in January 2025.** NESO
  publishes average only. WattTime's MOER is a paid tier, and **Great Britain is never
  explicitly named on any WattTime page I could fetch** — paid GB coverage is inferred
  from a "nearly 100% of global consumption" claim, not documented.
- **Conclusion: WP-10 as originally scoped is very likely impossible on free data, and
  possibly impossible at any price without a bespoke arrangement.** The honest
  deliverable is a written limitation naming exactly why, which is what R17 already
  does. I will not manufacture a proxy marginal series.

### Tooling: there is no free-GB path through the standard SDK

- The Green Software Foundation **Carbon Aware SDK** supports exactly two live data
  sources, **WattTime and ElectricityMaps — both commercial and keyed**; its third
  option is a static local JSON file. **There is no NESO / carbonintensity.org.uk data
  source.** Pointing the standard tool at Britain's free signal means writing a new data
  source. That is a genuine, citable gap and an obvious contribution.
  (Correction to my own earlier note: the endpoint is `emissions/forecasts/current` with
  a `windowSize` parameter — **there is no `/emissions/bytimewindow`.**)
- Its status should be stated carefully: the repository is **not archived** (v1.8.0,
  May 2025) but has had **no release in ~16 months**, and it **no longer appears on
  GSF's own current-projects page**. Do not call it a "Graduated Project" in the present
  tense; do not call it abandoned.
- **The SCI specification is genuinely an ISO standard**: ISO/IEC 21031:2024,
  first edition 2024-03, adopted by ISO/IEC JTC 1 under the PAS procedure from the
  Linux Foundation's SCI v1.0. Two honest nuances: it is a fast-track adoption of an
  existing industry specification rather than a de-novo ISO drafting, and it standardises
  **v1.0** while GSF's live specification has already moved to v1.1 (October 2024).

### Carbon-aware AI serving, for completeness

**Sprout** (Li, Jiang, Gadepally & Tiwari, EMNLP 2024 **Main**, DOI
10.18653/v1/2024.emnlp-main.1215) reports >40% carbon reduction — but its mechanism is
**generation directives that make the model emit fewer tokens when the grid is dirty**.
That is *degrade*, not *shift*: it is a published precedent for this package's `degrade`
rung, not for its deferral. **EcoServe** (arXiv:2502.05043, up to 47%) remains
**arXiv-only** ~19 months after v1 despite heavy citation, and should be cited as a
preprint.

### What this changes in the plan

1. **WP-1's expected result is now bounded by the literature, not open.** Low single
   digits for GB. That is still worth measuring — it converts a stipulated parameter
   into a curve — but it will not rescue the carbon story, and the roadmap should not
   pretend otherwise. Two design consequences, both from Sukprasert et al.: returns on
   slack are **sub-linear** (they report a **3.1×** increase in savings for a **365×**
   increase in slack), so the horizon sweep should expect a knee and not a slope; and
   **job length matters more than horizon** — at 24 h slack they measure 57 gCO2eq saved
   for a 1-hour job against 3 gCO2eq for a 168-hour job. E2's tasks are uniform and
   short, which is the favourable end; a length distribution belongs in the sweep.
   Wiesner et al. add a third: **interruptibility** improved savings by 24.2–36.6% for
   Germany, GB and France, and E2 has no interruption model at all.
1b. **Forecast error must be a variable, not noise.** Wiesner et al. simulated it as
   uniform random noise and disclaimed it themselves (*"prediction errors are not
   uniform and also correlated. Errors grow with increasing forecast length … the
   validity of our forecast error analyses are limited"*). Google's measured carbon
   forecast MAPE *"ranges between 0.4% - 26% over the range of forecast horizons (8-32
   hours)"* — a 12-hour horizon already sits where error is material. WP-3 should carry
   the real forecast, not a perturbed actual.
2. **WP-4 (spatial) is promoted.** Sukprasert's *"savings from spatial migration
   dominate"* is the field's own verdict, and the package's data plane is the mechanism
   that makes region a selectable quantity. Tempered by their intra-European "mere 24%".
3. **WP-3 shrinks to an integration task.** The forecast exists, free and keyless. No
   model to build.
4. **A new WP-12 appears: the herding arm.** The field names the thundering herd and
   nobody measures it across independent actors. This package already has a partial
   measurement (R11) and the gate to control it. That is a contribution, not a caveat.
5. **WP-10 is downgraded to a written limitation** until a GB marginal series can be
   shown to exist.
6. **A possible WP-13: a NESO data source for the Carbon Aware SDK** — the standard
   tool cannot see Britain's free signal today.

---

## 4. What is missing in specs, diagrams and tests

You asked whether more TDD/BDD, architecture specification and diagrams are needed —
for the whole and for the parts, including how ports and adapters like the EV one work.
Here is the gap analysis, honestly scoped: **this package is unusually well tested for
its size, and the gaps are specific, not general.**

### What already exists and does not need redoing
46 adapter unit tests; 13 architecture fitness functions over 14,966 cases against
shipped code; F7 enforcing the hexagonal import graph *structurally* (an adapter that
imports another adapter fails the build); F12 binding 127 hand-typed numbers across 12
documents to `results/`; an arc42 architecture document; 17+ ADRs; determinism proved
by re-running to byte-identical output; CI on two Node versions.

### Gap 1 — There is no behavioural specification anyone but a programmer can read
Every property is expressed as a JavaScript assertion. The *rules* — "nothing above
degrade runs without an approval", "terminate is never overridable", "a refused verdict
never withholds charge, only the optimisation" — exist in prose and in test code, but
not in a form a domain expert, a reviewer or a regulator can check without reading
JavaScript. **Proposal: Gherkin `.feature` files, one per port**, executed against the
same adapters (not a parallel implementation). Not because BDD is fashionable, but
because the safety constraint in E3 — *every vehicle receives its full charge before
its deadline in every arm, including when the gate refuses* — is exactly the kind of
sentence that must be a readable, executable acceptance criterion.

### Gap 2 — The ports are named but not specified
ARCHITECTURE names four ports (signal, forecast, human, actuation). Only some are
built. None has a written **contract**: its interface, its failure modes, what it may
assume, what it must never do. And the audit has now identified a **fifth, missing
port** — metering — whose absence F13 proves is load-bearing; §3c adds the **sixth,
publication** — the loop's output edge, the only port the invention cannot exist
without, today implemented only in the separate publisher packages and never
contracted or tested here. Proposal: a one-page
contract per port plus a **contract test suite** that any adapter must pass, so that
"a real EV charger adapter" becomes a thing you can *verify* rather than a thing you
claim.

### Gap 3 — The EV adapter is the strongest worked example and is under-documented
E3 is the most convincing part of this work for a non-specialist: a real, physical,
safety-constrained load with a genuine deadline and an owner whose consent matters. It
deserves the full port-and-adapter treatment — a sequence diagram from
plug-in → proposal → gate → owner consent → actuation → metered commit, the explicit
statement of which arrows are *built*, which are *simulated* and which are *designed
only*, and the safety argument (start-time shifting only, no V2G, no partial charge)
stated as an invariant with a test behind it.

### Gap 4 — The diagrams are static only
There is a structure diagram and an import graph. There is **no dynamic view**: no
sequence diagram of a single decision through gate → audit → harness, no state model of
a task's life (`arrived → gated → deferred → executed → committed`), no diagram of the
budget's own dynamics. For a control system, the dynamic view is the interesting one.
Proposal: C4 level-3 component diagram, two sequence diagrams (E2 decision, E3 charging
session), one state machine, all as committed source (Mermaid) so they cannot rot
silently.

### Gap 5 — The seam between the two experiments is assumed, not tested
Limitation R12: no measured run consumes the gateway's published documents as its
scheduling signal. E1 measures the data plane; E2 uses grid traces. They are joined by
an assumption. **One end-to-end test that drives a single gated decision from a real
published document through to an audit record** would close the package's biggest
structural gap, and it is not a large test.

### Gap 6 — No negative or chaos testing of the adapters
The fitness functions attack the *core* adversarially (F2 fail-closed, F6 tamper, F13
dishonest estimates). The *adapters* are not attacked: what happens when the gateway
serves malformed JSON, when the API times out mid-run, when a peer publishes an absurd
intensity, when the clock jumps? The audit already hardened `dataplane/measure.js`
against a hostile registry entry — that hardening has no test.

---

## 5. The plan

Ordered by value per session. Each work package states what it changes, what proves it,
and what could make it fail. **Nothing here modifies the submitted article**; results
land in `results/`, prose lands in this file, the README *Corrections* section, and
`CHANGELOG.md`.

| # | Work package | What it produces | Why it is first / risk |
|---|---|---|---|
| **WP-1** | **E2b — horizon and objective sweep** | New E2 arms: argmin instead of median threshold; horizon ∈ {6, 12, 24, 48} h; deferrable fraction ∈ {0.5, 1.0}. A saving-vs-horizon curve. | **Highest value.** Directly answers "is deferral worth it". Low risk: no new data, same traces, same gate. Risk is that it confirms deferral is weak *for this workload*, which is itself a publishable, honest result. |
| **WP-2** | **E2c — saving decomposition arm** | Replaces section 2b's arithmetic with a measured split: run P2 with drop disabled, then with degrade disabled, and attribute the saving exactly. | Turns the paper's most contestable number into a decomposed one. Cheap; pure re-run. |
| **WP-2b** | **Peak-avoidance vs clean-seeking split** | **DELIVERED 2026-09-01** by `npm run bounds`: every E3 arm now carries the decomposition in `results/bounds.json` (winter 7.03 pp peak-avoidance + 25.82 pp clean-seeking; summer 21.42 pp + **−4.9 pp**). | Done. The strongest over-claim in my own analysis is now corrected by a run, not by hand. |
| **WP-3** | **Forecast port + adapter** | A real `forecast` port consuming NESO's forward forecast, with a committed fixture so tests stay offline and deterministic; used by WP-1's optimiser. | Makes WP-1 *causal* rather than oracular (P1's threshold currently uses lookahead — see ADR-010). Risk: forecast endpoint shape and horizon must be verified, not assumed. |
| **WP-4** | **E4 — spatial, advisory** | Per the owner's answer: advisory and minimal. The ceiling is already computed (`results/bounds.json` spatial section); what remains is a one-page advisory spec — the loop *recommends* a region, records the recommendation in the audit chain, and nothing pretends to move work. | Shrunk from 2 sessions to 0.5. The regional series is forecast-only (R2), so "forecast-scored advice" is the whole claim, stated as such. |
| **WP-5** | **Metering port + contract** | The fifth port, specified and adapter-tested; F13 wired to the contract so the guarantee is stated where the port is defined. | F13 already proves the gap matters. Small, and closes limitation R15. |
| **WP-6** | **BDD feature files, one per port** | Gherkin specs executed against the real adapters; the E3 safety invariant becomes a readable acceptance criterion. | Addresses gap 1 and 2. Must not become a parallel implementation — features drive the same code the fitness functions do. |
| **WP-7** | **Dynamic diagrams** | C4 component view; two sequence diagrams; one task state machine; budget dynamics — committed Mermaid. | Addresses gap 4. Low risk, high explanatory value. |
| **WP-8** | **E1↔E2 seam test** | One end-to-end run: real published document → signal → gate → audit record. | Closes limitation R12, the biggest structural gap. |
| **WP-9** | **Adapter negative/chaos tests** | Malformed JSON, timeout, absurd values, hostile registry entries (the existing hardening gets its test). | Addresses gap 6. |
| **WP-10** | **Marginal-signal re-scoring** | Re-score E2/E3 against a marginal series if one is obtainable for GB; report both. | Addresses R17. **Now believed not buildable** — Electricity Maps discontinued marginal signals in Jan 2025, NESO is average-only, and WattTime never documents GB explicitly. Downgraded to a written limitation unless a series can be shown to exist. |
| **WP-12** | **Herding arm — many independent gated schedulers on one signal** | N independent governors sharing the peer signal; measure benefit erosion and the induced peak as N grows, with and without the gate's pacing. Turns limitation R11 into a result. | **The field names the "thundering herd" (CarbonScaler, CarbonFlex) and nobody measures it across independent actors.** This package has the signal, the gate and a partial measurement already. Highest novelty of anything here. |
| **WP-13** | **A NESO data source for the GSF Carbon Aware SDK** | Upstream contribution: the standard tool supports only WattTime and ElectricityMaps, both keyed. Britain's free signal is unreachable through it. | Small, outward-facing, and independently useful. Optional. |
| **WP-14** | **Tiered governance — rules first, humans for what matters** | A standing, audited auto-defer rule for `block` on deferrable work; humans keep terminate (absolute), physical actuation, and non-deferrable-above-degrade. Reported as a human-decisions-per-day curve per tier. | The owner's ask, and the data already prices rule one: 545.7 → 442.9 (winter) and 853 → 637 (summer) decisions per 28 days. The constraint that keeps it honest: a rule is a validator with an audit trail, never a bypass. |
| **WP-15** | **Real workload trace** | One live run of a `kaiban-distributed-examples` workflow (OpenRouter), recording durations, token counts and deadlines; the anonymised trace committed as a fixture and replayed as a new E2 arm beside the synthetic one. | Converts E2's biggest "stipulated" caveat into a measurement. Live once, locally; deterministic forever after. |
| **WP-16** | **Price-signal twin (economics arm)** | Fetch and commit a half-hourly GB day-ahead price trace the way `fetch-traces.js` commits carbon; score every existing arm on £ as well as gCO2e; report where the two signals agree and where they fight. First deliverable doubles as the second-grid signal-adapter proof (§2i honesty note). | Makes §2g's illustrative arithmetic a measured result. The one plausible risk is licensing on the price series — checked before fetching, stated if blocking. |
| **WP-17** | **E5 — the closed loop (the invention's experiment)** | N governed systems, each publishing its own well-known document after each commit and consuming the others' documents as its peer signal — no exogenous trace. Measures loop stability (damping vs amplification of the herd) vs publication cadence and staleness; subsumes WP-8's seam and extends WP-12; adds the publish-back edge to the demo; specifies the publication port. | **The article's own open problem** ("Multi-party closed loop — no third-party publisher yet") made runnable with parts already in this repository (governor + publisher/consumer packages + gateway). Closes R12 for real; turns R2/R5 from caveats into controlled variables. |
| **WP-11** | **Addendum write-up** | This file finalised, README *Corrections* updated, CHANGELOG, and a short "what changed after submission" note suitable for a revision or a follow-up paper. | Last, because it reports WP-1…WP-10. |

### Ordering
WP-2b is done (`npm run bounds`). Then: WP-1 → WP-2 (pure re-runs, immediate answers)
→ WP-14 (tiered governance; small, owner-requested) → WP-3 (causality) → WP-15 (real
trace) → WP-12 (herding + the randomised-delay/R18 arm) → **WP-17 (E5, the closed
loop — the invention's own experiment, and the joint headline with WP-12)** → WP-5,
WP-6, WP-7 (contracts, features, diagrams — parallelisable; WP-5/WP-6 now include the
publication port) → WP-16 (economics twin) → WP-4 (advisory spec), WP-9 (WP-8 is
subsumed by WP-17) → WP-13 (optional) → WP-10 (only if a GB marginal series is shown
to exist) → WP-11.

**If you only ever do one:** WP-1 — it answers "is deferral worth it" with a number,
and the bounds table (§2f) plus the literature already bracket what that number will
be, which makes it a *check* rather than a gamble.
**If you only ever do three:** WP-1, WP-14, WP-12.
**The joint headline (per the owner's answer to question 7 and the article itself):**
WP-12 + WP-17 — measure the herd the field named and stepped around, then close the
loop the article invented and measure whether mutual observation through published
documents damps it or amplifies it. Together they are the paper's "open problem" row
turned into results.

---

## 6. Session estimates

A "session" is one working context of the length we have been using. Estimates assume
the current green baseline and the existing determinism/CI discipline (every experiment
change costs a re-run, a doc cascade and an `F12` registry update — that overhead is
included).

| Work package | Sessions | Confidence |
|---|---:|---|
| WP-1 E2b horizon/objective sweep | 1.5 | high — same data, same gate |
| WP-2 E2c decomposition | 0.5 | high |
| WP-2b Peak vs clean-seeking split | **done** | delivered by `npm run bounds` |
| WP-3 Forecast port + adapter | 1 | medium — depends on endpoint verification |
| WP-4 E4 spatial advisory spec | 0.5 | high — ceiling already computed |
| WP-5 Metering port + contract | 0.5 | high |
| WP-6 BDD features per port | 1.5 | medium — scope creep is the risk |
| WP-7 Dynamic diagrams | 1 | high |
| WP-8 E1↔E2 seam test | 1 | medium — needs a live or fixtured gateway run |
| WP-9 Adapter negative/chaos tests | 1 | high |
| WP-10 Marginal re-scoring | 1–2 | **low** — data availability unknown |
| WP-12 Herding arm (R11 → result) | 2 | medium — model design is the risk |
| WP-13 NESO source for GSF SDK (optional) | 1 | medium |
| WP-14 Tiered governance | 1 | high — the sensitivity numbers already exist |
| WP-15 Real workload trace | 1 | medium — one live run, then deterministic |
| WP-16 Price-signal twin | 1.5 | medium — licensing on the price series is the risk |
| WP-17 E5 closed loop (subsumes WP-8) | 2 | medium — cadence/staleness model is the research choice |
| WP-11 Addendum write-up | 1 | high |
| **Total** | **≈ 17–18** (16–17 without the optional WP-13; WP-8's 1 session is absorbed into WP-17) | |
| **Minimum useful subset (WP-1, 2, 14, 7, 11)** | **≈ 5** | |
| **Headline pair (WP-12 + WP-17)** | **≈ 4** | |

---

## 7. Questions asked — answers received — decisions taken

These were the genuine unknowns. The indented bullets are the owner's answers, kept
verbatim; each **Decision** line is what the plan now does about it.

1. **What is this for now — a revision, a follow-up paper, or a better artifact?** If a
   revision of the submitted article is possible, WP-1 and WP-2 change what the paper
   can claim and should be done first and fast. If the article is frozen and this is a
   *follow-up*, WP-4 (spatial) is the stronger contribution because it is novel rather
   than corrective. If it is neither — the artifact just has to be right — then WP-2,
   WP-6, WP-7 and WP-9 matter most and the new experiments are optional.
   - article is frozen, but this can implement everything else and keep the notes on how it differs from the paper version (should be tagged as it is now for the paper tag to be the same and all else documented how differs than the paper clealrly and summary short accurate and easy to understand)

   **Decision (agreed):** the repo gets a permanent tag at the article's snapshot so the
   paper's version is always one `git checkout` away, every later change lands on top,
   and the README *Corrections* section stays the short, plain-words summary of every
   difference. Tag command is in section 9. Backward compatible: the tag never moves.
   Forward compatible: everything new is additive — new arms, new results files, new
   ports — never a rewrite of what the paper cites.

2. **Is the E2 workload meant to represent something real?** `deferrableFraction: 0.5`,
   `deferralHorizonHours: 6`, `energyPerTaskKWh: 0.05` and `degradedEnergyFraction: 0.4`
   are stipulated. If you have — or can get — a real agentic workload trace (even
   coarse: job durations, deadlines, how much is genuinely deferrable), WP-1 stops being
   a parameter sweep and becomes a measurement. If not, I will sweep and report the
   curve, which is defensible but weaker.
   - you can research for a real workflow or use any of kaiban-distributed-examples for a real run with openrouter key.

   **Decision (agreed):** new work package **WP-15**: replay a real
   `kaiban-distributed-examples` workflow (trip-planning or the RAG example) with the
   OpenRouter key, record real task durations, token counts and inter-task deadlines,
   and commit the anonymised trace as a workload fixture. E2's stipulated workload then
   becomes one arm and the real trace another. The live run happens once, locally, off
   CI; the committed trace keeps every test offline and deterministic.

3. **How far may work legitimately be deferred in your intended application?** The
   6-hour horizon is the single most consequential number in E2 and I do not know
   whether it came from a real service-level constraint or from caution. If a real
   agentic service can defer batch work overnight, the honest horizon is ~12 h and the
   result changes substantially.
   - ok, choose how you think is best for these cases

   **Decision (mine):** sweep, don't pick — horizons 6/12/24/48 h are all in WP-1, and
   the bounds calculus below already prices each rung of that ladder, so the honest
   deliverable is the curve with the knee marked, not one blessed number. Where a single
   default is needed (the demo), 12 h overnight — the longest horizon a
   "finish by morning" promise supports.

4. **For E4 (spatial): is choosing a region physically meaningful in your model, or is
   it advisory?** The current peers are real organisations publishing their own
   sustainability documents; "run in peer X's region" is only a real control if
   *something* could actually schedule there. I can model it as a counterfactual and say
   so — but you should decide whether that is a result or a thought experiment before I
   spend two sessions on it.
   - advisory, but spend the least on it as you choos best. also reframe all these questions and results to be more human like and easier to understand.

   **Decision (agreed):** E4 shrinks from a 2-session simulation to what the bounds
   calculus already computed for free — the spatial ceiling in \`results/bounds.json\`
   (section 2f below) — plus a one-page advisory spec: the loop *recommends* a region
   and records the recommendation in the audit log; nothing pretends to move work. And
   the whole document now opens with a plain-words summary (section 0).

5. **Marginal-emissions data (WP-10): this now looks unbuildable — do you accept that?**
   Verified 2026-09-01: Electricity Maps discontinued marginal signals in January 2025,
   NESO publishes average only, and WattTime's paid MOER never names Great Britain on any
   page I could fetch. Unless you know of a source I could not find, WP-10 becomes a
   written limitation rather than a re-scored result. I will not manufacture a proxy
   series.
   - yes acceptable but could change.

   **Decision (agreed):** WP-10 stays a written limitation (R17). A standing note in
   SEARCH-PROTOCOL-style spirit: if a GB marginal series ever becomes available, the
   re-scoring is one afternoon, because every arm already separates deciding from
   scoring.

6. **How much does the human-cost number matter to you?** 545.7/853 approvals over the
   window is currently reported as a cost. If the intended story is "governance is
   affordable", that number deserves its own sensitivity analysis (what happens if
   deferring blocked work is automatic — already computed) and possibly its own arm. If
   it is incidental, leave it.
   - try to introduce a model where only critical work is governed by hitl and the rest could be automated more by some rules or something.

   **Decision (agreed, and the data already supports it):** new work package **WP-14 —
   tiered governance**. The rule: a \`block\` on *deferrable* work auto-defers under a
   standing, audited policy — no human; humans see only what is irreversible (terminate
   stays absolute), physical, or non-deferrable-above-degrade. The existing sensitivity
   numbers say what that buys: human decisions drop from **545.7 → 442.9** (winter) and
   **853 → 637** (summer) per 28-day window just from auto-deferring blocked deferrable
   work — before any further rules. The design constraint that keeps it honest: an
   automated rule is itself a validator with an audit trail, never a bypass of the gate.

7. **Should I pursue the herding arm (WP-12) as the headline follow-up?** It is the one
   thing here the field has named but not measured — CarbonScaler explicitly declares it
   out of scope, CarbonFlex treats it as a within-cluster capacity problem only, and this
   package already has a partial measurement (R11) plus the gate that would control it.
   It is also the most speculative: 2 sessions, and the model design (how many independent
   actors, sharing what signal, with what capacity) is a research choice I should not make
   alone. Worth it, or stay corrective?
   - yes , make all inventions and innonvative and not treated anndreseached things.

   **Decision (agreed):** WP-12 (herding) is promoted to the headline experiment, with
   the randomised-delay arm (R18) inside it, and the innovation inventory in section 2h
   lists every genuinely unoccupied claim this repository can take.

8. **Do you want the BDD layer at all?** It is real work (WP-6, 1.5 sessions) and it
   duplicates coverage that fitness functions already provide. Its value is *readability
   by non-programmers* — reviewers, standards people, a regulator. Worth it only if
   someone in that category will actually read it. Tell me if not and I will drop it and
   put the effort into WP-4 and WP-9 instead.
   - might be useful also for me or others, yes, as simple as possible but complete.

   **Decision (agreed):** WP-6 stays, scoped to exactly one \`.feature\` file per port
   (five files), each under a page, each executed against the real adapters — no
   step-library framework, no parallel implementation.

---

## 8. What will not change

- **The submitted article is never edited.** Every divergence found by the audit or
  produced by this roadmap is recorded in the README's *Corrections* section and in the
  manuscript's revision notes — never by silently changing the paper.
- **Every number in this repository stays bound to `results/`.** F12 enforces it across
  127 registered claims in 12 documents; anything this roadmap produces gets registered
  the same way.
- **Every experiment stays deterministic and offline-reproducible.** Fixed seeds,
  committed traces, byte-identical re-runs, no live network in CI.
- **No result is stated that a reader cannot re-derive from this repository.**

---

## 9. Publishing commands (run by the owner — nothing here runs git)

The article's snapshot gets a permanent tag so "the paper's version" is always one
checkout away, and the current state is committed on top of it:

The paper's snapshot is **already pinned**: the existing tag **`v1.0.0`** is the state
the article describes (9 fitness functions over 10,994 cases), and `v1.1.0` pins the
artifact revision. Nothing needs re-tagging; an annotated alias just makes the
paper-pointer impossible to miss:

```bash
cd ~/work/sustainability-loop-eval

# 1 (optional). A self-explaining alias for the paper's snapshot:
git tag -a paper-snapshot v1.0.0 -m "The state the IEEE Software submission describes (== v1.0.0: 9 fitness functions over 10,994 cases). The paper is frozen; every later change is documented in CHANGELOG.md and the README Corrections section."

# 2. Commit this pass:
git add -A && git commit -m "The invention measured: E5 closed loop (plane spreads only by paying grams; fresh observation oscillates), E6/E6b routed charging + geo-migration with the spatial-Goodhart warning; bounds calculus incl. forecast accuracy; ROADMAP compositions C1-C17 + 15 scenarios + verified who-could-publish-today; RUNBOOK with per-WP agent briefs; EXECUTIVE-CASE; owner answers folded in as decisions; WP-14/15/16/17; unit tests 33->46"

# 3. Push, with tags:
git push && git push --tags
```
