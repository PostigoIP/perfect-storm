import { describe, it, expect } from 'vitest';
import { createSim } from '../src/model/sim.js';

const run = (sim, days, dt = 0.1) => { const out = []; for (let i = 0; i < Math.round(days / dt); i++) out.push(...sim.step(dt)); return out; };

describe('createSim', () => {
  it('conserves population every step', () => {
    const sim = createSim({ seed: 1, pop: 20000 });
    for (let i = 0; i < 200; i++) {
      sim.step(0.1);
      const s = sim.snapshot();
      expect(s.S + s.E + s.I + s.R).toBe(20000);
    }
  });

  it('every case has a valid, infectious parent', () => {
    const sim = createSim({ seed: 2, pop: 20000, params: { beta: 0.4 } });
    run(sim, 40);
    expect(sim.cases.length).toBeGreaterThan(200);
    for (const c of sim.cases) {
      if (c.parent === -1) continue;
      const p = sim.cases[c.parent];
      expect(p).toBeDefined();
      expect(p.tInf).toBeLessThan(c.tInf);
      expect(p.tOnset).toBeLessThanOrEqual(c.tInf);
      expect(c.tInf).toBeLessThan(p.tEnd);
    }
  });

  it('mutations are clock-like', () => {
    const sim = createSim({ seed: 3, pop: 50000, params: { beta: 0.4, mu: 0.08 } });
    run(sim, 60);
    let sx = 0, sy = 0, sxx = 0, sxy = 0, n = 0;
    for (const c of sim.cases) {
      if (c.parent !== -1) expect(c.muts).toBeGreaterThanOrEqual(sim.cases[c.parent].muts);
      sx += c.tInf; sy += c.muts; sxx += c.tInf * c.tInf; sxy += c.tInf * c.muts; n++;
    }
    const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
    expect(Math.abs(slope - 0.08) / 0.08).toBeLessThan(0.25);
  });

  it('a variant emerges on one branch and takes over when fitter', () => {
    const sim = createSim({ seed: 7, pop: 100000, params: { beta: 0.2 } });
    run(sim, 30);
    const lin = sim.introduceVariant('α', { tx: 1.6 });
    const L = sim.lineages[lin];
    expect(L.originCase).toBeGreaterThanOrEqual(0);
    expect(sim.cases[L.originCase].lineage).toBe(lin);
    run(sim, 60);
    const isDesc = (id) => { for (let x = id; x !== -1; x = sim.cases[x].parent) if (x === L.originCase) return true; return false; };
    for (const c of sim.cases) if (c.lineage === lin) expect(isDesc(c.id)).toBe(true);
    const share = sim.snapshot().lineageShares.find((s) => s.id === lin).share;
    expect(share).toBeGreaterThan(0.5);
  });

  it('imports attach to the reservoir', () => {
    const sim = createSim({ seed: 4, pop: 20000 });
    run(sim, 5);
    const before = sim.cases.length;
    sim.importCases(5);
    const added = sim.cases.slice(before);
    expect(added).toHaveLength(5);
    for (const c of added) { expect(c.parent).toBe(-1); expect(c.imported).toBe(true); }
  });

  it('clamps catch-up after a long pause', () => {
    const sim = createSim({ seed: 5 });
    sim.step(30);
    expect(sim.snapshot().t).toBeLessThanOrEqual(0.5 + 1e-9);
  });

  it('reset bumps generation and restores initial counts', () => {
    const sim = createSim({ seed: 6, pop: 20000 });
    const init = sim.snapshot();
    run(sim, 20);
    const g = sim.generation;
    sim.reset();
    const s = sim.snapshot();
    expect(sim.generation).toBe(g + 1);
    expect([s.t, s.S, s.E, s.I, s.R]).toEqual([init.t, init.S, init.E, init.I, init.R]);
    expect(sim.cases.length).toBe(init.E + init.I);
  });

  it('is deterministic for a seed', () => {
    const a = createSim({ seed: 42, pop: 30000, params: { beta: 0.45 } });
    const b = createSim({ seed: 42, pop: 30000, params: { beta: 0.45 } });
    run(a, 40); run(b, 40);
    expect(a.cases.length).toBeGreaterThan(500);
    expect(a.cases.slice(0, 500)).toEqual(b.cases.slice(0, 500));
  });

  it('step returns onsets in time order within the step', () => {
    const sim = createSim({ seed: 8, pop: 20000, params: { beta: 0.45 } });
    run(sim, 20);
    const ev = sim.step(0.1);
    const s = sim.snapshot();
    for (const c of ev) { expect(c.tOnset).toBeLessThanOrEqual(s.t + 1e-9); expect(c.tOnset).toBeGreaterThan(s.t - 0.1 - 1e-9); }
  });

  it('immunity moves people from S to R gradually', () => {
    const sim = createSim({ seed: 9, pop: 20000, params: { beta: 0.1 } });
    sim.setParam('immunity', 0.5);
    sim.step(0.1);
    const early = sim.snapshot().R;
    expect(early).toBeLessThan(2000);
    run(sim, 60);
    expect(sim.snapshot().R).toBeGreaterThan(9000);
  });
});
