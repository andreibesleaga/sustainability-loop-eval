# shared/

Two leaf modules with no dependencies of their own, used by every other folder so
that a given number means one thing across the whole package:

| file | what it is |
|---|---|
| `prng.js` | the single seeded PRNG (mulberry32) plus `pick` / `randInt` / `randFloat` / `poisson`. Every random draw in this repository comes from here, so a seed fully determines a run. |
| `stats.js` | the single definition of `mean` / `sd` (sample, n-1) / `quantile` (linearly interpolated) / `median` / `p95` / `pearson`, plus the rounding helpers used when writing results JSON. |

They are deliberately *not* part of the governance hexagon: `governor/carbon-governor.js`
imports nothing at all, and `governor/gate.js` imports only `kaiban-distributed` and the
core. The adapters (`simulation/`, `dataplane/`, `demo/`) and the fitness suite may import
`shared/`, never each other — checked by fitness function F7.
