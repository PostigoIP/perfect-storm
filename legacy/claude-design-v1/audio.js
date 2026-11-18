// audio.js — Web Audio droplet + thunder (v1 restored)
//
// Original "filtered noise burst" droplet: a short pink-noise burst run
// through a resonant bandpass that sweeps downward, with a master compressor
// and density-aware ducking so heavy rain doesn't saturate.

(function(){
  let ctx = null;
  let masterGain = null;
  let compressor = null;
  let reverb = null;
  let reverbGain = null;
  let preComp = null;
  let started = false;
  let muted = false;
  let volume = 0.7;
  let eventTimes = [];
  let noiseBuf = null;
  let pinkNoiseBuf = null;

  function ensure(){
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();

    masterGain = ctx.createGain();
    masterGain.gain.value = volume;
    compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -14;
    compressor.knee.value = 14;
    compressor.ratio.value = 6;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.12;
    masterGain.connect(compressor).connect(ctx.destination);

    preComp = ctx.createGain();
    preComp.gain.value = 1.0;
    preComp.connect(masterGain);

    reverb = ctx.createConvolver();
    reverb.buffer = makeImpulse(1.4, 3.2);
    reverbGain = ctx.createGain();
    reverbGain.gain.value = 0.18;
    reverb.connect(reverbGain).connect(preComp);

    buildNoise();
    return ctx;
  }

  function buildNoise(){
    const rate = ctx.sampleRate;
    const len = rate * 0.25;
    noiseBuf = ctx.createBuffer(1, len, rate);
    const d = noiseBuf.getChannelData(0);
    for (let i=0;i<len;i++) d[i] = (Math.random()*2-1);

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

  function densityGain(){
    const now = ctx.currentTime;
    eventTimes = eventTimes.filter(x => now - x < 0.5);
    const recent = eventTimes.length;
    if (recent < 10) return 1.0;
    if (recent < 30) return 1.0 - (recent - 10) / 20 * 0.45;
    if (recent < 60) return 0.55 - (recent - 30) / 30 * 0.30;
    return Math.max(0.12, 0.25 - (recent - 60) / 60 * 0.15);
  }

  // playDroplet — v1: short pink-noise burst through a resonant bandpass that
  // sweeps from high → low. The whole thing is gated by a snappy AD envelope.
  // Pitch / transient / tail / filter / pan / gain still drive variation.
  function playDroplet(p){
    if (!started || muted) return;
    ensure();
    p = p || {};
    const now = ctx.currentTime;

    eventTimes = eventTimes.filter(x => now - x < 0.5);
    if (eventTimes.length > 90 && Math.random() < 0.5) return;
    if (eventTimes.length > 140) return;
    eventTimes.push(now);

    const dGain = densityGain();
    const baseGain = (p.gain ?? 0.7) * 0.55 * dGain;
    const pitch = p.pitch ?? 1;
    const transient = p.transient ?? 0.7;
    const tailAmount = p.tail ?? 0.2;
    const filterAmt = p.filter ?? 0.7;

    // noise source
    const src = ctx.createBufferSource();
    src.buffer = pinkNoiseBuf;
    src.playbackRate.value = 0.7 + Math.random() * 0.6;

    // resonant bandpass — sweeps high → low for a "ploink"
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    const fStart = (1800 + Math.random() * 1600) * (0.8 + pitch * 0.4);
    const fEnd   = (350 + Math.random() * 250) * (0.8 + pitch * 0.4);
    bp.frequency.setValueAtTime(fStart, now);
    bp.frequency.exponentialRampToValueAtTime(fEnd, now + 0.09 + tailAmount * 0.10);
    bp.Q.value = 8 + filterAmt * 10;

    // gentle lowpass to keep harshness down
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2200 + filterAmt * 2000;

    // amplitude envelope: fast attack, short decay; transient param sharpens it
    const env = ctx.createGain();
    const attack = 0.001 + (1 - transient) * 0.004;
    const decay  = 0.05 + tailAmount * 0.18;
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(baseGain, now + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay);

    // pan + dry/wet
    const pan = ctx.createStereoPanner();
    pan.pan.value = p.pan || 0;

    const dry = ctx.createGain();
    dry.gain.value = 1.0;
    const wet = ctx.createGain();
    wet.gain.value = tailAmount * 0.30;

    src.connect(bp).connect(lp).connect(env).connect(pan);
    pan.connect(dry).connect(preComp);
    pan.connect(wet).connect(reverb);

    src.start(now);
    src.stop(now + 0.30);
  }

  function playThunder(p){
    if (!started || muted) return;
    ensure();
    p = p || {};
    const t = ctx.currentTime;
    const intensity = p.intensity || 1.0;

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
