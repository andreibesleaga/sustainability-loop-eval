# What changed after submission — the addendum (WP-11)

The article was submitted on 22 August 2026 and is frozen at the `v1.0.0` tag;
every number it prints still reproduces from that tag, byte for byte. This page is
the short, honest account of everything the evaluation package did *afterwards* —
written for a revision letter, a follow-up paper, or a reader deciding how much to
trust the repository. It deliberately quotes no figures: every number lives, once
and checked, in the pages it links.

## What was built (all of it additive — the paper's snapshot never moved)

- **Every remaining port got real.** The forecast port has a contract, a committed
  live capture and a conformance-tested adapter; the metering port has a contract
  stating exactly what F13 proves; the publication port — the invention's defining
  edge — is exercised end to end. ([ports/](ports/), [FITNESS-FUNCTIONS.md](FITNESS-FUNCTIONS.md))
- **The loop was closed with real documents.** N simulated systems publish and
  consume documents in the gateway's own shape; reading stale documents costs
  measurable carbon, and the member a control loop most needs turns out to be
  *load*, not intensity — a concrete recommendation for the draft standard.
  ([results/plane.md](../results/plane.md))
- **The specification became executable and visible.** Six plain-English feature
  files a regulator could read, run against the real code on every `npm test`;
  five dynamic diagrams of how the system actually moves; a one-page spatial
  advisory spec. ([features/](../features/), [architecture/DYNAMICS.md](architecture/DYNAMICS.md),
  [SPATIAL-ADVISORY.md](SPATIAL-ADVISORY.md))
- **The evaluation grew teeth.** A chaos suite drives the data-plane hardening
  with hostile input and pins the weaknesses it found as findings; a real captured
  workflow trace replays as a granularity control with its own equal-share
  counter-arm; renderer-identity tests make results-prose drift impossible to
  hide; and the registry that binds every hand-typed number to `results/` now
  covers every document, the changelog included. ([OVERVIEW.md](OVERVIEW.md))

## What was disproven — by this package, about its own ideas

Both of our anti-herd conjectures failed under measurement, and the repository
says so rather than defending them: a paced budget sheds or reshuffles work
instead of spreading it, and capacity-acting rungs concentrate what they keep.
The package claims **no anti-herd property for the gate**; what it does claim is
that running that comparison at all is, to the checked record, unprecedented.
([results/loop.md](../results/loop.md), [adr/ADR-019](adr/ADR-019-capacity-rungs.md))

## What was corrected

Every divergence from the article — down to a re-rounded decimal and the core
file growing during hardening — is listed in
[RESEARCH.md's corrections section](../RESEARCH.md#corrections-relative-to-the-submitted-article-v100),
and the full accounting of which numbers changed and which did not is the
[CHANGELOG](../CHANGELOG.md). A three-lens audit (documentation consistency,
adversarial code review, paper alignment) ran over the finished package; its
reports and the complete list of fixes are archived in
[archive/audit-2026-09-02/](../archive/audit-2026-09-02/).

## What remains open, honestly

No independent organisation publishes into the data plane yet — the loop is
closed in shape and mechanism, not in society; the workload and approvers remain
synthetic (one real trace runs beside them as a control); the regional signal is
forecast-only; and the herding problem the loop itself creates has no gate-side
solution here. The canonical list is [LIMITATIONS.md](LIMITATIONS.md), R1–R18.

*One page for anyone who wants the whole system in plain words:*
[OVERVIEW.md](OVERVIEW.md).
