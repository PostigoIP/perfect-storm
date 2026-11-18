// Sample-based rain. Each audible case = one scheduled one-shot from the
// ElevenLabs bank, placed in a shared acoustic space. No loops.

import { createSpace } from './space.js';
import { caseToVoice } from './voice.js';
import { mulberry32 } from '../model/rng.js';

export const LOOKAHEAD = 0.08;       // seconds between "now" and the earliest onset
export const MAX_VOICES = 96;        // per 0.5 s window

// Player bound to one context: schedules voices, tracks density, enforces the cap.
function createPlayer(ctx, bank, seed = 9) {
  const space = createSpace(ctx);
  const rand = mulberry32(seed);
  let recent = [];                   // onset times (ctx time)

  function density(at) {
    recent = recent.filter((x) => x > at - 1);
    return recent.length;            // events per second
  }

  function voiceNode(v, at) {
    const set = bank[v.set];
    if (!set?.length) return;
    const src = ctx.createBufferSource();
    src.buffer = set[v.index % set.length];
    src.playbackRate.value = v.rate;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = Math.min(18000, v.lowpassHz); lp.Q.value = 0.5;
    const g = ctx.createGain(); g.gain.value = v.gain;
    const pan = ctx.createStereoPanner(); pan.pan.value = Math.max(-1, Math.min(1, v.pan));
    const send = ctx.createGain(); send.gain.value = v.send;
    src.connect(lp).connect(g).connect(pan);
    pan.connect(space.layers[v.layer] ?? space.layers.near);
    pan.connect(send).connect(space.reverb);
    src.start(at);
    src.onended = () => { src.disconnect(); lp.disconnect(); g.disconnect(); pan.disconnect(); send.disconnect(); };
  }

  return {
    space,
    playCase(c, surface, at) {
      const evps = density(at);
      const inWindow = recent.filter((x) => x > at - 0.5).length;
      if (inWindow >= MAX_VOICES) {
        // over the cap: keep severe and reported cases first, drop quiet ones
        if (c.severity < 2 || rand() < (inWindow - MAX_VOICES) / MAX_VOICES) return false;
        if (inWindow >= MAX_VOICES * 1.5) return false;
      }
      recent.push(at);
      const v = caseToVoice(c, surface, evps, rand);
      voiceNode(v, at);
      if (v.extra) voiceNode({ ...v, ...v.extra, index: v.index, layer: 'mid', send: 0.3, pan: v.pan * 0.5 }, at + 0.02);
      return true;
    },
    thunder(at, intensity = 1) {
      const set = bank.thunder;
      if (!set?.length) return;
      const src = ctx.createBufferSource();
      src.buffer = set[Math.floor(rand() * set.length)];
      src.playbackRate.value = 0.92 + rand() * 0.12;
      const g = ctx.createGain(); g.gain.value = 0.85 * intensity;
      src.connect(g).connect(space.thunderBus);
      src.start(at);
      space.duckFor(at + 0.05, 1.8, -5);
    },
  };
}

async function decodeBank(getCtx, manifestUrl, fetchFn) {
  let res;
  try { res = await fetchFn(manifestUrl); } catch { return null; }
  if (!res.ok) return null;
  const manifest = await res.json();
  const ctx = getCtx();
  const base = manifestUrl.replace(/manifest\.json$/, '');
  const bank = {};
  await Promise.all(Object.entries(manifest.sets).map(async ([set, files]) => {
    bank[set] = await Promise.all(files.map(async (f) => {
      const ab = await (await fetchFn(base + f)).arrayBuffer();
      return ctx.decodeAudioData(ab);
    }));
  }));
  return bank;
}

export function createAudio({ manifestUrl = './sounds/manifest.json', fetchFn = (u) => fetch(u), AC = globalThis.AudioContext || globalThis.webkitAudioContext } = {}) {
  let ctx = null, bank = null, player = null, muted = false, volume = 0.8;

  const api = {
    get ready() { return !!player; },
    get ctx() { return ctx; },
    async unlock() {
      if (!ctx) ctx = new AC({ latencyHint: 'interactive' });
      if (ctx.state !== 'running') await ctx.resume();
      if (bank && !player) { player = createPlayer(ctx, bank); api.setVolume(volume); }
      return ctx;
    },
    async loadBank() {
      bank = await decodeBank(() => ctx ?? new OfflineAudioContext(1, 1, 44100), manifestUrl, fetchFn);
      if (bank && ctx && !player) { player = createPlayer(ctx, bank); api.setVolume(volume); }
      return bank;
    },
    // offsetSec: seconds after "now + LOOKAHEAD" at which this case sounds
    playCase(c, surface, offsetSec = 0) {
      if (!player || muted) return false;
      return player.playCase(c, surface, ctx.currentTime + LOOKAHEAD + Math.max(0, offsetSec));
    },
    thunder(intensity = 1) {
      if (!player || muted) return;
      player.thunder(ctx.currentTime + LOOKAHEAD, intensity);
    },
    setVolume(v) {
      volume = v;
      if (player) player.space.volume.gain.setTargetAtTime(muted ? 0 : v, ctx.currentTime, 0.05);
    },
    setMuted(m) { muted = m; api.setVolume(volume); },
    // Render `seconds` of audio offline; script(p) schedules via p.playCase(c, surface, at) / p.thunder(at).
    async offline(seconds, script, sampleRate = 44100) {
      if (!bank) throw new Error('no bank');
      const off = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);
      const p = createPlayer(off, bank);
      p.space.volume.gain.value = volume;
      script(p);
      return off.startRendering();
    },
  };
  return api;
}
