// Boot and wiring: one clock drives model → sound → rain → figures.
import { createBus } from './bus.js';
import { createSim } from './model/sim.js';
import { buildTree, thinTips } from './model/tree.js';
import { binCases } from './model/epicurve.js';
import { createAudio, LOOKAHEAD } from './audio/engine.js';
import { surfaceFor } from './audio/voice.js';
import { createRain } from './view/rain.js';
import { renderTree, renderEpicurve } from './view/figures.js';
import { SURFACE_VAR } from './view/tokens.js';
import { CHAPTERS, makeTween } from './story.js';
import { createObservedSource } from './model/observed.js';

const $ = (id) => document.getElementById(id);
export const bus = createBus();

// ── state ────────────────────────────────────────────────────────────────
const state = {
  mode: 'sim',          // 'sim' | 'obs'
  running: false,
  speed: 1.5,           // model days per real second
  chapter: -1,
  autoAdvance: true,
  chapterStart: 0,
  pending: [],          // visual drops waiting for their audio onset
  gen: 0,
};
const CHAPTER_DAYS = [18, 18, 22, 26, 26, 30, 30, 40, 40, Infinity];

let sim = createSim({ seed: 42 });
let source = sim;                   // the active event source (sim or observed)
let observed = null;
const audio = createAudio();
const rain = createRain($('stage'), { groundOffset: () => $('metrics').getBoundingClientRect().height });
const tween = makeTween({ setParam: (k, v) => sim.setParam(k, v) }, (k) => sim.snapshot().params[k]);

const surfaceOf = (l) => (state.mode === 'obs' ? observed.surfaceOf(l) : surfaceFor(l, sim.lineages));
const lineageLabel = (l) => (state.mode === 'obs' ? observed.lineageLabel(l) : sim.lineages[l]?.name ?? '?');

// ── clock ────────────────────────────────────────────────────────────────
let last = performance.now();
let lastTree = 0, lastEpi = 0, lastMetrics = 0;

function frame(now) {
  const dtReal = Math.min(0.1, (now - last) / 1000);    // background tabs never dump a backlog
  last = now;
  if (state.running) {
    const tStart = source.t;
    const onsets = source.step(dtReal * state.speed);
    for (const c of onsets) {
      const offset = Math.max(0, (c.tOnset - tStart) / state.speed);
      const surface = surfaceOf(c.lineage);
      audio.playCase(c, surface, offset);
      state.pending.push({ at: now + (LOOKAHEAD + offset) * 1000, c, surface, gen: state.gen });
    }
    if (state.mode === 'sim') maybeAdvanceChapter();
  }
  // release visual drops in sync with their sound
  if (state.pending.length) {
    const keep = [];
    for (const p of state.pending) {
      if (p.gen !== state.gen) continue;
      if (p.at <= now) rain.drop(p.c, p.surface); else keep.push(p);
    }
    state.pending = keep;
  }
  if (now - lastMetrics > 250) { lastMetrics = now; drawMetrics(); }
  if (now - lastEpi > 300) { lastEpi = now; drawEpicurve(); }
  if (now - lastTree > 1000) { lastTree = now; drawTree(); }
  requestAnimationFrame(frame);
}

// ── figures ──────────────────────────────────────────────────────────────
function domain() {
  const t = source.t;
  if (state.mode === 'obs') return observed.domain(t);
  return { t0: -8, t1: Math.max(60, t + 4) };
}
const fmtDay = (t) => (state.mode === 'obs' ? observed.fmt(t) : `D${Math.round(t)}`);

// tips that fit the figure without merging (~2.6 px per tip)
const tipBudget = () => Math.max(60, Math.min(400, Math.floor(($('tree').getBoundingClientRect().height - 40) / 2.6)));

function drawTree() {
  const t = source.t;
  let layout;
  if (state.mode === 'obs') layout = observed.tree(t, tipBudget());
  else {
    const tips = [];
    for (const c of sim.cases) if (c.sampled && c.tOnset + 2 <= t) tips.push({ id: c.id, t: c.tOnset + 2 });
    layout = buildTree((id) => ({ parent: sim.cases[id].parent, t: sim.cases[id].tInf, lineage: sim.cases[id].lineage }), thinTips(tips, tipBudget()));
  }
  const { t0, t1 } = domain();
  renderTree($('tree'), layout, { t0, t1, now: t, surfaceOf, lineageLabel, fmt: fmtDay, flashSince: t - (state.mode === 'obs' ? 7 : 1.5) });
  $('tree-note').textContent = `${layout.tips.length} sequenced · time-resolved`;
}

function drawEpicurve() {
  const t = source.t;
  const binDays = state.mode === 'obs' ? 7 : 1;
  const bins = state.mode === 'obs' ? observed.bins(t) : binCases(sim.cases, { binDays, tMax: t, nLineages: sim.lineages.length });
  const order = lineageOrder();
  const { t0, t1 } = domain();
  renderEpicurve($('epicurve'), bins, { t0, t1, now: t, binDays, surfaceOf, order, fmt: fmtDay, unitLabel: 'onsets' });
  drawLegend(order);
}

function lineageOrder() {
  const n = state.mode === 'obs' ? observed.nLineages : sim.lineages.length;
  return [...Array(n).keys()];
}

let legendKey = '';
function drawLegend(order) {
  const items = order.map((l) => `${lineageLabel(l)}|${surfaceOf(l)}`);
  const key = items.join(',') + state.mode;
  if (key === legendKey) return;
  legendKey = key;
  $('legend').innerHTML = order.map((l) => {
    const s = surfaceOf(l);
    return `<li><span class="swatch" style="background:var(${SURFACE_VAR[s]})"></span>${lineageLabel(l)}<span class="legend__sub">${state.mode === 'obs' ? '' : `— ${s}`}</span></li>`;
  }).join('') + '<li class="legend__key"><span class="swatch swatch--solid"></span>reported <span class="swatch swatch--faint"></span>not reported</li>';
}

function drawMetrics() {
  const s = source.snapshot();
  $('m-day').textContent = state.mode === 'obs' ? observed.fmt(s.t) : Math.floor(s.t);
  $('m-inc').textContent = s.incidenceToday.toLocaleString('en');
  $('m-cum').textContent = s.cumulative.toLocaleString('en');
  const rt = s.rtGenealogy ?? s.reffAnalytic;
  $('m-rt').textContent = rt == null ? '—' : rt.toFixed(2);
  syncSliders(s.params ?? {});
}

// ── controls ─────────────────────────────────────────────────────────────
const SLIDERS = [
  { k: 'beta', label: 'Transmission β', hint: 'per day, founder lineage', min: 0.05, max: 0.8, step: 0.01, fmt: (v) => v.toFixed(2) },
  { k: 'infectiousMean', label: 'Infectious period', hint: 'mean days', min: 2, max: 14, step: 0.5, fmt: (v) => `${v.toFixed(1)} d` },
  { k: 'immunity', label: 'Vaccination target', hint: 'share of population', min: 0, max: 0.9, step: 0.01, fmt: (v) => `${Math.round(v * 100)}%` },
  { k: 'detection', label: 'Reporting', hint: 'probability a case is reported', min: 0, max: 1, step: 0.01, fmt: (v) => `${Math.round(v * 100)}%` },
  { k: 'sampling', label: 'Sequencing', hint: 'share of reported cases sequenced', min: 0.01, max: 0.3, step: 0.01, fmt: (v) => `${Math.round(v * 100)}%` },
  { k: 'importRate', label: 'Imports', hint: 'per day, fall on leaves', min: 0, max: 10, step: 0.1, fmt: (v) => v.toFixed(1) },
  { k: 'speed', label: 'Speed', hint: 'model days per second', min: 0.25, max: 4, step: 0.25, fmt: (v) => `${v}×`, app: true },
];
const sliderEls = {};
function buildSliders() {
  const host = $('params');
  for (const d of SLIDERS) {
    const id = `p-${d.k}`;
    const wrap = document.createElement('label');
    wrap.className = 'slider';
    wrap.htmlFor = id;
    wrap.innerHTML = `<span>${d.label}</span><output for="${id}"></output><input type="range" id="${id}" min="${d.min}" max="${d.max}" step="${d.step}"><small>${d.hint}</small>`;
    host.appendChild(wrap);
    const input = wrap.querySelector('input'), out = wrap.querySelector('output');
    input.addEventListener('input', () => {
      const v = +input.value;
      out.textContent = d.fmt(v);
      if (d.app) state.speed = v; else sim.setParam(d.k, v);
    });
    sliderEls[d.k] = { input, out, d };
  }
}
function syncSliders(params) {
  for (const { input, out, d } of Object.values(sliderEls)) {
    if (document.activeElement === input) continue;
    const v = d.app ? state.speed : params[d.k];
    if (v == null) continue;
    input.value = v;
    out.textContent = d.fmt(v);
  }
}

function buildChapters() {
  $('chapters').innerHTML = CHAPTERS.map((c, i) => `<li><button type="button" data-i="${i}">${c.title}</button></li>`).join('');
  $('chapters').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-i]');
    if (b) { setMode('sim'); applyChapter(+b.dataset.i); play(true); }
  });
}

function applyChapter(i) {
  const ch = CHAPTERS[i];
  if (!ch) return;
  if (i === 0) clearRun();
  state.chapter = i;
  state.chapterStart = sim.t;
  ch.apply({ sim, setSpeed: (v) => (state.speed = v), tween, thunder: discontinuity });
  $('chapter-num').textContent = String(i + 1).padStart(2, '0');
  $('chapter-title').textContent = ch.title;
  $('chapter-body').textContent = ch.body;
  for (const b of $('chapters').querySelectorAll('button')) b.toggleAttribute('aria-current', false);
  $('chapters').querySelector(`button[data-i="${i}"]`)?.setAttribute('aria-current', 'step');
}

function maybeAdvanceChapter() {
  if (!state.autoAdvance || state.chapter < 0) return;
  if (sim.t - state.chapterStart >= CHAPTER_DAYS[state.chapter]) applyChapter(state.chapter + 1);
}

function discontinuity({ kind }) {
  audio.thunder(kind === 'import' ? 0.7 : 1);
  setTimeout(() => rain.lightning(), LOOKAHEAD * 1000);
  bus.emit('thunder', { kind });
}

function clearRun() {
  state.gen++;
  state.pending = [];
  rain.clear();
  legendKey = '';
}

function play(on = !state.running) {
  state.running = on;
  $('play').textContent = on ? 'Pause' : 'Play';
  if (on && state.mode === 'sim' && state.chapter < 0) applyChapter(0);
}

function setMode(mode) {
  if (mode === state.mode) return;
  if (mode === 'obs' && !observed) return;
  clearRun();
  state.mode = mode;
  source = mode === 'obs' ? observed : sim;
  if (mode === 'obs') {
    observed.reset();
    $('chapter-num').textContent = 'OBS';
    $('chapter-title').textContent = observed.title;
    $('chapter-body').textContent = observed.lede;
    state.speed = observed.defaultSpeed;
  } else if (state.chapter >= 0) applyChapter(state.chapter);
  $('mode-sim').setAttribute('aria-pressed', mode === 'sim');
  $('mode-obs').setAttribute('aria-pressed', mode === 'obs');
  document.body.dataset.mode = mode;
  $('epi-note').textContent = mode === 'obs' ? 'reported cases by week · WHO' : 'onsets by day · solid = reported';
  $('m-inc-label').textContent = mode === 'obs' ? 'Cases / day' : 'Onsets / day';
  drawProvenance();
  drawTree(); drawEpicurve(); drawMetrics();
}

function drawProvenance() {
  if (state.mode === 'obs') { $('provenance').innerHTML = observed.provenanceHTML(); return; }
  $('provenance').innerHTML = `<div class="panel__head">Source</div><p>Simulated. Stochastic SEIR (chain-binomial, 100,000 people) in which every infection records its infector. The tree is the time-resolved ancestry of sequenced cases; variants arise as mutations on one branch. Clinical attributes are drawn from fixed distributions.</p>`;
}

// ── wiring ───────────────────────────────────────────────────────────────
$('play').addEventListener('click', () => play());
$('reset').addEventListener('click', () => {
  clearRun();
  if (state.mode === 'obs') observed.reset();
  else { sim.reset(); state.chapter = -1; applyChapter(0); }
  drawTree(); drawEpicurve(); drawMetrics();
});
$('variant').addEventListener('click', () => {
  if (state.mode !== 'sim') return;
  const n = sim.lineages.filter((l) => l.name.startsWith('Variant')).length;
  const l = sim.introduceVariant(`Variant ${'αβγδε'[n] ?? n + 1}`, { tx: 1.5 + 0.15 * n, escape: n ? 0.2 : 0 });
  discontinuity({ lineage: l, kind: 'variant' });
});
$('import').addEventListener('click', () => {
  if (state.mode !== 'sim') return;
  sim.importCases(12);
  discontinuity({ kind: 'import' });
});
$('mode-sim').addEventListener('click', () => setMode('sim'));
$('mode-obs').addEventListener('click', () => setMode('obs'));
$('sound').addEventListener('change', async (e) => {
  if (e.target.checked) { await audio.unlock(); if (!audio.ready) await audio.loadBank(); }
  audio.setMuted(!e.target.checked);
});
$('volume').addEventListener('input', (e) => audio.setVolume(+e.target.value));
$('theme').addEventListener('click', () => {
  const root = document.documentElement;
  const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  root.dataset.theme = dark ? 'light' : 'dark';
  legendKey = ''; drawTree(); drawEpicurve();
});

async function start(withSound) {
  $('start').hidden = true;
  if (withSound) {
    await audio.unlock();
    const bank = await audio.loadBank();
    $('sound').checked = !!bank;
    audio.setMuted(!bank);
  } else audio.setMuted(true);
  play(true);
}
$('start-listen').addEventListener('click', () => start(true));
$('start-silent').addEventListener('click', () => start(false));

// Observed dataset (optional; mode disabled until it loads)
fetch('./data/ebola.json').then((r) => (r.ok ? r.json() : null)).then((data) => {
  if (!data) { $('mode-obs').disabled = true; $('mode-obs').title = 'Observed dataset not built'; return; }
  observed = createObservedSource(data);
}).catch(() => { $('mode-obs').disabled = true; });

// Check whether the sound bank exists so the start screen can say so
fetch('./sounds/manifest.json', { method: 'HEAD' }).then((r) => {
  if (!r.ok) $('bank-status').textContent = 'Sound bank not generated yet. "Listen" will run silently for now.';
}).catch(() => {});

buildSliders();
buildChapters();
drawProvenance();
rain.start();
requestAnimationFrame((t) => { last = t; frame(t); });
window.__ps = {
  state, sim: () => sim, audio,
  // debug: advance the active source by `days` and redraw (used for checks when the page is throttled)
  advance(days) {
    for (let d = 0; d < days; d += 0.4) { const ev = source.step(0.4); for (const c of ev) rain.drop(c, surfaceOf(c.lineage)); if (state.mode === 'sim') maybeAdvanceChapter(); }
    drawTree(); drawEpicurve(); drawMetrics();
  },
};
