# The whole system, in plain words

One page for anyone — a colleague, a reviewer, a regulator, a manager. **The short
of it:** a small governor with five verdicts, sitting behind a real enforcement
gate, cuts carbon on real grid data; systems that publish their footprint at a
standard address let *other* systems govern themselves on it — a feedback loop
between organisations that nobody had measured before; and the loop itself was
run, end to end, on real documents. Below: what the invention is, what was
measured, and what is honestly still open. Every headline number on this page is checked automatically against
the files in [`results/`](../results/) by `npm test`; if a checked number drifts
from the evidence, the build fails.

## The invention

Websites already publish machine-readable files at well-known addresses —
`robots.txt` for crawlers, `security.txt` for security contacts. This work does the
same for sustainability: **every system publishes a small standard document at
`/.well-known/sustainability-data` saying how much energy it used and what its
emissions were — and other systems read those documents and change their own
behaviour because of them.** Publish, read, adapt, publish again: a feedback loop
*between* organisations, not inside one. No published system today closes that loop
across organisational boundaries; that gap — checked by trying hard to refute it —
is the claim to novelty ([SEARCH-PROTOCOL.md](SEARCH-PROTOCOL.md)).

Inside each system sits a small governor. Before any significant action runs, it is
gated: the governor compares the day's carbon spend (plus this action's estimate)
against a daily budget and answers with one of **five verdicts** —
**allow** (run), **degrade** (run smaller, or wait for a cleaner hour),
**escalate** (a person must say yes), **block** (refused; a person may permit the
smaller fallback), **terminate** (refused absolutely; nobody can override it).
The worst applicable verdict always wins, anything malformed refuses rather than
allows, and every decision lands in a tamper-evident audit log.

## What is real, what is simulated

- **Real:** the enforcement gate and audit log (shipped code, `kaiban-distributed`,
  imported not mocked); the published documents and their format checks; the
  Great-Britain grid-carbon traces; the live measurements of the reference gateway.
- **Simulated:** the agent workload (one real captured workflow trace is replayed
  beside it as a granularity control — WP-15), the EV fleet, the human approver, the peer
  systems — all seeded, so every result reproduces byte-for-byte.
- **Designed, not built:** the wiring to a real approval board; a trusted meter
  (the contract exists — [ports/METERING.md](ports/METERING.md) — the traces stand
  in for the hardware).

The submitted IEEE Software article is frozen at tag `v1.0.0`; everything since is
additive and every divergence is recorded in the [CHANGELOG](../CHANGELOG.md) and
the README's corrections pointer.

## What was measured (and what it honestly means)

- **The safety properties hold in shipped code.** 13 architecture fitness functions,
  15,037 cases, all green — worst-verdict-wins, fail-closed, humans bound to the top
  rungs, `terminate` never overridable, tampering detected.
- **The governor cuts carbon — partly by doing less work.** At an 80% budget it
  saves −16.45% (winter) / −20.27% (summer) versus always-run. The exact attribution:
  in winter 67.7% of the saving comes from running work smaller, 25.8% from moving it
  to cleaner hours, 6.5% from dropping it. Read savings next to completion rates,
  never alone.
- **Scheduling alone is nearly free carbon.** A plain "run at the cleanest
  forecast hour" objective at the same settings as naive threshold-deferral reaches
  −6.62% / −8.54% where the threshold gets −1.54% / −2.97% — and a perfect signal
  would add almost nothing more (0.5–2.4 points below the theoretical ceiling).
- **EV charging:** 32.51% / 16.04% of session emissions avoided purely by shifting
  *when* a full charge starts — never how much, and every car charges fully; a
  refusal never withholds power ([features/actuation.feature](../features/actuation.feature)).
- **Rules can replace rubber-stamps.** One standing rule ("blocked-but-deferrable
  work may defer") cuts human decisions from 545.7 to 442.9 (winter) and 853 to 637
  (summer) per 28 days with *identical* emissions — authority moved, nothing else.
- **Reading stale documents costs real carbon.** At today's measured real-world
  publication cadence (documents ~23 days old) the closed loop pays 83.3 g/kWh
  against 78.51 at runtime cadence: +6.1% for acting on old news.
- **The loop's best signal is load, not intensity.** A peer's published
  carbon-intensity is its own *achieved* intensity — an optimised peer always looks
  clean — while its energy consumption actually says "the shared resource is busy".
  On the real committed documents, intensity appears on 3/12, energy on 9/12.
  That is a concrete recommendation for the draft standard: **publish load.**
- **We tested our own ideas, and both failed.** The conjecture that a paced budget
  doubles as an anti-herding stagger is wrong in this model class (a binding budget
  sheds work or reshuffles it), and so is the follow-up conjecture that
  capacity-based verdicts would spread the crowd — built and measured (WP-12b,
  ADR-019), they concentrate instead. Both are recorded as disproven in
  [results/loop.md](../results/loop.md); this work claims no anti-herd property for
  the gate.

## What is still open

The loop is closed in **shape and mechanism, not in society**: no independent
organisation publishes into the plane yet (limitation R5) — adoption, not
technology, is the missing half. The full honest list is
[LIMITATIONS.md](LIMITATIONS.md) (R1–R18); the remaining work, with effort
estimates, is [ROADMAP.md](ROADMAP.md) §5–6.

## Check everything yourself

```bash
npm install && npm test
```

That runs 89 adapter unit tests, the 13 fitness functions through the real gate
(15,037 cases), six plain-English feature specs executed against the real code, and
a checker that re-verifies every headline number on this page —
against `results/` — and a check that every link in these pages resolves. The diagrams of how it all moves are in
[architecture/DYNAMICS.md](architecture/DYNAMICS.md).
