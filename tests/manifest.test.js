import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { validateManifest } from '../scripts/manifest.mjs';

const ok = {
  version: 1,
  sets: { stone: ['stone-0.wav'], glass: ['glass-0.wav'], metal: ['metal-0.wav'], leaf: ['leaf-0.wav'], heavy: ['heavy-0.wav'], thunder: ['thunder-0.mp3'] },
  durations: { 'stone-0.wav': 0.4, 'glass-0.wav': 0.5, 'metal-0.wav': 0.7, 'leaf-0.wav': 0.3, 'heavy-0.wav': 0.9, 'thunder-0.mp3': 6.2 },
};
const all = () => true;

describe('validateManifest', () => {
  it('accepts a complete manifest', () => {
    expect(validateManifest(ok, all)).toEqual([]);
  });
  it('flags a missing required set', () => {
    const m = structuredClone(ok); delete m.sets.leaf;
    expect(validateManifest(m, all)).toContain('set "leaf" missing or empty');
  });
  it('flags files that do not exist', () => {
    expect(validateManifest(ok, (f) => f !== 'glass-0.wav')).toContain('file missing: glass-0.wav');
  });
  it('flags drops longer than 1.0 s', () => {
    const m = structuredClone(ok); m.durations['metal-0.wav'] = 1.4;
    expect(validateManifest(m, all)).toContain('drop too long: metal-0.wav (1.40 s)');
  });
  it('the committed bank, if present, is valid', () => {
    const p = 'public/sounds/manifest.json';
    if (!existsSync(p)) return;
    const m = JSON.parse(readFileSync(p, 'utf8'));
    expect(validateManifest(m, (f) => existsSync(`public/sounds/${f}`))).toEqual([]);
  });
});
