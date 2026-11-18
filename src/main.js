// Boot and wiring: one clock drives model → sound → rain → figures.
import { createBus } from './bus.js';
import { createSim } from './model/sim.js';
import { buildTree, thinTips } from './model/tree.js';
import { createAudio, LOOKAHEAD } from './audio/engine.js';
import { surfaceFor, MATERIAL } from './audio/voice.js';
import { bedLevel } from './audio/grains.js';
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
const story = createStory(sim, { onChapter: (i) => { if (i > 0) markEvent(sim.t, CHAPTERS[i].mark ?? CHAPTERS[i].title, { chapter: i, lineage: lineageByName(CHAPTERS[i].lineageName) }); selectedEvent = -1; stage.setSelectedEvent(-1); showChapter(i); }, setSpeed: (v) => (state.speed = v), thunder: (e) => discontinuity(e) });
let source = story;                 // the active event source (story-driven sim, or observed)
let observed = null;
// sound bank: ?bank=sounds-field (CC0 field recordings, default) | sounds-textures (ElevenLabs textures) | sounds (ElevenLabs one-shots)
const BANK = (new URLSearchParams(location.search).get('bank') || 'sounds-textures').replace(/[^\w-]/g, '');
// Experiment (user, 2026-11-18): no rain bed at all — every sound is one case's drop.
const BED_ENABLED = new URLSearchParams(location.search).get('bed') === '1';
const audio = createAudio({ manifestUrl: `./${BANK}/manifest.json`, bed: BED_ENABLED });
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

const surfaceOf = (l) => (state.mode === 'obs' ? observed.surfaceOf(l) : surfaceFor(l, sim.lineages));   // colour key
// what each lineage sounds like: colour key (role) → recorded material, shared with the clip renderer
const materialOf = (l) => MATERIAL[surfaceOf(l)] ?? 'puddle';
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
    if (source.done) play(false);   // the observed data has ended: stop, and let the rain fade
    for (const c of onsets) {
      const offset = Math.max(0, (c.tOnset - tStart) / state.speed);
      const surface = surfaceOf(c.lineage);
      const landAt = now + offset * 1000 + FALL_MS;
      if (!mutedLineages.has(c.lineage)) audio.playCase(c, materialOf(c.lineage), Math.max(0, offset + FALL_MS / 1000 - LOOKAHEAD));
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
  if (now - lastMetrics > 250) { lastMetrics = now; drawMetrics(); updateBed(); drawEventButtons(); }
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

// The tree is dropped for now (user, 2026-11-18): kept in code, not drawn.
const TREE_ENABLED = false;
function drawTree() {
  if (!TREE_ENABLED) return;
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
  // lineage view: one shape per lineage, each growing out of the one it arose in
  const col = layout.root ? collapseTree(layout.root, { founderBands: 1, maxLifted: 4 }) : null;
  renderCollapsedTree($('tree'), col, { t0, t1, now: t, surfaceOf, lineageLabel, fmt: fmtDay });
  $('tree-note').textContent = `phylogeny of ${layout.tips.length.toLocaleString('en')} sequenced cases, one shape per lineage`;
}

function lineageOrder() {
  const n = state.mode === 'obs' ? observed.nLineages : sim.lineages.length;
  return [...Array(n).keys()];
}

// Listening aids: mute any lineage's sound (or the death layer) from the legend.
const mutedLineages = new Set();
$('legend').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-lineage], button[data-layer]');
  if (!b) return;
  if (b.dataset.layer === 'deaths') audio.setDeaths(!audio.deaths);
  else { const l = +b.dataset.lineage; mutedLineages.has(l) ? mutedLineages.delete(l) : mutedLineages.add(l); }
  legendKey = ''; drawLegend(lineageOrder());
});

let legendKey = '';
function drawLegend(order) {
  const items = order.map((l) => `${lineageLabel(l)}|${surfaceOf(l)}|${materialOf(l)}`);
  const key = items.join(',') + state.mode + [...mutedLineages].join('.') + audio.deaths;
  if (key === legendKey) return;
  legendKey = key;
  const ROLE = (l) => (state.mode === 'obs' ? 'cases in' : l === 0 ? 'founder virus' : lineageLabel(l) === 'Imported' ? 'brought in from outside' : 'new variant');
  const MAT = { puddle: 'base tone', 'puddle:bright': 'brighter', 'puddle:dark': 'darker', 'puddle:light': 'lighter' };
  $('legend').innerHTML = order.map((l) => {
    const s = surfaceOf(l);
    const name = state.mode === 'obs' ? lineageLabel(l) : lineageLabel(l) === 'Founder' ? 'Founder' : lineageLabel(l);
    const on = !mutedLineages.has(l);
    return `<li><button type="button" class="stage__legend-item" data-lineage="${l}" aria-pressed="${on}" title="${on ? 'Mute' : 'Unmute'} this lineage's sound"><span class="stage__legend-sw" style="background:var(${SURFACE_VAR[s]})"></span><span class="stage__legend-name">${name}</span><span class="stage__legend-sub">${ROLE(l)} · ${on ? `sound: ${MAT[materialOf(l)] ?? materialOf(l)}` : 'muted'}</span></button></li>`;
  }).join('') +
  `<li><button type="button" class="stage__legend-item" data-layer="deaths" aria-pressed="${audio.deaths}" title="${audio.deaths ? 'Mute' : 'Unmute'} the extra low sound played for each death"><span class="stage__legend-sw stage__legend-sw--death"></span><span class="stage__legend-name">Deaths</span><span class="stage__legend-sub">${audio.deaths ? 'an extra low knock per death' : 'muted'}</span></button></li>` +
  `<li class="stage__legend-key"><span class="stage__legend-sw"></span>reported<span class="stage__legend-sw stage__legend-sw--faint"></span>never reported</li>` +
  `<li class="stage__legend-hint">click a line to mute or unmute its sound</li>`;
}

// The rain bed follows the epidemic: its level from how many drops are falling per
// second, its texture from the lineages of the last week of landed drops.
function updateBed() {
  if (!BED_ENABLED) return;
  if (!state.running) { audio.setBed({}, 0); return; }
  const rate = source.snapshot().incidenceToday * state.speed;
  const level = bedLevel(rate, audio.mix.bedFrom, audio.mix.bedFull);
  const recent = ledger.bins().slice(-Math.ceil(7 / ledger.binDays));
  const byMat = {}; let tot = 0;
  for (const b of recent) b.byLineage.forEach((n, l) => { if (n) { const m = materialOf(l).split(':')[0]; byMat[m] = (byMat[m] ?? 0) + n; tot += n; } });
  const levels = {};
  for (const m in byMat) levels[m] = (level * byMat[m]) / tot;
  audio.setBed(levels, level);
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

// story events and manual interventions, marked on the case series' time axis
let events = [];
const lineageByName = (name) => (name ? sim.lineages.findIndex((L) => L.name === name) : -1);

// Each milestone stores an exact checkpoint of the simulation and the story.
function markEvent(t, label, info = {}) {
  events.push({ t, label, lineage: -1, ...info, snap: { sim: sim.save(), story: story.save(), speed: state.speed } });
  stage.setEvents(events.map(eventForStage));
  drawEventButtons(true);
}
const eventForStage = (e) => ({ t: e.t, label: e.label, colour: e.lineage >= 0 ? surfaceOf(e.lineage) : null });

// Milestones are selectable once they appear: clicking one rewinds the
// simulation to that moment; everything after it is discarded and lived again.
let selectedEvent = -1;
function drawEventButtons(rebuild = false) {
  const host = $('events');
  const layout = stage.eventLayout();
  if (rebuild || host.children.length !== layout.length) {
    host.innerHTML = layout.map((e) => {
      const ev = events[e.k];
      const colour = ev.lineage >= 0 ? `var(${SURFACE_VAR[surfaceOf(ev.lineage)]})` : '';
      return `<button type="button" class="stage__event" data-k="${e.k}" aria-pressed="false" style="${colour ? `--ev-colour:${colour}` : ''}" title="Go back to ${e.label}">${e.label}</button>`;
    }).join('');
  }
  layout.forEach((e) => {
    const b = host.children[e.k];
    b.style.left = `${e.left}px`; b.style.top = `${e.top}px`;
    b.hidden = !e.visible;
    b.setAttribute('aria-pressed', String(e.k === selectedEvent));
  });
}
function rewindTo(k) {
  const e = events[k];
  if (!e?.snap || state.mode !== 'sim') return;
  sim.restore(e.snap.sim);
  story.restore(e.snap.story);
  state.speed = e.snap.speed;
  events = events.slice(0, k + 1);
  // visuals restart from the restored record: bars rebuilt from every onset so far
  state.gen++; state.pending = [];
  stage.clear();
  ledger = createLedger({ binDays: 1 });
  for (const c of sim.onsets) ledger.land(c);
  stage.setEvents(events.map(eventForStage));
  selectedEvent = k; stage.setSelectedEvent(k);
  legendKey = '';
  showChapter(story.index);
  drawEventButtons(true); drawLegend(lineageOrder()); drawMetrics();
  if (!state.running) play(true);
}
$('events').addEventListener('click', (ev) => {
  const b = ev.target.closest('button[data-k]');
  if (b) rewindTo(+b.dataset.k);
});

function clearRun() {
  state.gen++;
  state.pending = [];
  events = []; stage.setEvents(events); selectedEvent = -1; stage.setSelectedEvent(-1); $('events').innerHTML = '';
  stage.setUnitLabel(state.mode === 'obs' ? 'reported cases per week' : 'cases per day, by onset');
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
  const name = `Variant ${'αβγδε'[n] ?? n + 1}`;
  const l = sim.introduceVariant(name, { tx: 1.5 + 0.15 * n, escape: n ? 0.2 : 0 });
  markEvent(sim.t, name, { manual: true, lineage: l });
  discontinuity({ lineage: l, kind: 'variant' });
});
$('import').addEventListener('click', () => {
  if (state.mode !== 'sim') return;
  sim.importCases(12);
  markEvent(sim.t, 'Import pulse', { manual: true, lineage: lineageByName('Imported') });
  discontinuity({ kind: 'import' });
});
$('mode-sim').addEventListener('click', () => setMode('sim'));
for (const r of document.querySelectorAll('input[data-tree]')) r.addEventListener('change', () => {
  if (r.checked) $('stage-el').dataset.tree = r.dataset.tree;
});
for (const r of document.querySelectorAll('input[data-scale]')) r.addEventListener('change', () => stage.setScale(r.dataset.scale));
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
  'sounds-drops': 'Clean recorded drips for each case, over a bed of real rain that grows with the epidemic.',
  'sounds-blend': 'Softer drips that melt into the rain bed; the bed starts earlier and lingers.',
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
    try {
      await audio.unlock();
      const bank = await audio.loadBank();
      $('sound').checked = !!bank;
      audio.setMuted(!bank);
      if (!bank) $('bank-note').textContent = 'Sound bank could not be loaded.';
    } catch (err) {
      // show the failure instead of running silently (Safari diagnostics)
      $('bank-note').textContent = `Sound failed: ${err?.name ?? ''} ${err?.message ?? err}`;
      console.error('[audio]', err);
    }
  } else audio.setMuted(true);
  if (withSound && audio.ready) await runTutorial();
  play(true);
}

// A short tour of every sound before the story: one drop, an unreported case,
// each lineage's tone, deaths, thunder, and dense rain.
const TUTORIAL = [
  { title: 'One case, one drop', text: 'Each new case falls as a single drop. Early in an outbreak you can count them.',
    play: () => demo([{ lineage: 0, detected: true }], 0.6) },
  { title: 'Unreported cases', text: 'Cases nobody reports still fall, but farther away: fainter, darker, wetter.',
    play: () => demo([{ lineage: 0, detected: false }, { lineage: 0, detected: false }, { lineage: 0, detected: false }], 0.5) },
  { title: 'A new variant', text: 'When a new lineage takes hold, its drops fall a little brighter.',
    play: () => demo(Array.from({ length: 4 }, () => ({ lineage: 0, detected: true, material: 'puddle:bright' })), 0.45) },
  { title: 'A second variant', text: 'A later lineage falls darker.',
    play: () => demo(Array.from({ length: 4 }, () => ({ lineage: 0, detected: true, material: 'puddle:dark' })), 0.45) },
  { title: 'Imported cases', text: 'Cases brought in from outside fall a little lighter.',
    play: () => demo(Array.from({ length: 4 }, () => ({ lineage: 0, detected: true, material: 'puddle:light' })), 0.45) },
  { title: 'Deaths', text: 'Each death can add a low knock. It is off by default: switch it on from "Deaths" in the legend.',
    play: () => { const was = audio.deaths; audio.setDeaths(true); demo([{ lineage: 0, detected: true, severity: 3, outcome: 'fatal' }], 0); setTimeout(() => audio.setDeaths(was), 600); } },
  { title: 'Thunder', text: 'A discontinuity, such as a new variant appearing or a pulse of imports, arrives with thunder.',
    play: () => audio.thunder(1) },
  { title: 'Rain', text: 'And when cases multiply, the drops become rain. Every drop is still one case.',
    play: () => demo(Array.from({ length: 140 }, () => ({ lineage: 0, detected: Math.random() < 0.4 })), 3.5 / 140, true) },
];
function demo(list, gap, jitter = false) {
  list.forEach((d, i) => {
    const c = { id: Math.floor(Math.random() * 1e6), severity: d.severity ?? 1, detected: d.detected, muts: 0, lineage: d.lineage, outcome: d.outcome ?? 'recovered' };
    audio.playCase(c, d.material ?? materialOf(d.lineage), i * gap + (jitter ? Math.random() * gap : 0));
  });
}
function runTutorial() {
  return new Promise((resolve) => {
    const intro = $('start').querySelector('.start__inner:not(.tutorial)');
    const tut = $('tutorial');
    let k = 0;
    const show = () => {
      const step = TUTORIAL[k];
      $('tut-step').textContent = `${k + 1} / ${TUTORIAL.length}`;
      $('tut-title').textContent = step.title;
      $('tut-text').textContent = step.text;
      $('tut-next').textContent = k === TUTORIAL.length - 1 ? 'Start the story' : 'Next';
      step.play();
    };
    const finish = () => {
      $('tut-play').onclick = $('tut-next').onclick = $('tut-skip').onclick = null;
      tut.hidden = true; intro.hidden = false; $('start').hidden = true;
      resolve();
    };
    $('tut-play').onclick = () => TUTORIAL[k].play();
    $('tut-next').onclick = () => { if (k < TUTORIAL.length - 1) { k++; show(); } else finish(); };
    $('tut-skip').onclick = finish;
    intro.hidden = true; tut.hidden = false; $('start').hidden = false;
    show();
    $('tut-next').focus();
  });
}

// A one-line audio status in the controls, to diagnose silent browsers.
setInterval(() => {
  const s = audio.status(), el = $('audio-status');
  if (el) el.textContent = `audio: ${s.state} · ${s.rate ? `${(s.rate / 1000).toFixed(1)} kHz` : '—'} · bank ${s.bank ? 'loaded' : 'not loaded'}${s.muted ? ' · muted' : ''} · ${s.played} drops played`;
}, 1000);
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
