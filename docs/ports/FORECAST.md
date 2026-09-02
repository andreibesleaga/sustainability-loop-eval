# The forecast port — contract

> **At a glance.** A real, contract-first forecast port — published forward
> forecasts served verbatim from a committed live capture, refusals instead of
> inventions past the horizon, full provenance, and a conformance suite an adapter
> must pass.

The first of the six port contracts (ROADMAP §4 Gap 2; the template the others
follow). One page: what the port promises, what it may assume, what it must never do,
and how an adapter proves conformance.

## Purpose

Turn "how clean is it *now*" into "when, within the next N hours, will it be
cleanest" — the input an argmin scheduler (P3/E3/E6) actually needs. The port carries
**published forward forecasts**; it never fabricates one.

## Interface

An adapter provides:

```js
{
  capturedAt,          // ISO instant the forecast was fetched (provenance, required)
  horizonSlots,        // how far ahead the series extends, in 30-min slots
  source,              // { provider, urls[] } — where every value came from
  national(slot),      // forecast gCO2/kWh for `slot` offsets from capture; null past horizon
  regional(id, slot),  // same, for a NESO region id; null if unavailable
}
```

- Slots are 30-minute settlement periods, aligned to the provider's grid.
- Values are what the provider published, verbatim — no smoothing, no gap-filling
  beyond what the provider itself did, and any provider gap is surfaced as `null`,
  never interpolated silently.

## What the port may assume

- The provider publishes CO2 (generation-average, operational) labelled per its own
  methodology; unit relabelling (the gCO2e caveat, ADR-015/R17) happens in the
  consumer's documentation, not in the data.
- The forecast is *advice about the future*: consumers must treat `capturedAt` as the
  decision time and never mix values captured at different times inside one decision.

## Staleness

A forecast's age is data, not decoration: `capturedAt` is mandatory, and a consumer
can always compute how old the series is. What no code path in this package does —
stated here so nobody assumes otherwise — is act on that age: **no rung is made
stricter because a signal is stale**. Signal age is measured and reported, never
acted on; a maximum-age policy is a consumer's decision, and WP-17's measured
staleness cost (+6.1% at the real-world cadence) is the number that decision
should weigh.

## What the port must never do

- **Never serve a backfilled "forecast"** (a series fetched after the fact — that is
  the historical endpoint's data and carries an unknown issue horizon; the MAPE
  measured in `results/bounds.md` documents exactly this trap).
- **Never fall back to the actual series.** A missing forecast is a refusal
  (`null`), and the governor's fail-closed behaviour handles refusals; substituting
  ground truth would hand the scheduler an oracle (F8/F9's decide-vs-score split).
- **Never touch the network in tests.** Captures are taken manually by
  `node simulation/fetch-forecast.js`, committed under `data/forecast/`, and every
  test runs offline against the committed fixture.

## Conformance

An adapter passes if: (1) it loads a committed capture and answers `national()` /
`regional()` for every slot inside the horizon with the fixture's exact values;
(2) it returns `null` outside the horizon and for regions absent from the capture;
(3) its `capturedAt`/`source` provenance matches the fixture. `simulation/forecast.js`
is the reference adapter and `simulation/forecast.test.js` is the conformance suite.

## Grading the forecast (the prospective protocol)

The committed traces' forecast column has an **unknown issue horizon** (see
`results/bounds.md`), so a true fw48h error needs *prospective* capture:

1. `node simulation/fetch-forecast.js` — captures national + peer-region fw48h now.
2. Wait for the horizon to settle (≥ 48 h).
3. `node simulation/fetch-forecast.js --grade data/forecast/<capture>.json` — fetches
   the settled national actuals for the captured window and writes MAPE/MAE/bias *by
   lead time* beside the capture. Regional forecasts cannot be graded (no regional
   actual exists — limitation R2), and the tool says so rather than pretending.

Each graded capture is one honest datapoint of "how good is the public forecast at
lead L"; accumulate captures to make the curve.
