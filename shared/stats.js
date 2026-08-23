// SPDX-License-Identifier: GPL-3.0-only
/**
 * shared/stats.js — the one set of summary statistics used across this package.
 *
 * Everything that reports a median, a p95, a standard deviation or a correlation
 * (simulation and data-plane measurement alike) uses these, so a number labelled
 * "p95" means the same thing everywhere in results/.
 *
 * Conventions, stated once:
 *   - sd()       is the SAMPLE standard deviation (n-1), 0 for a single value.
 *   - quantile() is linearly interpolated on the sorted sample (the "type 7"
 *     definition used by R's default and by NumPy), so median() and p95() are
 *     consistent with each other and defined for any sample size.
 *
 * This module is a leaf: it imports nothing.
 */

export const sum = (v) => v.reduce((a, b) => a + b, 0);
export const mean = (v) => (v.length ? sum(v) / v.length : 0);

/** Sample standard deviation (n-1). Zero for fewer than two observations. */
export function sd(v) {
  if (v.length < 2) return 0;
  const m = mean(v);
  return Math.sqrt(sum(v.map((x) => (x - m) ** 2)) / (v.length - 1));
}

/** Linearly interpolated quantile on the sorted sample; 0 for an empty sample. */
export function quantile(v, q) {
  if (!v.length) return 0;
  const s = [...v].sort((a, b) => a - b);
  const i = (s.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (i - lo);
}
export const median = (v) => quantile(v, 0.5);
export const p95 = (v) => quantile(v, 0.95);

/** Pearson correlation between two equal-length series; 0 if either is constant. */
export function pearson(x, y) {
  const mx = mean(x);
  const my = mean(y);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < x.length; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;
}

/** Round for reporting; keeps JSON stable and readable. null for non-finite. */
export const r = (x, d = 3) => (Number.isFinite(x) ? Number(x.toFixed(d)) : null);

/** {mean, sd} over a set of per-seed values, rounded to `d` decimals. */
export const ms = (v, d = 3) => ({ mean: r(mean(v), d), sd: r(sd(v), d) });
