// Stochastic chain-binomial SEIR in which every infection is an individual
// with an infector, so the genealogy (and therefore the phylogeny) is real.
// S and R are counts; E and I are lists of case ids. Case id === index in `cases`.

import { mulberry32, gamma, poisson, binomial } from './rng.js';

export const DEFAULT_PARAMS = {
  beta: 0.32,             // per-day transmission rate of the founder lineage
  incubationMean: 5.0, incubationShape: 4,
  infectiousMean: 7.0, infectiousShape: 3,
  detection: 0.45,        // P(reported)
  sampling: 0.06,         // P(sequenced | reported)
  mu: 0.08,               // substitutions per genome per day
  importRate: 0,          // expected imports per day
  immunity: 0,            // target fraction moved S→R by vaccination
  vaccinationRate: 0.02,  // fraction of population per day while below target
};

const SUB = 0.1;          // model sub-step (days)
const MAX_CATCHUP = 0.5;  // max model days advanced per step() call
const SEEDS = 8;

export function createSim({ seed = 42, pop = 100000, params = {} } = {}) {
  const p = { ...DEFAULT_PARAMS, ...params };
  let r, t, S, R, E, I, cases, lineages, byLineage, vaccinated, onsetsLog, pos, inI;
  const api = { generation: 0 };

  function newLineage(name, extra) {
    const id = lineages.length;
    lineages.push({ id, name, parentLineage: -1, originCase: -1, tx: 1, escape: 0, colorIndex: id, ...extra });
    byLineage.push([]);
    return id;
  }

  function addCase(parentId, lineage, tInf, imported = false) {
    const parent = parentId >= 0 ? cases[parentId] : null;
    const inc = gamma(r, p.incubationShape, p.incubationMean / p.incubationShape);
    const dur = gamma(r, p.infectiousShape, p.infectiousMean / p.infectiousShape);
    const symptomatic = r() < 0.62;
    let severity = 0;
    if (symptomatic) {
      const u = r() * 0.62;
      severity = u < 0.34 ? 1 : u < 0.54 ? 2 : 3;
    }
    const outcome = severity === 3 ? (r() < 0.18 ? 'fatal' : 'hospitalized')
      : severity === 2 && r() < 0.12 ? 'hospitalized' : 'recovered';
    const detected = r() < (symptomatic ? Math.min(1, p.detection * 1.3) : p.detection * 0.3);
    const c = {
      id: cases.length,
      parent: parentId,
      tInf,
      tOnset: tInf + inc,
      tEnd: tInf + inc + dur,
      lineage,
      muts: parent ? parent.muts + poisson(r, p.mu * (tInf - parent.tInf)) : poisson(r, 2),
      detected,
      symptomatic,
      severity,
      outcome,
      sampled: detected && r() < p.sampling,
      imported,
      offspring: 0,
    };
    cases.push(c);
    E.push(c.id);
    if (parent) parent.offspring++;
    return c;
  }

  function init(s) {
    r = mulberry32(s);
    t = 0; R = 0; vaccinated = 0;
    E = []; I = []; cases = []; lineages = []; byLineage = []; onsetsLog = []; pos = []; inI = [];
    newLineage('Founder');
    S = pop - SEEDS;
    for (let k = 0; k < SEEDS; k++) addCase(-1, 0, -r() * 2, true);
  }

  function infectiousOf(l) { return byLineage[l]; }
  // O(1) membership in per-lineage infectious lists (swap-remove).
  function linAdd(l, id) { const arr = byLineage[l]; pos[id] = arr.length; arr.push(id); }
  function linRemove(l, id) {
    const arr = byLineage[l], i = pos[id], last = arr.pop();
    if (last !== id) { arr[i] = last; pos[last] = i; }
  }

  function sub(dt) {
    const t1 = t + dt;
    const N = pop;

    // vaccination: S → R toward target, at a bounded daily rate
    const target = Math.floor(p.immunity * pop);
    if (vaccinated < target && S > 0) {
      const move = Math.min(S, target - vaccinated, Math.ceil(p.vaccinationRate * pop * dt));
      S -= move; R += move; vaccinated += move;
    }

    // transmission, lineage by lineage
    for (let l = 0; l < lineages.length; l++) {
      const inf = infectiousOf(l);
      if (!inf.length) continue;
      const L = lineages[l];
      const lambda = p.beta * L.tx * inf.length / N;
      const fromS = binomial(r, S, 1 - Math.exp(-lambda * dt));
      const fromR = L.escape > 0 ? binomial(r, R, 1 - Math.exp(-lambda * L.escape * dt)) : 0;
      S -= fromS; R -= fromR;
      for (let k = 0; k < fromS + fromR; k++) {
        const parent = cases[inf[Math.floor(r() * inf.length)]];
        const tInf = Math.min(t + r() * dt, parent.tEnd - 1e-6);
        addCase(parent.id, parent.lineage, Math.max(tInf, parent.tOnset));
      }
    }

    // imports (residents infected elsewhere)
    const nImp = Math.min(S, poisson(r, p.importRate * dt));
    for (let k = 0; k < nImp; k++) { S--; api._import(t + r() * dt); }

    // E → I (onsets) and I → R
    const onsets = [];
    E = E.filter((id) => {
      const c = cases[id];
      if (c.tOnset <= t1) { I.push(id); inI[id] = true; linAdd(c.lineage, id); onsets.push(c); return false; }
      return true;
    });
    I = I.filter((id) => {
      const c = cases[id];
      if (c.tEnd <= t1) {
        linRemove(c.lineage, id);
        inI[id] = false;
        R++;
        return false;
      }
      return true;
    });
    t = t1;
    onsets.sort((a, b) => a.tOnset - b.tOnset);
    for (const c of onsets) onsetsLog.push(c);
    return onsets;
  }

  api._import = (tInf) => {
    let l = lineages.findIndex((x) => x.name === 'Imported');
    if (l < 0) l = newLineage('Imported', { tx: 1 });
    return addCase(-1, l, tInf, true);
  };

  api.step = (dtDays) => {
    let remaining = Math.min(dtDays, MAX_CATCHUP);
    const out = [];
    while (remaining > 1e-9) {
      const dt = Math.min(SUB, remaining);
      out.push(...sub(dt));
      remaining -= dt;
    }
    return out;
  };

  api.reset = (s = seed) => { init(s); api.generation++; };

  api.setParam = (k, v) => { if (k in p) p[k] = v; };

  api.importCases = (n) => {
    const k = Math.min(n, S);
    for (let i = 0; i < k; i++) { S--; api._import(t); }
    return k;
  };

  // A variant arises as a saltation in one currently infected person. That
  // person founds the lineage; a small cluster of their contacts is seeded so
  // the introduction is not lost to stochastic fade-out in a story beat.
  api.introduceVariant = (name, { tx = 1.5, escape = 0, cluster = 4, jump = 6 } = {}) => {
    const pool = I.length ? I : E;
    if (!pool.length) {
      const l = newLineage(name, { tx, escape });
      const c = addCase(-1, l, t, true);
      lineages[l].originCase = c.id;
      return l;
    }
    const origin = cases[pool[Math.floor(r() * pool.length)]];
    const l = newLineage(name, { tx, escape, parentLineage: origin.lineage, originCase: origin.id });
    if (inI[origin.id]) { linRemove(origin.lineage, origin.id); linAdd(l, origin.id); }
    origin.lineage = l;
    origin.muts += jump;
    for (let k = 0; k < cluster && S > 0; k++) {
      S--;
      const tInf = Math.min(Math.max(t, origin.tOnset), origin.tEnd - 1e-6);
      addCase(origin.id, l, tInf);
    }
    return l;
  };

  api.snapshot = () => {
    const day = onsetsLog.filter((c) => c.tOnset > t - 1);
    const week = onsetsLog.filter((c) => c.tOnset > t - 7);
    const counts = lineages.map(() => 0);
    for (const c of week) counts[c.lineage]++;
    const ended = [];
    for (let i = cases.length - 1; i >= 0 && ended.length < 2000; i--) {
      const c = cases[i];
      if (c.tEnd <= t && c.tEnd > t - 7) ended.push(c.offspring);
    }
    let txMean = 0;
    for (let l = 0; l < lineages.length; l++) txMean += lineages[l].tx * (I.length ? byLineage[l].length / I.length : l === 0 ? 1 : 0);
    return {
      t, S, E: E.length, I: I.length, R, pop,
      incidenceToday: day.length,
      cumulative: onsetsLog.length,
      rtGenealogy: ended.length >= 10 ? ended.reduce((a, b) => a + b, 0) / ended.length : null,
      reffAnalytic: p.beta * txMean * p.infectiousMean * S / pop,
      lineageShares: lineages.map((L, i) => ({ id: i, name: L.name, share: week.length ? counts[i] / week.length : 0 })),
      params: { ...p },
    };
  };

  Object.defineProperties(api, {
    cases: { get: () => cases },
    lineages: { get: () => lineages },
    t: { get: () => t },
  });

  init(seed);
  return api;
}
