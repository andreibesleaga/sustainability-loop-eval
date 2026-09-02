# Dynamic views

The six pictures in [`c4/`](c4/) show what the package *is*. This file shows what it
*does*: one component view of the six ports, two sequence diagrams, one state machine
for the life of a task, and one view of the budget's own dynamics. For a control
system the dynamic view is the interesting one, and until now the package had none
(ROADMAP §4, gap 4; the sequence diagram gap 3 asks for is diagram 3 below).

Every diagram is committed Mermaid source, inline, so it cannot rot silently and needs
no rendering step to read. The conventions are the ones [`c4/README.md`](c4/README.md)
sets: the C4-level view is drawn as a flowchart with each box's role written into its
label, because Mermaid's native `C4Component` renderer stacks the boxes unreadably. As
there: **the pictures are the same thing the words say; if they ever disagree, the code
wins.**

Two labels are used throughout, because the honest reading depends on them:

- **Built** — code in this repository, on the path the scripts actually execute.
- **Designed, not built** — a port or an edge that is specified or shaped here but has
  no adapter on any executed path. Named in the diagram itself, never left to be
  inferred.

| # | Diagram | What it shows |
|---|---|---|
| 1 | [The six ports](#1-c4-level-3--the-six-ports-their-adapters-and-the-gate) | C4 level 3: the governor core, the six ports, every adapter behind them, the real gate, and the data plane |
| 2 | [One E2 gated decision](#2-one-gated-decision-end-to-end-e2) | Task arrival → signal → pacing ratio → rung → gate verdict → approval → execute or defer → metered commit |
| 3 | [One charging session, including publish-back](#3-one-charging-session-including-publish-back-e3--e6--wp-17) | Plug-in → proposal → gate → owner consent → actuation → metered commit → published document → peers read it |
| 4 | [The life of a task](#4-the-life-of-a-task--state-machine) | Arrival → gated → allowed / degraded / deferred / blocked / terminated → executed or dropped |
| 5 | [Budget dynamics](#5-budget-dynamics--the-daily-sawtooth) | The daily sawtooth: spend accumulates, rungs fire at 0.8 / 1.0 / 1.1 / 1.25, midnight resets |

---

## 1. C4 level 3 — the six ports, their adapters and the gate

The hexagon's whole point is that ports compose, so this is the picture of the holes
rather than of the files. Notice that only the **signal**, **human** and **actuation**
ports have adapters on an executed path: the **forecast** port has a written contract
and a conformance adapter that no experiment yet decides with, the **metering** port
has a written contract (`docs/ports/METERING.md`, WP-5) whose reference implementation
is the inlined `exec()`+`commit()` pair — a trusted meter is still what the traces
stand in for, which is exactly what fitness function F13 shows is load-bearing
(R15) — and the **publication** port exists here
only as a document shape inside `simulation/plane.js`. The core in the middle imports
nothing (ADR-003) and the gate it is registered into is the shipped one, not a copy
(ADR-002).

```mermaid
flowchart TB
  NESO["<b>NESO Carbon Intensity API</b><br/><i>external system</i><br/>national actual and regional forecast, every 30 minutes"]
  GWDOCS["<b>Reference gateway</b><br/><i>external system</i><br/>documents at /.well-known/sustainability-data"]
  HUMAN(["<b>Human approver</b><br/><i>person</i><br/>says yes or no on escalate and on block"])

  LIB["<b>loadWindow, generateWorkload</b><br/><i>simulation/lib.js - adapter</i><br/>cached traces. The peer forecast decides,<br/>the national actual scores"]
  FCA["<b>forecastPort</b><br/><i>simulation/forecast.js - adapter, conformance-tested</i><br/>a committed capture, values verbatim,<br/>null past the horizon"]
  MEA["<b>measure, doc-check, logs</b><br/><i>dataplane/ - adapter</i><br/>every live document, five fetches each"]
  APPR["<b>approver adapters</b><br/><i>run.js simulated approver, charging.js owner coin,<br/>demo/agent.js terminal prompt,<br/>run.js standing rule T1 under WP-14</i>"]

  PSIG["<b>SIGNAL port</b><br/>peer and grid readings in<br/><i>built, but no written contract yet</i>"]
  PFOR["<b>FORECAST port</b><br/>when, inside the horizon, will it be cleanest<br/><i>contract in docs/ports/FORECAST.md.<br/>No experiment decides on it yet</i>"]

  subgraph ACTORS["Actuating adapters - each one imports the harness, and F7 checks that"]
    direction LR
    RUN["<b>P0, P1, P1t, P2, P3 policies</b><br/><i>simulation/run.js</i><br/>E2, the agentic workload"]
    CHG["<b>charging sessions</b><br/><i>simulation/charging.js</i><br/>E3, start-time shifting only - ADR-011"]
    DEMO["<b>demo and agent</b><br/><i>demo/demo.js, demo/agent.js</i><br/>one real document, one decision, five verdicts"]
  end
  ROUT["<b>routed charging advice</b><br/><i>simulation/routing.js</i><br/>argmin over region and window. ADVISORY -<br/>not gated, forecast-scored, and it moves no car"]

  PACT["<b>ACTUATION port</b><br/>decisions out<br/><i>governor/gate.js plus each adapter's plan</i>"]

  subgraph HEX["The hexagon - governor/"]
    direction TB
    MG["<b>makeGate, gated, chainAnchor</b><br/><i>governor/gate.js</i><br/>injected deterministic clock. An off-ladder<br/>verdict is normalised to block - ADR-005"]
    VAL["<b>carbonValidator</b><br/><i>governor/carbon-governor.js</i><br/>reads payload.estimatedGramsCO2e"]
    CORE["<b>createCarbonGovernor</b><br/><i>governor/carbon-governor.js</i><br/>decide, commit, reset, verdictFor<br/>imports nothing - ADR-003"]
    HAR["<b>execute</b><br/><i>governor/harness.js</i><br/>allow and degrade run. Escalate and block need<br/>approved === true. Terminate never runs - ADR-006"]
  end

  GATE["<b>ActionGate and AuditLog</b><br/><i>kaiban-distributed 2.0.0, external - the real enforcement point</i><br/>most-severe-wins, fail-closed, hash-chained records - ADR-002"]
  DEC["<b>verdict and one audit record</b><br/>returned to the calling adapter,<br/>which then calls the harness"]

  PHUM["<b>HUMAN port</b><br/>authority in<br/><i>governor/harness.js, built</i>"]
  PMET["<b>METERING port</b><br/>trusted actual grams in<br/><i>contract in docs/ports/METERING.md - the traces<br/>stand in for a trusted meter. R15, F13</i>"]
  PPUB["<b>PUBLICATION port</b><br/>the loop's output edge<br/><i>a document shape in simulation/plane.js,<br/>tested in plane.test.js. No contract page yet</i>"]
  PEERS["<b>Peer systems</b><br/><i>external</i><br/>read the published document as the SIGNAL port<br/>of their own governor - this is where the loop closes"]
  PLANE["<b>publishDocument</b><br/><i>simulation/plane.js - adapter</i><br/>a Draft-shaped document whose mandatory members are<br/>derived from the committed gateway documents at run time"]

  NESO --> LIB
  NESO --> FCA
  GWDOCS --> MEA
  GWDOCS --> DEMO
  HUMAN --> APPR

  LIB --> PSIG
  MEA --> PSIG
  FCA --> PFOR

  PSIG --> RUN
  PSIG --> CHG
  PSIG --> ROUT
  PFOR -.->|designed path - nothing decides on it yet| RUN

  RUN --> PACT
  CHG --> PACT
  DEMO --> PACT
  PACT --> MG
  MG --> VAL
  VAL --> CORE
  MG --> GATE
  GATE --> DEC
  DEC --> HAR

  APPR --> PHUM
  PHUM --> HAR
  HAR -->|the grams actually emitted| PMET
  PMET --> CORE

  HAR --> PPUB
  PLANE --> PPUB
  PPUB -.->|the loop-closing edge, exercised only in plane.js. R12| PEERS

  classDef comp fill:#85bbf0,stroke:#5d82a8,color:#000
  classDef port fill:#438dd5,stroke:#2e6295,color:#fff
  classDef gap fill:#f6d1d1,stroke:#a33,color:#000
  classDef ext fill:#999999,stroke:#6b6b6b,color:#fff
  classDef person fill:#08427b,stroke:#052e56,color:#fff
  class CORE,VAL,MG,HAR,LIB,FCA,MEA,APPR,RUN,CHG,DEMO,ROUT,PLANE,DEC comp
  class PSIG,PHUM,PACT port
  class PFOR,PMET,PPUB gap
  class GATE,NESO,GWDOCS,PEERS ext
  class HUMAN person
```

---

## 2. One gated decision, end to end (E2)

This is `simulation/run.js`'s `runP2` as it actually executes. What to notice: **the
gate is called once, on arrival — the verdict is never re-evaluated at execution time
(ADR-016)**, so one task means one verdict and one audit record, which is what makes
"human decisions per day" a number that means anything. Notice too that the decision is
taken on the *peer forecast* an agent can see while the budget is charged with the
*national actual* of the slot the work really ran in, and that the three middle rungs
choose the same physical action — what separates them is who authorised it (ADR-006,
and WP-14's standing rule T1 for the one case it covers).

```mermaid
sequenceDiagram
  autonumber
  participant SL as Slot loop (simulation/run.js)
  participant SIG as Signal port (cached peer forecast, lib.js)
  participant G as ActionGate (kaiban-distributed 2.0.0)
  participant V as carbonValidator
  participant C as Governor core
  participant L as AuditLog (hash-chained)
  participant X as execute (governor/harness.js)
  participant H as Human port (approver, or standing rule T1)
  participant Q as Deferral queue (in memory)

  Note over SL,C: midnight - the slot index is a multiple of 48
  SL->>C: reset - spent grams back to zero, same daily budget
  SL->>Q: work queued for this slot runs first, at full energy
  loop for each task arriving in this slot
    SL->>SIG: peer signal for the arrival slot
    SIG-->>SL: the mean of the three peers' published forecast
    SL->>G: gated with estimate = task energy x peer signal now
    G->>V: check payload.estimatedGramsCO2e
    V->>C: decide the estimate
    C-->>V: ratio = spent plus this estimate, over the budget, and the rung read off 0.8 / 1.0 / 1.1 / 1.25
    V-->>G: verdict
    G->>L: append one hash-chained record
    G-->>SL: most severe verdict wins, and an off-ladder verdict is re-aggregated as block
    Note over SL,L: the ONLY gate call this task will ever make - ADR-016
    alt allow
      SL->>X: execute - run now, at full energy
    else degrade
      SL->>X: execute - defer if the work can wait, otherwise run now at the degraded fraction
    else escalate or block
      SL->>H: ask for authority - every one of these is counted as a human decision
      H-->>SL: approval with approved === true, by a person or by standing rule T1 on blocked deferrable work
      SL->>X: execute with the approval - the same physical plan degrade would have chosen
    else terminate
      SL->>X: execute with a plan that throws if it is ever called
      X-->>SL: executed false - terminate is not overridable, and nobody was asked
    end
    X->>Q: a deferrable task is paused into the cleanest slot the peer signal predicts before its deadline
  end
  Note over Q,C: a later slot, possibly after midnight
  Q->>X: execute the SAME decision and the SAME approval - no second gate call, no second audit record
  X->>C: commit energy x the national ACTUAL at the slot the work RAN in
  Note over X,C: the metering contract (docs/ports/METERING.md) names that number - the trace stands in for a trusted meter - R15 and F13
  SL->>L: verify the chain at the end of the arm
  L-->>SL: valid, and one record per task
```

---

## 3. One charging session, including publish-back (E3, E6 and WP-17)

The strongest worked example: a physical load, a real deadline, and an owner whose
consent matters. What to notice is the **safety inversion** — a gate refusal never
withholds electricity, only the improvement, because `block` and `terminate` fall back
to charging naively with nobody asked (ADR-006's status note, ADR-011) — and that the
owner is asked *first*, on every rung the gate lets through, because whether to move
somebody's car is a product question, not a gate question. The last four messages are
the loop's output edge: they are exercised in `simulation/plane.js` with modelled
peers, not by `charging.js`, which is precisely limitation R12.

```mermaid
sequenceDiagram
  autonumber
  participant O as Vehicle owner (person)
  participant A as Charging agent (simulation/charging.js)
  participant SIG as Signal port (peer regional forecast)
  participant G as ActionGate and AuditLog (kaiban-distributed)
  participant C as Governor core (one budget per night)
  participant X as execute (governor/harness.js)
  participant CH as Charger (start time only)
  participant P as Publication port (simulation/plane.js)
  participant PE as Peer systems

  Note over A,C: each night - reset, one budget per night
  O->>A: plugged in between 17.00 and 19.00 UTC, must be full by 07.00
  A->>SIG: mean peer signal over every legal three-hour window
  SIG-->>A: a forecast per candidate window
  A->>A: bestStart = argmin of the peer signal, never finishing past the deadline
  opt E6 - routed charging, simulation/routing.js
    A->>SIG: the same argmin over three committed REGIONS as well as windows, plus a movement cost
    Note over A,SIG: advisory only - forecast-scored because GB publishes no regional actual, not gated, and nothing moves a car - R2 and R18
  end
  A->>G: gated with estimate = 20 kWh x the signal over the proposed window, tool shift-charge-start
  G->>C: decide the estimate
  C-->>G: rung from the pacing ratio
  G->>G: append one hash-chained audit record
  G-->>A: verdict
  alt allow, degrade or escalate
    A->>O: ask the owner - a PRODUCT rule, asked on every rung the gate lets through
    O-->>A: consent, or refusal
    A->>X: execute - move the start to bestStart, approved by vehicle-owner
  else block or terminate
    Note over A,O: refused outright - no fallback is offered and nobody is asked
  end
  A->>CH: deliver the full 20 kWh over six slots from the chosen start
  Note over CH: start time only - no discharge, no vehicle-to-grid, no partial charge - the car always charges, ADR-011
  A->>C: commit energy x the national ACTUAL over the window that was charged - on every session, shifted or not
  Note over A,P: end of the reporting period - the publish-back edge, WP-17
  A->>P: energy consumed and grams emitted for the period
  P->>P: build the Draft-shaped document - updated, reporting-period, energy-consumption, carbon-footprint, carbon-intensity and the rest of the mandatory member set, which is derived from the committed gateway documents at run time
  P->>PE: serve it at /.well-known/sustainability-data
  PE->>SIG: peers read that document as their own control signal at the next publication cadence
  Note over P,SIG: E3 itself does not publish - plane.js does, with modelled peers - the format is real, third-party publishers are not - R5 and R12
```

---

## 4. The life of a task — state machine

One task, from arrival to executed or dropped, exactly as `runP2` moves it. What to
notice: **stopped, refused and paused are three different things** — `terminate` drops
the task with nobody asked and no approval able to lift it, `block` refuses what was
proposed but lets an authority permit the fallback, and a deferred task is neither, just
paused (ADR-006). The transition out of *Deferred* carries no gate call: it re-uses the
decision and the approval the task was already granted on arrival (ADR-016), which is
also how work committed today can belong to yesterday's decision.

```mermaid
stateDiagram-v2
  state "Arrived in its slot" as Arrived
  state "Gated once, on arrival" as Gated
  state "Running now, full energy" as RunNow
  state "Running now, reduced" as RunReduced
  state "Waiting for authority" as Waiting
  state "Deferred - paused, authorised, not refused" as Deferred
  state "Executed - actual grams committed" as Executed
  state "Dropped" as Dropped

  [*] --> Arrived
  Arrived --> Gated: estimate = task energy x the peer signal now
  Gated --> RunNow: allow
  Gated --> Deferred: degrade, and the work can wait
  Gated --> RunReduced: degrade, and it cannot
  Gated --> Waiting: escalate, or block
  Gated --> Dropped: terminate - nobody is asked, and no approval lifts it
  Waiting --> Deferred: authorised, and the work can wait
  Waiting --> RunReduced: authorised, and it cannot
  Waiting --> Dropped: no approval with approved === true
  Deferred --> RunNow: its chosen slot arrives - NOT re-gated
  RunNow --> Executed: commit the national actual at the slot it ran in
  RunReduced --> Executed: commit the national actual at the slot it ran in
  Executed --> [*]
  Dropped --> [*]

  note right of Waiting
    Authority is a person for escalate,
    for block on work that cannot wait,
    and - under WP-14's standing rule T1 -
    the rule itself for block on deferrable
    work. The rule changes who authorised
    it and nothing else, ADR-006.
  end note

  note right of Deferred
    The queue is in memory, for one
    simulated arm. A deferred task may
    cross midnight and then commit
    against the next day's budget, which
    is the pacing-not-capping property,
    ADR-016 and R3.
  end note
```

---

## 5. Budget dynamics — the daily sawtooth

The controller in one picture: one number, four thresholds, and a hard reset. What to
notice is that `degrade` fires at 0.8, *before* the budget is spent — the governor paces
rather than caps (ADR-004), which is also why days can still end over budget (R3) — and
that the ratio the ladder reads is evaluated once, at arrival. That last point is what
makes the arrival hour part of the verdict: the same task is allowed at 03.00 and
refused at 23.00 of the same day (R16), and midnight is a discontinuity the work itself
never sees.

```mermaid
flowchart TB
  RESET["<b>Midnight - the reset</b><br/><i>slot index a multiple of 48</i><br/>spent grams back to zero; the daily budget is unchanged<br/>and the deferral queue is NOT reset"]

  subgraph DAY["One day - the pacing ratio climbs as grams are committed"]
    direction TB
    B1["<b>allow</b><br/>ratio below 0.8<br/>runs now, at full energy"]
    B2["<b>degrade</b><br/>0.8 up to 1.0<br/>fires BEFORE the budget is spent<br/>this is pacing, not capping - ADR-004"]
    B3["<b>escalate</b><br/>1.0 up to 1.1<br/>a human decides, and the action then does<br/>what degrade would have done"]
    B4["<b>block</b><br/>1.1 up to 1.25<br/>refused; an authority may permit the<br/>reduced or deferred fallback and nothing else"]
    B5["<b>terminate</b><br/>1.25 and above<br/>nothing runs and nobody is asked"]
    B1 --> B2 --> B3 --> B4 --> B5
  end

  RATIO["<b>the pacing ratio</b><br/>spent grams plus THIS action's estimate,<br/>over the period budget - evaluated once, at arrival"]
  COMMIT["<b>commit</b><br/>the grams actually emitted at the slot the work RAN in,<br/>national actual - not the estimate the decision used.<br/>This is the negative feedback that closes the inner loop."]
  CARRY["<b>work that crossed midnight</b><br/>gated yesterday, committed today, never re-gated -<br/>so a day can open already carrying spend<br/>it never decided on - ADR-016"]
  OVER["<b>consequence</b><br/>days can still end over budget - R3<br/>and the arrival hour is part of the verdict - R16"]

  RESET -->|a new day opens at ratio zero| B1
  RATIO --> B1
  COMMIT -->|raises the ratio the NEXT decision reads| RATIO
  B1 --> COMMIT
  B2 --> COMMIT
  B3 --> COMMIT
  B4 --> COMMIT
  CARRY --> COMMIT
  B5 -->|and at the next midnight the ratio falls back to zero - the sawtooth| RESET
  DAY --> OVER

  classDef rung fill:#85bbf0,stroke:#5d82a8,color:#000
  classDef stop fill:#f6d1d1,stroke:#a33,color:#000
  classDef mech fill:#438dd5,stroke:#2e6295,color:#fff
  classDef note fill:#eeeeee,stroke:#888,color:#000
  class B1,B2,B3,B4 rung
  class B5 stop
  class RESET,RATIO,COMMIT,CARRY mech
  class OVER note
```

---

## Where each diagram comes from

| Diagram | Grounded in |
|---|---|
| 1 | `governor/carbon-governor.js`, `governor/gate.js`, `governor/harness.js`; the adapters in `simulation/`, `dataplane/`, `demo/`; the port list in ROADMAP §3d; the contracts in `docs/ports/FORECAST.md` and `docs/ports/METERING.md`; ADR-002, ADR-003, ADR-005, ADR-006 |
| 2 | `runP2` in `simulation/run.js`, `gated()` in `governor/gate.js`, `execute()` in `governor/harness.js`; ADR-004, ADR-005, ADR-006, ADR-016; WP-14's `tierRules` branch |
| 3 | `governed()` and `bestStart()` in `simulation/charging.js`, `e6()` in `simulation/routing.js`, `publishDocument()` in `simulation/plane.js`; ADR-006, ADR-011; R2, R5, R12, R18 |
| 4 | The plan selection and the deferral queue in `runP2`; `execute()`'s three-line rule; ADR-006, ADR-016 |
| 5 | `verdictFor()` and `DEFAULT_RUNGS` in `governor/carbon-governor.js`, the midnight `reset()` in `runP2`; ADR-004, ADR-016; R3, R16 |
