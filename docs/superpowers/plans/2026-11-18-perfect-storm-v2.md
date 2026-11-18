# Perfect Storm v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Perfect Storm as a deployable static site where one simulated or observed case is one drop sound, one falling drop, one epicurve unit and (if sampled) one phylogeny tip.

**Architecture:** Vanilla ES modules bundled by Vite. Pure model code (`src/model/`) is framework-free and unit-tested with Vitest; views render Canvas (rain) and SVG (tree, epicurve); Web Audio plays a pre-generated ElevenLabs sample bank. Everything communicates via one event bus and snapshots.

**Tech Stack:** Node 26, Vite 6, Vitest 3, Web Audio, Canvas 2D, SVG; ffmpeg for offline sound post-processing; ElevenLabs Sound Effects API (offline, build-time only).

**Spec:** `docs/superpowers/specs/2026-11-18-perfect-storm-v2-design.md`

## Global Constraints

- No UI framework. No runtime calls to ElevenLabs or any third-party API; all data and sounds are static files in `public/`.
- `ELEVENLABS_API_KEY` is read only from `.env.local` (gitignored); never logged, never committed.
- Every colour/size/font in CSS comes from a `--ps-*` token (names fixed in the design-system brief: `--ps-paper --ps-ink --ps-ink-2 --ps-rule --ps-accent --ps-lineage-1..5 --ps-severity-1..4 --ps-font-display/text/mono --ps-fs-display/h1/h2/body/small/caption/data --ps-space-1..8 --ps-rule-w --ps-dur-fast/slow --ps-ease`). No border radii.
- Sound starts only after a user gesture; silent (visual-only) mode must be fully usable.
- No rain ambience loop for case sounds; each audible case is one scheduled one-shot.
- Inferred clinical attributes of observed cases are labelled "inferred" in the UI.
- Model RNG is seedable (`mulberry32`) so tests are deterministic.

## Review Focus

1. **Background tab / throttled timers** — on return, the app must not dump a backlog of thousands of drops at once; the sim clamps catch-up to ≤ 0.5 s of model time. (Task 2 test `clamps catch-up`.)
2. **Extreme incidence** (≥ 5,000 cases/day) — audio voice count stays ≤ `MAX_VOICES` (96) per 0.5 s and the master never exceeds −1 dBFS in offline render. (Task 6 tests.)
3. **Missing sound bank** (key never set, `public/sounds/manifest.json` absent) — app loads, shows "sound bank not generated", runs silent. (Task 6 test `loadBank returns null on 404`.)
4. **Reset / chapter jump mid-run** — pending scheduled events from the previous run are dropped (generation counter). (Task 2 test `reset discards pending`.)
5. **Phone width + iOS audio unlock** — layout has no horizontal scroll at 375 px; AudioContext resumes on first `pointerdown`. (Task 7 browser check.)

---

### Task 1: Scaffold, interim tokens, layout shell

**Files:**
- Create: `package.json`, `vite.config.js`, `index.html`, `src/main.js`, `src/styles/tokens.css`, `src/styles/app.css`, `src/bus.js`, `tests/bus.test.js`

**Interfaces:**
- Produces: `createBus(): { on(type, fn) → off, emit(type, payload) }` in `src/bus.js`. DOM regions with ids: `#stage` (canvas host), `#chapter`, `#tree`, `#epicurve`, `#controls`, `#metrics`, `#provenance`, `#start` (overlay).

- [ ] Step 1: `npm init`, add devDeps `vite@6.3.5`, `vitest@3.2.4`; scripts `dev`, `build`, `preview`, `test` (`vitest run`). `vite.config.js` sets `base: './'`.
- [ ] Step 2: Failing test `tests/bus.test.js`: `emit('case', x)` calls every `on('case')` listener once with `x`; the function returned by `on` unsubscribes; a throwing listener doesn't stop others.
- [ ] Step 3: Implement `createBus`. Run `npm test` → PASS.
- [ ] Step 4: `src/styles/tokens.css` defines every token listed in Global Constraints (interim values: paper `#efeee9`, ink `#0b0b0b`, mono `IBM Plex Mono`, display `Archivo` 800 condensed; dark theme swaps paper/ink). `app.css`: CSS grid — stage full width 62vh; below it a 2-col grid (tree over epicurve on the left, sharing width; controls column 320 px right); single column below 900 px. Hairline rules, no radii.
- [ ] Step 5: `npm run dev`, open in the built-in browser at desktop and 375 px: regions visible, no horizontal scroll.
- [ ] Step 6: Commit `feat: scaffold vite app with interim brutalist shell`.

### Task 2: Stochastic SEIR with genealogy

**Files:**
- Create: `src/model/rng.js`, `src/model/sim.js`, `tests/rng.test.js`, `tests/sim.test.js`

**Interfaces:**
- Consumes: none.
- Produces:
  - `rng.js`: `mulberry32(seed) → () => number`, `gamma(r, shape, scale)`, `poisson(r, mean)`, `binomial(r, n, p)` (normal approx for n·p > 30).
  - `sim.js`: `createSim({ seed, pop = 100000, params })` returning `{ step(dtDays), reset(seed?), setParam(k, v), introduceVariant(name, { tx, escape }), importCases(n), snapshot(), cases, lineages, generation }`.
  - Case record: `{ id, parent, tInf, tOnset, tEnd, lineage, muts, detected, symptomatic, severity: 0|1|2|3, outcome: 'recovered'|'hospitalized'|'fatal', sampled }`. `parent === -1` = reservoir.
  - Lineage record: `{ id, name, parentLineage, originCase, tx, escape, colorIndex }`. Lineage 0 = founder.
  - `step` returns the array of cases that became **infectious (onset)** this step — these are the audible/visible events.
  - Default params: `beta 0.32, incubationMean 5.0, incubationShape 4, infectiousMean 7, infectiousShape 3, detection 0.45, sampling 0.06, mu 0.08 (muts/day), importRate 0, immunity 0`.

- [ ] Step 1: Failing tests in `tests/rng.test.js`: same seed → same sequence; `gamma` sample mean of 20k draws within 3% of shape·scale; `poisson(r, 3)` mean within 3%; `binomial(r, 1000, 0.1)` mean within 3%.
- [ ] Step 2: Implement `rng.js` (gamma via Marsaglia–Tsang). PASS.
- [ ] Step 3: Failing tests in `tests/sim.test.js`:
  - `conserves population`: after 200 steps of 0.1 d, `S + E + I + R === pop` every step.
  - `every case has a valid parent`: each non-reservoir parent id exists and has `tInf < child.tInf`, and parent was infectious at `child.tInf` (`parent.tOnset ≤ child.tInf < parent.tEnd`).
  - `mutations are clock-like`: `child.muts ≥ parent.muts`; regression of muts on tInf over all cases has slope within 25% of `mu`.
  - `variant emerges from a branch`: after `introduceVariant('α', {tx:1.6})`, new lineage's `originCase` is an existing case; all cases with that lineage descend from it; at 60 days later its share among new infections > 0.5 with seed 7.
  - `imports attach to reservoir`: `importCases(5)` adds 5 cases with `parent === -1`.
  - `clamps catch-up`: `step(30)` advances at most 0.5 model days.
  - `reset discards pending`: `generation` increments on reset; snapshot counts return to initial.
  - `deterministic`: two sims with seed 42 produce identical first 500 case records.
- [ ] Step 4: Implement `sim.js`: chain-binomial infections per tick with λ = β·Σ_l tx_l·I_l / N; infector drawn from infectious list weighted by lineage tx; per-case gamma incubation/infectious durations; E/I kept as arrays of ids; mutations `parent.muts + poisson(mu·Δt)`; severity/outcome/detected/sampled sampled per case (severity weights none .38 / mild .34 / moderate .20 / severe .08, fatal = 18% of severe). `snapshot()` returns `{ t, S, E, I, R, incidenceToday, rtGenealogy, reffAnalytic, lineageShares }`. PASS.
- [ ] Step 5: Port `legacy/claude-design-v1/story.js` to `src/story.js` against the new `setParam`/`introduceVariant`/`importCases` API (keep chapter text; vaccination = `setParam('immunity', x)` moving S→R gradually inside `step`).
- [ ] Step 6: Commit `feat: stochastic SEIR with case genealogy`.

### Task 3: Phylogeny extraction and layout

**Files:**
- Create: `src/model/tree.js`, `tests/tree.test.js`

**Interfaces:**
- Consumes: case records from Task 2 (or observed nodes from Task 8 in the same shape: `{ id, parent, t, lineage, muts }`).
- Produces: `buildTree(nodes, tipIds, { maxTips = 400 }) → { root, tips, edges: [{ from, to, x0, x1, y, lineage }], verticals: [{ x, y0, y1 }], tMin, tMax }` where x is in days and y is tip-order index (0..n−1, internal y = mean of child ys). `thinTips(tips, maxTips)` keeps tips evenly spread over time.

- [ ] Step 1: Failing tests: a hand-built 7-node genealogy with 3 tips yields exactly 3 tips, collapses unary chains (no internal node with one child), root is MRCA of the tips, every tip's `x` equals its `t`, ladderized (larger clade first); `thinTips` of 1,000 tips → 400 with time coverage of first and last tip preserved; reservoir parents (−1) join under a synthetic root placed at `tMin − 5` days.
- [ ] Step 2: Implement (mark ancestors of tips, walk up, collapse unary, DFS ladderize). PASS.
- [ ] Step 3: Commit `feat: sampled-tip phylogeny extraction and layout`.

### Task 4: Case-series binning

**Files:**
- Create: `src/model/epicurve.js`, `tests/epicurve.test.js`

**Interfaces:**
- Produces: `binCases(cases, { binDays = 1, tMax }) → [{ t0, total, detected, byLineage: number[] }]` by onset date; `observedBins(weeks)` passthrough for Task 8.

- [ ] Step 1: Failing tests: sum of `total` equals cases with `tOnset ≤ tMax`; `detected ≤ total` per bin; `byLineage` sums to `total`; empty input → `[]`.
- [ ] Step 2: Implement. PASS. Commit `feat: epicurve binning`.

### Task 5: ElevenLabs sound bank (offline)

**Files:**
- Create: `scripts/sound-prompts.json`, `scripts/gen-sounds.mjs`, `scripts/post-sounds.mjs`, `tests/manifest.test.js`, output `public/sounds/*.mp3`, `public/sounds/manifest.json`

**Interfaces:**
- Produces: `manifest.json` = `{ version: 1, sets: { stone: [file…], glass: [...], metal: [...], leaf: [...], heavy: [...], thunder: [...], far: [...] }, gainDb: { file: number } }`. Surface ↔ lineage map: founder→stone, 1st variant→glass, 2nd→metal, imports→leaf, further variants cycle.

- [ ] Step 1: `sound-prompts.json`: per set, 4–6 prompt variants × N takes (drops: 12 per surface, `duration_seconds: 0.5`, `prompt_influence: 0.7`; heavy: 6 @ 0.8 s; thunder: 6 @ 6 s; far: 2 @ 12 s). Prompt style: "single water droplet hitting thick polished stone, close microphone, dry, isolated, no background" (surface swapped per set).
- [ ] Step 2: `gen-sounds.mjs`: loads `.env.local`, POSTs `https://api.elevenlabs.io/v1/sound-generation` (`xi-api-key` header, body `{ text, duration_seconds, prompt_influence }`), writes raw takes to `generador_sounds/raw/<set>/<n>.mp3` (gitignored), skips existing files, `--dry-run` prints the request count and estimated seconds without calling. Exits with a clear message if the key is missing.
- [ ] Step 3: `post-sounds.mjs`: ffmpeg per take — trim leading silence (`silenceremove` −50 dB), fade-out 20 ms, mono for drops / stereo for thunder & far, loudness-normalise (`loudnorm I=-20` drops, −18 thunder), encode 128k mp3 to `public/sounds/<set>-<n>.mp3`; write `manifest.json`. Takes listed in `scripts/rejects.json` are skipped (curation).
- [ ] Step 4: Failing test `tests/manifest.test.js`: if manifest exists, every listed file exists, every set non-empty, drops ≤ 1.0 s (via `ffprobe` duration recorded in manifest `durations`). Skips when no manifest. Implement manifest `durations`. PASS.
- [ ] Step 5: Run `node scripts/gen-sounds.mjs --dry-run`; then (once the user has created `.env.local`) the real run, then `post-sounds.mjs`. Listen-check is Task 6's clips.
- [ ] Step 6: Commit `feat: ElevenLabs sound bank pipeline` (+ generated `public/sounds`).

### Task 6: Audio engine and review clips

**Files:**
- Create: `src/audio/engine.js`, `src/audio/voice.js`, `src/audio/space.js`, `tests/voice.test.js`, `tools/render-clips.html`, `tools/render-clips.js`

**Interfaces:**
- Consumes: manifest (Task 5), case records (Task 2), bus (Task 1).
- Produces:
  - `voice.js` (pure): `caseToVoice(c, lineageSurface, density) → { set, index, rate, gain, lowpassHz, pan, send, layer: 'near'|'mid'|'far', onsetJitter }`; `densityGain(eventsPerSec) → 0..1` (monotone non-increasing, 1.0 below 4 ev/s, ≥ 0.12); `layerFor(eventsPerSec, rand)`.
  - `engine.js`: `createAudio({ manifestUrl }) → { unlock(), loadBank() → Promise<bank|null>, playCase(c, tSim), thunder(intensity), setVolume(v), setMuted(b), offline(durationSec, scriptFn) → Promise<AudioBuffer> }`. Scheduling: events queued with target time `ctx.currentTime + 0.1 + U(0, tickRealSec)`; voices capped at `MAX_VOICES = 96` per 0.5 s (lowest-gain dropped first); severity-3 + fatal → low resonant hit (heavy set, rate 0.5).
  - `space.js`: generated stereo IR (2.4 s, pre-delay 18 ms, early reflections), near/mid/far buses (far: highpass 900 Hz + more send), thunder ducks rain bus by 4 dB for 1.5 s, master `DynamicsCompressor` as limiter (threshold −3, ratio 20).

- [ ] Step 1: Failing tests `tests/voice.test.js`: same lineage → same `set`; undetected → `layer` ≠ 'near' and larger `send` than detected; severity 3 gain > severity 0 gain; `densityGain` monotone and bounded; mutation count shifts `rate` by ≤ ±3%; pan for a lineage stays within its zone ±0.25.
- [ ] Step 2: Implement `voice.js`. PASS.
- [ ] Step 3: Implement `space.js`, `engine.js`; `loadBank` returns `null` on 404 (test with mocked fetch: `loadBank returns null on 404`).
- [ ] Step 4: `tools/render-clips.html`: runs the sim with seeds/params for three 12 s scenarios (sparse ≈ 2 cases/s, building ≈ 20/s, storm ≈ 200/s + one variant thunder) through `engine.offline`, measures peak dBFS, downloads WAVs. Open in the built-in browser, save to `review/clips/`, report peaks (must be ≤ −1 dBFS).
- [ ] Step 5: Send the three WAVs to the user (SendUserFile) and wait for their verdict before Task 7's polish; iterate prompts/curation/mix on feedback.
- [ ] Step 6: Commit `feat: sample-based rain audio engine`.

### Task 7: Views and wiring

**Files:**
- Create: `src/view/rain.js`, `src/view/tree.js`, `src/view/epicurve.js`, `src/view/controls.js`, `src/view/metrics.js`; Modify: `src/main.js`

**Interfaces:**
- Consumes: Tasks 1–4, 6.
- Produces: `createRain(canvas) → { drop(c), lightning(colorIndex), setReducedMotion(b), start(), stop() }` (port of legacy `scene.js`, drops coloured by `--ps-lineage-n`, no gradients/glow — flat brutalist strokes); `renderTree(svg, layout, { now })` and `renderEpicurve(svg, bins, { tMin, tMax })` sharing one x-scale (`xScale(t)` exported from `epicurve.js`); new tips/bars flash for `--ps-dur-slow`.

- [ ] Step 1: Rain view port; drop per onset event; lightning on variant/import.
- [ ] Step 2: Tree view: SVG paths for edges/verticals, tips as 3 px squares, lineage-origin marker (small ▲ and label), x-axis in days at bottom shared with epicurve; redraw ≤ 1 Hz.
- [ ] Step 3: Epicurve: stacked bars by lineage (filled = detected, outline = undetected); unit-square stacks when max bin ≤ 40.
- [ ] Step 4: Controls (play/pause/reset, mode Simulate/Observed, sound switch, volume, β, infectious period, immunity, detection, sampling, speed, Variant, Import), chapter index from `story.js`, metrics (day, incidence, cumulative, Rt), start overlay with "Listen" / "Watch in silence".
- [ ] Step 5: Built-in browser check at desktop and 375 px, light and dark, reduced motion: rain + tree + epicurve move together; a variant produces thunder + new tree colour + new bar colour; no console errors; Review Focus 1 (hide tab 30 s, return: no burst) and 5.
- [ ] Step 6: Commit `feat: rain, phylogeny and epicurve views`.

### Task 8: Observed mode — West African Ebola 2013–16

**Files:**
- Create: `scripts/prep-ebola.mjs`, `public/data/ebola.json`, `src/model/observed.js`, `tests/observed.test.js`, `src/view/provenance.js`

**Interfaces:**
- Produces: `ebola.json` = `{ meta: { title, sources: [{ name, url, citation, license }], transformations: [...] }, nodes: [{ id, parent, t, lineage, muts }], tips: [id], weeks: [{ t0, byCountry: { GIN, SLE, LBR } }] }` with `t` in days since 2013-12-01 and lineage = country index; `createObserved(data) → same interface subset as sim: { step(dtDays), snapshot(), cases }` emitting synthetic onset events spread uniformly within each epi-week, clinical attributes sampled and flagged `inferred: true`.

- [ ] Step 1: `prep-ebola.mjs`: fetch `https://data.nextstrain.org/ebola.json` (gzip) → flatten tree (`num_date` → days, `div` → muts, `country` → lineage); fetch WHO case counts from `ebov/space-time` (`Data/` location × epi-week table) → weekly totals by country; write `public/data/ebola.json` with provenance (Dudas et al. 2017 Nature; Nextstrain/Bedford; CC BY-SA 4.0 for counts).
- [ ] Step 2: Failing tests: observed stream over a full week emits exactly that week's case count (±0); tips revealed only when `t ≤ now`; all emitted cases have `inferred: true`.
- [ ] Step 3: Implement `observed.js`; wire mode switch; provenance panel lists sources, licence, transformations, "clinical attributes inferred". PASS.
- [ ] Step 4: Commit `feat: observed mode with West African Ebola data`.

### Task 9: Build and deploy pipeline

**Files:**
- Create: `.github/workflows/build.yml`, update `README.md`

- [ ] Step 1: Workflow on push/PR: `npm ci`, `npm test`, `npm run build`, upload `dist` artifact. (Pages/Vercel deploy step added only after the user picks the host and confirms the droplet/sound licences.)
- [ ] Step 2: `npm run build && npm run preview`; check in browser. Commit `ci: build and test workflow`. Push branch, open PR to `main`.

### Task 10: Apply the design system (after `design-system` branch lands)

- [ ] Step 1: Merge `refs/heads/<design-system branch>` (user approval), replace `src/styles/tokens.css` with `design-system/tokens.css`, adopt `design-system/components.css` classes in controls/metrics/chapters/legend/provenance.
- [ ] Step 2: Browser check light/dark, desktop/375 px. Commit `style: adopt Perfect Storm design system`.
