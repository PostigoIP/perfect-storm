import { describe, it, expect } from 'vitest';
import { binCases } from '../src/model/epicurve.js';
import { createSim } from '../src/model/sim.js';

describe('binCases', () => {
  const sim = createSim({ seed: 11, pop: 30000, params: { beta: 0.45 } });
  for (let i = 0; i < 400; i++) sim.step(0.1);
  const tMax = sim.t;
  const bins = binCases(sim.cases, { binDays: 1, tMax, nLineages: sim.lineages.length });

  it('totals equal onsets up to tMax', () => {
    const n = sim.cases.filter((c) => c.tOnset <= tMax).length;
    expect(bins.reduce((s, b) => s + b.total, 0)).toBe(n);
  });
  it('detected ≤ total and byLineage sums to total', () => {
    for (const b of bins) {
      expect(b.detected).toBeLessThanOrEqual(b.total);
      expect(b.byLineage.reduce((s, x) => s + x, 0)).toBe(b.total);
      expect(b.detectedByLineage.reduce((s, x) => s + x, 0)).toBe(b.detected);
    }
  });
  it('bins are contiguous and aligned to binDays', () => {
    for (let i = 1; i < bins.length; i++) expect(bins[i].t0 - bins[i - 1].t0).toBe(1);
  });
  it('empty input → []', () => {
    expect(binCases([], { tMax: 10 })).toEqual([]);
  });
});
