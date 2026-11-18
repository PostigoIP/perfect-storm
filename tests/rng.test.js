import { describe, it, expect } from 'vitest';
import { mulberry32, gamma, poisson, binomial } from '../src/model/rng.js';

const mean = (f, n = 20000) => { let s = 0; for (let i = 0; i < n; i++) s += f(); return s / n; };

describe('rng', () => {
  it('same seed gives the same sequence', () => {
    const a = mulberry32(42), b = mulberry32(42);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });
  it('gamma mean ≈ shape·scale', () => {
    const r = mulberry32(1);
    expect(Math.abs(mean(() => gamma(r, 4, 1.25)) - 5) / 5).toBeLessThan(0.03);
    expect(Math.abs(mean(() => gamma(r, 0.7, 2)) - 1.4) / 1.4).toBeLessThan(0.03);
  });
  it('poisson mean ≈ λ', () => {
    const r = mulberry32(2);
    expect(Math.abs(mean(() => poisson(r, 3)) - 3) / 3).toBeLessThan(0.03);
    expect(Math.abs(mean(() => poisson(r, 80)) - 80) / 80).toBeLessThan(0.03);
  });
  it('binomial mean ≈ n·p, bounded to [0, n]', () => {
    const r = mulberry32(3);
    expect(Math.abs(mean(() => binomial(r, 1000, 0.1)) - 100) / 100).toBeLessThan(0.03);
    expect(Math.abs(mean(() => binomial(r, 20, 0.2)) - 4) / 4).toBeLessThan(0.03);
    for (let i = 0; i < 2000; i++) { const k = binomial(r, 50, 0.9); expect(k).toBeGreaterThanOrEqual(0); expect(k).toBeLessThanOrEqual(50); }
  });
});
