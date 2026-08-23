# demo/

Two short, honest demonstrations of the loop. Neither is part of the evaluation: no
number in `results/` comes from here. They exist so a reader can see the real gate
make a real decision in ten seconds.

| script | what it does | needs |
|---|---|---|
| `npm run demo` | fetches **one real document** from the live data plane, then asks the **real gate** about five hypothetical agent actions of increasing size — sized so every rung of the ladder appears once — and prints each verdict in plain words | network (falls back to a committed fixture and says so) |
| `npm run agent` | asks a **real LLM** (via OpenRouter) to propose one concrete task, prices it against the peer document's carbon intensity, and puts it through the **real gate** — with you as the human on the `escalate` and `block` rungs | `OPENROUTER_API_KEY`, Node 22.9+ |

## `demo/demo.js`

```
npm run demo
```

Fetches `https://sustainability.up.railway.app/cloudflare.com/.well-known/sustainability-data`
(override with `DEMO_SUBJECT=<domain>`, which must look like a domain name and must have a
saved copy under `data/dataplane/docs/` for the offline fallback — the demo says so
plainly if it does not), reads its `carbon-footprint` / `carbon-unit` /
`carbon-intensity-gCO2e-per-kWh` members, builds a governor with a small **illustrative**
daily budget, and asks `governor/gate.js` about five actions. Their sizes are chosen
relative to the budget, not to any particular intensity, so the run walks the whole
ladder — `allow`, `degrade`, `escalate`, `block`, `terminate` — whatever document loads.

It prints the verdict, what it means (the shared wording in `demo/meaning.js`), whether
the action actually ran, the budget spent so far, and finally `audit.verify()` over the
chain of decisions. Actuation goes through `execute()` in `governor/harness.js`: nobody is
at the terminal to approve anything here, so `escalate` and `block` do not run, and
`terminate` would not run even if they did.

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

* `allow` / `degrade` → runs automatically (full / reduced);
* `escalate` → **asks you at the terminal** whether to approve the task as proposed — the
  human port, for real;
* `block` → asks you whether to authorise a **reduced** run (40% of the energy). That is
  the only thing on offer; the task as proposed is not available on this rung;
* `terminate` → nothing runs and **nobody is asked**. No approval can override it.

Every one of those paths goes through `execute()` in `governor/harness.js`, the same
function the simulations use, so the demo cannot be more permissive than the rest of the
package. Anything the model or the document says is stripped of control and ANSI escape
sequences and length-clamped before it is printed or put into the prompt, and the model
call has a 60-second timeout.

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

`demo/` is an adapter: it may import `governor/`, `shared/` and its own folder, never
`simulation/`, `dataplane/` or `fitness/`. `demo/meaning.js` holds the one plain-English
gloss of the five rungs, shared by both scripts so they cannot drift apart. Fitness
function F7 checks all of that from the real import graph, including that both scripts
import `governor/harness.js`.
