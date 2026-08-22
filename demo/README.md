# demo/

Two short, honest demonstrations of the loop. Neither is part of the evaluation: no
number in `results/` comes from here. They exist so a reader can see the real gate
make a real decision in ten seconds.

| script | what it does | needs |
|---|---|---|
| `npm run demo` | fetches **one real document** from the live data plane, then asks the **real gate** about three hypothetical agent actions of increasing size and prints each verdict in plain words | network (falls back to a committed fixture and says so) |
| `npm run agent` | asks a **real LLM** (via OpenRouter) to propose one concrete task, prices it against the peer document's carbon intensity, and puts it through the **real gate** — with you as the human on the `escalate` rung | `OPENROUTER_API_KEY`, Node 22.9+ |

## `demo/demo.js`

```
npm run demo
```

Fetches `https://sustainability.up.railway.app/cloudflare.com/.well-known/sustainability-data`
(override with `DEMO_SUBJECT=<domain>`), reads its `carbon-footprint` / `carbon-unit` /
`carbon-intensity-gCO2e-per-kWh` members, builds a governor with a small **illustrative**
daily budget, and asks `governor/gate.js` about three actions. It prints the verdict, what
it means (run / run reduced / ask a human / refuse / stop), the budget spent so far, and
finally `audit.verify()` over the chain of decisions.

**Labels, stated in the output itself:** one real document, one real gate, one invented
budget. If the fetched document publishes no carbon intensity (most real-organization
documents publish an annual footprint instead), the demo says so and falls back to a
clearly-marked illustrative 250 gCO2e/kWh.

## `demo/agent.js`

```
export OPENROUTER_API_KEY=sk-or-...      # or put it in a local .env (gitignored)
npm run agent
```

The same real document, then **one real model call** through OpenRouter
(`https://openrouter.ai/api/v1/chat/completions`, plain `fetch`, no SDK and no new
dependency). The model is asked, as an operations agent for a fictional encoding service,
to return only `{"task", "estimatedKWh", "why"}`. The proposal is priced at
`estimatedKWh × peer carbon intensity`, sent through the real gate, and:

* `allow` / `degrade` → prints that it would run (full / degraded);
* `escalate` → **asks you at the terminal** (`approve? (y/n)`) — the human port, for real;
* `block` / `terminate` → nothing runs.

Then it prints `audit.verify()`. Model: `OPENROUTER_MODEL` if set, otherwise
`anthropic/claude-sonnet-5`; the model name and "via OpenRouter" are printed in the output.

* **Without a key** it prints one line telling you to set `OPENROUTER_API_KEY` and exits 0.
  It never fabricates a model reply.
* `npm run agent` loads a local `.env` via Node's `--env-file-if-exists` (Node **22.9+**).
  `.env` and `.env.*` are in `.gitignore` and must never be committed.
* Non-2xx responses print the status and the API's message (401 → check the key, 402 →
  insufficient credits, 429 → rate limited) and exit 1. If the model's reply is not
  parseable JSON, the raw reply is printed and the run stops.

**Labels:** one real document, one real model call, the real gate; the budget is
illustrative and the proposed task is the model's, not a measurement of anything.

## Architecture

`demo/` is an adapter: it may import `governor/` and `shared/`, never `simulation/`,
`dataplane/` or `fitness/`. Fitness function F7 checks that from the import graph.
