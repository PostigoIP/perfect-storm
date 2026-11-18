# Perfect Storm — design system

**Matter → image → light.** Tokens and components for Perfect Storm, a piece of auditory epidemiology in which every simulated infection is one drop of sound and one falling mark.

> **Where the language comes from.** This system started as a study of a gallery exhibition web page. Partway through, the brief changed: the source is now the **exhibition itself** (Rachel Garrard, *Manifestations in the Light*, St. Agnes, Berlin, 2026), not the page that presents it.
>
> Three things feed it:
> - **The building:** a Brutalist church nave in raw concrete, lit from above.
> - **The installation:** a floor gridded in white quartz powder, with found objects set on it as glyphs.
> - **The paintings and their intent:** hand-ground mineral pigment on linen, built around a vertical axis and a slit of light; a last work that is almost only light; a passage through transforming states.
>
> No branding, images or logos from the gallery or the artist are used. A few short concept words ("matter, image, light", "coming forth") paraphrase the exhibition's theme.

Files:

| File | What it is |
|---|---|
| `tokens.css` | Every `--ps-*` custom property; day (light) on `:root`, night (dark) under `prefers-color-scheme` and `[data-theme="dark"]` |
| `components.css` | Plain CSS classes, prefixed `ps-`, built only from tokens |
| `index.html` | Reference page: every token (with live hex and contrast) and every component, Day/Night/Auto toggle. It links `./tokens.css` and `./components.css`, so it always shows the real files; serve the folder (e.g. `python3 -m http.server -d design-system`) |

## Principles

1. **The floor is the grid.** Structure is a fine light line laid on raw ground, like quartz powder on concrete. Data is placed *on* the grid, never boxed in. Use `.ps-floor` behind fields of marks; dividers are hairlines, and panels have no box.
2. **Every case is a glyph.** One mark per event, placed precisely in relation to the others. Each lineage has a **shape** (`--ps-glyph-1…5`: block, triangle, cross, lozenge, bar) as well as a colour, so identity never rests on colour alone.
3. **Colour is matter.** The five lineage colours are mineral pigments: iron, lapis, malachite, manganese, ochre. They step from dark to light so they separate by lightness, not hue alone. Everything else is concrete, graphite and quartz. Severity is a hue-free concrete ramp. It spans the full range of lightness, so some steps come close to a lineage (light theme: severity-4 against iron is ΔE 7; severity-3 against malachite collapses under CVD). Never fill by lineage *and* severity in one view: encode the second through glyph, size or outline.
4. **One slit of light.** There is a single accent, cinnabar by day and the glow of light by night. It marks what is active now: the current chapter, a focused control, the hover state of a primary action. It is never a data colour. If two things glow, neither does.
5. **Symmetry along an axis.** The wordmark sits on a vertical slit (`.ps-wordmark__slit`), and the main view can be centred on one axis (`.ps-axis`); everything else settles around it.
6. **Day and night are separate.** "Coming forth by day" versus the night passage. The dark theme is not an inversion. Each theme's colours were chosen and checked against its own surface (contrast ≥3:1 for every lineage; colour-blind ΔE ≥8 between every pair of lineages).
7. **Light arrives and leaves.** Motion is a slow change of light, not travel. Use `--ps-dur-slow` (1.2 s) for things appearing or fading and `--ps-dur-fast` for direct feedback on controls. Nothing bounces. Under `prefers-reduced-motion` every duration is 0.
8. **Raw and honest.** No radii, no shadows, no ornament on controls: a line, a fill, a word. Uppercase is always tracked (`--ps-tracking-caps`).

## Using the tokens

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&family=Hanken+Grotesk:ital,wght@0,300..700;1,300..700&family=IBM+Plex+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="design-system/tokens.css">
<link rel="stylesheet" href="design-system/components.css">
<html class="ps-root"> <!-- recommended: body type, colour and background from tokens -->
```

**Base styles.** `components.css` works without `.ps-root`: every `ps-` class brings its own box-sizing, square corners, focus ring and the `<var>` case exemption. `.ps-root` adds page-level body type, colour and background on top of that.

**Theme.**
- With no attribute, the page follows the OS.
- `document.documentElement.dataset.theme = 'dark'` (or `'light'`) forces a theme.
- Removing the attribute returns to auto.

**Colour.**

| Token | Use |
|---|---|
| `--ps-paper`, `--ps-paper-2` | Ground and recessed wells |
| `--ps-ink`, `--ps-ink-2` | Text. `ink-2` is ≥4.5:1 in both themes |
| `--ps-rule` | Decorative hairlines only. Control outlines use `--ps-ink` |
| `--ps-quartz` | The floor-grid line |
| `--ps-accent`, `--ps-accent-ink` | The one active thing, and text on it |
| `--ps-lineage-1…5` | Lineages, in fixed order. Never cycle them: a sixth lineage folds into "other" |
| `--ps-severity-1…4` | Ordinal ramp, none → severe. `severity-1` is close to paper, so give it an ink-2 hairline when it must read as a mark (`.ps-swatch--s1` does this) |

**Reading tokens in canvas or WebGL.** Everything is a 6-digit hex, so read it with `getComputedStyle(document.documentElement).getPropertyValue('--ps-lineage-2').trim()`. Read again whenever the theme changes.

**Glyphs.**
- In CSS: `clip-path: var(--ps-glyph-n)`.
- In canvas: draw the same polygons (the coordinates in `tokens.css` are percentages of the mark's box).

**Type.**
- `--ps-font-display` (Archivo, at `--ps-stretch-display` 112.5%, uppercase, light weights): titles and big numerals.
- `--ps-font-text` (Hanken Grotesk 300–500): reading text.
- `--ps-font-mono` (IBM Plex Mono): data, indices, tooltips. Use `font-variant-numeric: tabular-nums` wherever numbers update live.

**Size scale.**
- Display, h1, h2 and metric use `clamp()`.
- Body is 16px, small 14px, caption 12px, data 13px.

**Space and grid.**
- `--ps-space-1…8` = 4, 8, 12, 16, 24, 40, 64, 104px.
- `--ps-gutter` is 16px on a phone, rising to 40px.
- `--ps-cols` is a bare integer (12, or 4 below 40rem) for `grid-template-columns: repeat(var(--ps-cols), minmax(0, 1fr))`.
- `--ps-rule-w` is 1px, `--ps-rule-w-strong` 2px.
- `--ps-floor-cell` (48px) is the quartz grid pitch.

**Motion.** `transition: opacity var(--ps-dur-slow) var(--ps-ease)`. Durations become 0ms under reduced motion, so you don't need extra media queries.

## Components

| Class | Notes |
|---|---|
| `.ps-topbar` | Sticky. Three slots: meta · wordmark · controls. Below 40rem the meta slot hides and the wordmark moves left |
| `.ps-wordmark` | Two words around `<span class="ps-wordmark__slit">`. `--large` modifier |
| `.ps-chapters` | `<ol>` of links or buttons, auto-numbered `01, 02…`. Mark the current one with `.is-active` or `aria-current`; it gets the accent line on top ("light from above"). `--stacked` for a vertical index |
| `.ps-metric` | `__value` (big numeral), `__label` (mono caps, rendered above), optional `__unit` and `__note` |
| `.ps-slider` | `input[type=range]`, square thumb, styled for WebKit and Firefox. Set `--ps-fill` from JS for the WebKit progress fill. Wrap in `.ps-field` with an `<output class="ps-field__value">` |
| `.ps-switch` | `<label class="ps-switch"><input type="checkbox" role="switch"><span>Sound</span></label>` |
| `.ps-btn` | Outlined; hover inverts. `--primary` is ink-filled and turns accent on hover. `--quiet` is text-only. `:disabled` is dashed |
| `.ps-seg` | `<fieldset>` of radio `<label><input><span>`. The legend is visually hidden but still read aloud |
| `.ps-panel` | Strong ink line on top, no box. `__head` holds `__title` (with an optional `__index`) on one side and labels on the other. `--well` adds a recessed fill |
| `.ps-label` | Tracked caps, caption size, ink-2. Wrap symbols in `<var>` (`Transmission <var>β</var>`, `<var>R<sub>t</sub></var>`) so uppercase does not turn β into Β |
| `.ps-legend` + `.ps-swatch` | Legend text stays in ink. Swatches: `--l1…l5` (colour + glyph), `--s1…s4`, `--lg`, `--line`, `--outline` |
| `.ps-tooltip` | Inverted ink block, mono. Position it yourself and toggle `.is-visible`. `--static` for inline use. Supports `__title` and a `<dl>` |
| `.ps-source` | Citation block: a short strong rule above, auto-numbered `[1]` notes |

Utilities:
- `.ps-floor`: quartz grid background.
- `.ps-axis`: central slit of light.
- `.ps-emerge` / `.is-lit`: slow fade in and out.
- `.ps-display`, `.ps-h1`, `.ps-h2`, `.ps-data`: type styles.

## How the app uses it

The app (`index.html`, `src/`) links `design-system/tokens.css` and `components.css` directly and adds only a few things of its own. It defines no new token names.

- **Founder lineage is ink.** `src/styles/tokens.css` sets `--ps-lineage-1: var(--ps-ink)` (under `:root:root`, so it wins over both dark selectors). In the piece, lineage 1 is the founder strain ("stone"). It is drawn in the same graphite as the text and the tree's root, so variants read as departures from it. Iron is therefore unused in the app.
  - glass, metal and leaf take `--ps-lineage-2…4` (lapis, malachite, manganese).
  - `--ps-lineage-5` (ochre) is the spare.
  - Canvas code still gets a 6-digit hex from `getPropertyValue('--ps-lineage-1')`.
- **Palette check for this mapping** (dataviz `validate_palette.js`, glass/metal/leaf against each theme's paper):
  - CVD separation, normal-vision ΔE, chroma and contrast pass in both themes.
  - The **lightness-band** check fails: light lapis has L 0.37 (band 0.43–0.77); dark malachite has L 0.74 and dark manganese L 0.82 (band 0.48–0.67). This is the system's deliberate dark-to-light stepping (principle 3), so it was kept.
  - The founder (ink) against its nearest lineage still separates: light ink↔lapis ΔE 23.5 (CVD 23.0); dark ink↔manganese ΔE 17.9 (CVD 13.2).
- **Disabled segment.** `.ps-seg` has no disabled state. The app dims the span (`src/styles/app.css`); promote it here if another page needs it.
- **Lineage swatches in the legend are plain `.ps-swatch` squares, not `--l1…l5` glyphs.** The stage and tree do not draw glyph shapes yet, so a glyph in the legend would promise a mark that never appears.

## Font licences

All three families come from Google Fonts under the **SIL Open Font License 1.1**. They are free to use, embed and self-host, including commercially. The licence travels with the font files, and the fonts cannot be sold on their own.

| Family | Designer | Licence |
|---|---|---|
| Archivo | Omnibus-Type | SIL OFL 1.1 |
| Hanken Grotesk | Alfredo Marco Pradil, Hanken Design Co. | SIL OFL 1.1 |
| IBM Plex Mono | Mike Abbink, Bold Monday (for IBM) | SIL OFL 1.1 |

## Palette checks

The lineage palettes were tested in both themes against their own surface:
- WCAG contrast ≥3:1 for every lineage.
- Simulated protan, deutan and tritan vision: ΔE (OKLab ×100) ≥8.4 between **every** pair.
- Normal-vision ΔE ≥18.9 between every pair.

The accent was chosen as the hue farthest from all five lineages (ΔE ≥16). Severity was **not** designed to be separable from lineages; see principle 3 for the one-encoding-per-view rule. The reference page recomputes contrast live from the CSS, so any edit shows its effect immediately.
