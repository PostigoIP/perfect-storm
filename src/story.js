// Narrative chapters (ported from legacy/claude-design-v1/story.js).
// Each chapter's apply(ctx) receives { sim, setSpeed, tween, thunder }.

export const CHAPTERS = [
  {
    id: 'zero', title: 'Patient zero',
    body: 'A new respiratory virus reaches a population with no immunity. The first cases fall as single drops, and almost none are noticed.',
    apply: ({ sim, setSpeed }) => {
      sim.reset();
      sim.setParam('immunity', 0); sim.setParam('beta', 0.32); sim.setParam('detection', 0.08);
      sim.setParam('importRate', 0);
      setSpeed(1.5);
    },
  },
  {
    id: 'silent', title: 'Silent spread',
    body: 'Each infection seeds two or three more. Without testing, the reported curve trails the real one. What sounds like drizzle is already an outbreak.',
    apply: ({ sim, tween }) => { sim.setParam('detection', 0.12); tween('beta', 0.5, 4000); },
  },
  {
    id: 'wall', title: 'The exponential wall',
    body: 'Doublings stack. A handful becomes thousands within weeks. Single drops merge into rain.',
    apply: ({ sim, setSpeed }) => { sim.setParam('beta', 0.6); sim.setParam('detection', 0.38); setSpeed(2); },
  },
  {
    id: 'lockdown', title: 'Lockdown',
    body: 'Distancing and closures cut transmission per contact. R falls below one. The rain thins, but it does not stop.',
    apply: ({ sim, tween }) => { tween('beta', 0.12, 2500); sim.setParam('detection', 0.55); },
  },
  {
    id: 'plateau', title: 'A long plateau',
    body: 'Cases settle into a low murmur. Mobility returns, transmission creeps up, and travellers seed new clusters: listen for the leaves.',
    apply: ({ sim, tween }) => { tween('beta', 0.24, 3500); sim.setParam('importRate', 3); },
  },
  {
    id: 'alpha', title: 'A new variant',
    body: 'A more transmissible lineage arises in one infected person. Thunder marks the moment; from then on its drops fall on glass.',
    apply: ({ sim, thunder }) => { const l = sim.introduceVariant('Variant α', { tx: 1.6 }); thunder({ lineage: l, kind: 'variant' }); },
  },
  {
    id: 'second-wave', title: 'Second wave',
    body: 'With the variant spreading, R climbs above one again even as testing improves. The glass gets louder.',
    apply: ({ sim }) => { sim.setParam('beta', 0.3); sim.setParam('detection', 0.62); },
  },
  {
    id: 'vaccine', title: 'Vaccines arrive',
    body: 'Each vaccinated person moves from susceptible to immune without ever being infected. The fuel is removed, person by person.',
    apply: ({ sim }) => { sim.setParam('vaccinationRate', 0.01); sim.setParam('immunity', 0.62); },
  },
  {
    id: 'escape', title: 'A partial-escape variant',
    body: 'A second variant evades some immunity. It falls on metal. Cases rise, but the peak is shorter: imperfect immunity still dampens the curve.',
    apply: ({ sim, thunder }) => { const l = sim.introduceVariant('Variant β', { tx: 1.75, escape: 0.35 }); thunder({ lineage: l, kind: 'variant' }); sim.setParam('importRate', 2); },
  },
  {
    id: 'endemic', title: 'Endemic rain',
    body: 'The virus settles into a low, persistent rain. The storm has not ended; it has changed surface. This is what living with a pathogen sounds like.',
    apply: ({ sim, setSpeed }) => { sim.setParam('beta', 0.2); sim.setParam('importRate', 1.2); sim.setParam('detection', 0.5); setSpeed(1.5); },
  },
];

// Ease a sim parameter toward a value over real time. Returns a cancel function.
export function makeTween(sim, getParam) {
  const active = new Map();
  return function tween(key, to, ms) {
    active.get(key)?.();
    const from = getParam(key), start = performance.now();
    let raf = 0;
    const tick = () => {
      const k = Math.min(1, (performance.now() - start) / ms);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      sim.setParam(key, from + (to - from) * e);
      if (k < 1) raf = requestAnimationFrame(tick); else active.delete(key);
    };
    raf = requestAnimationFrame(tick);
    const cancel = () => { cancelAnimationFrame(raf); active.delete(key); };
    active.set(key, cancel);
    return cancel;
  };
}
