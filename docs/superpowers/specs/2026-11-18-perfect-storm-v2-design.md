# Perfect Storm v2 — design

Date: 2026-11-18 · Branch: `feat/v2-rebuild` · Supersedes the prototype in `legacy/claude-design-v1/`

## Intent

Perfect Storm makes an outbreak legible through the ear: every infection is one raindrop, so a growing epidemic is heard as drizzle becoming a storm. The user still likes the concept but finds v1 not aesthetic enough, and the sound "especially bad". v2 keeps the concept and fixes three things:

1. **Sound** — it should sound like real rain built from real drops, not synthesised noise ticks.
2. **Visual depth** — sound is joined by two accurate-yet-artistic figures: an **evolving phylogenetic tree** and a **case series (epidemic curve)**.
3. **Form** — brutalist look (design system from the parallel `design-system` session, inspired by König Galerie / Rachel Garrard), shipped as a deployable static site from GitHub (`PostigoIP/perfect-storm`).

## Goals

- One case = one drop sound = one falling drop = one unit in the epicurve = (if sampled) one tip in the tree. The same event is visible and audible in every view.
- The tree is a real genealogy, not decoration: in simulation it is the ancestry of the model's own cases; in observed mode it is a published time-resolved tree.
- Both data sources (user's decision): **Simulate** (stochastic model, story chapters) and **Observed** (real outbreak data, with provenance).
- Static site: `npm run build` → `dist/`, deployable to GitHub Pages or Vercel.

## Non-goals

- Agent-based spatial simulation; scenario comparison; server-side anything.
- Being a forecasting tool. It is an artwork with honest epidemiology.

## Anti-goals (failure even if it "works")

- A rain ambience loop, or drops that pulse in tick-sized bursts.
- A tree whose shape is invented and not derived from data.
- A dashboard look: the storm stays the stage; charts are drawn like prints, not widgets.
- Presenting inferred clinical attributes of real cases as observed.

## Approaches considered

| | Approach | Trade-off |
|---|---|---|
| **A (chosen)** | **Vanilla ES modules + Vite**, Canvas for rain, SVG for tree and epicurve, Web Audio. Port the legacy modules (engine, story, scene) and rewrite audio. | Smallest bundle, no framework fighting the canvas/audio loop, CSS design system applies directly. UI state is hand-wired (manageable: one screen). |
| B | React + Vite port of `app.jsx` | Reuses v1 UI code, but v1's UI is the part being replaced; React adds re-render overhead around a 60 fps scene for little gain. |
| C | Keep a single-file artifact | Not deployable/maintainable as a project; can't bundle samples and datasets cleanly. |

## Architecture

```
src/
  main.js            boot, mode switch, wiring
  model/sim.js       stochastic SEIR with individual genealogy
  model/observed.js  loads observed dataset → same event stream
  model/tree.js      sampled-tip subtree extraction + layout (shared by both modes)
  audio/engine.js    sample-based rain, thunder, scheduling
  view/rain.js       canvas storm (ported from scene.js)
  view/tree.js       SVG phylogeny
  view/epicurve.js   SVG case series
  story.js           chapters (ported)
  styles/            interim CSS reading --ps-* tokens; replaced by design-system/
public/samples/      droplet samples (from generador_lluvia/sources)
public/data/         observed dataset (pre-processed JSON)
scripts/             data prep (Node) for observed mode
```

Modules talk through one event stream (`case`, `thunder`, `tick`) and snapshots, as in v1.

### Simulation model (replaces compartment-only engine)

- **Chain-binomial stochastic SEIR**, population 100k, dt = 0.1 day. New infections per tick ~ Binomial(S, 1 − e^(−λ·dt)).
- **Individuals are tracked from infection onward** (E and I are lists of case records; S and R stay counts). Each case: `id, parent, tInf, tOnset (incubation ~ Gamma), tRecover (infectious period ~ Gamma), lineage, muts, detected, symptomatic, severity, outcome`.
- **Infector** is drawn from currently infectious cases, weighted by each lineage's relative transmissibility → variant frequencies *emerge* from the genealogy instead of being hand-set shares.
- **Mutation**: each case inherits its parent's mutation count + Poisson(μ · (tInf − parent.tInf)). Divergence is thus clock-like.
- **Variant introduction** = a saltation: a mutation event on one existing branch that starts a new lineage with higher transmissibility (and optional immune escape). **Import** = a new case whose parent is an external reservoir node attached deep in the tree.
- Rt computed from the genealogy (mean offspring of cases infected in a window), with the v1 analytic R_eff shown alongside.
- Story chapters from `story.js` drive parameters as before.

### Tree (both modes)

- Tips = a **sequenced subsample** of detected cases (sampling probability, capped ~400 live tips; older tips thinned uniformly over time so the tree stays readable).
- The drawn tree is the ancestry of those tips with unary nodes collapsed — exactly what a real time-resolved phylogeny is.
- Layout: rectangular, **x = calendar time shared with the epicurve**, y = ladderized tip order. Branches coloured by lineage; lineage origin marked. Updates ~1 s; new tips flash in sync with their drop.
- Observed mode: the published tree is revealed progressively by tip sampling date as the timeline plays.

### Case series

- Daily (sim) / weekly (observed) bars by **onset date**, stacked by lineage, drawn as unit stacks when counts are small and solid bars when large.
- Two layers: true infections (outline) vs reported/detected (filled). Shared time axis with the tree, aligned vertically.

### Observed dataset (proposal)

**West African Ebola epidemic 2013–2016**:
- Tree: Nextstrain `ebola` build (1,610 Makona genomes, time-resolved, coloured by country; Dudas et al., *Nature* 2017; maintained by Trevor Bedford) — `data.nextstrain.org/ebola.json`.
- Case series: WHO case counts by district and epi-week from `ebov/space-time` (CC BY-SA 4.0).
- Pre-processed into `public/data/ebola.json` by a script in `scripts/`; provenance (source, citation, licence, transformations) shown in the UI. Clinical attributes are inferred and labelled as such.
- Cases are released as drops spread uniformly within each epi-week, so the sound of the real epidemic is literally its weekly case count.

### Sound design (from scratch — user decision 2026-11-18)

The v1 sound is discarded entirely (synth noise bursts + tick-batched timing). Concept: **each lineage is a surface**. The founder lineage falls on stone, the first variant on glass, the next on a metal roof, imports on leaves. Listening to the rain is listening to the tree's composition: when a variant takes over, the rain audibly changes what it falls on.

- **Source (user pick): an ElevenLabs Sound Effects palette**, generated once offline by `scripts/gen-sounds.mjs` (reads `ELEVENLABS_API_KEY` from `.env.local`, which the user creates; never committed). Prompts live in `scripts/sound-prompts.json` so the bank is reproducible. Bank: ~12 one-shot single drops per surface (×4), ~6 heavy drops, ~6 thunder rolls, 2 distant-rain textures for the far layer. Takes are trimmed, loudness-normalised and curated (keep the best), shipped as small `.mp3`/`.ogg` in `public/sounds/` with a `manifest.json`. Visitors never call ElevenLabs. Output used under the user's paid ElevenLabs plan terms.
- The old droplet recordings in `generador_lluvia/sources/` are not used.
- **Per-case variation is meaningful**: lineage → surface (sample set) + stable pan zone; mutation count → small detune within the surface's take; severity → gain and brightness (low-pass openness); detected vs undetected → close/dry vs far/dark (more reverb); deaths → rare low resonant hit.
- **Layering like `generador_lluvia.py`**: at low incidence each case is a full, close drop. As incidence grows, cases are routed across three layers (close/heavy, mid, far/fine with high-pass) so the texture turns into rain naturally while case-to-event mapping is preserved; a density-driven bus compressor and gain law prevent clipping.
- **Timing**: events are scheduled on `AudioContext.currentTime` with a 100 ms look-ahead and onsets jittered uniformly across their tick — no batching pulse.
- **Thunder** for discontinuities (variant, import): layered low rumble (filtered noise with multiple delayed rolls) + crack, long stereo reverb, slight ducking of the rain.
- **Deaths** (sim and inferred): a rare, quiet low resonant tone — present but never dominant.
- **Space**: generated stereo impulse response with pre-delay (outdoor/courtyard feel), master limiter.
- **Verification**: an offline render (`OfflineAudioContext`) of three 10 s clips — sparse, building, storm — checked for peak/clipping and sent to the user to judge before the visuals are finished.

### Look (interim → design system)

- Interim brutalist CSS: hard grid, hairline rules, no radii, mono numerals, raw type; all values read from `--ps-*` tokens (names already fixed in the design-system brief).
- Layout: rain stage full-bleed at top with chapter text; below, tree and epicurve stacked on one shared time axis; controls in a strict side column (collapses below on phone).
- When `design-system` branch lands: merge, swap `src/styles/tokens.css` for `design-system/tokens.css` + components, adjust class names.

### Kept from v1

Story chapters, Simulate/Observed switch, silent (visual-only) mode, sound only after user gesture, volume, reduced motion, provenance labels.

## Deployment

- Vite static build. GitHub Actions workflow builds on push to `main`. Hosting target: GitHub Pages (needs the repo public, or a paid plan) **or** Vercel (works with private repo). Decision deferred to deploy time; nothing is published without the user's go-ahead.

## Left to the builder

Exact distributions/parameter values, tip-thinning rule details, colour of the reservoir/import branches, number of story chapters for the Ebola arc (if any), mobile layout details.

## Revision 2026-11-18 (user direction): one composition

The figures stop being separate panels. **The cases rain into the case series**: every drop lands on top of its own day's (observed: week's) bar, and the bar grows by exactly one when it lands, so the epidemic curve is literally accumulated rain. The sound of a case plays at the moment of impact.

- Landing position is data (the bin of the case's onset date); the start of the fall is free. Two variants are offered: **column** (drops fall straight down above their bin) and **wide** (drops start anywhere across the stage and travel straight to their bin). The user picks.
- **The phylogenetic tree sits behind the rain**, faint, on the same time axis, so a sampled tip sits above its bar. A toggle brings it to the **front** (full opacity, hover) or turns it **off**.
- Thunder inverts the whole stage (rain, tree and bars together).
- Bars are drawn in the stage's own coordinate system; their y-scale eases when it rescales. Every case increments its bar even when its streak or voice is dropped by a cap.
