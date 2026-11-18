// engine.js — SEIR epidemic engine + clinical case sampler + event scheduler
// Plain JS, exported on window. No rendering, no audio. Communicates via a
// snapshot getter and an `onCase(cb)` event sink.

(function(){
  // small deterministic-ish PRNG (mulberry32) so resets feel coherent
  function rng(seed){
    let t = seed >>> 0 || 1;
    return function(){
      t += 0x6D2B79F5;
      let r = t;
      r = Math.imul(r ^ (r >>> 15), r | 1);
      r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  const VARIANT_DEFS = {
    wild:  { id:'wild',  name:'Wildtype',  hue: 230, tx: 1.00, severityShift: 0 },
    alpha: { id:'alpha', name:'Alpha',     hue: 60,  tx: 1.55, severityShift: 0.05 },
    beta:  { id:'beta',  name:'Beta',      hue: 350, tx: 2.10, severityShift: 0.12 },
  };

  function makeEngine(opts){
    opts = opts || {};
    const POP = opts.population || 100000;
    let state = {
      S: POP - 8,
      E: 0,
      I: 8,
      R: 0,
      pop: POP,
      day: 0,
      // running stats
      cumulativeCases: 8,
      incidenceWindow: [],   // last N ticks of new infections
      newToday: 0,
      newAtTick: 0,
      // R_eff approximation
      reff: 1.0,
      // active variants
      variants: { wild: { ...VARIANT_DEFS.wild, share: 1, intros: 0 } },
      lastVariantIntro: null,
      lastImport: null,
    };

    // parameters (live-mutable)
    const params = {
      beta: 0.34,            // transmission rate per contact-day
      sigma: 1/3.5,          // 1/incubation
      gamma: 1/7,            // 1/infectious duration
      immunity: 0.18,        // baseline fraction already immune
      detection: 0.45,       // probability a case is "detected" / reported
      importRate: 0,         // baseline imports/day (slider)
      speed: 1,              // ticks per real second multiplier
      reducedMotion: false,
    };

    // apply baseline immunity on construct
    state.R = Math.floor(POP * params.immunity);
    state.S = POP - state.R - state.I - state.E;

    let rand = rng(42);
    let listeners = new Set();
    let running = false;
    let acc = 0;
    let lastT = performance.now();
    const TICK_MS = 100; // 10 ticks/sec → 1 day = 10 ticks ≈ 1 sec at speed=1

    function emit(ev){ listeners.forEach(fn => { try{ fn(ev); } catch(e){} }); }

    function onCase(cb){ listeners.add(cb); return () => listeners.delete(cb); }

    function chooseVariant(){
      const entries = Object.values(state.variants);
      const total = entries.reduce((s,v) => s + v.share, 0) || 1;
      let r = rand() * total;
      for (const v of entries){
        r -= v.share;
        if (r <= 0) return v;
      }
      return entries[0];
    }

    function sampleCase(variant, isImport){
      // clinical profile
      const symptomatic = rand() < 0.62;
      const detected = rand() < (symptomatic ? params.detection + 0.15 : params.detection * 0.35);
      const sevRoll = rand();
      const sevShift = variant.severityShift;
      let severity;
      if (!symptomatic) severity = 'none';
      else if (sevRoll < 0.55 - sevShift) severity = 'mild';
      else if (sevRoll < 0.88 - sevShift) severity = 'moderate';
      else severity = 'severe';
      const outcomeRoll = rand();
      let outcome = 'recovered';
      if (severity === 'severe' && outcomeRoll < 0.18) outcome = 'fatal';
      else if (severity === 'severe' || severity === 'moderate' && outcomeRoll < 0.12) outcome = 'hospitalized';
      const incubation = Math.max(1, 4 + (rand()-0.5)*3.5); // days
      // audible delay: short, scaled with incubation but kept perceptually fast
      const audibleDelayMs = Math.min(900, incubation * 50 + rand()*120);
      return {
        id: Math.random().toString(36).slice(2,9),
        variantId: variant.id,
        hue: variant.hue,
        symptomatic, detected, severity, outcome,
        isImport: !!isImport,
        audibleDelayMs,
        // audio params for the sound engine
        audio: {
          gain: severity === 'severe' ? 1.0 : severity === 'moderate' ? 0.82 : symptomatic ? 0.68 : 0.5,
          pitch: 1 + (rand()-0.5) * 0.5 + (variant.id === 'alpha' ? 0.2 : variant.id === 'beta' ? -0.18 : 0),
          filter: symptomatic ? 0.85 : 0.55,    // 0..1 cutoff fraction
          pan: (rand()-0.5) * 1.6,
          tail: severity === 'severe' ? 0.7 : severity === 'moderate' ? 0.4 : 0.18,
          transient: symptomatic ? 0.9 : 0.6,
        },
        // visual params
        visual: {
          size: severity === 'severe' ? 1.3 : severity === 'moderate' ? 1.1 : 1.0,
          opacity: detected ? 0.9 : 0.55,
          length: severity === 'severe' ? 1.4 : 1.0,
        }
      };
    }

    function spawnCases(n, options){
      const opts = options || {};
      for (let i=0;i<n;i++){
        const v = opts.variant ? state.variants[opts.variant] || state.variants.wild : chooseVariant();
        const c = sampleCase(v, opts.isImport);
        v.share = Math.min(1, v.share + 0.0006); // tiny share growth per case
        // emit asynchronously with audible delay
        setTimeout(() => emit(c), c.audibleDelayMs);
      }
    }

    function tick(){
      state.day += 0.1; // 1 tick = 0.1 day
      // effective transmissibility weighted by variant share
      const variants = Object.values(state.variants);
      const totalShare = variants.reduce((s,v)=>s+v.share,0) || 1;
      let betaEff = 0;
      for (const v of variants) betaEff += params.beta * v.tx * (v.share/totalShare);

      const N = state.pop;
      const lambda = betaEff * (state.I / N);     // force of infection per susceptible per day
      const newE = lambda * state.S * 0.1;        // per tick
      const eToI = state.E * params.sigma * 0.1;
      const iToR = state.I * params.gamma * 0.1;

      // imports
      const baseImports = params.importRate * 0.1;
      const imports = (rand() < baseImports) ? Math.max(1, Math.floor(baseImports + rand()*2)) : 0;

      // integer-ish updates
      state.S = Math.max(0, state.S - newE);
      state.E = Math.max(0, state.E + newE - eToI);
      state.I = Math.max(0, state.I + eToI - iToR + imports);
      state.R = Math.max(0, state.R + iToR);

      // when E→I "matures", schedule audible case events for that fraction
      const newInfectious = Math.floor(eToI) + (rand() < (eToI - Math.floor(eToI)) ? 1 : 0);
      state.newAtTick = newInfectious + imports;
      state.cumulativeCases += state.newAtTick;
      state.newToday += state.newAtTick;
      // sliding incidence window — 10 ticks = 1 day
      state.incidenceWindow.push(state.newAtTick);
      if (state.incidenceWindow.length > 70) state.incidenceWindow.shift();

      // schedule droplet events for matured infectious
      if (newInfectious > 0) spawnCases(newInfectious, { isImport: false });
      if (imports > 0) spawnCases(imports, { isImport: true });

      // reset newToday at day boundary
      if (Math.floor(state.day) !== Math.floor(state.day - 0.1)){
        state.newToday = state.newAtTick;
      }

      // crude R_eff = beta_eff / gamma * S/N
      state.reff = (betaEff / params.gamma) * (state.S / N);
    }

    function loop(){
      if (!running) return;
      const now = performance.now();
      const dt = Math.min(500, now - lastT);
      lastT = now;
      acc += dt * params.speed;
      while (acc >= TICK_MS){
        tick();
        acc -= TICK_MS;
      }
    }

    let intervalId = null;
    function play(){
      if (running) return;
      running = true;
      lastT = performance.now();
      acc = 0;
      intervalId = setInterval(loop, 40);
    }
    function pause(){
      running = false;
      if (intervalId){ clearInterval(intervalId); intervalId = null; }
    }
    function reset(){
      state.S = state.pop - 8 - Math.floor(state.pop * params.immunity);
      state.E = 0; state.I = 8; state.R = Math.floor(state.pop * params.immunity);
      state.day = 0; state.cumulativeCases = 8;
      state.newToday = 0; state.newAtTick = 0;
      state.incidenceWindow.length = 0;
      state.reff = 1;
      state.variants = { wild: { ...VARIANT_DEFS.wild, share: 1, intros: 0 } };
      state.lastVariantIntro = null; state.lastImport = null;
      rand = rng(42 + Math.floor(Math.random()*1000));
    }

    function introduceVariant(id){
      const def = VARIANT_DEFS[id];
      if (!def) return;
      const v = state.variants[id] || { ...def, share: 0, intros: 0 };
      v.share = Math.max(v.share, 0.04);
      v.intros++;
      state.variants[id] = v;
      // re-normalize shares lightly
      const total = Object.values(state.variants).reduce((s,vv)=>s+vv.share,0);
      Object.values(state.variants).forEach(vv => vv.share = vv.share / total);
      // seed a few cases of this variant
      state.E += 4;
      state.S = Math.max(0, state.S - 4);
      spawnCases(3, { variant: id, isImport: false });
      state.lastVariantIntro = { id, t: performance.now(), hue: def.hue };
      emit({ kind:'thunder', hue: def.hue, intensity: 1.0, label: def.name });
    }

    function importPulse(n){
      n = n || 12;
      state.I += n;
      state.S = Math.max(0, state.S - n);
      state.cumulativeCases += n;
      spawnCases(n, { isImport: true });
      state.lastImport = { t: performance.now(), n };
      emit({ kind:'thunder', hue: 200, intensity: 0.7, label: 'Import pulse' });
    }

    // directVaccinate — gradually move people from S to R to model vaccination.
    // targetFraction is the fraction of total population the campaign aims to immunize
    // (counted as the R compartment); duration is the campaign length in ms.
    let vaccineTimer = null;
    function directVaccinate(targetFraction, durationMs){
      if (vaccineTimer) clearInterval(vaccineTimer);
      const startR = state.R;
      const targetR = Math.min(state.pop - state.I - state.E, Math.floor(state.pop * targetFraction));
      const delta = targetR - startR;
      if (delta <= 0) return;
      const start = performance.now();
      vaccineTimer = setInterval(() => {
        const t = Math.min(1, (performance.now() - start) / durationMs);
        const moved = Math.floor(delta * t);
        const newR = startR + moved;
        const transfer = newR - state.R;
        if (transfer > 0){
          const take = Math.min(state.S, transfer);
          state.S -= take;
          state.R += take;
        }
        if (t >= 1){ clearInterval(vaccineTimer); vaccineTimer = null; }
      }, 80);
    }

    function setParam(k, v){ params[k] = v; }
    function getSnapshot(){
      // incidence per day (sum of last 10 ticks)
      const tail = state.incidenceWindow.slice(-10);
      const incidence = tail.reduce((a,b)=>a+b,0);
      const prevalence = state.I;
      return {
        S: state.S, E: state.E, I: state.I, R: state.R, pop: state.pop,
        day: state.day, incidence, prevalence, reff: state.reff,
        cumulative: state.cumulativeCases,
        variants: Object.values(state.variants).map(v => ({ ...v })),
        running, params: { ...params },
        history: state.incidenceWindow.slice(),
      };
    }

    return { play, pause, reset, setParam, getSnapshot, onCase,
             introduceVariant, importPulse, directVaccinate, isRunning: () => running };
  }

  window.PSEngine = { makeEngine, VARIANT_DEFS };
})();
