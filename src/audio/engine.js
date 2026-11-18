// Sample-based rain. Each audible case = one scheduled event, placed in a shared
// acoustic space. No loops. Two bank kinds:
//  v1 one-shots: a short take per case
//  v2 grains: a slice of a long real-rain recording that starts just before one
//     real impact, so overlapping cases rebuild the recording's own texture

import { createSpace } from './space.js';
import { caseToVoice, SET_ALIAS } from './voice.js';
import { pickGrain, grainLength } from './grains.js';
import { mulberry32 } from '../model/rng.js';

export const LOOKAHEAD = 0.08;       // seconds between "now" and the earliest onset
export const MAX_VOICES = 14;        // distinct near drops per 0.5 s; beyond that the bed carries the mass

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
    const src = ctx.createBufferSource();
    let grain = null;
    if (bank.grains) {
      const pool = bank.drops ?? bank.grains;
      const entries = pool[v.set] ?? pool[SET_ALIAS[v.set]] ?? Object.values(pool)[0];
      const g = entries && pickGrain(entries, v.index);
      if (!g) return;
      src.buffer = entries[g.entry].buffer;
      grain = { offset: g.offset, len: grainLength(v.severity ?? 1, rand()) };
    } else {
      const set = bank[v.set] ?? bank.stone;
      if (!set?.length) return;
      src.buffer = set[v.index % set.length];
    }
    src.playbackRate.value = v.rate;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = Math.min(18000, v.lowpassHz); lp.Q.value = 0.5;
    const hp = ctx.createBiquadFilter();   // drops keep no surface thump; the bed keeps the low end
    hp.type = 'highpass'; hp.frequency.value = grain ? 250 : 80; hp.Q.value = 0.6;
    const g = ctx.createGain();
    if (grain) {
      // one drop: near-instant attack, then a natural exponential decay (no hold)
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(v.gain, at + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0005, at + grain.len);
    } else g.gain.value = v.gain;
    const pan = ctx.createStereoPanner(); pan.pan.value = Math.max(-1, Math.min(1, v.pan));
    const send = ctx.createGain(); send.gain.value = grain ? v.send * 0.5 : v.send;   // far drops wetter, near drops dry
    src.connect(hp).connect(lp).connect(g).connect(pan);
    pan.connect(space.layers[v.layer] ?? space.layers.near);
    pan.connect(send).connect(space.reverb);
    if (grain) src.start(at, grain.offset + 0.014, grain.len + 0.01); else src.start(at);   // ~3 ms before the impact
    src.onended = () => { src.disconnect(); hp.disconnect(); lp.disconnect(); g.disconnect(); pan.disconnect(); send.disconnect(); };
  }

  // The rain bed: one looping real recording per material, silent until the
  // epidemic's own density fades it in (setBed). Its texture follows the mix of lineages.
  const bed = {};
  if (bank.grains) {
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7000; lp.Q.value = 0.4;
    lp.connect(space.bedIn);
    for (const [mat, entries] of Object.entries(bank.grains)) {
      const src = ctx.createBufferSource();
      src.buffer = bank.beds?.[mat] ?? entries[0].buffer; src.loop = true;
      const g = ctx.createGain(); g.gain.value = 0;
      src.connect(g).connect(lp);
      src.start(ctx.currentTime, rand() * Math.max(0, src.buffer.duration - 1));
      bed[mat] = g;
    }
    bed._lp = lp;
    // room tone: the quietest stretch of a recording, very low and constant, so sparse drops
    // fall into air rather than digital silence
    const tone = ctx.createBufferSource();
    tone.buffer = (bank.grains.stone ?? Object.values(bank.grains)[0])[0].buffer; tone.loop = true;
    const tlp = ctx.createBiquadFilter(); tlp.type = 'lowpass'; tlp.frequency.value = 2500;
    const tg = ctx.createGain(); tg.gain.value = 0.018;
    tone.connect(tlp).connect(tg).connect(space.bedIn);
    tone.start(ctx.currentTime, rand() * Math.max(0, tone.buffer.duration - 1));
  }

  return {
    space,
    // levels: { material: 0..1 }, darkness 0..1 (denser rain → darker, less sizzle)
    setBed(levels, darkness, at = ctx.currentTime) {
      for (const [mat, g] of Object.entries(bed)) if (mat !== '_lp') g.gain.setTargetAtTime(0.5 * (levels[mat] ?? 0), at, 1.5);
      if (bed._lp) bed._lp.frequency.setTargetAtTime(11000 - 4000 * darkness, at, 1.5);
    },
    playCase(c, surface, at) {
      const evps = density(at);
      const inWindow = recent.filter((x) => x > at - 0.5).length;
      if (inWindow >= MAX_VOICES) {
        // over the cap: keep severe and reported cases first, drop quiet ones
        if (c.severity < 2 || rand() < (inWindow - MAX_VOICES) / MAX_VOICES) return false;
        if (inWindow >= MAX_VOICES * 1.5) return false;
      }
      recent.push(at);
      const v = { ...caseToVoice(c, surface, evps, rand), severity: c.severity };
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
      const g = ctx.createGain(); g.gain.value = 0.8 * intensity;
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
  const load = async (f) => ctx.decodeAudioData(await (await fetchFn(base + f)).arrayBuffer());
  if (manifest.version === 2) {
    const bank = { grains: {} };
    await Promise.all(Object.entries(manifest.sets).map(async ([set, entries]) => {
      bank.grains[set] = await Promise.all(entries.map(async (e) => ({ buffer: await load(e.file), onsets: e.onsets })));
    }));
    await Promise.all(Object.entries(manifest.oneshots ?? {}).map(async ([set, files]) => { bank[set] = await Promise.all(files.map(load)); }));
    // optional separate recordings for the rain bed (drops come from clean drips)
    if (manifest.beds) {
      bank.beds = {};
      await Promise.all(Object.entries(manifest.beds).map(async ([mat, file]) => { bank.beds[mat] = await load(file); }));
    }
    return bank;
  }
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
  const cache = new Map();              // manifest url → decoded bank (switching back is instant)

  const api = {
    get ready() { return !!player; },
    get bankUrl() { return manifestUrl; },
    // Swap the sound bank live; sounds already scheduled finish on the old one.
    async setBank(url) {
      manifestUrl = url;
      if (!cache.has(url)) cache.set(url, await decodeBank(() => ctx ?? new OfflineAudioContext(1, 1, 44100), url, fetchFn));
      if (manifestUrl !== url) return cache.get(url);      // a newer switch won the race
      bank = cache.get(url);
      player = bank && ctx ? createPlayer(ctx, bank) : null;
      if (player) api.setVolume(volume);
      return bank;
    },
    get ctx() { return ctx; },
    async unlock() {
      if (!ctx) ctx = new AC({ latencyHint: 'interactive' });
      if (ctx.state !== 'running') await ctx.resume();
      if (bank && !player) { player = createPlayer(ctx, bank); api.setVolume(volume); }
      return ctx;
    },
    async loadBank() {
      if (!cache.has(manifestUrl)) cache.set(manifestUrl, await decodeBank(() => ctx ?? new OfflineAudioContext(1, 1, 44100), manifestUrl, fetchFn));
      bank = cache.get(manifestUrl);
      if (bank && ctx && !player) { player = createPlayer(ctx, bank); api.setVolume(volume); }
      return bank;
    },
    // offsetSec: seconds after "now + LOOKAHEAD" at which this case sounds
    playCase(c, surface, offsetSec = 0) {
      if (!player || muted) return false;
      const ok = player.playCase(c, surface, ctx.currentTime + LOOKAHEAD + Math.max(0, offsetSec));
      if (ok) api.stats.played++;
      return ok;
    },
    stats: { played: 0 },
    status() {
      return { state: ctx?.state ?? 'not started', rate: ctx?.sampleRate ?? 0, bank: !!bank, player: !!player, muted, played: api.stats.played };
    },
    setBed(levels, darkness = 0) { player?.setBed(levels, darkness); },
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
