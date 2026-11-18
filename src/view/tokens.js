// Reads --ps-* colour tokens once per theme change, for canvas drawing.
let cache = null;

function read() {
  const cs = getComputedStyle(document.documentElement);
  const v = (n) => cs.getPropertyValue(n).trim();
  return {
    paper: v('--ps-paper'), ink: v('--ps-ink'), ink2: v('--ps-ink-2'), accent: v('--ps-accent'),
    stone: v('--ps-lineage-1'), glass: v('--ps-lineage-2'), metal: v('--ps-lineage-3'),
    leaf: v('--ps-lineage-4'), extra: v('--ps-lineage-5'),
  };
}

export function tokens() { return cache ?? (cache = read()); }
export function invalidateTokens() { cache = null; }

new MutationObserver(invalidateTokens).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', invalidateTokens);

// Surface name → CSS variable, for SVG fills.
export const SURFACE_VAR = { stone: '--ps-lineage-1', glass: '--ps-lineage-2', metal: '--ps-lineage-3', leaf: '--ps-lineage-4', heavy: '--ps-lineage-5' };
export const SURFACE_LABEL = { stone: 'stone', glass: 'glass', metal: 'metal', leaf: 'leaf' };
