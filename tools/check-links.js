// SPDX-License-Identifier: GPL-3.0-only
/**
 * tools/check-links.js — every relative Markdown link in the repository must point
 * at a file that exists, and every `#fragment` on a Markdown target must name a
 * heading in that file (GitHub's slug rules). Offline, no dependencies. Exit 1 on
 * the first broken link so `npm test` fails loudly.
 */
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { dirname, join, resolve, relative } from "node:path";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const SKIP = new Set(["node_modules", ".git", ".audit"]);

function mdFiles(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...mdFiles(p));
    else if (e.name.endsWith(".md")) out.push(p);
  }
  return out;
}

const slugCache = new Map();
function slugs(file) {
  if (slugCache.has(file)) return slugCache.get(file);
  const seen = new Map();
  const set = new Set();
  let fence = false;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (/^\s*```/.test(line)) { fence = !fence; continue; }
    if (fence) continue;
    const m = /^#{1,6}\s+(.*?)\s*#*\s*$/.exec(line);
    if (!m) continue;
    // GitHub: strip inline code marks and links, lowercase, drop everything that is
    // not a letter, number, space, hyphen or underscore, spaces → hyphens, dedupe.
    let s = m[1].replace(/`/g, "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").toLowerCase();
    s = s.replace(/[^\p{L}\p{N} _-]/gu, "").replace(/ /g, "-");
    const n = seen.get(s) ?? 0;
    seen.set(s, n + 1);
    set.add(n === 0 ? s : `${s}-${n}`);
  }
  slugCache.set(file, set);
  return set;
}

const LINK = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
let links = 0;
const broken = [];
for (const file of mdFiles(ROOT)) {
  const text = readFileSync(file, "utf8");
  for (const m of text.matchAll(LINK)) {
    let target = m[1];
    if (/^(https?:|mailto:|tel:|<)/i.test(target)) continue;
    links++;
    const [path, frag] = target.split("#");
    const abs = path ? resolve(dirname(file), decodeURIComponent(path)) : file;
    const rel = relative(ROOT, file);
    if (!existsSync(abs)) { broken.push(`${rel}: missing ${target}`); continue; }
    if (frag && abs.endsWith(".md") && statSync(abs).isFile() && !slugs(abs).has(frag.toLowerCase())) {
      broken.push(`${rel}: no heading "#${frag}" in ${relative(ROOT, abs)}`);
    }
  }
}
if (broken.length) {
  console.error(`check-links: ${broken.length} broken of ${links} relative links\n  ` + broken.join("\n  "));
  process.exit(1);
}
console.log(`check-links: ${links} relative links, all resolve (files and anchors)`);
