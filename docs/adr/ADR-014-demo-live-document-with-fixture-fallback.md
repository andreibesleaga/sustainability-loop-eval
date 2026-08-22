# ADR-014 — The demo reads one live document, with a fixture fallback

- **Status:** Accepted
- **Date:** 2026-08-22

## Context

The full evaluation takes several commands and produces tables. Someone meeting
the idea for the first time needs one command that shows the whole loop in a few
seconds: a real published document, a real decision, a real verdict.

But a demo that fails on a train, behind a proxy, or after the gateway moves is a
demo that does not work.

## Decision

`npm run demo` fetches one real document from the public gateway, reads its
carbon-intensity figure, turns it into an estimate for one action, sends that
action through the real `kaiban-distributed` gate, and prints the verdicts.

If the network is unavailable, it falls back to a committed fixture under
`data/dataplane/docs/` and says clearly that it is using the fixture. It never
pretends a cached document was fetched live.

`npm run agent` is the same shape with a real language model proposing the action.
It needs `OPENROUTER_API_KEY` in the environment; without one it explains that and
exits rather than failing obscurely. When the verdict is `escalate`, it asks the
person at the terminal to approve — the human port, with an actual human in it.

## Consequences

- Thirty seconds from `npm install` to a real verdict.
- The demo is honest offline as well as online, because the fallback announces itself.
- The demo is a demonstration, not evidence. No number from it appears in the article or in `results/`.
- `npm run agent` is the only part of the package that needs an API key, and the only part where a real human answers the human port.

## Alternatives considered

- **A recorded transcript.** Always works, proves nothing.
- **Live only, no fallback.** Honest, and broken for anyone offline.
- **A fixture only.** Reliable, and it would not show that the signal plane is actually live.
