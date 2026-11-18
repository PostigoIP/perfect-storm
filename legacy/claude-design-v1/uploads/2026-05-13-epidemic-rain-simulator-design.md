# Epidemic Rain Simulator Design

Date: 2026-05-13

## Goal

Build an experimental but understandable epidemic simulator where each case is heard as one short droplet sample. The application should make epidemic growth intelligible through sound: sparse cases sound like individual drops; rising incidence produces an emergent rain texture; explosive introductions, imports, or variants appear as thunder and lightning.

The experience is not a background rain loop. Rain must emerge from many discrete case events, similar to how many individual claps become applause.

## Product Shape

The first version is a single-screen interactive web app:

- A large storm stage on the left.
- A right rail with controls, metrics, and optional epidemiological readouts.
- Continuous play/pause/reset simulation.
- Live parameter changes that immediately alter the visual storm and sound density.
- A progressive design that starts with essential parameters but can later support richer epidemiological controls and scenario comparison.

The app should be both a poetic instrument and a didactic model. It should be clear enough for a user to understand transmission, immunity, variants, and epidemic waves, while still feeling like a living audiovisual system.

## Core Modes

### Simulation Mode

The user manipulates a synthetic outbreak in real time. Initial controls:

- Transmissibility.
- Infectious duration.
- Immunity or vaccination.
- Imported cases.
- Variant introduction.

The model exposes:

- Incidence.
- Prevalence.
- Effective reproduction number.
- S/E/I/R state counts.

Scenario comparison is out of scope for the first prototype, but the architecture should not block it.

### Real Outbreak Data Mode

The app should also be designed to support real outbreaks from public data sources. This is part of the initial architecture, even if the first working integration can be minimal.

Candidate sources:

- Nextstrain public datasets and data files for pathogen evolution and variant context.
- Our World in Data chart/data endpoints for time series such as cases, deaths, or disease burden.
- Other public APIs or downloadable datasets with explicit source and license metadata.

Real data will usually be aggregated by date and location rather than individual case records. The app should convert these aggregates into sonified case events by distributing them across the simulated time interval. When clinical attributes are not observed, the app should sample them from configurable distributions and label them as inferred rather than directly observed.

Every imported dataset should keep source, citation, license, pathogen, geography, date range, and transformation metadata.

## Epidemiological Model

Use a discrete-time SEIR-style model for the first simulator:

- Susceptible.
- Exposed.
- Infectious.
- Recovered or removed.

The model should calculate new infections per tick using transmissibility, susceptible fraction, infectious population, immunity, and variant effects. It should also support exogenous imports as a separate event source.

Variants have both epidemiological and audiovisual effects:

- Increased or decreased transmissibility.
- Optional changes to clinical severity probabilities.
- Distinct visual marking.
- A thunder/lightning event at introduction.
- A change in the timbral profile of future droplets caused by that variant.

## Clinical Case Generator

Each new infection creates a small case profile. The first version should include:

- Infection time.
- Incubation period.
- Detection status.
- Symptomatic or asymptomatic status.
- Severity band.
- Outcome category.
- Variant label.

These profiles should be simple enough to explain and test. They do not need full individual medical histories in the first version.

The case profile controls when and how the sound occurs:

- Incubation can delay the main audible case event.
- Detection can determine whether a case appears in the official curve or only in inferred/background activity.
- Symptomatic cases can be louder, sharper, or less filtered.
- Asymptomatic cases can be softer or more filtered.
- Severity can affect volume, transient, resonance, or tail length.
- Outcome can add rare low-frequency or resonant events without overwhelming the main droplet language.
- Variant can alter the timbre of all cases it produces.

## Sound Design

The sound engine is event-based. It should not play a rain ambience track.

Core rule:

Each audible case triggers a short droplet sample. Rain emerges from the density and variation of many droplet events.

Droplet variation should be meaningful, not purely decorative. Clinical and epidemiological variables should drive:

- Gain.
- Pitch or playback rate.
- Filter cutoff.
- Stereo position.
- Transient sharpness.
- Tail or reverb send.
- Delay from infection to audible event.

At low incidence, drops should be individually countable. At high incidence, overlap should produce a continuous rain-like texture. The system should preserve a connection between case count and event count, while using rate limiting or perceptual aggregation if needed to avoid audio overload.

Thunder is reserved for discontinuities:

- Variant introduction.
- Importation pulse.
- Sudden intervention or parameter shock, if added later.

Thunder should be generated or sampled separately from droplet events and should not replace the case-to-drop mapping.

## Visual Design

Use the "Storm Stage + Right Rail" layout.

The storm stage should show:

- Falling drops for new case events.
- A subtle epidemic curve or horizon near the bottom.
- Density changes as incidence rises.
- Lightning for variant/import events.
- Optional color or timbre-linked visual differences for variants or clinical profiles.

The right rail should show:

- Play/pause/reset controls.
- Sound enable control.
- Sliders for core parameters.
- Buttons for variant/import events.
- Incidence, prevalence, effective R, and S/E/I/R metrics.
- A compact explanation of whether the current view is simulated or real-data-driven.

The main scene should remain meteorological. The epidemiological explanation lives in the rail so the artwork does not become a conventional chart dashboard.

## Data Architecture

Keep data ingestion separate from simulation and rendering.

Suggested modules:

- Source adapters: fetch and parse provider-specific formats.
- Normalizer: convert source data to a common outbreak time series format.
- Provenance store: preserve source, license, citation, and transformation notes.
- Event scheduler: convert observed or simulated incidence into droplet events.
- Clinical sampler: attach inferred clinical attributes when source data does not provide them.

Common outbreak record:

```ts
type OutbreakObservation = {
  date: string;
  location: string;
  pathogen: string;
  cases?: number;
  incidence?: number;
  deaths?: number;
  variantFrequencies?: Record<string, number>;
  source: string;
  observedFields: string[];
  inferredFields: string[];
};
```

Common case event:

```ts
type CaseEvent = {
  id: string;
  infectionTime: number;
  audibleTime: number;
  variant: string;
  detected: boolean;
  symptomatic: boolean;
  severity: "none" | "mild" | "moderate" | "severe";
  outcome: "recovered" | "hospitalized" | "fatal";
  audio: DropletAudioParams;
  visual: DropletVisualParams;
};
```

## Technical Architecture

Separate the system into five main units:

- Epidemiological engine: SEIR ticks, metrics, imports, variants, and interventions.
- Clinical case generator: assigns compact case profiles to new infections.
- Sound engine: schedules droplet samples and thunder events using Web Audio.
- Visual scene: renders drops, lightning, and curve/horizon using canvas.
- UI shell: controls, metrics, source mode, and accessibility states.

The modules should communicate through explicit events and state snapshots. The rendering layer should not own epidemiological logic, and the epidemiological model should not know how audio or visuals are implemented.

## Error Handling

For simulation mode:

- Clamp slider values to valid ranges.
- Prevent negative compartment counts.
- Handle extreme incidence with audio scheduling limits.
- Keep play/pause/reset deterministic enough for testing.

For real data mode:

- Show clear source loading errors.
- Validate required fields before sonification.
- Mark missing clinical attributes as inferred.
- Preserve source attribution.
- Avoid presenting inferred clinical variation as observed fact.

## Accessibility and Ethics

The app should include:

- Sound on/off and volume control.
- Visual-only mode where event density and thunder remain understandable.
- Reduced motion option.
- Clear labeling of simulated versus observed data.
- Clear labeling of inferred versus observed clinical attributes.

The tone should avoid gamifying harm. It can be beautiful, but it should treat real outbreaks as serious public health data.

## Testing Plan

Unit tests:

- SEIR state transitions and conservation of population.
- Effective R and incidence calculations.
- Variant/import behavior.
- Clinical case profile generation.
- Mapping from clinical attributes to droplet audio parameters.
- Normalization of imported outbreak observations.

Browser verification:

- App loads without blank canvas.
- Play/pause/reset works.
- Sliders update metrics and event density.
- Variant/import actions create thunder/lightning events.
- Sound engine starts only after user gesture.
- Real data mode handles loading, errors, and provenance display.

Audio verification:

- Low incidence produces sparse audible drops.
- High incidence produces emergent rain from many droplet events.
- No looping rain ambience is used for the core case sound.
- Droplet variation is driven by case attributes.

## Initial Scope

First implementation should deliver:

- Single-screen app with storm stage and right rail.
- SEIR simulation mode.
- Event-based droplet sample playback.
- Clinical case profiles for droplet variation.
- Variant/import thunder events.
- Core metrics and sliders.
- A data adapter interface plus one small example integration or fixture shaped like real outbreak data.

Out of scope for the first implementation:

- Full scenario comparison UI.
- Full agent-based individual population simulation.
- Exhaustive clinical disease progression.
- Multiple polished public data connectors.
- Server-side persistence.

## Initial Implementation Choices

Use React with a canvas-based storm scene and Web Audio for event scheduling. This gives enough structure for a rich interactive UI without requiring a 3D engine.

Use one short bundled droplet sample for the core case sound. If a suitable licensed sample is not available during implementation, generate a short synthetic droplet asset and treat it as the canonical sample. Do not replace it with a looped rain ambience.

Use an Our World in Data-shaped time-series fixture for the first real-data path because it maps directly to date/case observations. Add the adapter boundary in a way that can later support Nextstrain datasets for variant frequencies and pathogen evolution context.

The first visual style should be dark, meteorological, and data-legible: falling drops, a subtle curve horizon, lightning for discontinuities, and a restrained right rail. Avoid turning the first screen into either a decorative landing page or a dense epidemiology dashboard.

## Source Notes

Nextstrain publishes public dataset resources and documents a REST interface for public datasets. Our World in Data provides reusable chart data and download paths, with licensing and citation requirements depending on the underlying source. The implementation should treat these as external data providers with explicit provenance rather than hard-coding assumptions about availability or license.
