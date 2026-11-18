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

  it('starts from a single patient zero (rooted genealogy)', () => {
    const sim = createSim({ seed: 12, pop: 20000 });
    const roots = sim.cases.filter((c) => c.parent === -1);
    expect(roots).toHaveLength(1);
    for (const c of sim.cases) if (c.parent !== -1) expect(c.parent).toBe(roots[0].id);
    run(sim, 30);
    const isFromZero = (id) => { let x = id; while (sim.cases[x].parent !== -1) x = sim.cases[x].parent; return x === roots[0].id; };
    for (const c of sim.cases) if (!c.imported) expect(isFromZero(c.id)).toBe(true);
  });

  it('lineage shares stay within [0, 1] when a variant arises in an already-counted case', () => {
    const sim = createSim({ seed: 2, pop: 30000, params: { beta: 0.4 } });
    run(sim, 30);
    for (const [name, wait] of [['α', 25], ['β', 0], ['γ', 0]]) {
      sim.introduceVariant(name, { tx: 1.6 });
      for (let d = 0; d < 20 + wait; d++) {
        run(sim, 1);
        const sh = sim.snapshot().lineageShares;
        for (const x of sh) { expect(x.share).toBeGreaterThanOrEqual(0); expect(x.share).toBeLessThanOrEqual(1); }
        const tot = sh.reduce((a, x) => a + x.share, 0);
        if (tot > 0) expect(tot).toBeCloseTo(1, 9);
      }
    }
    // shares must equal a recount of onsets in the last 7 days, by lineage at onset
    const t = sim.t, week = sim.cases.filter((c) => c.tOnset <= t && c.tOnset > t - 7);
    const sh = sim.snapshot().lineageShares;
    for (const x of sh) expect(x.share).toBeCloseTo(week.filter((c) => (c.onsetLineage ?? c.lineage) === x.id).length / week.length, 9);
  });

  it('analytic R counts the immune that an escape variant can reinfect', () => {
    const sim = createSim({ seed: 3, pop: 20000, params: { beta: 0.2 } });
    sim.setParam('immunity', 0.8);
    run(sim, 60);
    const before = sim.snapshot();
    sim.introduceVariant('esc', { tx: 1, escape: 1, cluster: 30 });
    run(sim, 12);
    const s = sim.snapshot();
    // with full escape, the variant sees S + R, so R_eff for its share is β·D·(S+R)/N
    expect(s.reffAnalytic).toBeGreaterThan(before.reffAnalytic * 1.3);
  });

  it('vaccination doses everyone, but only doses reaching susceptibles move people', () => {
    // an epidemic first immunises most people, then it burns out
    const sim = createSim({ seed: 13, pop: 20000, params: { beta: 0.25 } });
    run(sim, 250);
    sim.setParam('beta', 0);
    run(sim, 30);
    const before = sim.snapshot().S;
    expect(before).toBeLessThan(15000);
    sim.setParam('immunity', 0.6);
    run(sim, 80);
    // 60% of people get a dose; only the susceptible ones move: ~40% of S remains
    const after = sim.snapshot().S;
    expect(after / before).toBeGreaterThan(0.3);
    expect(after / before).toBeLessThan(0.5);
  });

  it('save/restore rewinds exactly: same state, and the same future', () => {
    const sim = createSim({ seed: 21, pop: 30000, params: { beta: 0.45 } });
    run(sim, 30);
    sim.introduceVariant('α', { tx: 1.6 });
    const snap = sim.save();
    const at = sim.snapshot();
    run(sim, 25);
    const futureA = sim.cases.slice(at.cumulative).map((c) => [c.id, c.parent, c.tInf, c.lineage]);
    const nA = sim.cases.length;
    sim.restore(snap);
    const back = sim.snapshot();
    expect([back.t, back.S, back.E, back.I, back.R, back.cumulative]).toEqual([at.t, at.S, at.E, at.I, at.R, at.cumulative]);
    run(sim, 25);
    expect(sim.cases.length).toBe(nA);
    expect(sim.cases.slice(at.cumulative).map((c) => [c.id, c.parent, c.tInf, c.lineage])).toEqual(futureA);
  });

  it('a saved checkpoint is not changed by running on', () => {
    const sim = createSim({ seed: 22, pop: 20000, params: { beta: 0.4 } });
    run(sim, 20);
    const snap = sim.save();
    const n = snap.cases.length;
    run(sim, 30);
    expect(snap.cases.length).toBe(n);
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
