import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createCompareSource } from '../src/model/compare.js';

const data = JSON.parse(readFileSync(new URL('../public/data/compare.json', import.meta.url)));
const total = (p) => p.days.reduce((s, d) => s + d.counts.reduce((a, b) => a + b, 0), 0);

function runPhase(src) {
  const out = [];
  const phase = src.phase;
  while (src.phase === phase && !src.done) out.push(...src.step(0.5));
  return out;
}

describe('compare source', () => {
  it('replays the contained outbreak first, every case once, then the one that got away', () => {
    const seen = [];
    const src = createCompareSource(data, { onPhase: (i) => seen.push(i) });
    expect(src.phase).toBe(0);
    const first = runPhase(src);
    expect(first.length).toBe(64);
    expect(first.every((c) => c.lineage === 0)).toBe(true);
    expect(src.phase).toBe(1);
    expect(seen).toEqual([1]);
    expect(src.t).toBeLessThan(1);              // the clock starts again at day 0
    const second = [];
    while (!src.done) second.push(...src.step(0.5));
    expect(second.length + first.length + 0).toBe(64 + total(data.phases[1]));
    expect(second.every((c) => c.lineage > 0)).toBe(true);
  });

  it('places each case on its own day, on a shared axis starting at day 0', () => {
    const src = createCompareSource(data);
    const cases = runPhase(src);
    for (const c of cases) expect(data.phases[0].days.some((d) => c.tOnset >= d.t && c.tOnset < d.t + 1)).toBe(true);
    expect(src.domain()).toEqual(data.meta.domain);
  });

  it('keeps the contained outbreak running in silence until it was declared over', () => {
    const src = createCompareSource(data);
    runPhase(src);
    expect(src.phase).toBe(1);
    // the switch only happens once day `end` (1 Dec 2025, day 119) has passed
    const src2 = createCompareSource(data);
    src2.step(data.phases[0].end - 1);
    expect(src2.phase).toBe(0);
  });

  it('reports metrics per phase and resets cleanly', () => {
    const src = createCompareSource(data);
    src.step(40);
    expect(src.snapshot().cumulative).toBeGreaterThan(0);
    expect(src.dateLabel(0)).toBe('4 Aug 25');
    src.reset();
    expect(src.phase).toBe(0);
    expect(src.t).toBe(0);
    expect(src.snapshot().cumulative).toBe(0);
  });

  it('gives each case a unique id across both outbreaks', () => {
    const src = createCompareSource(data);
    const all = [];
    while (!src.done) all.push(...src.step(1));
    expect(new Set(all.map((c) => c.id)).size).toBe(all.length);
  });
});

describe('compare milestones', () => {
  it('exposes each outbreak\'s milestones, the last of the first on its final day', () => {
    const src = createCompareSource(data);
    const first = src.phaseEvents(0);
    expect(first.at(-1).t).toBe(data.phases[0].end);
    expect(src.phaseEvents(1).length).toBeGreaterThan(0);
  });
});

describe('compare deaths', () => {
  it('marks exactly the reported number of deaths in each outbreak', () => {
    const src = createCompareSource(data);
    const byPhase = [[], []];
    while (!src.done) { const p = src.phase; byPhase[p].push(...src.step(1)); }
    expect(byPhase[0].filter((c) => c.outcome === 'fatal').length).toBe(45);
    expect(byPhase[1].filter((c) => c.outcome === 'fatal').length).toBe(5202);
  });
  it('reports deaths so far in the snapshot', () => {
    const src = createCompareSource(data);
    expect(src.snapshot().deaths).toBe(0);
    src.step(60);
    expect(src.snapshot().deaths).toBe(45);
  });
});
