// story.js — Chapter definitions + a tiny controller that drives the engine
// through a narrative arc. Each chapter applies engine settings and may
// schedule animated parameter changes (e.g. "vaccines roll out over time").

(function(){

  // ── helpers ──────────────────────────────────────────────
  function tween(engine, key, to, duration){
    const snap = engine.getSnapshot();
    const from = snap.params[key];
    const start = performance.now();
    const id = setInterval(() => {
      const t = Math.min(1, (performance.now() - start) / duration);
      const eased = t<.5 ? 2*t*t : 1 - Math.pow(-2*t+2, 2)/2;
      engine.setParam(key, from + (to - from) * eased);
      if (t >= 1) clearInterval(id);
    }, 40);
    return () => clearInterval(id);
  }

  // ── chapters ─────────────────────────────────────────────
  // Each chapter: { id, title, body, apply(eng), highlight? }
  // The "body" is short — story panel keeps the artwork visible.

  const COVID_ARC = [
    {
      id: 'zero',
      title: 'Patient zero',
      body: 'A novel respiratory virus enters a fully susceptible population. The first cases are a few isolated drops in dry air — most go undetected.',
      apply: (eng) => {
        // set baseline params BEFORE reset so reset uses them
        eng.setParam('immunity', 0.0);
        eng.reset();
        eng.setParam('beta', 0.32);
        eng.setParam('gamma', 1/7);
        eng.setParam('detection', 0.08);
        eng.setParam('importRate', 0);
        eng.setParam('speed', 1.5);
      },
      highlight: 'incidence',
    },
    {
      id: 'silent',
      title: 'Silent spread',
      body: 'Each infectious person seeds two or three more. Without testing, the reported curve trails the real one by weeks. Listen — what sounds like drizzle is already an outbreak.',
      apply: (eng) => {
        eng.setParam('beta', 0.45);
        eng.setParam('detection', 0.12);
        tween(eng, 'beta', 0.55, 4000);
      },
      highlight: 'reff',
    },
    {
      id: 'wall',
      title: 'The exponential wall',
      body: 'Doublings stack. A handful becomes thousands within a few weeks. Hospitals begin to fill. The texture of the storm changes — individual drops collapse into continuous rain.',
      apply: (eng) => {
        eng.setParam('beta', 0.62);
        eng.setParam('detection', 0.38);
        eng.setParam('speed', 2);
      },
      highlight: 'I',
    },
    {
      id: 'lockdown',
      title: 'Lockdown',
      body: 'Aggressive non-pharmaceutical interventions — stay-at-home orders, distancing, masking — slash the per-contact transmission probability. R drops below 1. The rain thins, but it does not stop.',
      apply: (eng) => {
        tween(eng, 'beta', 0.16, 2500);
        eng.setParam('detection', 0.55);
      },
      highlight: 'beta',
    },
    {
      id: 'plateau',
      title: 'A long plateau',
      body: 'Cases settle into a low murmur. People grow tired. As mobility returns, β creeps upward and imports from elsewhere seed new clusters.',
      apply: (eng) => {
        tween(eng, 'beta', 0.32, 3500);
        eng.setParam('importRate', 3.5);
      },
    },
    {
      id: 'alpha',
      title: 'A new variant',
      body: 'A more transmissible lineage emerges. Listen for the thunder — the introduction is a single discontinuity, but the texture of every drop that follows shifts.',
      apply: (eng) => {
        eng.introduceVariant('alpha');
        eng.setParam('beta', 0.38);
      },
      highlight: 'variants',
    },
    {
      id: 'second-wave',
      title: 'Second wave',
      body: 'With Alpha dominant, R climbs above 1 again — even as case detection improves. The storm builds. Without a counter-measure, the wave will be larger than the first.',
      apply: (eng) => {
        eng.setParam('beta', 0.46);
        eng.setParam('detection', 0.62);
      },
      highlight: 'reff',
    },
    {
      id: 'vaccine',
      title: 'Vaccines arrive',
      body: 'Each percentage point of vaccination moves someone from Susceptible to Recovered without ever becoming Infectious. The fuel for the fire is removed, person by person, over months.',
      apply: (eng) => {
        // dramatic, slow rise — this is the headline of the chapter
        tween(eng, 'immunity', 0.62, 9000);
        // model vaccination by also pushing R out the door (simplified)
        eng.directVaccinate(0.62, 9000);
        eng.setParam('beta', 0.42);
      },
      highlight: 'immunity',
    },
    {
      id: 'escape',
      title: 'A partial-escape variant',
      body: 'Beta evades some prior immunity. Cases rise again — but this time the peak is shorter, the rain sparser. Immunity, even imperfect, dampens the curve.',
      apply: (eng) => {
        eng.introduceVariant('beta');
        eng.setParam('beta', 0.40);
        eng.setParam('importRate', 2);
      },
      highlight: 'variants',
    },
    {
      id: 'endemic',
      title: 'Endemic rain',
      body: 'The pathogen settles into a low, persistent murmur. Imports and waning immunity drive occasional surges. The storm has not ended — it has changed key. This is what living with a pathogen sounds like.',
      apply: (eng) => {
        eng.setParam('beta', 0.24);
        eng.setParam('importRate', 1.4);
        eng.setParam('detection', 0.5);
        eng.setParam('speed', 1.5);
      },
    },
  ];

  window.PSStory = {
    arcs: { covid: { id:'covid', name:'COVID-19 — vaccine arc', chapters: COVID_ARC } },
    tween,
  };
})();
