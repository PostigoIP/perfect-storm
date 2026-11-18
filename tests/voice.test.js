import { describe, it, expect } from 'vitest';
import { caseToVoice, densityGain, surfaceFor } from '../src/audio/voice.js';
import { mulberry32 } from '../src/model/rng.js';

const base = { id: 10, lineage: 0, muts: 4, detected: true, severity: 1, outcome: 'recovered' };
const lineages = [{ name: 'Founder' }, { name: 'Imported' }, { name: 'Variant α' }, { name: 'Variant β' }];

describe('surfaceFor', () => {
  it('founder → stone, imports → leaf, variants → glass then metal', () => {
    expect(lineages.map((_, i) => surfaceFor(i, lineages))).toEqual(['stone', 'leaf', 'glass', 'metal']);
  });
});

describe('caseToVoice', () => {
  const r = mulberry32(1);
  const v = (o = {}, density = 1) => caseToVoice({ ...base, ...o }, 'stone', density, r);

  it('same lineage surface → same set', () => {
    expect(v().set).toBe('stone');
    expect(v({ id: 99 }).set).toBe('stone');
  });
  it('undetected cases are never near and are wetter', () => {
    for (let i = 0; i < 200; i++) {
      const u = v({ detected: false, id: i });
      expect(u.layer).not.toBe('near');
      expect(u.send).toBeGreaterThan(v({ id: i }, 1).send);
    }
  });
  it('severe cases are louder and brighter than asymptomatic (same distance)', () => {
    expect(v({ severity: 3 }).gain).toBeGreaterThan(v({ severity: 0 }).gain);
    expect(v({ severity: 3 }).lowpassHz).toBeGreaterThan(v({ severity: 0 }).lowpassHz);
  });
  it('drops vary in pitch within 0.95–1.2 (no boxy downward shifts)', () => {
    const rates = Array.from({ length: 400 }, (_, i) => v({ id: i, muts: i % 9 }).rate);
    for (const r of rates) { expect(r).toBeGreaterThanOrEqual(0.95); expect(r).toBeLessThanOrEqual(1.2); }
    expect(Math.max(...rates) - Math.min(...rates)).toBeGreaterThan(0.15);
  });

  it('distance: most drops are soft and far, few close; far drops are darker and wetter', () => {
    const vs = Array.from({ length: 2000 }, (_, i) => v({ id: i, severity: 1 }));
    const db = vs.map((x) => 20 * Math.log10(x.gain / 0.67));
    expect(Math.min(...db)).toBeGreaterThanOrEqual(-24.5);
    expect(Math.max(...db)).toBeLessThanOrEqual(0.5);
    const median = [...db].sort((a, b) => a - b)[1000];
    expect(median).toBeLessThan(-8);
    const far = vs.filter((x) => x.distance > 0.7), near = vs.filter((x) => x.distance < 0.3);
    const mean = (a, k) => a.reduce((s, x) => s + x[k], 0) / a.length;
    expect(mean(far, 'lowpassHz')).toBeLessThan(mean(near, 'lowpassHz'));
    expect(mean(far, 'send')).toBeGreaterThan(mean(near, 'send'));
  });
  it('pan stays within the lineage zone ±0.25', () => {
    const pans = Array.from({ length: 300 }, (_, i) => caseToVoice({ ...base, id: i, lineage: 2 }, 'glass', 1, r).pan);
    const centre = (Math.max(...pans) + Math.min(...pans)) / 2;
    for (const p of pans) expect(Math.abs(p - centre)).toBeLessThanOrEqual(0.25 + 1e-9);
    expect(Math.abs(centre)).toBeLessThanOrEqual(1);
  });
  it('fatal outcomes add a low heavy hit', () => {
    expect(v({ severity: 3, outcome: 'fatal' }).extra).toMatchObject({ set: 'heavy' });
    expect(v().extra).toBeNull();
  });
});

describe('densityGain', () => {
  it('is 1 below 4 events/s, monotone non-increasing, floored at 0.12', () => {
    expect(densityGain(0)).toBe(1);
    expect(densityGain(3.9)).toBe(1);
    let prev = 1;
    for (let e = 0; e < 5000; e += 7) { const g = densityGain(e); expect(g).toBeLessThanOrEqual(prev); expect(g).toBeGreaterThanOrEqual(0.12); prev = g; }
  });
});
