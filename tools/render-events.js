// Render a sound timeline logged during a screen recording (tools/rec/events.json)
// through the app's own engine, offline, so it can be muxed with the video.
import { createAudio } from '../src/audio/engine.js';
const log = (s) => { document.getElementById('log').textContent += s + '\n'; };
function wav(buf) {
  const n = buf.length, ch = buf.numberOfChannels, out = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const w = (o, s) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); out.setUint32(4, 36 + n * ch * 2, true); w(8, 'WAVEfmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true);
  out.setUint16(22, ch, true); out.setUint32(24, buf.sampleRate, true); out.setUint32(28, buf.sampleRate * ch * 2, true);
  out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, n * ch * 2, true);
  const d = [...Array(ch)].map((_, c) => buf.getChannelData(c)); let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { out.setInt16(o, Math.max(-1, Math.min(1, d[c][i])) * 0x7fff, true); o += 2; }
  return out.buffer;
}
document.getElementById('go').onclick = async () => {
  const q = new URLSearchParams(location.search);
  const bank = q.get('bank') || 'sounds-textures', name = q.get('out') || 'recording-audio.wav';
  const { duration, events } = await (await fetch('/tools/rec/events.json')).json();
  const audio = createAudio({ manifestUrl: `/${bank}/manifest.json`, bed: false });
  audio.setDeaths(q.get('deaths') !== '0');
  await audio.loadBank();
  // Render in 5 s chunks: an offline graph holding a minute of scheduled sources is
  // processed node by node every block and crawls. Each chunk gets a pre-roll (drops from
  // 1.5 s before, thunder from 8 s before) that is rendered and then discarded.
  const SR = 44100, CHUNK = 5, PRE_DROP = 1.5, PRE_THUNDER = 8;
  const total = new Float32Array(Math.ceil(duration * SR)), total2 = new Float32Array(total.length);
  for (let a = 0; a < duration; a += CHUNK) {
    const b = Math.min(duration, a + CHUNK), start = Math.max(0, a - PRE_THUNDER);
    const part = await audio.offline(b - start, (p) => {
      for (const e of events) {
        if (e.kind === 'drop' && e.t >= Math.max(start, a - PRE_DROP) && e.t < b) p.playCase(e.c, e.material, e.t - start);
        if (e.kind === 'thunder' && e.t >= start && e.t < b) p.thunder(e.t - start, e.intensity ?? 1);
      }
    }, SR);
    const off = Math.round((a - start) * SR), L = part.getChannelData(0), R = part.getChannelData(1);
    total.set(L.subarray(off, off + Math.round((b - a) * SR)), Math.round(a * SR));
    total2.set(R.subarray(off, off + Math.round((b - a) * SR)), Math.round(a * SR));
    log(`  chunk ${a.toFixed(0)}–${b.toFixed(0)} s`);
  }
  const buf = { length: total.length, numberOfChannels: 2, sampleRate: SR, getChannelData: (c) => (c ? total2 : total) };
  let peak = 0; for (const x of total) peak = Math.max(peak, Math.abs(x)); for (const x of total2) peak = Math.max(peak, Math.abs(x));
  await fetch(`/__save-clip?name=${name}`, { method: 'POST', body: wav(buf) });
  log(`${events.length} events, ${duration.toFixed(1)} s, peak ${(20 * Math.log10(peak)).toFixed(1)} dBFS → review/clips/${name}\ndone`);
};
