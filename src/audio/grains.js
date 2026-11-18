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
  return 0.16 + severity * 0.07 + u * 0.08;
}
