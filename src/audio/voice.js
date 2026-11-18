// Pure mapping from a case to how its drop sounds. No Web Audio here.
//   lineage   → surface (sample set) and a stable stereo zone
//   mutations → slight detune within the take (±2%) + ±1% jitter
//   severity  → loudness and brightness
//   detected  → close and dry; undetected → farther, darker, wetter
//   fatal     → an extra low heavy hit, rare and quiet

const VARIANT_SURFACES = ['glass', 'metal'];
const PAN_ZONES = [0, -0.55, 0.55, -0.3, 0.3];
const GAIN = [0.42, 0.58, 0.74, 0.9];
const BRIGHT = [3200, 5200, 8500, 14000];
const SEND = { near: 0.06, mid: 0.2, far: 0.42 };

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
  const layer = layerFor(eventsPerSec, c.detected, rand);
  const dark = c.detected ? 1 : 0.55;
  return {
    set: surface,
    index: Math.floor(hash01(c.id + 7) * 1e6),
    rate: 1 + 0.02 * Math.sin(c.muts * 1.7) + (rand() - 0.5) * 0.02,
    gain: GAIN[c.severity] * densityGain(eventsPerSec) * (c.detected ? 1 : 0.8),
    lowpassHz: BRIGHT[c.severity] * dark,
    pan: PAN_ZONES[c.lineage % PAN_ZONES.length] + (hash01(c.id) - 0.5) * 0.5,
    layer,
    send: SEND[layer] + (c.detected ? 0 : 0.08),
    extra: c.outcome === 'fatal' ? { set: 'heavy', rate: 0.5, gain: 0.35, lowpassHz: 900 } : null,
  };
}
