// Narrative chapters, driven by what the epidemic actually does.
// Each chapter applies its measures on entry and ends when its own claim has
// come true (until), never earlier than minDays and never later than maxDays.
// Interventions are expressed as a target R, converted to β for the current
// susceptible pool and lineage mix, so the text stays true whatever the seed.

const share = (s, name) => s.lineageShares.find((x) => x.name === name)?.share ?? 0;

export const CHAPTERS = [
  {
    id: 'zero', title: 'Patient zero',
    body: 'A new respiratory virus reaches a population with no immunity. The first cases fall as single drops, and almost none are noticed.',
    enter: ({ sim, setR, setSpeed }) => {
      sim.reset();
      sim.setParam('immunity', 0); sim.setParam('detection', 0.08); sim.setParam('importRate', 0);
      setR(2.5); setSpeed(1.5);
    },
    until: (s) => s.incidenceToday >= 6, minDays: 8, maxDays: 40,
  },
  {
    id: 'silent', title: 'Silent spread',
    body: 'Each infection seeds two or three more. Without testing, the reported curve trails the real one. What sounds like drizzle is already an outbreak.',
    enter: ({ sim }) => sim.setParam('detection', 0.12),
    until: (s) => s.incidenceToday >= 40, minDays: 8, maxDays: 50,
  },
  {
    id: 'wall', title: 'The exponential wall',
    body: 'Doublings stack. A handful becomes hundreds a day within weeks. Single drops merge into rain.',
    enter: ({ sim, setSpeed }) => { sim.setParam('detection', 0.38); setSpeed(2); },
    until: (s) => s.incidenceToday >= 400 || s.S / s.pop < 0.88, minDays: 5, maxDays: 40,
  },
  {
    id: 'lockdown', title: 'Lockdown',
    body: 'Distancing and closures cut transmission per contact. R falls below one. The rain thins, but it does not stop.',
    enter: ({ sim, rampR }) => { rampR(0.65, 3); sim.setParam('detection', 0.55); },
    until: (s, m) => s.reffAnalytic < 1 && s.incidenceToday < 0.35 * m.peak, minDays: 14, maxDays: 70,
  },
  {
    id: 'plateau', title: 'A long plateau',
    body: 'Cases settle into a low murmur. Mobility returns, transmission creeps back toward one, and travellers seed new clusters: listen for the leaves.',
    enter: ({ sim, rampR }) => { rampR(0.9, 6); sim.setParam('importRate', 1.2); },
    until: () => false, minDays: 24, maxDays: 24,
  },
  {
    id: 'alpha', title: 'A new variant',
    body: 'A more transmissible lineage arises in one infected person. Thunder marks the moment; from then on its drops fall on glass.',
    enter: ({ sim, thunder, setR }) => {
      setR(0.95);   // founder transmission now fixed: the variant's advantage is all that changes
      const l = sim.introduceVariant('Variant α', { tx: 1.7, cluster: 40 });
      thunder({ lineage: l, kind: 'variant' });
    },
    until: (s) => share(s, 'Variant α') >= 0.5, minDays: 8, maxDays: 100,
  },
  {
    id: 'second-wave', title: 'Second wave',
    body: 'With the variant dominant, R climbs above one again even as testing improves. The glass gets louder. Left alone, this wave would outgrow the first.',
    enter: ({ sim }) => sim.setParam('detection', 0.62),
    until: (s, m) => s.incidenceToday >= Math.max(200, 0.6 * m.mem.firstPeak), minDays: 6, maxDays: 60,
  },
  {
    id: 'vaccine', title: 'Vaccines arrive',
    body: 'Each vaccinated person moves from susceptible to immune without ever being infected. The fuel is removed, person by person, and the wave turns.',
    enter: ({ sim }) => { sim.setParam('vaccinationRate', 0.015); sim.setParam('immunity', 0.6); },
    until: (s, m) => s.reffAnalytic < 1 && s.incidenceToday < 0.12 * m.peak, minDays: 20, maxDays: 110,
  },
  {
    id: 'escape', title: 'A partial-escape variant',
    body: 'A second variant evades some immunity and falls on metal. Cases rise again, but the peak is lower: imperfect immunity still dampens the curve.',
    enter: ({ sim, thunder }) => {
      const l = sim.introduceVariant('Variant β', { tx: 2.0, escape: 0.6, cluster: 60 });
      thunder({ lineage: l, kind: 'variant' });
      sim.setParam('importRate', 1.5);
    },
    until: (s, m) => share(s, 'Variant β') >= 0.7 && s.incidenceToday >= 1.8 * Math.max(5, m.entry), minDays: 20, maxDays: 100,
  },
  {
    id: 'endemic', title: 'Endemic rain',
    body: 'The virus settles into a low, persistent rain. The storm has not ended; it has changed surface. This is what living with a pathogen sounds like.',
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
    start: () => enter(0),
    goto: enter,
    step,
    setAuto: (b) => { auto = b; },
    get index() { return index; },
    get t() { return sim.t; },
    snapshot: () => sim.snapshot(),
  };
}
