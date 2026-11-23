// Observed mode: a real outbreak replayed as drops. Weekly reported counts
// become that many onsets, spread evenly through the week; the published
// time-resolved tree is revealed as each genome's sampling date passes.
// Clinical attributes are not in the data, so they are sampled and flagged.

import { mulberry32 } from './rng.js';
import { buildTree, thinTips } from './tree.js';
import { binCases } from './epicurve.js';
import { t as tr, month } from '../i18n.js';

export function createObservedSource(data, { seed = 7 } = {}) {
  const { meta, lineages, nodes, tips, weeks } = data;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const startMs = Date.parse(meta.start + 'T00:00:00Z');
  const t0Start = weeks.length ? weeks[0].t0 : 0;
  const rootDate = Math.min(...nodes.filter((n) => n.parent < 0).map((n) => n.date));
  const tEnd = Math.max(weeks.length ? weeks.at(-1).t0 + 7 : 0, ...tips.map((x) => x.t));
  const sev = meta.inferred ?? { severe: 0.6, fatal: 0.4 };

  let cases, cursor, t, rand;

  function synthesize() {
    rand = mulberry32(seed);
    cases = [];
    for (const w of weeks) {
      const pool = [];
      w.counts.forEach((n, l) => { for (let k = 0; k < n; k++) pool.push(l); });
      for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
      pool.forEach((l, k) => {
        const severe = rand() < sev.severe;
        cases.push({
          id: cases.length, parent: -1, lineage: l, muts: 0,
          tInf: NaN, tOnset: w.t0 + (7 * (k + rand())) / pool.length,
          detected: true, symptomatic: true,
          severity: severe ? 3 : 2,
          outcome: rand() < sev.fatal ? 'fatal' : 'recovered',
          sampled: false, inferred: true,
        });
      });
    }
    cases.sort((a, b) => a.tOnset - b.tOnset);
    cases.forEach((c, i) => (c.id = i));
  }

  function reset() { synthesize(); cursor = 0; t = t0Start; treeCache = null; }

  let treeCache = null;
  const getNode = (id) => {
    const n = byId.get(id);
    return { parent: n.parent, t: n.parent < 0 ? n.date : byId.get(n.parent).date, lineage: n.lineage };
  };

  const api = {
    get t() { return t; },
    get done() { return t >= tEnd; },
    title: meta.title,
    lede: meta.lede,
    defaultSpeed: meta.defaultSpeed ?? 5,
    nLineages: lineages.length,
    surfaceOf: (l) => lineages[l]?.surface ?? 'stone',
    lineageLabel: (l) => lineages[l]?.name ?? '?',
    step(dtDays) {
      const t1 = t + dtDays, out = [];
      while (cursor < cases.length && cases[cursor].tOnset <= t1) out.push(cases[cursor++]);
      t = Math.min(t1, tEnd);
      return out;
    },
    reset,
    snapshot() {
      let day = 0;
      for (let i = cursor - 1; i >= 0 && cases[i].tOnset > t - 1; i--) day++;
      return { t, incidenceToday: day, cumulative: cursor, rtGenealogy: null, reffAnalytic: null };
    },
    tree(now, maxTips = 400) {
      const shown = tips.filter((x) => x.t <= now);
      if (treeCache && treeCache.n === shown.length && treeCache.max === maxTips) return treeCache.layout;
      const layout = buildTree(getNode, thinTips(shown, maxTips));
      treeCache = { n: shown.length, max: maxTips, layout };
      return layout;
    },
    bins(now) { return binCases(cases.slice(0, cursor), { binDays: 7, tMax: now, nLineages: lineages.length }); },
    domain() { const t0 = Math.min(rootDate, t0Start) - 7; return { t0, t1: tEnd + 0.12 * (tEnd - t0), t0Start }; },
    fmt(d) {
      const dt = new Date(startMs + d * 86400000);
      return `${month(dt.getUTCMonth())} ${String(dt.getUTCFullYear()).slice(2)}`;
    },
    provenanceHTML() {
      const src = meta.sources.map((s) => `<li><a href="${s.url}" rel="noopener" target="_blank">${tr(s.name)}</a>. ${tr(s.citation ?? '')} <em>${tr(s.license ?? '')}</em></li>`).join('');
      const trs = meta.transformations.map((x) => `<li>${tr(x)}</li>`).join('');
      return `<div class="panel__head">${tr('Source · observed')}</div><ul>${src}</ul><div class="panel__head">${tr('Transformations')}</div><ul>${trs}</ul><p><strong>${tr('Inferred:')}</strong> ${tr('the severity and outcome of individual cases are sampled')} (${Math.round(sev.fatal * 100)}% ${tr('fatal')}), ${tr('rather than observed. Drops within a week are spaced evenly, so their exact timing inside the week is not observed data.')}</p>`;
    },
  };
  reset();
  return api;
}
