/**
 * shared/prng.js — the one seeded pseudo-random number generator in this package.
 *
 * Every random draw anywhere in the repository (fitness properties, simulated
 * workloads, simulated approvers) comes from here, so a seed fully determines a
 * run: no Math.random, no wall-clock entropy, no per-machine variation.
 *
 * This module is a leaf: it imports nothing.
 */

/** mulberry32: 32-bit, tiny, well-behaved. Same seed => same stream, everywhere. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Uniform element of `arr`. */
export const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

/** Uniform integer in [lo, hi] (both inclusive). */
export const randInt = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));

/** Uniform real in [lo, hi). */
export const randFloat = (rng, lo, hi) => lo + rng() * (hi - lo);

/** Knuth's method: number of arrivals in one slot, mean `lambda`. */
export function poisson(rng, lambda) {
  const limit = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do { k++; p *= rng(); } while (p > limit);
  return k - 1;
}
