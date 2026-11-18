import { describe, it, expect } from 'vitest';
import { buildTree } from '../src/model/tree.js';
import { collapseTree } from '../src/model/collapse.js';
import { createSim } from '../src/model/sim.js';

function simTree(seed, withVariant) {
  const sim = createSim({ seed, pop: 60000, params: { beta: 0.42, sampling: 0.2, detection: 0.6 } });
  for (let i = 0; i < 350; i++) sim.step(0.1);
  if (withVariant) sim.introduceVariant('Variant α', { tx: 1.7 });
  for (let i = 0; i < 300; i++) sim.step(0.1);
  const tips = sim.cases.filter((c) => c.sampled && c.tOnset <= sim.t).map((c) => ({ id: c.id, t: c.tOnset }));
  const tr = buildTree((id) => ({ parent: sim.cases[id].parent, t: sim.cases[id].tInf, lineage: sim.cases[id].lineage }), tips);
  return { sim, tr, tips };
}

describe('collapseTree', () => {
  const { tr, tips } = simTree(3, true);
  const col = collapseTree(tr.root, { maxClades: 10 });

  it('returns at most maxClades clades that partition every tip', () => {
    expect(col.clades.length).toBeLessThanOrEqual(10);
    expect(col.clades.length).toBeGreaterThan(1);
    expect(col.clades.reduce((s, c) => s + c.n, 0)).toBe(tips.length);
  });

  it('each clade is one lineage when the budget allows (variant gets its own wedges)', () => {
    const variantClades = col.clades.filter((c) => c.lineage === 1);
    expect(variantClades).toHaveLength(1);
    expect(variantClades[0].kind).toBe('lineage');
    expect(variantClades[0].purity).toBeGreaterThanOrEqual(0.8);
  });

  it('wedge geometry: point at the ancestor, tail at the latest tip, heights in order', () => {
    let lastY = -1;
    for (const c of col.clades) {
      expect(c.x0).toBeLessThanOrEqual(c.x1);
      expect(c.y0).toBeGreaterThanOrEqual(lastY);
      expect(c.y1).toBeGreaterThan(c.y0);
      lastY = c.y1;
    }
    expect(col.clades.at(-1).y1).toBeLessThanOrEqual(1 + 1e-9);
  });

  it('bigger clades get taller wedges', () => {
    const sorted = [...col.clades].sort((a, b) => a.n - b.n);
    const h = (c) => c.y1 - c.y0;
    expect(h(sorted.at(-1))).toBeGreaterThan(h(sorted[0]));
  });

  it('backbone connects the root to every clade', () => {
    const founder = col.clades.filter((c) => c.kind === 'clade' && c.node !== col.root);
    for (const v of col.verticals) expect(v.y1).toBeGreaterThanOrEqual(v.y0);
    const reached = new Set(col.edges.map((e) => e.to));
    for (const c of founder) expect(reached.has(c.node.id)).toBe(true);
    for (const c of col.clades.filter((c) => c.kind === 'lineage')) expect(col.connectors.some((k) => Math.abs(k.y1 - c.yc) < 1e-9)).toBe(true);
  });

  it('gathers independent introductions into one band', () => {
    const t = (id, x, l) => ({ id: `tip:${id}`, caseId: id, x, lineage: l, tip: true, children: [] });
    const main = { id: 'm', x: 0, lineage: 0, children: [t(1, 5, 0), t(2, 6, 0)] };
    const root = { id: 'root', x: -5, lineage: -1, synthetic: true, children: [main, t(3, 4, 2), t(4, 8, 2)] };
    const col = collapseTree(root, { maxClades: 10 });
    const intro = col.clades.find((c) => c.kind === 'intros');
    expect(intro.members).toHaveLength(2);
    expect(col.clades.reduce((s, c) => s + c.n, 0)).toBe(4);
  });

  it('lineage view: one founder wedge, each lineage its own band, nested lineages lifted from their host', () => {
    const lv = collapseTree(tr.root, { founderBands: 1, maxLifted: 4 });
    const founder = lv.clades.filter((c) => c.kind === 'clade');
    expect(founder).toHaveLength(1);
    expect(lv.clades.filter((c) => c.kind === 'lineage').map((c) => c.lineage)).toContain(1);
    expect(lv.clades.reduce((s, c) => s + c.n, 0)).toBe(tips.length);
  });

  it('nested lineages are lifted out of lifted lineages without double counting', () => {
    const t = (id, x, l) => ({ id: `tip:${id}`, caseId: id, x, lineage: l, tip: true, children: [] });
    // founder 0 → lineage 1 clade (4 tips) which contains a lineage 2 clade (3 tips)
    const l2 = { id: 'l2', x: 6, lineage: 2, children: [t(1, 9, 2), { id: 'l2b', x: 7, lineage: 2, children: [t(2, 9, 2), t(3, 10, 2)] }] };
    const l1 = { id: 'l1', x: 3, lineage: 1, children: [{ id: 'l1b', x: 4, lineage: 1, children: [t(4, 8, 1), t(5, 9, 1)] }, { id: 'l1c', x: 5, lineage: 1, children: [l2, { id: 'l1d', x: 5.5, lineage: 1, children: [t(6, 8, 1), t(7, 9, 1)] }] }] };
    const root = { id: 'r', x: 0, lineage: 0, children: [{ id: 'f', x: 1, lineage: 0, children: [t(8, 6, 0), t(9, 7, 0), t(10, 8, 0)] }, l1] };
    const lv = collapseTree(root, { founderBands: 1, maxLifted: 4 });
    const byL = Object.fromEntries(lv.clades.map((c) => [c.lineage, c.n]));
    expect(byL).toEqual({ 0: 3, 1: 4, 2: 3 });
    expect(lv.connectors).toHaveLength(2);
  });

  it('handles a tree that is a single tip', () => {
    const one = collapseTree({ id: 'tip:1', caseId: 1, x: 3, lineage: 0, tip: true, children: [] }, { maxClades: 10 });
    expect(one.clades).toHaveLength(1);
    expect(one.clades[0].n).toBe(1);
  });
});
