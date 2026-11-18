// Bars made of landed drops. Same shape as binCases() so views can share code.
export function createLedger({ binDays = 1, nLineages = 1 } = {}) {
  let map = new Map(), nl = nLineages, maxTotal = 0;
  const key = (t) => Math.floor(t / binDays);
  return {
    binDays,
    land(c) {
      const k = key(c.tOnset);
      if (c.lineage + 1 > nl) nl = c.lineage + 1;
      let b = map.get(k);
      if (!b) map.set(k, (b = { t0: k * binDays, total: 0, detected: 0, byLineage: [], detectedByLineage: [] }));
      b.total++;
      b.byLineage[c.lineage] = (b.byLineage[c.lineage] ?? 0) + 1;
      if (c.detected) { b.detected++; b.detectedByLineage[c.lineage] = (b.detectedByLineage[c.lineage] ?? 0) + 1; }
      if (b.total > maxTotal) maxTotal = b.total;
    },
    heightOf(t) { return map.get(key(t))?.total ?? 0; },
    max() { return maxTotal; },
    bins() {
      if (!map.size) return [];
      const ks = [...map.keys()], k0 = Math.min(...ks), k1 = Math.max(...ks), out = [];
      for (let k = k0; k <= k1; k++) {
        const b = map.get(k) ?? { t0: k * binDays, total: 0, detected: 0, byLineage: [], detectedByLineage: [] };
        out.push({ ...b, byLineage: Array.from({ length: nl }, (_, i) => b.byLineage[i] ?? 0), detectedByLineage: Array.from({ length: nl }, (_, i) => b.detectedByLineage[i] ?? 0) });
      }
      return out;
    },
    clear() { map = new Map(); maxTotal = 0; },
  };
}
