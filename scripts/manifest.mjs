// Sound-bank manifest rules shared by post-sounds.mjs and the tests.
export const REQUIRED_SETS = ['stone', 'glass', 'metal', 'leaf', 'heavy', 'thunder'];
export const DROP_SETS = ['stone', 'glass', 'metal', 'leaf', 'heavy'];
export const MAX_DROP_SECONDS = 1.0;

export function validateManifest(m, fileExists) {
  const errs = [];
  if (m?.version !== 1) errs.push('version must be 1');
  for (const s of REQUIRED_SETS) if (!m?.sets?.[s]?.length) errs.push(`set "${s}" missing or empty`);
  for (const [set, files] of Object.entries(m?.sets ?? {})) {
    for (const f of files) {
      if (!fileExists(f)) errs.push(`file missing: ${f}`);
      const d = m.durations?.[f];
      if (DROP_SETS.includes(set) && d > MAX_DROP_SECONDS) errs.push(`drop too long: ${f} (${d.toFixed(2)} s)`);
    }
  }
  return errs;
}
