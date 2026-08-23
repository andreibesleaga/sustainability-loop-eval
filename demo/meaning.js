// SPDX-License-Identifier: GPL-3.0-only
/**
 * demo/meaning.js — one plain-English gloss of the five rungs, shared by demo.js and
 * demo/agent.js so the two demos can never drift from each other or from ADR-006.
 *
 * MEANING is the CORE rule — what governor/harness.js does with each rung, regardless
 * of domain. DEMO_ACTION is what the interactive demos then do about it: who, if
 * anybody, gets asked.
 */

/** What the rung means for actuation, everywhere in this package. */
export const MEANING = {
  allow: "runs as planned — authorised automatically",
  degrade: "runs in reduced form — authorised automatically",
  escalate: "a human decides; it runs only with an explicit approval",
  block: "withheld; a human may authorise a reduced fallback, and nothing else",
  terminate: "nobody can authorise it — nothing runs",
};

/** What the demos do at the terminal for each rung. */
export const DEMO_ACTION = {
  allow: "would run (full)",
  degrade: "would run (reduced)",
  escalate: "asks you: approve the task as proposed? (y/n)",
  block: "asks you: authorise a REDUCED run instead? (y/n) — nothing else is on offer",
  terminate: "stopped — nothing runs, and nobody is asked",
};

/** Rungs a human is asked about at all. `terminate` is deliberately absent. */
export const PROMPTS_HUMAN = new Set(["escalate", "block"]);
