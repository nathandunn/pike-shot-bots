// Seeded RNG (mulberry32): fast and plenty good for Monte Carlo.
export function makeRng(seed) {
  let a = (seed >>> 0) || 1;
  const rng = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.int = (n) => Math.floor(rng() * n);
  rng.range = (lo, hi) => lo + rng() * (hi - lo);
  rng.pick = (arr) => arr[Math.floor(rng() * arr.length)];
  rng.gauss = () => { let u = 0, v = 0; while (u === 0) u = rng(); v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  // casualties from an expected value: binomial-ish, never negative, never more than cap
  rng.casualties = (mean, cap) => {
    if (mean <= 0) return 0;
    const sd = Math.sqrt(mean) * 0.9;
    return Math.max(0, Math.min(cap, Math.round(mean + sd * rng.gauss())));
  };
  return rng;
}
