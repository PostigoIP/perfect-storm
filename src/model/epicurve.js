// Case series: onsets binned by date, split by lineage and by reporting.

export function binCases(cases, { binDays = 1, tMax = Infinity, nLineages } = {}) {
  let first = Infinity, last = -Infinity, nl = nLineages ?? 0;
  for (const c of cases) {
    if (c.tOnset > tMax) continue;
    if (c.tOnset < first) first = c.tOnset;
    if (c.tOnset > last) last = c.tOnset;
    if (c.lineage + 1 > nl) nl = c.lineage + 1;
  }
  if (first === Infinity) return [];
  const k0 = Math.floor(first / binDays), k1 = Math.floor(last / binDays);
  const bins = [];
  for (let k = k0; k <= k1; k++) {
    bins.push({ t0: k * binDays, total: 0, detected: 0, byLineage: new Array(nl).fill(0), detectedByLineage: new Array(nl).fill(0) });
  }
  for (const c of cases) {
    if (c.tOnset > tMax) continue;
    const b = bins[Math.floor(c.tOnset / binDays) - k0];
    b.total++; b.byLineage[c.lineage]++;
    if (c.detected) { b.detected++; b.detectedByLineage[c.lineage]++; }
  }
  return bins;
}
