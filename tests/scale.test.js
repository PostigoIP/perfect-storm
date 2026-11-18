import { describe, it, expect } from 'vitest';
import { yScale } from '../src/view/scale.js';

describe('yScale', () => {
  it('linear: proportional, ticks at nice values within range', () => {
    const s = yScale('linear', 400);
    expect(s.f(0)).toBe(0); expect(s.f(200)).toBeCloseTo(0.5); expect(s.f(400)).toBeCloseTo(1);
    expect(s.ticks.map((t) => t.v)).toEqual([100, 200, 300, 400]);
  });
  it('log: equal ratios get equal heights, zero sits on the baseline', () => {
    const s = yScale('log', 1000);
    expect(s.f(0)).toBe(0);
    expect(s.f(1000)).toBeCloseTo(1);
    // 10→100 spans about the same height as 100→1000 (log1p is close to log for large v)
    expect(Math.abs((s.f(100) - s.f(10)) - (s.f(1000) - s.f(100)))).toBeLessThan(0.05);
    expect(s.ticks.map((t) => t.v)).toEqual([1, 10, 100, 1000]);
  });
  it('log keeps small numbers visible', () => {
    const s = yScale('log', 1000);
    expect(s.f(5)).toBeGreaterThan(0.2);
  });
});
