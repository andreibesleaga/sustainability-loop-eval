# ADR-018 — The agent demo calls OpenRouter over plain HTTPS, default `anthropic/claude-sonnet-5`

- **Status:** Accepted
- **Date:** 2026-08-23

## Context

`npm run agent` shows the one thing nothing else can: a real model proposing an
action, the same real gate deciding, and a real person answering the human port.
It must not cost a second dependency or a build step.

## Decision

POST to OpenRouter's chat-completions endpoint with `fetch` and an
`AbortSignal.timeout`. No vendor SDK. Default model `anthropic/claude-sonnet-5`,
overridable with `OPENROUTER_MODEL`; key from `OPENROUTER_API_KEY` via Node's
`--env-file-if-exists`. Without a key the script explains and exits.

One endpoint reaches many providers, so a reader swaps a model with one
environment variable and the demo reads as no vendor's endorsement.

Model output, and anything read from a fetched document, is treated as untrusted:
control and ANSI characters stripped, length clamped, before printing or
interpolating into a prompt.

## Consequences

- The only command that spends money. Never part of `npm test` or `npm run all`.
- Its output varies between runs, which is fine because it produces no result.
- The model proposes; the gate decides; the human answers. Enforced by the same `governor/harness.js` everything else uses.

## Alternatives considered

- **A vendor SDK.** A second dependency and a coupling to one provider.
- **A local model.** Asks every reader to install one first.
