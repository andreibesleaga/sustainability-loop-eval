// SPDX-License-Identifier: GPL-3.0-only
/**
 * fitness/import-graph.js — the static-analysis half of fitness function F7.
 *
 * Reads the repository's own source files and reports which module specifiers each
 * file imports. Kept separate from props.js because this is filesystem/text analysis,
 * not a runtime property of the gate; F7 in props.js turns its output into a verdict.
 *
 * The scanner is deliberately per-statement rather than one big regex over the file:
 * an earlier version used `/^\s*import[\s\S]*?from ["'](...)["']$/gm`, which could
 * span from one statement into a later one and quietly miss forms it did not model.
 * This version comment-strips first, then matches the four ESM forms exactly:
 *
 *   import x from "s"      import {a, b} from "s"      import * as n from "s"
 *   import "s"             (side-effect only)
 *   export ... from "s"    export * from "s"
 *   import("s")            (dynamic, string-literal specifier only)
 *
 * A dynamic import whose specifier is a variable cannot be resolved statically and is
 * reported as the sentinel "<dynamic>" so a reader of F7's output knows it is there.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const CORE = "governor";
export const SHARED = "shared";
export const ADAPTERS = ["simulation", "dataplane", "demo"];

/**
 * Remove line and block comments without touching the contents of string or template
 * literals (so a "https://..." inside a string is never mistaken for a comment).
 * Comment bodies are replaced by spaces so every offset stays where it was.
 */
export function stripComments(src) {
  let out = "";
  for (let i = 0; i < src.length; i++) {
    const c = src[i], d = src[i + 1];
    if (c === "/" && d === "/") {
      while (i < src.length && src[i] !== "\n") { out += " "; i++; }
      out += "\n";
    } else if (c === "/" && d === "*") {
      out += "  "; i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) { out += src[i] === "\n" ? "\n" : " "; i++; }
      out += "  "; i++;
    } else if (c === '"' || c === "'" || c === "`") {
      out += c; i++;
      while (i < src.length && src[i] !== c) {
        if (src[i] === "\\") { out += src[i]; i++; }
        if (i < src.length) { out += src[i]; i++; }
      }
      out += src[i] ?? "";
    } else {
      out += c;
    }
  }
  return out;
}

// The middle clause of a static import/export may span lines but can contain neither a
// quote nor a semicolon, which is what stops a match from running past its statement.
const STATIC_FROM = /\b(?:import|export)\s+[^;'"`]*?\bfrom\s*(["'])([^"'\n]+)\1/g;
const BARE_IMPORT = /\bimport\s*(["'])([^"'\n]+)\1/g;
const DYNAMIC = /\bimport\s*\(\s*(?:(["'])([^"'\n]+)\1)?/g;

/** Every module specifier `file` imports, in no particular order, deduplicated. */
export function importsOf(file) {
  const src = stripComments(fs.readFileSync(file, "utf8"));
  const specs = [];
  for (const re of [STATIC_FROM, BARE_IMPORT]) {
    re.lastIndex = 0;
    for (let m; (m = re.exec(src)); ) specs.push(m[2]);
  }
  DYNAMIC.lastIndex = 0;
  for (let m; (m = DYNAMIC.exec(src)); ) specs.push(m[2] ?? "<dynamic>");
  return [...new Set(specs)];
}

/** Source files in a top-level folder. `tests: true` returns the *.test.js files instead. */
export function jsFilesIn(dir, { tests = false } = {}) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs)
    .filter((f) => f.endsWith(".js") && f.endsWith(".test.js") === tests)
    .sort()
    .map((f) => path.join(abs, f));
}

/** The repo folder a specifier points at: a top-level directory name, or the bare package. */
export function targetOf(file, spec) {
  if (!spec.startsWith(".")) return spec;
  return path.relative(ROOT, path.resolve(path.dirname(file), spec)).split(path.sep)[0];
}

/** True if `file` imports the module at repo-relative path `rel` (e.g. "governor/harness.js"). */
export function importsModule(file, rel) {
  const want = path.join(ROOT, rel);
  return importsOf(file).some((s) => s.startsWith(".") && path.resolve(path.dirname(file), s) === want);
}
