// Seedable random numbers and the few distributions the model needs.

export function mulberry32(seed) {
  let t = seed >>> 0 || 1;
  return function () {
    t += 0x6d2b79f5;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function normal(r) {
  let u = 0;
  while (u === 0) u = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}

// Marsaglia–Tsang; shape < 1 via boost.
export function gamma(r, shape, scale = 1) {
  if (shape < 1) return gamma(r, shape + 1, scale) * Math.pow(r(), 1 / shape);
  const d = shape - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x, v;
    do { x = normal(r); v = 1 + c * x; } while (v <= 0);
    v = v * v * v;
    const u = r();
    if (u < 1 - 0.0331 * x ** 4 || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v * scale;
  }
}

export function poisson(r, lambda) {
  if (lambda <= 0) return 0;
  if (lambda > 30) return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * normal(r)));
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= r(); } while (p > L);
  return k - 1;
}

export function binomial(r, n, p) {
  if (n <= 0 || p <= 0) return 0;
  if (p >= 1) return n;
  const m = n * p;
  if (m > 30 && n * (1 - p) > 30) {
    return Math.min(n, Math.max(0, Math.round(m + Math.sqrt(m * (1 - p)) * normal(r))));
  }
  if (m < 10) return Math.min(n, poissonCapped(r, n, p));
  let k = 0;
  for (let i = 0; i < n; i++) if (r() < p) k++;
  return k;
}

// Small-mean binomial by inversion (exact).
function poissonCapped(r, n, p) {
  const q = 1 - p, s = p / q;
  let pr = Math.pow(q, n), cdf = pr, k = 0;
  const u = r();
  while (u > cdf && k < n) { pr *= s * (n - k) / (k + 1); k++; cdf += pr; }
  return k;
}
