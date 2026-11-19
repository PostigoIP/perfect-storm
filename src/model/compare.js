// Compare mode: two real outbreaks replayed one after the other, at the same
// speed, on the same axis (days since each one's first case) and the same scale.
// The first one's bars stay on the case series while the second one grows.
// Daily counts become that many onsets spread evenly through the day.

import { mulberry32 } from './rng.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function createCompareSource(data, { seed = 11, onPhase = () => {} } = {}) {
  const { meta, lineages, phases } = data;
  let phase, t, cursor, cases, rand, idBase;

  function synthesize() {
    const p = phases[phase];
    cases = [];
    for (const d of p.days) {
      const pool = [];
      d.counts.forEach((n, l) => { for (let k = 0; k < n; k++) pool.push(l); });
      for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
      pool.forEach((l, k) => {
        const fatal = rand() < p.fatal;
        cases.push({
          id: 0, parent: -1, lineage: l, muts: 0, tInf: NaN,
          tOnset: d.t + (k + rand()) / pool.length,
          detected: true, symptomatic: true,
          severity: fatal ? 3 : 2, outcome: fatal ? 'fatal' : 'recovered',
          sampled: false, inferred: true,
        });
      });
    }
    cases.sort((a, b) => a.tOnset - b.tOnset);
    cases.forEach((c, i) => (c.id = idBase + i));
  }

  function enter(i) { phase = i; t = 0; cursor = 0; synthesize(); }
  function reset() { rand = mulberry32(seed); idBase = 0; enter(0); }

  const api = {
    get t() { return t; },
    get phase() { return phase; },
    get done() { return phase === phases.length - 1 && t >= phases[phase].end; },
    get title() { return phases[phase].title; },
    get lede() { return phases[phase].lede; },
    get events() { return phases[phase].events ?? []; },
    phaseEvents: (i) => phases[i]?.events ?? [],
    defaultSpeed: meta.defaultSpeed ?? 5,
    binDays: meta.binDays ?? 1,
    yMax: meta.yMax,
    unitLabel: meta.unitLabel,
    nPhases: phases.length,
    nLineages: lineages.length,
    surfaceOf: (l) => lineages[l]?.surface ?? 'stone',
    lineageLabel: (l) => lineages[l]?.name ?? '?',
    step(dtDays) {
      const end = phases[phase].end;
      const t1 = t + dtDays, out = [];
      while (cursor < cases.length && cases[cursor].tOnset <= t1) out.push(cases[cursor++]);
      t = Math.min(t1, end);
      // the first outbreak is over: the second one starts again from day 0
      if (t >= end && phase < phases.length - 1) {
        idBase += cases.length;
        enter(phase + 1);
        onPhase(phase);
      }
      return out;
    },
    reset,
    snapshot() {
      let day = 0;
      for (let i = cursor - 1; i >= 0 && cases[i].tOnset > t - 1; i--) day++;
      return { t, incidenceToday: day, cumulative: cursor, rtGenealogy: null, reffAnalytic: null };
    },
    tree() { return { root: null, tips: [] }; },
    domain() { return { ...meta.domain }; },
    fmt: (d) => `D${Math.round(d)}`,
    // the calendar date of day d in the current outbreak
    dateLabel(d) {
      const dt = new Date(Date.parse(phases[phase].start + 'T00:00:00Z') + Math.floor(d) * 86400000);
      return `${dt.getUTCDate()} ${MONTHS[dt.getUTCMonth()]} ${String(dt.getUTCFullYear()).slice(2)}`;
    },
    provenanceHTML() {
      const src = meta.sources.map((s) => `<li><a href="${s.url}" rel="noopener" target="_blank">${s.name}</a>. ${s.citation ?? ''}</li>`).join('');
      const tr = meta.transformations.map((x) => `<li>${x}</li>`).join('');
      return `<div class="panel__head">Source · observed, compared</div><ul>${src}</ul><div class="panel__head">Transformations</div><ul>${tr}</ul>`;
    },
  };
  reset();
  return api;
}
