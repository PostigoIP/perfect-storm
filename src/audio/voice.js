// Pure mapping from a case to how its drop sounds. No Web Audio here.
//   lineage   → surface (sample set) and a stable stereo zone
//   mutations → slight detune within the take (±2%) + ±1% jitter
//   severity  → loudness and brightness
//   detected  → close and dry; undetected → farther, darker, wetter
//   fatal     → an extra low heavy hit, rare and quiet

const VARIANT_SURFACES = ['glass', 'metal'];
const PAN_ZONES = [0, -0.55, 0.55, -0.3, 0.3];
const GAIN = [0.6, 0.67, 0.75, 0.85];   // severity spans ~3 dB: louder, never a different instrument
const BRIGHT = [9000, 11000, 14000, 18000];   // drops stay bright; distance is level + wetness, not muffling
const SEND = { near: 0.06, mid: 0.2, far: 0.42 };

// colour key (role) → drop sound. Founder = drops into a puddle (most cases);
// variant 1 and imports = clear dripping 'plinks'; variant 2 = drips on leaves.
export const MATERIAL = { stone: 'puddle', glass: 'plink', metal: 'leaves', leaf: 'plink' };
// older banks name their sets by surface; map the drop sets onto them
export const SET_ALIAS = { puddle: 'leaf', plink: 'glass', leaves: 'stone' };
export const materialFor = (lineage, lineages) => MATERIAL[surfaceFor(lineage, lineages)] ?? 'puddle';

export function surfaceFor(lineage, lineages) {
  const L = lineages[lineage];
  if (!L || lineage === 0) return 'stone';
  if (L.name === 'Imported') return 'leaf';
  let k = 0;
  for (let i = 1; i < lineage; i++) if (lineages[i].name !== 'Imported') k++;
  return VARIANT_SURFACES[k % VARIANT_SURFACES.length];
}

// 1 below 4 events/s, then ~1/sqrt(density) so the sum grows gently, floor 0.12.
export function densityGain(eventsPerSec) {
  if (eventsPerSec < 4) return 1;
  return Math.max(0.12, Math.sqrt(4 / eventsPerSec));
}

export function layerFor(eventsPerSec, detected, rand) {
  const pFar = Math.min(0.6, eventsPerSec / 250);
  const u = rand();
  if (!detected) return u < 0.5 + pFar / 2 ? 'far' : 'mid';
  const pMid = Math.min(0.5, eventsPerSec / 120);
  return u < pFar * 0.5 ? 'far' : u < pFar * 0.5 + pMid ? 'mid' : 'near';
}

const hash01 = (n) => (((n * 2654435761) >>> 0) % 100000) / 100000;

export function caseToVoice(c, surface, eventsPerSec, rand) {
  // distance: most drops land far and soft, a few close and clear (heavy-tailed);
  // unreported cases are always beyond the near field
  let d = Math.pow(hash01(c.id * 13 + 5), 0.6);
  if (!c.detected) d = 0.35 + 0.65 * d;
  const layer = d < 0.35 ? 'near' : d < 0.7 ? 'mid' : 'far';
  return {
    set: surface,
    index: Math.floor(hash01(c.id + 7) * 1e6),
    rate: 0.962 + 0.225 * hash01(c.id * 7 + 3) + 0.01 * Math.sin(c.muts * 1.7),   // 0.95–1.2: no boxy downward shifts
    gain: GAIN[c.severity] * Math.pow(10, (-24 * d) / 20) * densityGain(eventsPerSec),
    lowpassHz: BRIGHT[c.severity] * (1 - 0.65 * d),
    pan: PAN_ZONES[c.lineage % PAN_ZONES.length] + (hash01(c.id) - 0.5) * 0.5,
    distance: d,
    layer,
    send: 0.02 + 0.2 * d,
    extra: c.outcome === 'fatal' ? { set: 'heavy', rate: 0.5, gain: 0.35, lowpassHz: 900 } : null,
  };
}
