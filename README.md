# Perfect Storm — auditory epidemiology

Every case is one drop. Rain is what an outbreak sounds like.

A stochastic outbreak, or the real 2013–2016 West African Ebola epidemic, replayed as rain: each case is one
drop you see and hear, and it lands on its day in the case series, which is the rain that has already
fallen. Chapters follow the epidemic (patient zero, lockdown, variants, vaccines, endemic rain); every
milestone on the curve can be selected to rewind to that moment.

**Live:** https://postigoip.github.io/perfect-storm/ (Chrome or Firefox recommended; headphones).

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # model, story, sound-mapping and view tests
npm run build      # static site in dist/
```

## Layout

- `src/model/` — stochastic SEIR in which every infection records its infector (genealogy), story-independent
  epidemic curve binning, phylogeny extraction and collapse, observed-data replay.
- `src/story.js` — event-driven chapters: each ends when what it describes has happened (tested in `tests/story.test.js`).
- `src/audio/` — sample-based rain: one short drop per case, distance cues, thunder; grain banks from long recordings.
- `src/view/` — the stage (rain falling into the case series), legend, milestones.
- `design-system/` — the brutalist design system (tokens, components, reference page).
- `scripts/` — data prep (`prep-ebola.mjs`), sound-bank builders (`build-grains.py`, `gen-sounds.mjs`, `cut-thunder.py`).
- `tools/` — offline clip rendering and the listening loop used to tune the sound (`listen.py`).
- `docs/` — design spec, plan, deploy notes, gallery-installation concept.
- `legacy/claude-design-v1/` — the original prototype.

## Credits and licences

Perfect Storm is by **Ignacio Postigo-Hidalgo**, © 2026.

| Part | Licence |
|---|---|
| Code (`src/`, `scripts/`, `tools/`, `design-system/`, `index.html`) | [MIT](LICENSE) |
| Original content: texts, design, and the ElevenLabs-generated sounds in `public/sounds/` and `public/sounds-textures/` | [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/): reuse with credit ("Ignacio Postigo-Hidalgo, Perfect Storm"), not for commercial purposes; for commercial use, ask the author |
| `public/data/ebola.json` | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), as its source |
| `public/data/compare.json` | [CC BY-NC-SA 3.0 IGO](https://creativecommons.org/licenses/by-nc-sa/3.0/igo/), as WHO's publications it is derived from |
| Freesound recordings | CC0 1.0 (credited below) |
| Fonts | their own open licences, loaded from Google Fonts |

**Data (observed mode)** — `public/data/ebola.json` is derived from:
- Nextstrain `ebola` build (time-resolved phylogeny of Makona genomes), https://nextstrain.org/ebola;
  Dudas G. et al., *Virus genomes reveal factors that spread and sustained the Ebola epidemic*, Nature 544, 309–315 (2017).
- Weekly case counts by district from https://github.com/ebov/space-time (WHO patient database, compiled for Dudas et al. 2017),
  licensed **CC BY-SA 4.0**. The derived `public/data/ebola.json` is shared under the same licence.

**Data (Compare mode)** — `public/data/compare.json` is built by `scripts/prep-compare.mjs` from WHO publications:
the Kasai 2025 epidemic curve (Disease Outbreak News DON589) and the dated Bundibugyo 2026 totals (DON602–DON625).
Bundibugyo's daily pace between reports is a reconstruction; the transformations are listed on the page.
WHO content is licensed CC BY-NC-SA 3.0 IGO; the derived `compare.json` is shared under the same licence. WHO does not endorse this work.

**Sound**
- Drops and rain: CC0 1.0 recordings from Freesound — see `public/sounds-field/SOURCES.md` and `public/sounds-drops/SOURCES.md`
  (Vrymaa, bassimat, gyzhor, kyles, Squidems; thunder by billgrip and mrrap4food).
- `public/sounds/` and `public/sounds-textures/`: generated with ElevenLabs Sound Effects under a paid plan (prompts in `scripts/`).

**Fonts** — loaded from Google Fonts under their respective open licences (see `design-system/README.md`).

**Code** — © 2026 Ignacio Postigo-Hidalgo, MIT licence (see `LICENSE`).
