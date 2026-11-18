import { describe, it, expect } from 'vitest';
import { createObservedSource } from '../src/model/observed.js';

const data = {
  meta: { title: 'Fixture', lede: 'x', start: '2014-01-06', sources: [], transformations: [] },
  lineages: [{ name: 'Guinea', surface: 'stone' }, { name: 'Liberia', surface: 'metal' }],
  nodes: [
    { id: 0, parent: -1, date: 0, lineage: 0 },
    { id: 1, parent: 0, date: 10, lineage: 0 },
    { id: 2, parent: 1, date: 12, lineage: 0 },
    { id: 3, parent: 1, date: 30, lineage: 1 },
    { id: 4, parent: 0, date: 20, lineage: 0 },
  ],
  tips: [{ id: 2, t: 12 }, { id: 3, t: 30 }, { id: 4, t: 20 }],
  weeks: [{ t0: 0, counts: [3, 0] }, { t0: 7, counts: [10, 4] }, { t0: 14, counts: [0, 0] }, { t0: 21, counts: [25, 9] }],
};
const runTo = (src, t) => { const out = []; for (let g = 0; g < 10000 && src.t < t - 1e-9; g++) out.push(...src.step(Math.min(0.5, t - src.t))); return out; };

describe('createObservedSource', () => {
  it('emits exactly each week\'s count as onsets inside that week', () => {
    const src = createObservedSource(data, { seed: 1 });
    const ev = runTo(src, 28);
    expect(ev).toHaveLength(3 + 14 + 0 + 34);
    const wk2 = ev.filter((c) => c.tOnset >= 7 && c.tOnset < 14);
    expect(wk2).toHaveLength(14);
    expect(wk2.filter((c) => c.lineage === 1)).toHaveLength(4);
  });
  it('marks every emitted case as inferred and reported', () => {
    const src = createObservedSource(data, { seed: 1 });
    for (const c of runTo(src, 28)) { expect(c.inferred).toBe(true); expect(c.detected).toBe(true); }
  });
  it('reveals tips only once their sampling date has passed', () => {
    const src = createObservedSource(data, { seed: 1 });
    runTo(src, 21);
    const tr = src.tree(src.t);
    expect(tr.tips.map((t) => t.id).sort()).toEqual([2, 4]);
    runTo(src, 30);
    expect(src.tree(src.t).tips).toHaveLength(3);
  });
  it('splits branches at the parent node date (standard phylogeny)', () => {
    const src = createObservedSource(data, { seed: 1 });
    runTo(src, 30);
    const tr = src.tree(src.t);
    expect(tr.root.x).toBe(0);
    expect(tr.internal.map((n) => n.x).sort((a, b) => a - b)).toEqual([0, 10]);
  });
  it('reset rewinds to the start', () => {
    const src = createObservedSource(data, { seed: 1 });
    runTo(src, 20);
    src.reset();
    expect(src.t).toBe(src.domain(0).t0Start);
    expect(src.snapshot().cumulative).toBe(0);
  });
});
