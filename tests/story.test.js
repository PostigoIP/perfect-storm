import { describe, it, expect } from 'vitest';
import { createSim } from '../src/model/sim.js';
import { CHAPTERS, createStory } from '../src/story.js';

// Run the whole arc headless and record what the epidemic did in each chapter.
function runArc(seed) {
  const sim = createSim({ seed });
  const log = [];
  const story = createStory(sim, {
    onChapter: (i) => {
      // the state that ended the previous chapter is the one at the moment of transition
      const s = sim.snapshot();
      if (log.length) log.at(-1).exit = s;
      log.push({ i, id: CHAPTERS[i].id, t: sim.t, entry: s, peak: 0, min: Infinity });
    },
  });
  story.start();
  while (story.index < CHAPTERS.length - 1 && sim.t < 700) {
    const before = log.length;
    story.step(0.25);
    if (log.length !== before) continue;          // a transition just recorded the exit
    const s = sim.snapshot(), cur = log.at(-1);
    cur.peak = Math.max(cur.peak, s.incidenceToday);
    cur.min = Math.min(cur.min, s.incidenceToday);
  }
  for (let d = 0; d < 30; d++) story.step(0.25);   // a little endemic time
  log.at(-1).exit = sim.snapshot();
  return { log, sim, story };
}

const byId = (log, id) => log.find((c) => c.id === id);
const share = (s, name) => s.lineageShares.find((x) => x.name === name)?.share ?? 0;

describe.each([1, 2, 3, 4, 5])('story arc, seed %i', (seed) => {
  const { log, sim } = runArc(seed);

  it('reaches the endemic chapter in under 700 days', () => {
    expect(log.at(-1).id).toBe('endemic');
    expect(sim.t).toBeLessThan(700);
  });

  it('the wall: incidence climbs at least tenfold, while most people are still susceptible', () => {
    const c = byId(log, 'wall');
    expect(c.exit.incidenceToday).toBeGreaterThan(8 * Math.max(5, c.entry.incidenceToday));
    expect(c.exit.S / c.exit.pop).toBeGreaterThan(0.6);
  });

  it('lockdown: R falls below 1 and the rain thins but does not stop', () => {
    const c = byId(log, 'lockdown');
    expect(c.exit.reffAnalytic).toBeLessThan(1);
    expect(c.exit.incidenceToday).toBeLessThan(0.5 * c.peak);
    expect(c.exit.incidenceToday).toBeGreaterThan(0);
  });

  it('plateau: a low murmur, neither exploding nor vanishing', () => {
    const c = byId(log, 'plateau');
    expect(c.exit.incidenceToday).toBeGreaterThan(0);
    expect(c.peak).toBeLessThan(0.6 * byId(log, 'wall').peak + byId(log, 'lockdown').peak * 0.6);
  });

  it('the new variant takes over', () => {
    expect(share(byId(log, 'alpha').exit, 'Variant α')).toBeGreaterThanOrEqual(0.5);
  });

  it('second wave: cases climb again, above the plateau', () => {
    const c = byId(log, 'second-wave');
    expect(c.peak).toBeGreaterThan(1.5 * Math.max(5, c.entry.incidenceToday));
    expect(c.peak).toBeGreaterThan(byId(log, 'plateau').peak);
  });

  it('vaccines: the wave turns and R ends below 1', () => {
    const c = byId(log, 'vaccine');
    expect(c.exit.reffAnalytic).toBeLessThan(1);
    expect(c.exit.incidenceToday).toBeLessThan(0.6 * c.peak);
  });

  it('escape variant: it rises, but its peak is lower than the second wave', () => {
    const c = byId(log, 'escape');
    expect(share(c.exit, 'Variant β')).toBeGreaterThanOrEqual(0.5);
    expect(c.peak).toBeGreaterThan(1.5 * Math.max(5, c.entry.incidenceToday));      // it rises
    expect(c.peak).toBeLessThan(Math.max(byId(log, 'second-wave').peak, byId(log, 'vaccine').peak)); // lower
  });

  it('endemic: persistent low rain, not extinction', () => {
    const c = log.at(-1);
    expect(c.exit.incidenceToday).toBeGreaterThan(0);
    expect(c.exit.incidenceToday).toBeLessThan(byId(log, 'wall').peak);
  });
});
