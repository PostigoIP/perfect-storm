# Deploying Perfect Storm

Perfect Storm builds to a plain static site (`dist/`). It has no server code and no secrets at runtime. **Nothing is published yet.** This page lists what is ready and what you still have to decide.

## What is in place

| File | What it does | Publishes anything? |
|---|---|---|
| `.github/workflows/ci.yml` | On every push and pull request: Node 22, `npm ci`, `vitest run`, `vite build`, then uploads `dist/` as a build artifact (kept 7 days) | No. The artifact is private to the repo. |
| `.github/workflows/pages.yml` | Builds and deploys to GitHub Pages | Only when you run it by hand (`workflow_dispatch`), and only after you enable Pages |
| `vercel.json` | Tells Vercel it is a Vite static build: `npm ci`, `npm run build`, output `dist`; sound files cached for a day | Only once you create and link a Vercel project |

## The build

- `vite.config.js` sets `base: './'`, so every URL in the build is relative. The same `dist/` works at a domain root (Vercel) and under a sub-path (GitHub Pages at `/perfect-storm/`). The `save-review-clips` plugin is `apply: 'serve'`: it exists only in dev and is not in the build.
- Everything under `public/` is copied as-is into `dist/`: `data/ebola.json`, `sounds/`, `sounds-textures/` and any new bank such as `sounds-field/`.
- **Sub-path check (2026-11-18, commit e03de18):** `dist/` was copied to `/perfect-storm/` on a local static server and played in Observed mode with sound on. All 57 requests returned 200: the page, JS, CSS, `data/ebola.json`, `sounds/manifest.json` and every WAV/MP3 in it. The console showed no errors.
- **Not fully self-contained:** `index.html` loads Archivo and IBM Plex Mono from Google Fonts at runtime (see Fonts below).

### Size (snapshot at e03de18; the sound banks are being rebuilt, so this will change)

`dist/` is **9.68 MB in 71 files**:

| Part | Size |
|---|---|
| `sounds-textures/` (8 × 30 s MP3 grain beds at 722 kB each, plus 6 thunder MP3s) | 7.1 MB |
| `sounds/` (45 short WAV takes + 6 thunder MP3s) | 3.1 MB |
| `data/ebola.json` | 173 kB |
| JS + CSS + HTML | 59 kB (≈ 22 kB gzipped) |

Notes:
- At this commit no code under `src/` fetches `sounds-textures/`. The 7.1 MB ships but the page never loads it. The audio rebuild will either start using it or should drop it from `public/`.
- The six thunder MP3s are in both `sounds/` and `sounds-textures/`.
- Both hosts serve this size comfortably. The CI log prints the size and the 10 largest files on every run, so growth stays visible.

## Option A: GitHub Pages

URL would be `https://postigoip.github.io/perfect-storm/`.

**Constraints**
- The repo is **private**. Pages on a private repo needs a paid GitHub plan (Pro, Team or Enterprise). On GitHub Free it is not available at all.
- **The Pages site is public** even when the repo is private. Restricting who can view it needs Enterprise Cloud.

**To go live (all your clicks)**
1. Make sure your plan allows Pages on a private repo, or make the repo public.
2. Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**. This creates the `github-pages` environment.
3. Get `.github/workflows/pages.yml` onto `main`. GitHub only offers "Run workflow" for a `workflow_dispatch` workflow on the default branch. The `github-pages` environment also only accepts deployments from the default branch, unless you add another branch under **Settings → Environments → github-pages**.
4. **Actions → Deploy to GitHub Pages → Run workflow.**
5. Optional: to deploy on every push to `main`, add `push: { branches: [main] }` under `on:` in `pages.yml`.

Until step 2 is done, a run fails at the deploy step and publishes nothing.

## Option B: Vercel

URL would be `perfect-storm-<something>.vercel.app`, or a custom domain.

**Constraints**
- The **Hobby** (free) plan is for **non-commercial** use only. A funded or commissioned artwork, or one tied to an exhibition, may count as commercial; then it needs Pro.
- Linking a private GitHub repo means installing the Vercel GitHub app and granting it access to this repo.
- Once linked, Vercel builds a **preview deployment for every pushed branch** (each has its own URL) and a production deployment from `main`. On new projects, previews sit behind Vercel Authentication by default. Check this under **Settings → Deployment Protection** if work-in-progress must not leak.

**To go live (all your clicks)**
1. vercel.com → **Add New → Project** → import `PostigoIP/perfect-storm` (approve the GitHub app for this repo only).
2. Framework preset **Vite**. `vercel.json` already sets the install command, build command and output directory `dist`. Set **Node.js version** to 22 under Settings → General to match CI.
3. Choose the **production branch**. The default is `main`; the current work is on `feat/v2-rebuild`.
4. Optional: add a custom domain. This involves DNS changes at your registrar, or buying a domain through Vercel, which is a purchase.

A Vercel connector is available in Claude Code sessions. It can create the project or deploy once you say so, but nothing has been created.

## Licences to clear before any public deploy

None of these block a private preview. All of them matter once the URL is public.

### 1. Sound files

**ElevenLabs output** (`public/sounds/*.wav`, `public/sounds-textures/*.mp3`), generated with the Sound Effects API under your **Starter** plan:
- Paid plans, Starter included, carry a commercial licence for generated output. The free plan has none. Output generated while on a paid plan keeps its licence if you later downgrade. Keep a record (invoice or plan screenshot) covering the generation dates.
- ElevenLabs bars redistributing the outputs as a standalone sound library. A public site serves the raw WAV/MP3 files, which anyone can download. Check that this counts as "use in a work" and not "distribution of the assets". Read the current Terms of Service and the Sound Effects terms on elevenlabs.io: these notes come from summaries, not from reading the terms.
- No attribution is needed on paid plans. Crediting "Sound: generated with ElevenLabs" is still good practice for an artwork.

**Freesound field recordings (CC0)**: none are in the repo at e03de18. `public/sounds-field/manifest.json` did not exist when this was written. When it lands, list each file's Freesound ID, author and URL, and confirm each is **CC0**. Freesound also hosts CC BY and CC BY-NC sounds. CC BY needs credit on the page, and CC BY-NC rules out commercial use. CC0 needs nothing, but crediting is courteous.

### 2. Ebola data (`public/data/ebola.json`)

Built by `scripts/prep-ebola.mjs` from two sources:

| Source | What we use | Licence |
|---|---|---|
| [ebov/space-time](https://github.com/ebov/space-time): `EBOV_maxCases.csv` (WHO patient-database counts compiled for Dudas et al. 2017) | Weekly reported cases by district → the rain and the case series | **CC BY-SA 4.0** (the repo's LICENSE file; its README text says "Creative Commons Attribution 4.0" but links BY-SA, so treat it as BY-SA) |
| [Nextstrain ebola build](https://nextstrain.org/ebola) (`data.nextstrain.org/ebola.json`, updated 2019-12-14) | Time-resolved Makona phylogeny → the tree | No explicit data licence found. Nextstrain asks you to credit Nextstrain and the original data generators (Dudas et al., *Nature* 544:309, 2017, and the sequencing labs). The underlying genomes are public GenBank data. `ebola.json` currently says "see nextstrain.org". |

What this means:
- **Attribution (required):** the public page must credit both sources visibly, not only inside the JSON: title, authors, link and licence (CC BY-SA 4.0 for ebov/space-time), and state that the data was modified (aggregated to weeks and merged with the tree).
- **Share-alike (required for the derived data):** `ebola.json` is an adapted dataset, so it must be released under CC BY-SA 4.0 or a compatible licence. In practice, add a licence notice for `public/data/` and keep the file downloadable as it already is.
- **Open question for you:** does share-alike reach the artwork itself, meaning the code, sounds and visuals? The usual reading is that a work that *uses* the data (a visualisation driven by it) is not automatically an adaptation of the dataset. But it is a judgement call, and it matters for an artwork you may sell or exhibit. Decide on it, and take advice if the work will be commercial.
- Before going public, replace "see nextstrain.org" in the generated `sources` with a concrete citation (an edit in `scripts/prep-ebola.mjs`, then regenerate).

### 3. Fonts

- **Archivo** (Omnibus-Type) and **IBM Plex Mono** (IBM) are both under the **SIL Open Font License 1.1**. Free to use on a website and no attribution needed.
- They are loaded from **Google Fonts' CDN**. Each visitor's IP address goes to Google. Under the GDPR (a German court ruled on exactly this in 2022), EU-facing sites usually either **self-host the fonts** or name Google in a privacy notice. Self-hosting would also make the build fully self-contained. It is a small change to `index.html` plus the font files in `public/fonts/`.

### 4. Code

The repo has no `LICENSE` file, so by default all rights are reserved. Decide whether the code stays closed or gets an open licence. This is separate from the CC BY-SA question for the data.

## Decisions you need to make to go live

1. **Host:** GitHub Pages (paid plan or public repo; site public) or Vercel (Hobby is non-commercial only; per-branch previews).
2. **Which branch is production:** `main` or `feat/v2-rebuild`. For Pages it effectively has to be `main`.
3. **ElevenLabs terms:** confirm that serving the raw generated files on a public site is allowed, and keep proof of the Starter plan at generation time.
4. **Credits and licence page:** where the attribution for ebov/space-time, Nextstrain, Dudas et al., ElevenLabs and any Freesound authors appears, and what CC BY-SA notice covers `ebola.json`.
5. **Share-alike scope:** whether the artwork as a whole carries CC BY-SA or only the data.
6. **Fonts:** self-host, or keep Google Fonts with a privacy notice.
7. **Unused `sounds-textures/`:** load it in the rebuilt audio, or drop it (7.1 MB).
8. **Custom domain:** whether to have one and where to register it.
