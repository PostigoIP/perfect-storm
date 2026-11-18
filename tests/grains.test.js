import { describe, it, expect } from 'vitest';
import { pickGrain, grainLength } from '../src/audio/grains.js';

const entries = [{ onsets: [0.1, 0.5, 0.9] }, { onsets: [2.0, 3.0] }];

describe('pickGrain', () => {
  it('maps an index onto every onset across files, wrapping', () => {
    const seen = new Set();
    for (let i = 0; i < 5; i++) { const g = pickGrain(entries, i); seen.add(`${g.entry}:${g.offset}`); }
    expect(seen.size).toBe(5);
    expect(pickGrain(entries, 5)).toEqual(pickGrain(entries, 0));
  });
  it('returns null when a surface has no onsets', () => {
    expect(pickGrain([{ onsets: [] }], 3)).toBeNull();
  });
});

describe('grainLength', () => {
  it('a single drop: grows with severity and stays within 0.03–0.12 s', () => {
    let prev = 0;
    for (let s = 0; s <= 3; s++) { const L = grainLength(s, 0.5); expect(L).toBeGreaterThan(prev); expect(L).toBeGreaterThanOrEqual(0.03); expect(L).toBeLessThanOrEqual(0.12); prev = L; }
  });
});

import { bedLevel } from '../src/audio/grains.js';
describe('bedLevel', () => {
  it('is silent while drops are sparse, full in a downpour, monotone between', () => {
    expect(bedLevel(0)).toBe(0);
    expect(bedLevel(6)).toBe(0);
    expect(bedLevel(500)).toBe(1);
    let prev = 0;
    for (let r = 0; r < 600; r += 5) { const v = bedLevel(r); expect(v).toBeGreaterThanOrEqual(prev); prev = v; }
  });
});
