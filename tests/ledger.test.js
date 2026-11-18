import { describe, it, expect } from 'vitest';
import { createLedger } from '../src/view/ledger.js';
import { binCases } from '../src/model/epicurve.js';
import { createSim } from '../src/model/sim.js';

describe('landing ledger', () => {
  const sim = createSim({ seed: 5, pop: 20000, params: { beta: 0.5 } });
  for (let i = 0; i < 300; i++) sim.step(0.1);
  const cases = sim.cases.filter((c) => c.tOnset <= sim.t);

  it('after every case has landed, bars equal binCases exactly', () => {
    const L = createLedger({ binDays: 1, nLineages: sim.lineages.length });
    for (const c of cases) L.land(c);
    const a = L.bins(), b = binCases(cases, { binDays: 1, tMax: sim.t, nLineages: sim.lineages.length });
    expect(a.map((x) => [x.t0, x.total, x.detected])).toEqual(b.map((x) => [x.t0, x.total, x.detected]));
  });
  it('heightOf returns the current stacked count of a bin', () => {
    const L = createLedger({ binDays: 7, nLineages: 2 });
    L.land({ tOnset: 8, lineage: 0, detected: true });
    L.land({ tOnset: 9, lineage: 1, detected: false });
    expect(L.heightOf(10)).toBe(2);
    expect(L.heightOf(3)).toBe(0);
    expect(L.max()).toBe(2);
  });
  it('clear empties it', () => {
    const L = createLedger({ binDays: 1, nLineages: 1 });
    L.land({ tOnset: 1, lineage: 0, detected: true });
    L.clear();
    expect(L.bins()).toEqual([]);
  });
});
