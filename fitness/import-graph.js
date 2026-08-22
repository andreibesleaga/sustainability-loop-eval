/**
 * fitness/import-graph.js — the static-analysis half of fitness function F7.
 *
 * Reads the repository's own source files and reports which folders each file imports
 * from. Kept separate from props.js because this is filesystem/text analysis, not a
 * runtime property of the gate; F7 in props.js turns its output into a verdict.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const CORE = "governor";
export const ADAPTERS = ["simulation", "dataplane", "demo"];

export function importsOf(file) {
  const src = fs.readFileSync(file, "utf8");
  const re = /^\s*import\s+[\s\S]*?\s+from\s+["']([^"']+)["'];?\s*$/gm;
  const specs = [];
  let m;
  while ((m = re.exec(src))) specs.push(m[1]);
  return specs;
}

export function jsFilesIn(dir) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs).filter((f) => f.endsWith(".js") && !f.endsWith(".test.js")).map((f) => path.join(abs, f));
}

/** The repo folder a specifier points at: a top-level directory name, or the bare package. */
export function targetOf(file, spec) {
  if (!spec.startsWith(".")) return spec;
  return path.relative(ROOT, path.resolve(path.dirname(file), spec)).split(path.sep)[0];
}

