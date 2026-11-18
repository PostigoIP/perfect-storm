// Vertical scale for the case series. 'log' (log1p) shows waves of every size
// and makes exponential growth a straight line; 'linear' shows absolute burden.
export function yScale(kind, yMax) {
  const max = Math.max(1, yMax);
  if (kind === 'log') {
    const L = Math.log10(1 + max);
    const ticks = [];
    for (let v = 1; v <= max * 1.0001; v *= 10) ticks.push({ v, f: Math.log10(1 + v) / L });
    return { kind, f: (v) => Math.log10(1 + Math.max(0, v)) / L, ticks };
  }
  const raw = max / 4, p = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => raw <= s);
  const ticks = [];
  for (let v = step; v <= max * 1.0001; v += step) ticks.push({ v: +v.toFixed(6), f: v / max });
  return { kind, f: (v) => Math.max(0, v) / max, ticks };
}
