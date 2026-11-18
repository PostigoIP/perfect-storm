import { describe, it, expect } from 'vitest';
import { buildTree, thinTips } from '../src/model/tree.js';

// 0 ─┬─ 1 ─┬─ 2*      (* = sampled tip)
//    │     └─ 3*
//    └─ 4 ─── 5*
// 6 (import, unsampled)
const cases = [
  { id: 0, parent: -1, t: 0, lineage: 0 },
  { id: 1, parent: 0, t: 1, lineage: 0 },
  { id: 2, parent: 1, t: 2, lineage: 0 },
  { id: 3, parent: 1, t: 3, lineage: 0 },
  { id: 4, parent: 0, t: 4, lineage: 1 },
  { id: 5, parent: 4, t: 5, lineage: 1 },
  { id: 6, parent: -1, t: 6, lineage: 2 },
];
const get = (id) => cases[id];
const tips = [{ id: 2, t: 5 }, { id: 3, t: 6 }, { id: 5, t: 8 }];

describe('buildTree', () => {
  it('keeps exactly the sampled tips at their sampling times', () => {
    const tr = buildTree(get, tips);
    expect(tr.tips.map((x) => x.id).sort()).toEqual([2, 3, 5]);
    for (const tip of tr.tips) expect(tip.x).toBe(tips.find((q) => q.id === tip.id).t);
  });

  it('collapses unary nodes and roots at the MRCA (transmission 0→1)', () => {
    const tr = buildTree(get, tips);
    expect(tr.internal).toHaveLength(2);
    for (const n of tr.internal) expect(n.children).toHaveLength(2);
    expect(tr.root.x).toBe(1);
    expect(tr.internal.map((n) => n.x).sort()).toEqual([1, 2]);
  });

  it('ladderizes: larger clade first, y in tip order', () => {
    const tr = buildTree(get, tips);
    const y = Object.fromEntries(tr.tips.map((x) => [x.id, x.y]));
    expect([y[2], y[3], y[5]]).toEqual([0, 1, 2]);
    expect(tr.root.y).toBeCloseTo((0.5 + 2) / 2);
  });

  it('emits horizontal edges and vertical connectors with lineage', () => {
    const tr = buildTree(get, tips);
    const e5 = tr.edges.find((e) => e.to === 'tip:5');
    expect(e5).toMatchObject({ x0: 1, x1: 8, y: 2, lineage: 1 });
    expect(tr.verticals).toHaveLength(2);
    for (const v of tr.verticals) expect(v.y0).toBeLessThan(v.y1);
  });

  it('joins reservoir-rooted subtrees under a synthetic root 5 days before', () => {
    const tr = buildTree(get, [...tips, { id: 6, t: 9 }]);
    expect(tr.root.synthetic).toBe(true);
    expect(tr.root.x).toBe(-5);
    expect(tr.root.children).toHaveLength(2);
    expect(tr.tMin).toBe(-5);
    expect(tr.tMax).toBe(9);
  });

  it('returns an empty layout for no tips', () => {
    const tr = buildTree(get, []);
    expect(tr.tips).toEqual([]);
    expect(tr.root).toBeNull();
  });
});

describe('thinTips', () => {
  it('keeps maxTips evenly over time including first and last', () => {
    const many = Array.from({ length: 1000 }, (_, i) => ({ id: i, t: i * 0.3 }));
    const kept = thinTips(many, 400);
    expect(kept).toHaveLength(400);
    expect(kept[0].id).toBe(0);
    expect(kept.at(-1).id).toBe(999);
  });
  it('returns all when under the cap', () => {
    const few = [{ id: 1, t: 2 }, { id: 0, t: 1 }];
    expect(thinTips(few, 400).map((x) => x.id)).toEqual([0, 1]);
  });
});
