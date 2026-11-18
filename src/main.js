// Boot and wiring: one clock drives model → sound → rain → figures.
import { createBus } from './bus.js';
import { createSim } from './model/sim.js';
import { buildTree, thinTips } from './model/tree.js';
import { createAudio, LOOKAHEAD } from './audio/engine.js';
import { surfaceFor } from './audio/voice.js';
import { createStage } from './view/stage.js';
import { createLedger } from './view/ledger.js';
import { renderCollapsedTree } from './view/figures.js';
import './view/dock.js';
import { collapseTree } from './model/collapse.js';
import { SURFACE_VAR } from './view/tokens.js';
import { CHAPTERS, createStory } from './story.js';
import { createObservedSource } from './model/observed.js';

const $ = (id) => document.getElementById(id);
export const bus = createBus();

// ── state ────────────────────────────────────────────────────────────────
const state = {
  mode: 'sim',          // 'sim' | 'obs'
  running: false,
  speed: 1.5,           // model days per real second
  chapter: -1,
  pending: [],          // visual drops waiting for their audio onset
  gen: 0,
};

let sim = createSim({ seed: 42 });
// the story drives the simulation: chapters end when what they describe has happened
const story = createStory(sim, { onChapter: (i) => showChapter(i), setSpeed: (v) => (state.speed = v), thunder: (e) => discontinuity(e) });
let source = story;                 // the active event source (story-driven sim, or observed)
let observed = null;
// sound bank: ?bank=sounds-field (CC0 field recordings, default) | sounds-textures (ElevenLabs textures) | sounds (ElevenLabs one-shots)
const BANK = (new URLSearchParams(location.search).get('bank') || 'sounds-field').replace(/[^\w-]/g, '');
const audio = createAudio({ manifestUrl: `./${BANK}/manifest.json` });
let ledger = createLedger({ binDays: 1 });
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FALL_MS = reducedMotion ? 0 : 1100;   // a drop's flight; its sound plays on impact
const stage = createStage($('stage'), {
  stageEl: $('stage-el'),
  groundOffset: () => $('metrics').getBoundingClientRect().height,
  domain: () => ({ ...domain(), now: source.t }),
  ledger: () => ledger,
  surfaceOf: (l) => surfaceOf(l),
  order: () => lineageOrder(),
  fmt: (t) => fmtDay(t),
});

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
      const landAt = now + offset * 1000 + FALL_MS;
      audio.playCase(c, surface, Math.max(0, offset + FALL_MS / 1000 - LOOKAHEAD));
      stage.spawn(c, surface, landAt - FALL_MS, landAt);
      state.pending.push({ at: landAt, c, surface, gen: state.gen });
    }
  }
  // landings: every case adds one to its bar, in time order (independent of visual caps)
  if (state.pending.length) {
    const keep = [];
    for (const p of state.pending) {
      if (p.gen !== state.gen) continue;
      if (p.at <= now) { ledger.land(p.c); stage.splash(p.c, p.surface); } else keep.push(p);
    }
    state.pending = keep;
  }
  if (now - lastMetrics > 250) { lastMetrics = now; drawMetrics(); }
  if (now - lastEpi > 500) { lastEpi = now; drawLegend(lineageOrder()); }
  if (now - lastTree > 1000) { lastTree = now; drawTree(); }
  requestAnimationFrame(frame);
}

// ── figures ──────────────────────────────────────────────────────────────
function domain() {
  const t = source.t;
  if (state.mode === 'obs') return observed.domain(t);
  const t0 = -8;
  return { t0, t1: Math.max(60, t + 4 + 0.14 * (t - t0)) };   // room past 'now' for clade labels
}
const fmtDay = (t) => (state.mode === 'obs' ? observed.fmt(t) : `D${Math.round(t)}`);

// tips that fit the figure without merging (~2.6 px per tip)
const TIP_CAP = 2000;   // tips feeding the collapsed tree (counts on wedges); not drawn one by one
const bandBudget = () => Math.max(5, Math.min(12, Math.floor($('tree').getBoundingClientRect().height / 30)));

function drawTree() {
  const t = source.t;
  const box = stage.treeBox();
  $('tree').style.top = `${box.top}px`;
  $('tree').style.height = `${Math.max(60, box.bottom - box.top)}px`;
  let layout;
  if (state.mode === 'obs') layout = observed.tree(t, TIP_CAP);
  else {
    const tips = [];
    for (const c of sim.cases) if (c.sampled && c.tOnset + 2 <= t) tips.push({ id: c.id, t: c.tOnset + 2 });
    layout = buildTree((id) => ({ parent: sim.cases[id].parent, t: sim.cases[id].tInf, lineage: sim.cases[id].lineage }), thinTips(tips, TIP_CAP));
  }
  const { t0, t1 } = domain();
  const col = layout.root ? collapseTree(layout.root, { maxClades: bandBudget() }) : null;
  renderCollapsedTree($('tree'), col, { t0, t1, now: t, surfaceOf, lineageLabel, fmt: fmtDay });
  $('tree-note').textContent = `phylogeny of ${layout.tips.length.toLocaleString('en')} sequenced cases, grouped into clades`;
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
    return `<li><span class="ps-swatch" style="--ps-swatch:var(${SURFACE_VAR[s]})"></span>${lineageLabel(l)}<span class="legend__sub">${state.mode === 'obs' ? '' : `— ${s}`}</span></li>`;
  }).join('') + '<li class="legend__key"><span class="ps-swatch"></span>reported <span class="ps-swatch swatch--faint"></span>not reported</li>';
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
  { k: 'beta', label: 'Transmission <var>β</var>', hint: 'per day, founder lineage', min: 0.05, max: 0.8, step: 0.01, fmt: (v) => v.toFixed(2) },
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
    wrap.className = 'ps-field';
    wrap.htmlFor = id;
    wrap.innerHTML = `<span class="ps-label">${d.label}</span><output class="ps-field__value" for="${id}"></output><input class="ps-slider" type="range" id="${id}" min="${d.min}" max="${d.max}" step="${d.step}"><small class="field__hint">${d.hint}</small>`;
    host.appendChild(wrap);
    const input = wrap.querySelector('input'), out = wrap.querySelector('output');
    input.addEventListener('input', () => {
      const v = +input.value;
      out.textContent = d.fmt(v);
      setFill(input);
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
    setFill(input);
  }
}
// WebKit draws the slider's progress from --ps-fill (Firefox uses ::-moz-range-progress)
function setFill(input) {
  const min = +input.min, max = +input.max;
  input.style.setProperty('--ps-fill', `${(100 * (+input.value - min)) / (max - min || 1)}%`);
}

function buildChapters() {
  $('chapters').innerHTML = CHAPTERS.map((c, i) => `<li><button type="button" data-i="${i}">${c.title}</button></li>`).join('');
  $('chapters').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-i]');
    if (b) { setMode('sim'); goChapter(+b.dataset.i); play(true); }
  });
}

function goChapter(i) {
  if (!CHAPTERS[i]) return;
  if (i === 0) clearRun();
  story.goto(i);
}

function showChapter(i) {
  const ch = CHAPTERS[i];
  state.chapter = i;
  if (state.mode !== 'sim') return;
  $('chapter-num').textContent = String(i + 1).padStart(2, '0');
  $('chapter-title').textContent = ch.title;
  $('chapter-body').textContent = ch.body;
  for (const b of $('chapters').querySelectorAll('button')) b.toggleAttribute('aria-current', false);
  $('chapters').querySelector(`button[data-i="${i}"]`)?.setAttribute('aria-current', 'step');
}

function discontinuity({ kind }) {
  audio.thunder(kind === 'import' ? 0.7 : 1);
  setTimeout(() => stage.flash(), LOOKAHEAD * 1000);
  bus.emit('thunder', { kind });
}

function clearRun() {
  state.gen++;
  state.pending = [];
  ledger = createLedger({ binDays: state.mode === 'obs' ? 7 : 1 });
  stage.clear();
  legendKey = '';
}

function play(on = !state.running) {
  state.running = on;
  $('play').textContent = on ? 'Pause' : 'Play';
  if (on && state.mode === 'sim' && state.chapter < 0) goChapter(0);
}

// The mode radios check themselves before setMode runs; keep them honest.
function syncModeRadios() {
  $('mode-sim').checked = state.mode === 'sim';
  $('mode-obs').checked = state.mode === 'obs';
}

function setMode(mode) {
  if (mode === state.mode) return syncModeRadios();
  if (mode === 'obs' && !observed) return syncModeRadios();
  state.mode = mode;
  clearRun();
  source = mode === 'obs' ? observed : story;
  if (mode === 'obs') {
    observed.reset();
    $('chapter-num').textContent = 'OBS';
    $('chapter-title').textContent = observed.title;
    $('chapter-body').textContent = observed.lede;
    state.speed = observed.defaultSpeed;
  } else if (state.chapter >= 0) showChapter(state.chapter);
  syncModeRadios();
  document.body.dataset.mode = mode;
  $('m-inc-label').textContent = mode === 'obs' ? 'Cases / day' : 'Onsets / day';
  drawProvenance();
  drawTree(); drawLegend(lineageOrder()); drawMetrics();
}

function drawProvenance() {
  if (state.mode === 'obs') { $('provenance').innerHTML = observed.provenanceHTML(); return; }
  $('provenance').innerHTML = `<div class="panel__head">Source · simulated</div><p>Simulated. Stochastic SEIR (chain-binomial, 100,000 people) in which every infection records its infector. The tree is the time-resolved ancestry of sequenced cases; variants arise as mutations on one branch. Clinical attributes are drawn from fixed distributions.</p>`;
}

// ── wiring ───────────────────────────────────────────────────────────────
$('play').addEventListener('click', () => play());
$('reset').addEventListener('click', () => {
  clearRun();
  if (state.mode === 'obs') observed.reset();
  else { state.chapter = -1; goChapter(0); }
  drawTree(); drawLegend(lineageOrder()); drawMetrics();
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
for (const r of document.querySelectorAll('input[data-tree]')) r.addEventListener('change', () => {
  if (r.checked) $('stage-el').dataset.tree = r.dataset.tree;
});
for (const r of document.querySelectorAll('input[data-spread]')) r.addEventListener('change', () => {
  if (r.checked) stage.setSpread(r.dataset.spread);
});
$('mode-obs').addEventListener('click', () => setMode('obs'));
$('sound').addEventListener('change', async (e) => {
  if (e.target.checked) { await audio.unlock(); if (!audio.ready) await audio.loadBank(); }
  audio.setMuted(!e.target.checked);
});
$('volume').addEventListener('input', (e) => {
  audio.setVolume(+e.target.value);
  setFill(e.target);
  $('volume-out').textContent = `${Math.round(+e.target.value * 100)}%`;
});
// A/B: switch the sound source live, while the storm keeps playing
const BANK_NOTES = {
  'sounds-field': 'Real CC0 rain on stone, glass, metal and leaves.',
  'sounds-textures': 'ElevenLabs-generated rain textures, cut at each drop.',
  sounds: 'ElevenLabs single-drop takes (the first attempt).',
};
for (const r of document.querySelectorAll('input[data-bank]')) {
  if (r.dataset.bank === BANK) r.checked = true;
  r.addEventListener('change', async () => {
    const name = r.dataset.bank;
    $('bank-note').textContent = 'Loading…';
    const bank = await audio.setBank(`./${name}/manifest.json`);
    $('bank-note').textContent = bank ? BANK_NOTES[name] : 'This sound bank is not available.';
    const u = new URL(location.href); u.searchParams.set('bank', name); history.replaceState(null, '', u);
  });
}
$('bank-note').textContent = BANK_NOTES[BANK] ?? '';
$('theme').addEventListener('click', () => {
  const root = document.documentElement;
  const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  root.dataset.theme = dark ? 'light' : 'dark';
  legendKey = ''; drawTree();
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
  $('mode-obs').disabled = false;
}).catch(() => { $('mode-obs').disabled = true; });

// Check whether the sound bank exists so the start screen can say so
fetch(`./${BANK}/manifest.json`, { method: 'HEAD' }).then((r) => {
  if (!r.ok) $('bank-status').textContent = 'Sound bank not generated yet. "Listen" will run silently for now.';
}).catch(() => {});

buildSliders();
buildChapters();
drawProvenance();
stage.start();
requestAnimationFrame((t) => { last = t; frame(t); });
window.__ps = {
  state, sim: () => sim, audio, stage,
  // debug: advance the active source by `days` and redraw (used for checks when the page is throttled)
  advance(days) {
    for (let d = 0; d < days; d += 0.4) { const ev = source.step(0.4); for (const c of ev) ledger.land(c); }
    drawTree(); drawLegend(lineageOrder()); drawMetrics();
  },
};
