// The acoustic space: three distance buses, a generated courtyard reverb,
// thunder ducking, glue compression and a brick-wall-ish limiter.
// Works on any BaseAudioContext (live or offline).

export function createSpace(ctx) {
  const master = ctx.createGain();
  const glue = ctx.createDynamicsCompressor();
  glue.threshold.value = -10; glue.ratio.value = 1.5; glue.knee.value = 6;    // gentle: no pumping
  glue.attack.value = 0.1; glue.release.value = 0.4;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -4; limiter.ratio.value = 20; limiter.knee.value = 0;
  limiter.attack.value = 0.001; limiter.release.value = 0.1;
  const trim = ctx.createGain(); trim.gain.value = 1.27;   // +3 dB over the old 0.9: sparse chapters were too quiet
  const volume = ctx.createGain(); volume.gain.value = 0.8;
  // a gentle tilt: -3 dB above 5 kHz so dense rain is a wash, not a sizzle
  const tilt = ctx.createBiquadFilter(); tilt.type = 'highshelf'; tilt.frequency.value = 5000; tilt.gain.value = -3;
  master.connect(tilt).connect(glue).connect(trim).connect(limiter).connect(volume).connect(ctx.destination);   // gain before the limiter, so nothing escapes it

  // rain sits on a duckable bus so thunder can breathe
  const duck = ctx.createGain();
  duck.connect(master);

  const reverb = ctx.createConvolver();
  reverb.buffer = courtyardIR(ctx);
  const reverbReturn = ctx.createGain(); reverbReturn.gain.value = 0.8;
  const reverbTone = ctx.createBiquadFilter(); reverbTone.type = 'highpass'; reverbTone.frequency.value = 180;
  reverb.connect(reverbTone).connect(reverbReturn).connect(duck);

  // the rain bed enters on the duckable bus, unfiltered by the distance buses
  const bedIn = ctx.createGain();
  bedIn.connect(duck);

  const near = ctx.createGain();
  near.connect(duck);
  const mid = ctx.createGain(); mid.gain.value = 0.75;
  const midLp = ctx.createBiquadFilter(); midLp.type = 'lowpass'; midLp.frequency.value = 6500;
  mid.connect(midLp).connect(duck);
  const far = ctx.createGain(); far.gain.value = 0.5;
  const farHp = ctx.createBiquadFilter(); farHp.type = 'highpass'; farHp.frequency.value = 500;
  const farLp = ctx.createBiquadFilter(); farLp.type = 'lowpass'; farLp.frequency.value = 3200;
  far.connect(farHp).connect(farLp).connect(duck);

  // Thunder recordings are mostly < 250 Hz, which laptop speakers can't reproduce.
  // Psychoacoustic bass: saturate the rumble to create harmonics at 200 Hz–1.2 kHz
  // (audible on small speakers; the ear infers the fundamental), in parallel with the dry signal.
  const thunderBus = ctx.createGain();
  const sub = ctx.createBiquadFilter(); sub.type = 'highpass'; sub.frequency.value = 40;
  thunderBus.connect(sub).connect(master);
  const lowOnly = ctx.createBiquadFilter(); lowOnly.type = 'lowpass'; lowOnly.frequency.value = 300;
  const shaper = ctx.createWaveShaper();
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) { const x = (i / (curve.length - 1)) * 2 - 1; curve[i] = Math.tanh(4 * x) / Math.tanh(4); }
  shaper.curve = curve; shaper.oversample = '2x';
  const harmonics = ctx.createBiquadFilter(); harmonics.type = 'bandpass'; harmonics.frequency.value = 500; harmonics.Q.value = 0.5;
  const harmGain = ctx.createGain(); harmGain.gain.value = 0.4;
  thunderBus.connect(lowOnly).connect(shaper).connect(harmonics).connect(harmGain).connect(master);
  const thunderSend = ctx.createGain(); thunderSend.gain.value = 0.35;
  thunderBus.connect(thunderSend).connect(reverb);

  return {
    ctx, master, volume, reverb, thunderBus, bedIn,
    layers: { near, mid, far },
    duckFor(at, seconds = 1.5, db = -4) {
      const g = duck.gain, lo = Math.pow(10, db / 20);
      g.cancelScheduledValues(at);
      g.setTargetAtTime(lo, at, 0.05);
      g.setTargetAtTime(1, at + seconds, 0.4);
    },
  };
}

// Stereo impulse response: 18 ms pre-delay, sparse early reflections,
// then a decorrelated tail that darkens as it decays (≈2.4 s).
function courtyardIR(ctx) {
  const sr = ctx.sampleRate, len = Math.floor(sr * 0.4);   // short outdoor diffuser, not a hall: no metallic phasing
  const buf = ctx.createBuffer(2, len, sr);
  const pre = Math.floor(0.018 * sr);
  const taps = [[0.011, 0.5], [0.019, 0.38], [0.027, 0.3], [0.041, 0.24], [0.058, 0.18], [0.073, 0.14]];
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let seed = 1234 + ch * 777;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
    for (const [t, g] of taps) {
      const i = pre + Math.floor((t + (ch ? 0.0031 : 0)) * sr);
      if (i < len) d[i] += g * (ch ? -1 : 1);
    }
    let lp = 0;
    for (let i = pre; i < len; i++) {
      const k = (i - pre) / (len - pre);
      const env = Math.pow(1 - k, 2.2) * Math.exp(-k * 3.2);
      const a = 0.25 + 0.7 * k;               // one-pole low-pass that closes over time
      lp = lp * a + rnd() * (1 - a);
      d[i] += lp * env * 0.9;
    }
  }
  return buf;
}
