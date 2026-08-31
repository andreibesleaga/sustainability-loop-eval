# C4 diagrams

Six pictures of the same system, from far away to close up. Each one has a
Mermaid source file (`.mmd`) and a rendered image (`.png`). The pictures are the
same thing the words say; if they ever disagree, the code wins.

| File | Level | What it shows |
|---|---|---|
| [`c4-context.mmd`](c4-context.mmd) · [`.png`](c4-context.png) | C4 level 1 — context | The governed service, its peers' published documents, the gateway, the grid data source, the human approver reached through **this package's** human port, and the agent runtime that ships the gate |
| [`c4-container.mmd`](c4-container.mmd) · [`.png`](c4-container.png) | C4 level 2 — containers | The parts inside this repository, plus the kaiban-distributed gate and the two external APIs |
| [`c4-component.mmd`](c4-component.mmd) · [`.png`](c4-component.png) | C4 level 3 — components | The governor core, the gate adapter, the human port, the fitness properties and the import-graph scanner, the policies and their trace plumbing, the shared leaf utilities, the measurement, the demos |
| [`runtime-governed-decision.mmd`](runtime-governed-decision.mmd) · [`.png`](runtime-governed-decision.png) | Runtime | One action, start to finish: agent, gate, validator, governor, verdict, the harness, the human, the audit — with all five rungs drawn separately |
| [`runtime-simulated-day.mmd`](runtime-simulated-day.mmd) · [`.png`](runtime-simulated-day.png) | Runtime | One simulated day in `simulation/run.js` |
| [`loop-overview.mmd`](loop-overview.mmd) · [`.png`](loop-overview.png) | Concept | The Cybernetic Sustainability Loop: publish, sense, decide, gate, human, act, publish again |

**Solid and dotted edges.** A solid arrow is an import or a call that exists in
this repository. There are two dotted arrows. In the component diagram, one is
labelled as conceptual: the measured documents feed the *signal* the demo reads, but
`dataplane/` and `demo/` do not import each other, and F7 would fail if they did. In
the context diagram, the peers' "read its document in turn" edge is dotted because it
is the loop-closing edge nothing in this package exercises (limitation R12).

## How the images were made

```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
npx --yes -p @mermaid-js/mermaid-cli mmdc -i c4-context.mmd -o c4-context.png -b white -s 2
```

Repeat for each file — `-b white -s 2` for every one, so the six pictures stay
the same size and background. If you edit a `.mmd`, re-render its `.png` in the
same commit so the two never drift apart.

## A note on the C4 syntax

Mermaid has native `C4Context` / `C4Container` / `C4Component` keywords. In the
renderer used here they stack every box into a single tall column with the
relationship labels written on top of each other, which is unreadable. The three
C4-level diagrams are therefore drawn as ordinary flowcharts, with the C4 role of
each box (person, system, external, container, component) written into its label.
The information is the same; only the drawing engine differs.
