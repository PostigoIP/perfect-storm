import { describe, it, expect } from 'vitest';
import { createAudio } from '../src/audio/engine.js';

describe('createAudio', () => {
  it('loadBank returns null on 404 (app runs silent)', async () => {
    const a = createAudio({ fetchFn: async () => ({ ok: false, status: 404 }) });
    expect(await a.loadBank()).toBeNull();
    expect(a.ready).toBe(false);
    expect(a.playCase({ id: 1 }, 'stone')).toBe(false);
  });
  it('loadBank returns null when the network fails', async () => {
    const a = createAudio({ fetchFn: async () => { throw new Error('offline'); } });
    expect(await a.loadBank()).toBeNull();
  });
});
