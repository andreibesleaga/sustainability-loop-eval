# The spatial advisory — specification

> **At a glance.** The loop can already say *where* as well as *when*: this page
> specifies the advisory that recommends a region and window from peer-published
> signals, prices the move, records the recommendation, and never pretends to move
> the work itself.

WP-4 (`docs/ROADMAP.md` §5). Modeled on `docs/ports/FORECAST.md` and
`docs/ports/METERING.md`, the template the port contracts follow. One page: what
the advisory promises, what it carries, what it must never do, the measured
reality, and how an implementation proves conformance. This is **not** a seventh
port — it is a specified *use* of the forecast port's regional signal (C5 in
`docs/ROADMAP.md` §3d), sitting downstream of `forecast.regional()` and upstream
of the gate.

## Purpose

Turn "where" into an **advised** dimension, the way the forecast port already
turns "when" into one. The owner's decision (`docs/ROADMAP.md` §7, the WP-4 row):
*"the loop recommends a region, records the recommendation in the audit chain,
and nothing pretends to move work."* The advisory consumes peer-published
regional signals (`forecast.regional(id, slot)`, already contracted in
`docs/ports/FORECAST.md`) and produces a **recommendation** — a value a human or
a downstream system may act on — never an action itself. Nothing in this
package, and nothing this specification permits, moves a car, a workload, or a
watt between regions.

## The advisory object

A conforming recommendation is computed as `simulation/routing.js`'s `e6()`
computes it today (argmin over regions × start windows, per session) and
carries:

- **The recommended region and window** — the `(region, start-slot)` pair the
  argmin selected, e.g. the region name and the charge window's first slot.
- **The signal values compared, and their provenance** — the per-region forecast
  means the argmin scored (`windowMean(region.values, s)` in `routing.js`), each
  tagged forecast-only: Great Britain publishes no regional actual, so every
  candidate's score carries the same provenance stamp (R2). A recommendation
  that does not carry this tag is non-conforming.
- **The movement cost charged** — `moveKWh` × the destination region's intensity
  at the start slot (`routing.js`'s `move = region.name === HOME_REGION ? 0 : m
  * region.values[s]`), folded into the region's score before the argmin runs.
  A recommendation that picks a non-home region without having added this term
  is non-conforming; `moveKWh` itself is swept (0 / 2 / 5 kWh in the reference
  implementation) because it is the honest unknown, not fitted.
- **The alternatives rejected** — the other candidate regions' scores at the
  same window, so a reader can see the margin, not just the winner. **Specified
  here, not implemented today**: `routing.js` computes and discards the
  per-session losing candidates, keeping only aggregate region-share counters
  (`byRegion`, reported as `chosenRegionSharePct` in `results/routing.json`). A
  conforming implementation of *this* object keeps the per-recommendation
  alternative set; today's code keeps only the fleet-wide summary.
- **The audit-chain record** — the recommendation recorded exactly as a gate
  decision is: a payload the `ActionGate` evaluates and the hash-chained
  `AuditLog` (`governor/gate.js`) appends, tamper-evident the same way, subject
  to the same external-anchor gap (`chainAnchor()`/`verifyAnchored()`) and the
  same caveat that an anchor protects only the prefix anchored, not tail
  rewrites after it. **Specified here, not implemented today**: `routing.js`
  never calls `makeGate`/`gated`/`AuditLog` — it is a pure calculus module, in
  the same style as `simulation/bounds.js`, computing the recommendation and
  writing only `results/routing.json`/`.md`. Wiring the recommendation through
  `gated()` as a `payload` (e.g. `{ tool: "spatial-advisory", recommendedRegion,
  window, moveKWh, estimatedGramsCO2e }`) so it lands in the same `AuditLog` as
  every other gated decision is open work, not a shipped behaviour.

## What it must never do

- **Never move work.** The advisory is a recommendation object, not an
  actuation call; no code path in this package sends a vehicle, a workload, or
  a job anywhere. Acting on the recommendation is a separate, human- or
  system-initiated step outside this specification's scope.
- **Never claim actual (non-forecast) regional emissions for Great Britain.**
  R2 stands: the regional endpoints publish no actual, so every cross-region
  comparison is forecast-scored by construction, and a recommendation that
  presents a regional number as measured ground truth is non-conforming.
- **Never silently drop the movement cost.** A recommendation for a non-home
  region computed without the `moveKWh` term is not a recommendation, it is an
  error — the same discipline `routing.js` already enforces in its own argmin.
- **Never present advice as a verdict.** A recommendation is not `allow`,
  `degrade`, `escalate`, `block`, or `terminate`; it has no rung of its own. It
  is an input a validator may read, the same way `decide()` reads
  `estimatedGramsCO2e` (`docs/ports/METERING.md`), never a bypass of the
  ladder.
- **Never bypass the five rungs when advice is acted on.** Acting on a spatial
  recommendation — actually charging, actually running, actually relocating —
  re-enters the normal gate path exactly like any other agent action: worst-verdict-wins,
  fail-closed, `terminate` unoverridable (ADR-006). The advisory sits
  upstream of that decision, not around it.

## Honesty box — the measured reality

E6 (`simulation/routing.js`, `npm run routing`) is forecast-scored, and it is
worth being blunt about why: Great Britain's regional carbon-intensity endpoint
publishes no regional *actual*, only a forecast, so a routed (region, window)
choice can only ever be scored against what was predicted, never against what
happened (R2, `docs/LIMITATIONS.md`). The stay-home arms are additionally
scored on the national actual precisely because that is the one comparison a
reader can check against ground truth — the routed arms have no such check.
`results/routing.md` prints its own warning about this and about the
Goodhart risk (a region whose forecast reads near-zero attracts all the
simulated load), and that self-printed warning is not decorative: it **stays
mandatory** in any conforming implementation's own output, not just in this
package's. Two measured numbers from the committed run illustrate the shape:
the winter ceiling puts the cheapest peer region **54.72% below** the mean peer
signal, and the routed arm at zero movement cost realises **78.01%** of that
opportunity relative to the already-optimal home window — before any
movement cost is charged. Charging a real one (5 kWh) is enough to route
**96.3%** of winter sessions away from home in the reference run, which is the
point: the advisory's honesty depends on the movement cost being priced, not
waived.

## Conformance

An implementation of this specification passes if:

1. **Every recommendation carries the object above** — region, window, the
   compared signal values tagged forecast-only, the movement cost charged, the
   rejected alternatives, and an audit-chain record — with no field silently
   defaulted to zero or omitted.
2. **No recommendation for a non-home region is cheaper on paper than the same
   region's score minus its movement cost** — i.e. the movement-cost invariant
   `routing.js`'s argmin already enforces (`chargeG(region, s) + move`) is
   pinned by a test, not just an eyeballed table.
3. **The forecast-only provenance tag survives to the recommendation object.**
   A test that swaps a region's series for the (non-existent) actual must fail
   loudly rather than silently scoring against it — mirroring the forecast
   port's own "never fall back to the actual series" rule
   (`docs/ports/FORECAST.md`).
4. **Acting on a recommendation is observably gated** — a test drives a
   recommendation through `gated()` and asserts the resulting decision is on
   the five-rung ladder, never a bare pass-through of the advisory.
5. **The ceiling for any spatial claim is the committed bound.** No seeded or
   simulated spatial arm may report a saving above the corresponding value in
   `results/bounds.json`'s `spatial` section (`results.W1.spatial` /
   `results.W2.spatial`); a result that beats its bound is a bug, per the
   refutation-device rule `results/bounds.md` states for every ceiling it
   carries.

Reference calculus: `simulation/routing.js` (`npm run routing`) →
`results/routing.json`, `results/routing.md`. Reference ceiling:
`simulation/bounds.js` (`npm run bounds`) → `results/bounds.json`'s `spatial`
section.
