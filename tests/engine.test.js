import { describe, it, expect, vi, afterEach } from 'vitest';
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

  it('setBank to a missing bank keeps running silently and reports null', async () => {
    const asked = [];
    const a = createAudio({ fetchFn: async (u) => { asked.push(u); return { ok: false, status: 404 }; } });
    expect(await a.setBank('./sounds-x/manifest.json')).toBeNull();
    expect(asked).toContain('./sounds-x/manifest.json');
    expect(a.bankUrl).toBe('./sounds-x/manifest.json');
    expect(a.ready).toBe(false);
  });

  describe('unlock on iPhone (silent switch)', () => {
    afterEach(() => vi.unstubAllGlobals());
    class FakeAC { constructor() { this.state = 'suspended'; this.sampleRate = 48000; } async resume() { this.state = 'running'; } }

    it('asks for a playback audio session before the context starts, so the silent switch does not mute it', async () => {
      const session = { type: 'auto' };
      let typeWhenCreated = null;
      class AC extends FakeAC { constructor() { super(); typeWhenCreated = session.type; } }
      vi.stubGlobal('navigator', { audioSession: session });
      const a = createAudio({ AC, fetchFn: async () => ({ ok: false, status: 404 }) });
      await a.unlock();
      expect(session.type).toBe('playback');
      expect(typeWhenCreated).toBe('playback');
    });

    it('does not touch the audio session until Listen is chosen', () => {
      const session = { type: 'auto' };
      vi.stubGlobal('navigator', { audioSession: session });
      createAudio({ AC: FakeAC, fetchFn: async () => ({ ok: false, status: 404 }) });
      expect(session.type).toBe('auto');
    });

    it('still unlocks where the audio session API is missing or refuses', async () => {
      vi.stubGlobal('navigator', {});
      const a = createAudio({ AC: FakeAC, fetchFn: async () => ({ ok: false, status: 404 }) });
      expect((await a.unlock()).state).toBe('running');
      const refusing = { get type() { return 'auto'; }, set type(v) { throw new Error('not allowed'); } };
      vi.stubGlobal('navigator', { audioSession: refusing });
      const b = createAudio({ AC: FakeAC, fetchFn: async () => ({ ok: false, status: 404 }) });
      expect((await b.unlock()).state).toBe('running');
    });
  });
});
