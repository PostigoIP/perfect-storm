// Grain selection for banks made of long recordings (manifest version 2).

// index → one real impact across all recordings of a surface
export function pickGrain(entries, index) {
  let total = 0;
  for (const e of entries) total += e.onsets.length;
  if (!total) return null;
  let k = ((index % total) + total) % total;
  for (let i = 0; i < entries.length; i++) {
    if (k < entries[i].onsets.length) return { entry: i, offset: entries[i].onsets[k] };
    k -= entries[i].onsets.length;
  }
  return null;
}

// seconds of recording a case plays: longer for more severe cases
export function grainLength(severity, u) {
  return 0.05 + severity * 0.02 + u * 0.04;   // one drop: impact and its ring (50–150 ms)
}

// How much of the continuous rain bed to fade in, from the rate of drops
// actually falling (cases per real second). Silent while drops are countable
// (< 2/s); full by 50/s; log-shaped in between, so the bed is the epidemic's
// own density, never a fixed ambience.
export function bedLevel(dropsPerSec) {
  if (dropsPerSec <= 2) return 0;
  return Math.min(1, Math.log(dropsPerSec / 2) / Math.log(50 / 2));
}
