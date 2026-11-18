// One 10 s clip per drop set, identical timing and processing, so sets can be compared by ear.
import { createAudio } from '../src/audio/engine.js';
const log = (s) => { document.getElementById('log').textContent += s + '\n'; };
const SECONDS = 10, N = 45;
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
  const bankName = new URLSearchParams(location.search).get('bank') || 'sounds-drops';
  const audio = createAudio({ manifestUrl: `/${bankName}/manifest.json`, bed: false });
  const bank = await audio.loadBank();
  // fixed pseudo-random times shared by every set
  let seed = 7; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const times = Array.from({ length: N }, () => 0.3 + rnd() * (SECONDS - 0.8)).sort((a, b) => a - b);
  for (const set of Object.keys(bank.grains)) {
    const buf = await audio.offline(SECONDS, (p) => times.forEach((at, k) => p.playCase({ id: k * 17 + 3, severity: 1, detected: true, muts: 0, lineage: 0, outcome: 'recovered' }, set, at)));
    let peak = 0; for (let c = 0; c < buf.numberOfChannels; c++) for (const x of buf.getChannelData(c)) peak = Math.max(peak, Math.abs(x));
    await fetch(`/__save-clip?name=set-${set}.wav`, { method: 'POST', body: wav(buf) });
    log(`${set}: ${N} drops, peak ${(20 * Math.log10(peak)).toFixed(1)} dBFS`);
  }
  log('done');
};
