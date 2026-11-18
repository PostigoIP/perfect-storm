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
  it('a single drop: grows with severity and stays within 0.05–0.15 s', () => {
    let prev = 0;
    for (let s = 0; s <= 3; s++) { const L = grainLength(s, 0.5); expect(L).toBeGreaterThan(prev); expect(L).toBeGreaterThanOrEqual(0.05); expect(L).toBeLessThanOrEqual(0.15); prev = L; }
  });
});

import { bedLevel } from '../src/audio/grains.js';
describe('bedLevel', () => {
  it('is silent while drops are sparse, full in a downpour, monotone between', () => {
    // the bed is only for rain too dense to count: none below ~15 drops/s
    expect(bedLevel(0)).toBe(0);
    expect(bedLevel(10)).toBe(0);
    expect(bedLevel(20)).toBeGreaterThan(0);
    expect(bedLevel(200)).toBe(1);
    let prev = 0;
    for (let r = 0; r < 600; r += 5) { const v = bedLevel(r); expect(v).toBeGreaterThanOrEqual(prev); prev = v; }
  });
});

describe('bedLevel with a mix profile', () => {
  it('can start earlier and fill sooner', () => {
    expect(bedLevel(12, 10, 150)).toBeGreaterThan(0);
    expect(bedLevel(150, 10, 150)).toBe(1);
    expect(bedLevel(9, 10, 150)).toBe(0);
  });
});
