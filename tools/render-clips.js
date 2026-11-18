// Renders three 12 s review clips straight from the simulation through the real
// audio engine (OfflineAudioContext), reports peaks, and saves WAVs (dev only).
import { createSim } from '../src/model/sim.js';
import { createAudio } from '../src/audio/engine.js';
import { materialFor } from '../src/audio/voice.js';
import { bedLevel } from '../src/audio/grains.js';

const log = (s) => { document.getElementById('log').textContent += s + '\n'; };
const SECONDS = 12;
const BED = new URLSearchParams(location.search).get('bed') === '1';
const SCENARIOS = [
  { name: 'sparse', rate: 2, beta: 0.32 },
  { name: 'building', rate: 20, beta: 0.45, variantAt: null },
  { name: 'heavy', rate: 200, beta: 0.55, variantAt: null },   // dense rain, no thunder: for spectral checks
  { name: 'storm', rate: 200, beta: 0.55, variantAt: 4 },
];

function wav(buf) {
  const n = buf.length, ch = buf.numberOfChannels, out = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const w = (o, s) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); out.setUint32(4, 36 + n * ch * 2, true); w(8, 'WAVEfmt ');
  out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, ch, true);
  out.setUint32(24, buf.sampleRate, true); out.setUint32(28, buf.sampleRate * ch * 2, true);
  out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, n * ch * 2, true);
  const data = [...Array(ch)].map((_, c) => buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { out.setInt16(o, Math.max(-1, Math.min(1, data[c][i])) * 0x7fff, true); o += 2; }
  return out.buffer;
}

async function render(audio, sc, bankName) {
  const sim = createSim({ seed: 21, params: { beta: sc.beta, importRate: 0.5 } });
  let guard = 0;
  while (sim.snapshot().incidenceToday < sc.rate * 0.6 && guard++ < 3000) sim.step(0.1);
  if (sc.name !== 'sparse') sim.introduceVariant('Variant α', { tx: 1.6 });
  const inc = Math.max(1, sim.snapshot().incidenceToday);
  const daysPerSec = Math.min(4, sc.rate / inc);
  const t0 = sim.t, events = [];
  let thunderAt = null;
  while (sim.t < t0 + SECONDS * daysPerSec) {
    if (sc.variantAt != null && thunderAt == null && sim.t >= t0 + sc.variantAt * daysPerSec) {
      sim.introduceVariant('Variant β', { tx: 1.8 }); thunderAt = sc.variantAt;
    }
    for (const c of sim.step(0.1)) events.push({ c, at: 0.3 + (c.tOnset - t0) / daysPerSec });
  }
  const buf = await audio.offline(SECONDS + 2, (p) => {
    for (const e of events) if (e.at < SECONDS) p.playCase(e.c, materialFor(e.c.lineage, sim.lineages), e.at);
    // drive the bed exactly as the app does: level from drops/s, texture from recent lineages
    for (let t = 0; BED && t < SECONDS; t += 0.25) {
      const win = events.filter((e) => e.at > t - 1 && e.at <= t);
      const mix = events.filter((e) => e.at > t - 3 && e.at <= t);
      const level = bedLevel(win.length, audio.mix.bedFrom, audio.mix.bedFull);
      const levels = {};
      for (const e of mix) { const m = materialFor(e.c.lineage, sim.lineages).split(':')[0]; levels[m] = (levels[m] ?? 0) + level / mix.length; }
      p.setBed(levels, level, t);
    }
    if (thunderAt != null) p.thunder(thunderAt + 0.3, 1);
  });
  let peak = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) for (const x of buf.getChannelData(c)) peak = Math.max(peak, Math.abs(x));
  const db = 20 * Math.log10(peak || 1e-9);
  log(`${sc.name}: ${events.filter((e) => e.at < SECONDS).length} cases in ${SECONDS}s (${(events.length / SECONDS).toFixed(0)}/s), peak ${db.toFixed(2)} dBFS ${db <= -1 ? 'OK' : 'TOO HOT'}`);
  await fetch(`/__save-clip?name=${bankName}${new URLSearchParams(location.search).get('deaths') === '0' ? '-nodeaths' : ''}-${sc.name}.wav`, { method: 'POST', body: wav(buf) });
  return db;
}

document.getElementById('go').onclick = async () => {
  const bankName = new URLSearchParams(location.search).get('bank') || 'sounds';
  const audio = createAudio({ manifestUrl: `/${bankName}/manifest.json`, bed: BED });
  const DEATHS = new URLSearchParams(location.search).get('deaths') !== '0';
  audio.setDeaths(DEATHS);
  if (!(await audio.loadBank())) { log('no sound bank (public/sounds/manifest.json) — generate it first'); return; }
  const peaks = [];
  for (const sc of SCENARIOS) peaks.push(await render(audio, sc, bankName));
  log('done');
  window.__peaks = peaks;
};
