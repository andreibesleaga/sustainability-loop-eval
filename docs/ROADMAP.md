# Roadmap — what this evaluation proved, what it did not, and what to build next

> **Status:** addendum, written 2026-09-01 after the multi-lens audit. **The submitted
> article is not changed by anything in this file.** Where this document disagrees with
> the article, the article stands as the record of what was submitted and the
> disagreement is listed in the README's *Corrections* section. Everything here is
> either measured in `results/`, proved by a fitness function, or explicitly labelled as
> a proposal.

This file answers four questions that the audit left open:

1. [What is this, in plain language, and is it needed?](#1-what-this-is-in-plain-language)
2. [Is it worth it, if the saving comes from doing less work?](#2-the-honest-answer-to-is-it-worth-it)
3. [What should a real "defer to when and where the power is clean" mechanism be?](#3-what-a-real-when-and-where-mechanism-would-be)
4. [What specifications, diagrams and tests are still missing?](#4-what-is-missing-in-specs-diagrams-and-tests)

Then: [the plan](#5-the-plan), [session estimates](#6-session-estimates), and
[the questions I need answered](#7-questions-i-need-answered-before-building).

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
  13 fitness functions over 14,925 cases against the real `kaiban-distributed`
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
| A governance gate can hold ladder semantics, fail-closed, human binding and a tamper-evident record in shipped agentic runtime code | **Proved.** 13 fitness functions, 14,925 cases, real `ActionGate`. |
| Carbon can be one such constraint, end to end, from a published signal to an audited verdict | **Demonstrated**, on real grid traces and a live data plane. |
| Carbon-aware *deferral* is worth a large saving | **Under-measured, not disproved.** E3 says 32.85% with room to move; E2 says 1.54% with a 6-hour horizon. |
| The governor's headline 16–20% is a carbon saving from smarter timing | **No.** Mostly degrade and drop. Say so plainly. |
| Governance adds carbon saving | **No** — measured to *subtract* 0.34/0.49 points in E3. It adds authority and audit. |

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
33 adapter unit tests; 13 architecture fitness functions over 14,925 cases against
shipped code; F7 enforcing the hexagonal import graph *structurally* (an adapter that
imports another adapter fails the build); F12 binding 92 hand-typed numbers across 11
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
port** — metering — whose absence F13 proves is load-bearing. Proposal: a one-page
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
| **WP-2b** | **Peak-avoidance vs clean-seeking split** | Reports E3 (and E2b) against a *mean-intensity* baseline as well as the naive one, so "avoided the evening peak" and "found clean power" are two numbers instead of one. Section 2c-bis does this arithmetically; this makes it a run. | Directly corrects the strongest over-claim the audit found in my own analysis. In summer the clean-seeking component is **negative**. Cheap and high-credibility. |
| **WP-3** | **Forecast port + adapter** | A real `forecast` port consuming NESO's forward forecast, with a committed fixture so tests stay offline and deterministic; used by WP-1's optimiser. | Makes WP-1 *causal* rather than oracular (P1's threshold currently uses lookahead — see ADR-010). Risk: forecast endpoint shape and horizon must be verified, not assumed. |
| **WP-4** | **E4 — spatial arm** | Choosing *where* to run across peer regions from the data plane, not just *when*. Reported against temporal-only. | The experiment only this package can run, and the strongest justification for a data plane. Risk: regional series are forecast-only, so a spatial result may not be scoreable against a regional *actual* — this must be checked before building, and may cap the claim at "forecast-scored". |
| **WP-5** | **Metering port + contract** | The fifth port, specified and adapter-tested; F13 wired to the contract so the guarantee is stated where the port is defined. | F13 already proves the gap matters. Small, and closes limitation R15. |
| **WP-6** | **BDD feature files, one per port** | Gherkin specs executed against the real adapters; the E3 safety invariant becomes a readable acceptance criterion. | Addresses gap 1 and 2. Must not become a parallel implementation — features drive the same code the fitness functions do. |
| **WP-7** | **Dynamic diagrams** | C4 component view; two sequence diagrams; one task state machine; budget dynamics — committed Mermaid. | Addresses gap 4. Low risk, high explanatory value. |
| **WP-8** | **E1↔E2 seam test** | One end-to-end run: real published document → signal → gate → audit record. | Closes limitation R12, the biggest structural gap. |
| **WP-9** | **Adapter negative/chaos tests** | Malformed JSON, timeout, absurd values, hostile registry entries (the existing hardening gets its test). | Addresses gap 6. |
| **WP-10** | **Marginal-signal re-scoring** | Re-score E2/E3 against a marginal series if one is obtainable for GB; report both. | Addresses R17. **Now believed not buildable** — Electricity Maps discontinued marginal signals in Jan 2025, NESO is average-only, and WattTime never documents GB explicitly. Downgraded to a written limitation unless a series can be shown to exist. |
| **WP-12** | **Herding arm — many independent gated schedulers on one signal** | N independent governors sharing the peer signal; measure benefit erosion and the induced peak as N grows, with and without the gate's pacing. Turns limitation R11 into a result. | **The field names the "thundering herd" (CarbonScaler, CarbonFlex) and nobody measures it across independent actors.** This package has the signal, the gate and a partial measurement already. Highest novelty of anything here. |
| **WP-13** | **A NESO data source for the GSF Carbon Aware SDK** | Upstream contribution: the standard tool supports only WattTime and ElectricityMaps, both keyed. Britain's free signal is unreachable through it. | Small, outward-facing, and independently useful. Optional. |
| **WP-11** | **Addendum write-up** | This file finalised, README *Corrections* updated, CHANGELOG, and a short "what changed after submission" note suitable for a revision or a follow-up paper. | Last, because it reports WP-1…WP-10. |

### Ordering
WP-1 → WP-2 → WP-2b (all pure re-runs, immediate answers) → WP-3 (unblocks causality) →
WP-5, WP-6, WP-7 (specification and contracts, parallelisable) → WP-4, WP-8 (new
experiments) → WP-9 → WP-12 → WP-10 (only if a GB marginal series is shown to exist) → WP-13 (optional) → WP-11.

**If you only ever do one:** WP-1. It answers your question with a number — and the
literature now tells us roughly what that number will be, which makes it a *check*
rather than a gamble.
**If you only ever do three:** WP-1, WP-2b, WP-7.
**If you want the one with the best chance of being novel:** WP-12. The field has named
the thundering-herd problem and stepped around it; this package can measure it.

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
| WP-2b Peak vs clean-seeking split | 0.5 | high |
| WP-3 Forecast port + adapter | 1 | medium — depends on endpoint verification |
| WP-4 E4 spatial arm | 2 | medium — scoring question is open |
| WP-5 Metering port + contract | 0.5 | high |
| WP-6 BDD features per port | 1.5 | medium — scope creep is the risk |
| WP-7 Dynamic diagrams | 1 | high |
| WP-8 E1↔E2 seam test | 1 | medium — needs a live or fixtured gateway run |
| WP-9 Adapter negative/chaos tests | 1 | high |
| WP-10 Marginal re-scoring | 1–2 | **low** — data availability unknown |
| WP-12 Herding arm (R11 → result) | 2 | medium — model design is the risk |
| WP-13 NESO source for GSF SDK (optional) | 1 | medium |
| WP-11 Addendum write-up | 1 | high |
| **Total** | **≈ 15.5–16.5** (14.5–15.5 without the optional WP-13) | |
| **Minimum useful subset (WP-1, 2, 2b, 7, 11)** | **≈ 4.5** | |

---

## 7. Questions I need answered before building

These are the genuine unknowns. Each one changes what gets built, so I would rather ask
than assume.

1. **What is this for now — a revision, a follow-up paper, or a better artifact?** If a
   revision of the submitted article is possible, WP-1 and WP-2 change what the paper
   can claim and should be done first and fast. If the article is frozen and this is a
   *follow-up*, WP-4 (spatial) is the stronger contribution because it is novel rather
   than corrective. If it is neither — the artifact just has to be right — then WP-2,
   WP-6, WP-7 and WP-9 matter most and the new experiments are optional.
   - article is frozen, but this can implement everything else and keep the notes on how it differs from the paper version (should be tagged as it is now for the paper tag to be the same and all else documented how differs than the paper clealrly and summary short accurate and easy to understand)

2. **Is the E2 workload meant to represent something real?** `deferrableFraction: 0.5`,
   `deferralHorizonHours: 6`, `energyPerTaskKWh: 0.05` and `degradedEnergyFraction: 0.4`
   are stipulated. If you have — or can get — a real agentic workload trace (even
   coarse: job durations, deadlines, how much is genuinely deferrable), WP-1 stops being
   a parameter sweep and becomes a measurement. If not, I will sweep and report the
   curve, which is defensible but weaker.
   - you can research for a real workflow or use any of kaiban-distributed-examples for a real run with openrouter key.

3. **How far may work legitimately be deferred in your intended application?** The
   6-hour horizon is the single most consequential number in E2 and I do not know
   whether it came from a real service-level constraint or from caution. If a real
   agentic service can defer batch work overnight, the honest horizon is ~12 h and the
   result changes substantially.
   - ok, choose how you think is best for these cases

4. **For E4 (spatial): is choosing a region physically meaningful in your model, or is
   it advisory?** The current peers are real organisations publishing their own
   sustainability documents; "run in peer X's region" is only a real control if
   *something* could actually schedule there. I can model it as a counterfactual and say
   so — but you should decide whether that is a result or a thought experiment before I
   spend two sessions on it.
   - advisory, but spend the least on it as you choos best. also reframe all these questions and results to be more human like and easier to understand.

5. **Marginal-emissions data (WP-10): this now looks unbuildable — do you accept that?**
   Verified 2026-09-01: Electricity Maps discontinued marginal signals in January 2025,
   NESO publishes average only, and WattTime's paid MOER never names Great Britain on any
   page I could fetch. Unless you know of a source I could not find, WP-10 becomes a
   written limitation rather than a re-scored result. I will not manufacture a proxy
   series.
   - yes acceptable but could change.

6. **How much does the human-cost number matter to you?** 545.7/853 approvals over the
   window is currently reported as a cost. If the intended story is "governance is
   affordable", that number deserves its own sensitivity analysis (what happens if
   deferring blocked work is automatic — already computed) and possibly its own arm. If
   it is incidental, leave it.
   - try to introduce a model where only critical work is governed by hitl and the rest could be automated more by some rules or something.

7. **Should I pursue the herding arm (WP-12) as the headline follow-up?** It is the one
   thing here the field has named but not measured — CarbonScaler explicitly declares it
   out of scope, CarbonFlex treats it as a within-cluster capacity problem only, and this
   package already has a partial measurement (R11) plus the gate that would control it.
   It is also the most speculative: 2 sessions, and the model design (how many independent
   actors, sharing what signal, with what capacity) is a research choice I should not make
   alone. Worth it, or stay corrective?
   - yes , make all inventions and innonvative and not treated anndreseached things.

8. **Do you want the BDD layer at all?** It is real work (WP-6, 1.5 sessions) and it
   duplicates coverage that fitness functions already provide. Its value is *readability
   by non-programmers* — reviewers, standards people, a regulator. Worth it only if
   someone in that category will actually read it. Tell me if not and I will drop it and
   put the effort into WP-4 and WP-9 instead.
   - might be useful also for me or others, yes, as simple as possible but complete.

---

## 8. What will not change

- **The submitted article is never edited.** Every divergence found by the audit or
  produced by this roadmap is recorded in the README's *Corrections* section and in the
  manuscript's revision notes — never by silently changing the paper.
- **Every number in this repository stays bound to `results/`.** F12 enforces it across
  92 registered claims in 11 documents; anything this roadmap produces gets registered
  the same way.
- **Every experiment stays deterministic and offline-reproducible.** Fixed seeds,
  committed traces, byte-identical re-runs, no live network in CI.
- **No result is stated that a reader cannot re-derive from this repository.**
