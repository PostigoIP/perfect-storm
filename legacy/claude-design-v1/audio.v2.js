// audio.js — Web Audio droplet synthesis + thunder
// v2 — physical-model water-drop (sine bubble chirp + soft impact) instead of
// raw filtered noise. Master compressor + density-aware ducking prevents
// saturation when incidence is high.

(function(){
  let ctx = null;
  let masterGain = null;
  let compressor = null;
  let reverb = null;
  let reverbGain = null;
  let preComp = null;       // bus that feeds the compressor
  let started = false;
  let muted = false;
  let volume = 0.7;
  let eventTimes = [];      // for density tracking
  let noiseBuf = null;
  let pinkNoiseBuf = null;

  function ensure(){
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();

    // master → compressor → destination
    masterGain = ctx.createGain();
    masterGain.gain.value = volume;
    compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -14;
    compressor.knee.value = 14;
    compressor.ratio.value = 6;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.12;
    masterGain.connect(compressor).connect(ctx.destination);

    // pre-comp bus all sounds feed into
    preComp = ctx.createGain();
    preComp.gain.value = 1.0;
    preComp.connect(masterGain);

    // mild "air" reverb (short room, not a wash)
    reverb = ctx.createConvolver();
    reverb.buffer = makeImpulse(1.4, 3.2);
    reverbGain = ctx.createGain();
    reverbGain.gain.value = 0.18;
    reverb.connect(reverbGain).connect(preComp);

    // pre-build noise tables
    buildNoise();
    return ctx;
  }

  function buildNoise(){
    const rate = ctx.sampleRate;
    // white noise
    const len = rate * 0.25;
    noiseBuf = ctx.createBuffer(1, len, rate);
    const d = noiseBuf.getChannelData(0);
    for (let i=0;i<len;i++) d[i] = (Math.random()*2-1);

    // pink-ish noise (Voss-McCartney approx) — softer than white for drop tails
    pinkNoiseBuf = ctx.createBuffer(1, len, rate);
    const p = pinkNoiseBuf.getChannelData(0);
    let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
    for (let i=0;i<len;i++){
      const w = Math.random()*2-1;
      b0 = 0.99886*b0 + w*0.0555179;
      b1 = 0.99332*b1 + w*0.0750759;
      b2 = 0.96900*b2 + w*0.1538520;
      b3 = 0.86650*b3 + w*0.3104856;
      b4 = 0.55000*b4 + w*0.5329522;
      b5 = -0.7616*b5 - w*0.0168980;
      p[i] = (b0+b1+b2+b3+b4+b5+b6+w*0.5362) * 0.11;
      b6 = w * 0.115926;
    }
  }

  function makeImpulse(seconds, decay){
    const rate = ctx.sampleRate;
    const len = Math.max(1, Math.floor(rate * seconds));
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch=0; ch<2; ch++){
      const d = buf.getChannelData(ch);
      for (let i=0;i<len;i++){
        d[i] = (Math.random()*2-1) * Math.pow(1 - i/len, decay);
      }
    }
    return buf;
  }

  async function start(){
    ensure();
    if (ctx.state === 'suspended') await ctx.resume();
    started = true;
  }

  function setVolume(v){
    volume = Math.max(0, Math.min(1, v));
    if (masterGain) masterGain.gain.setTargetAtTime(muted ? 0 : volume, ctx.currentTime, 0.05);
  }
  function setMuted(m){
    muted = !!m;
    if (masterGain) masterGain.gain.setTargetAtTime(muted ? 0 : volume, ctx.currentTime, 0.05);
  }

  // density-aware gain reduction so heavy rain doesn't saturate
  function densityGain(){
    const now = ctx.currentTime;
    eventTimes = eventTimes.filter(x => now - x < 0.5);
    const recent = eventTimes.length;
    // smooth ramp: gain drops from 1.0 at 0 events to ~0.18 at 80 events / 0.5s
    if (recent < 10) return 1.0;
    if (recent < 30) return 1.0 - (recent - 10) / 20 * 0.45;     // 1.0 → 0.55
    if (recent < 60) return 0.55 - (recent - 30) / 30 * 0.30;    // 0.55 → 0.25
    return Math.max(0.12, 0.25 - (recent - 60) / 60 * 0.15);
  }

  // playDroplet — physical-ish water bubble drop.
  // A real drop produces an upward chirp because the entrained-air cavity
  // (Helmholtz resonator) shrinks as the splash forms, raising its resonant
  // frequency. We model this with a sine that ramps upward in pitch, plus a
  // tiny pink-noise "impact" transient, and a subtle filtered tail.
  function playDroplet(p){
    if (!started || muted) return;
    ensure();
    p = p || {};
    const now = ctx.currentTime;

    // probabilistic skip when very dense
    eventTimes = eventTimes.filter(x => now - x < 0.5);
    if (eventTimes.length > 90 && Math.random() < 0.5) return;
    if (eventTimes.length > 140) return; // hard cap
    eventTimes.push(now);

    const dGain = densityGain();
    const baseGain = (p.gain ?? 0.7) * 0.42 * dGain;

    // === 1) Bubble — sine with upward chirp ===
    const pitch = p.pitch ?? 1;
    const fStart = 280 + Math.random()*160 + (pitch-1)*180;
    const fPeak  = fStart * (1.7 + Math.random()*0.6 + (p.transient||0.7)*0.5);
    const fEnd   = fPeak * (0.92 - Math.random()*0.06);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(fStart, now);
    osc.frequency.exponentialRampToValueAtTime(fPeak, now + 0.022);
    osc.frequency.exponentialRampToValueAtTime(fEnd,  now + 0.10 + (p.tail||0.2)*0.20);

    // second sine an octave above for a touch of brightness (Helmholtz overtone)
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(fStart*2, now);
    osc2.frequency.exponentialRampToValueAtTime(fPeak*2, now + 0.022);

    const oscMix = ctx.createGain();
    oscMix.gain.value = 1.0;
    const osc2Mix = ctx.createGain();
    osc2Mix.gain.value = 0.18;

    osc.connect(oscMix);
    osc2.connect(osc2Mix);

    // bubble amplitude envelope
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(baseGain, now + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.16 + (p.tail||0.2)*0.30);

    oscMix.connect(env);
    osc2Mix.connect(env);

    // === 2) Impact — tiny pink-noise click ===
    const impact = ctx.createBufferSource();
    impact.buffer = pinkNoiseBuf;
    impact.playbackRate.value = 0.9 + Math.random()*0.3;
    const ihp = ctx.createBiquadFilter();
    ihp.type = 'highpass';
    ihp.frequency.value = 800;
    const ibp = ctx.createBiquadFilter();
    ibp.type = 'bandpass';
    ibp.frequency.value = 1800 + Math.random()*1200;
    ibp.Q.value = 1.0;
    const iEnv = ctx.createGain();
    iEnv.gain.setValueAtTime(0, now);
    iEnv.gain.linearRampToValueAtTime(baseGain * 0.45 * (p.transient||0.7), now + 0.0008);
    iEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.018);

    impact.connect(ihp).connect(ibp).connect(iEnv);

    // === 3) Tail — gentle filtered noise wash for ambient body ===
    const tailAmount = (p.tail||0.2);
    const tail = ctx.createBufferSource();
    tail.buffer = pinkNoiseBuf;
    tail.playbackRate.value = 0.6 + Math.random()*0.2;
    const tlp = ctx.createBiquadFilter();
    tlp.type = 'lowpass';
    tlp.frequency.value = 1200 + (p.filter||0.7)*1800;
    const tEnv = ctx.createGain();
    tEnv.gain.setValueAtTime(0, now);
    tEnv.gain.linearRampToValueAtTime(baseGain * 0.10 * tailAmount, now + 0.006);
    tEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.10 + tailAmount*0.30);
    tail.connect(tlp).connect(tEnv);

    // === pan + bus ===
    const pan = ctx.createStereoPanner();
    pan.pan.value = p.pan || 0;

    const dry = ctx.createGain();
    dry.gain.value = 1.0;
    const wet = ctx.createGain();
    wet.gain.value = tailAmount * 0.35;

    env.connect(pan);
    iEnv.connect(pan);
    tEnv.connect(pan);
    pan.connect(dry).connect(preComp);
    pan.connect(wet).connect(reverb);

    osc.start(now);
    osc.stop(now + 0.35);
    osc2.start(now);
    osc2.stop(now + 0.35);
    impact.start(now);
    impact.stop(now + 0.04);
    tail.start(now);
    tail.stop(now + 0.45);
  }

  function playThunder(p){
    if (!started || muted) return;
    ensure();
    p = p || {};
    const t = ctx.currentTime;
    const intensity = p.intensity || 1.0;

    // low rumble
    const src = ctx.createBufferSource();
    src.buffer = pinkNoiseBuf;
    src.loop = true;
    src.playbackRate.value = 0.55;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 200;
    lp.Q.value = 0.7;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.42 * intensity, t + 0.05);
    env.gain.linearRampToValueAtTime(0.16 * intensity, t + 0.45);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);

    const pan = ctx.createStereoPanner();
    pan.pan.value = (Math.random()-0.5) * 0.6;

    src.connect(lp).connect(env).connect(pan).connect(preComp);
    pan.connect(reverb);

    // crack
    const crack = ctx.createBufferSource();
    crack.buffer = noiseBuf;
    crack.playbackRate.value = 1.5;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2200;
    const cenv = ctx.createGain();
    cenv.gain.setValueAtTime(0, t);
    cenv.gain.linearRampToValueAtTime(0.42 * intensity, t + 0.005);
    cenv.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    crack.connect(hp).connect(cenv).connect(pan);

    src.start(t);
    src.stop(t + 2.8);
    crack.start(t + 0.012);
    crack.stop(t + 0.3);
  }

  window.PSAudio = {
    start, setVolume, setMuted,
    playDroplet, playThunder,
    isStarted: () => started,
  };
})();
