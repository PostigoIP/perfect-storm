// Narrative chapters, driven by what the epidemic actually does.
// Each chapter applies its measures on entry and ends when its own claim has
// come true (until), never earlier than minDays and never later than maxDays.
// Interventions are expressed as a target R, converted to β for the current
// susceptible pool and lineage mix, so the text stays true whatever the seed.

const share = (s, name) => s.lineageShares.find((x) => x.name === name)?.share ?? 0;

export const CHAPTERS = [
  {
    id: 'zero', title: 'Patient zero',
    body: 'A hypothetical respiratory virus reaches a population with no prior immunity. The first cases arrive as isolated drops, and almost none are detected.',
    enter: ({ sim, setR, setSpeed }) => {
      sim.reset();
      sim.setParam('immunity', 0); sim.setParam('detection', 0.08); sim.setParam('importRate', 0);
      setR(2.5); setSpeed(1.5);
    },
    until: (s) => s.incidenceToday >= 6, minDays: 8, maxDays: 40,
  },
  {
    id: 'silent', mark: 'Silent spread', title: 'Silent spread',
    body: 'Each infection leads to two or three more. Without diagnostic testing, the reported curve lags behind reality, and what still sounds like a light drizzle is already a storm underway.',
    enter: ({ sim }) => sim.setParam('detection', 0.12),
    until: (s) => s.incidenceToday >= 40, minDays: 8, maxDays: 50,
  },
  {
    id: 'wall', mark: 'Exponential', title: 'The exponential wall',
    body: 'As cases double again and again, a handful turns into hundreds a day within weeks, and individual drops merge into steady rain.',
    enter: ({ sim, setSpeed }) => { sim.setParam('detection', 0.38); setSpeed(2); },
    until: (s) => s.incidenceToday >= 400 || s.S / s.pop < 0.88, minDays: 5, maxDays: 40,
  },
  {
    id: 'lockdown', mark: 'Lockdown', title: 'Lockdown',
    body: 'Physical distancing and closures cut transmission per contact, pushing R below one. The rain eases, though it does not stop completely.',
    enter: ({ sim, rampR }) => { rampR(0.65, 3); sim.setParam('detection', 0.55); },
    until: (s, m) => s.reffAnalytic < 1 && s.incidenceToday < 0.35 * m.peak, minDays: 14, maxDays: 70,
  },
  {
    id: 'plateau', mark: 'Plateau', title: 'A long plateau',
    body: 'Cases settle into a low background hum. As mobility returns, transmission creeps back toward one, and travellers seed new clusters.',
    enter: ({ sim, rampR }) => { rampR(0.9, 6); sim.setParam('importRate', 1.2); },
    until: () => false, minDays: 24, maxDays: 24,
  },
  {
    id: 'alpha', mark: 'Variant α', lineageName: 'Variant α', title: 'New variant',
    body: 'A more transmissible variant emerges in a single infected person. A clap of thunder marks the moment, and from then on its lineage sounds slightly brighter.',
    enter: ({ sim, thunder, setR }) => {
      setR(0.95);   // founder transmission now fixed: the variant's advantage is all that changes
      const l = sim.introduceVariant('Variant α', { tx: 1.7, cluster: 40 });
      thunder({ lineage: l, kind: 'variant' });
    },
    until: (s) => share(s, 'Variant α') >= 0.5, minDays: 8, maxDays: 100,
  },
  {
    id: 'second-wave', mark: 'Second wave', title: 'Second wave',
    body: 'Once the new variant takes over, R climbs back above one even with better testing. The brighter drops multiply; left unchecked, this wave would surpass the first.',
    enter: ({ sim }) => sim.setParam('detection', 0.62),
    until: (s, m) => s.incidenceToday >= Math.max(200, 0.6 * m.mem.firstPeak), minDays: 6, maxDays: 60,
  },
  {
    id: 'vaccine', mark: 'Vaccines', title: 'Vaccines arrive',
    body: 'Every vaccinated person moves from susceptible to immune without getting infected. As fewer susceptible people remain, the wave finally turns.',
    enter: ({ sim }) => { sim.setParam('vaccinationRate', 0.015); sim.setParam('immunity', 0.6); },
    until: (s, m) => s.reffAnalytic < 1 && s.incidenceToday < 0.12 * m.peak, minDays: 20, maxDays: 110,
  },
  {
    id: 'escape', mark: 'Variant β', lineageName: 'Variant β', title: 'A partial-escape variant',
    body: 'A second variant evades part of that immunity, and its drops sound darker. Cases rise again, though the peak stays lower because partial immunity still slows transmission.',
    enter: ({ sim, thunder }) => {
      const l = sim.introduceVariant('Variant β', { tx: 2.0, escape: 0.6, cluster: 60 });
      thunder({ lineage: l, kind: 'variant' });
      sim.setParam('importRate', 1.5);
    },
    until: (s, m) => share(s, 'Variant β') >= 0.7 && s.incidenceToday >= 1.8 * Math.max(5, m.entry), minDays: 20, maxDays: 100,
  },
  {
    id: 'endemic', mark: 'Endemic', title: 'Endemic rain',
    body: 'Eventually, the virus settles into a low, persistent rain. It does not disappear; it becomes part of the auditory and epidemic background.',
    enter: ({ sim, rampR, setSpeed }) => { rampR(1.0, 10); sim.setParam('importRate', 1); sim.setParam('detection', 0.5); setSpeed(1.5); },
    until: () => false, minDays: Infinity, maxDays: Infinity,
  },
];

// β that gives effective R = target now (R_eff ∝ β at fixed S and lineage mix)
function betaFor(sim, target) {
  const s = sim.snapshot();
  const perBeta = s.reffAnalytic / Math.max(1e-9, s.params.beta);
  return perBeta > 1e-9 ? target / perBeta : s.params.beta;
}

export function createStory(sim, { onChapter, setSpeed = () => {}, thunder = () => {} } = {}) {
  let index = -1, t0 = 0, ramp = null, auto = true;
  const mem = { firstPeak: 0 };
  let m = { peak: 0, peaked: false, mem };

  const ctx = {
    sim, setSpeed, thunder,
    setR: (R) => { ramp = null; sim.setParam('beta', betaFor(sim, R)); },
    rampR: (R, days) => { ramp = { R, from: sim.snapshot().params.beta, t0: sim.t, days }; },
  };

  function enter(i) {
    if (index === 3 || index === 2) mem.firstPeak = Math.max(mem.firstPeak, m.peak);
    index = i; t0 = sim.t; ramp = null;
    m = { peak: 0, peaked: false, rose: false, entry: null, mem };
    CHAPTERS[i].enter(ctx);
    t0 = sim.t;
    onChapter?.(i);
  }

  function step(dtDays) {
    const onsets = sim.step(dtDays);
    if (ramp) {   // ease β toward the β that yields the target R, in model days
      const k = Math.min(1, (sim.t - ramp.t0) / ramp.days);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      sim.setParam('beta', ramp.from + (betaFor(sim, ramp.R) - ramp.from) * e);
      if (k >= 1) { sim.setParam('beta', betaFor(sim, ramp.R)); if (!['plateau', 'endemic'].includes(CHAPTERS[index]?.id)) ramp = null; }
    }
    if (index >= 0) {
      const s = sim.snapshot();
      if (m.entry == null) m.entry = s.incidenceToday;
      if (s.incidenceToday > m.peak) m.peak = s.incidenceToday;
      else if (s.incidenceToday < 0.8 * m.peak) m.peaked = true;
      if (s.incidenceToday > 1.5 * Math.max(5, m.entry)) m.rose = true;
      const ch = CHAPTERS[index], age = sim.t - t0;
      if (auto && index < CHAPTERS.length - 1 && age >= ch.minDays && (age >= ch.maxDays || ch.until(s, m))) enter(index + 1);
    }
    return onsets;
  }

  return {
    save: () => structuredClone({ index, t0, ramp, auto, mem, m }),
    restore(snap) {
      const s = structuredClone(snap);
      ({ index, t0, ramp, auto } = s);
      Object.assign(mem, s.mem);
      m = { ...s.m, mem };
    },
    start: () => enter(0),
    goto: enter,
    step,
    setAuto: (b) => { auto = b; },
    get index() { return index; },
    get t() { return sim.t; },
    snapshot: () => sim.snapshot(),
  };
}
