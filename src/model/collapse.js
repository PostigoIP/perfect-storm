// Collapse a phylogeny into a few readable bands.
//
//  1. Lineage clades (a variant, or a country in observed data, arising inside
//     the tree) are lifted out and become their own band, connected to the
//     band they arose in. Lifting is recursive: a lineage arising inside a
//     lifted lineage is lifted out of it, and counted only once.
//  2. Independent introductions from outside (children of a synthetic root,
//     other than the main tree) are gathered into one "introductions" band.
//  3. What remains of the founder tree is opened from the root, largest clade
//     first, into `founderBands` wedges (default: whatever `maxClades` leaves).
//     Opened nodes are the backbone; wedges: point = common ancestor,
//     tail = latest sampled case, height ∝ √(sequenced cases).

export function collapseTree(root, { maxClades = 10, founderBands, maxLifted, gap = 0.025 } = {}) {
  // raw stats (whole subtree)
  const raw = new Map();
  (function walk(n) {
    if (n.tip) { raw.set(n, new Map([[n.lineage, 1]])); return; }
    const m = new Map();
    for (const c of n.children) { walk(c); for (const [l, k] of raw.get(c)) m.set(l, (m.get(l) ?? 0) + k); }
    raw.set(n, m);
  })(root);
  const total = (n) => [...raw.get(n).values()].reduce((a, b) => a + b, 0);
  const major = (n) => [...raw.get(n)].sort((a, b) => b[1] - a[1])[0][0];
  const purity = (n) => Math.max(...raw.get(n).values()) / total(n);

  // 2. introductions
  let main = root;
  const intros = [];
  if (root.synthetic && root.children.length > 1) {
    const sorted = [...root.children].sort((a, b) => total(b) - total(a));
    main = sorted[0];
    intros.push(...sorted.slice(1));
  }
  const founderLineage = main.lineage;   // the lineage at the root, not the most numerous one

  // 1. lineage clades, recursively
  let lifted = [];                      // { node, host }
  (function scan(n) {
    if (n.tip) return;
    for (const c of n.children) {
      const lc = major(c);
      // a new lineage: few of the host's own cases inside it (nested newer lineages don't count against it)
      const hostShare = (raw.get(c).get(n.lineage) ?? 0) / total(c);
      if (lc !== n.lineage && lc !== founderLineage && hostShare <= 0.3 && total(c) >= 3) lifted.push({ node: c, host: n });
      scan(c);
    }
  })(main);
  // keep the outermost lift per lineage path: a lift whose node sits inside another lift of the same lineage is dropped
  const cap = maxLifted ?? Math.max(1, Math.floor(maxClades / 3));
  lifted.sort((a, b) => total(b.node) - total(a.node));
  const kept = [];
  const inside = (anc, node) => { let found = false; (function f(n) { if (found) return; if (n === node) found = true; else if (!n.tip) n.children.forEach(f); })(anc); return found; };
  for (const L of lifted) {
    if (kept.length >= cap) break;
    if (kept.some((K) => major(K.node) === major(L.node) && inside(K.node, L.node))) continue;
    kept.push(L);
  }
  lifted = kept;
  const removed = new Set(lifted.map((L) => L.node));
  const kids = (n) => n.children.filter((c) => !removed.has(c));
  const nExcl = (n) => (n.tip ? 1 : kids(n).reduce((s, c) => s + nExcl(c), 0));
  const xMaxExcl = (n) => (n.tip ? n.x : Math.max(...kids(n).map(xMaxExcl)));
  const majorExcl = (n) => {
    const m = new Map();
    (function f(x) { if (x.tip) m.set(x.lineage, (m.get(x.lineage) ?? 0) + 1); else kids(x).forEach(f); })(n);
    return m.size ? [...m].sort((a, b) => b[1] - a[1])[0][0] : major(n);
  };

  // 3. founder wedges
  const budget = founderBands ?? Math.max(1, maxClades - lifted.length - (intros.length ? 1 : 0));
  let founder = [main];
  for (;;) {
    const cand = founder.map((n, i) => ({ n, i }))
      .filter(({ n }) => !n.tip && kids(n).length && founder.length - 1 + kids(n).length <= budget)
      .sort((a, b) => nExcl(b.n) - nExcl(a.n));
    if (!cand.length) break;
    const { n, i } = cand[0];
    founder = [...founder.slice(0, i), ...kids(n), ...founder.slice(i + 1)];
  }

  // bands, each lifted lineage right after the band it arose in
  const containsExcl = (top, node) => { let found = false; (function f(n) { if (found) return; if (n === node) found = true; else if (!n.tip) kids(n).forEach(f); })(top); return found; };
  const bands = [];
  const liftedBand = (L) => ({ kind: 'lineage', node: L.node, n: nExcl(L.node), x0: L.host.x, x1: xMaxExcl(L.node), lineage: majorExcl(L.node), purity: purity(L.node), host: L.host });
  const placed = new Set();
  function emit(band) {
    bands.push(band);
    for (const L of lifted) if (!placed.has(L) && containsExcl(band.node, L.host)) { placed.add(L); const b = liftedBand(L); b.hostBand = band; emit(b); }
  }
  for (const c of founder) emit({ kind: 'clade', node: c, n: nExcl(c), x0: c.x, x1: xMaxExcl(c), lineage: c.tip ? c.lineage : majorExcl(c), purity: 1 });
  for (const L of lifted) if (!placed.has(L)) { placed.add(L); emit(liftedBand(L)); }   // host on the backbone
  if (intros.length) {
    bands.push({
      kind: 'intros', node: { id: 'intros' }, n: intros.reduce((s, c) => s + total(c), 0), lineage: major(intros[0]), purity: 1,
      x0: Math.min(...intros.map((c) => c.x)), x1: Math.max(...intros.map((c) => xMaxExcl(c))),
      members: intros.map((c) => ({ x0: c.x, x1: xMaxExcl(c), n: total(c), lineage: major(c) })),
    });
  }

  // vertical layout in [0, 1]
  const w = bands.map((b) => (b.kind === 'intros' ? Math.max(1.2, Math.sqrt(b.members.length)) : Math.sqrt(b.n)));
  const free = 1 - gap * (bands.length - 1);
  const W = w.reduce((a, b) => a + b, 0);
  let y = 0;
  for (let k = 0; k < bands.length; k++) {
    const h = (w[k] / W) * free;
    Object.assign(bands[k], { y0: y, y1: y + h, yc: y + h / 2 });
    y += h + gap;
  }

  // backbone over the founder tree
  const yc = new Map(bands.filter((b) => b.kind === 'clade').map((b) => [b.node, b.yc]));
  const edges = [], verticals = [];
  (function place(n) {
    if (yc.has(n)) return yc.get(n);
    const ch = kids(n);
    const ysv = ch.map(place);
    const lo = Math.min(...ysv), hi = Math.max(...ysv);
    yc.set(n, (lo + hi) / 2);
    if (ch.length > 1) verticals.push({ x: n.x, y0: lo, y1: hi, lineage: n.lineage });
    ch.forEach((c, k) => edges.push({ from: n.id, to: c.id, x0: n.x, x1: c.x, y: ysv[k], lineage: c.tip ? c.lineage : majorExcl(c) }));
    return yc.get(n);
  })(main);
  const introBand = bands.find((b) => b.kind === 'intros');
  let rootY = yc.get(main);
  if (root.synthetic && introBand) {
    rootY = (yc.get(main) + introBand.yc) / 2;
    verticals.push({ x: root.x, y0: Math.min(yc.get(main), introBand.yc), y1: Math.max(yc.get(main), introBand.yc), lineage: -1, synthetic: true });
    edges.push({ from: root.id, to: main.id, x0: root.x, x1: main.x, y: yc.get(main), lineage: founderLineage });
    edges.push({ from: root.id, to: 'intros', x0: root.x, x1: introBand.x0, y: introBand.yc, lineage: introBand.lineage });
  }
  // connectors: where each lifted lineage arose, inside its host band
  const connectors = bands.filter((b) => b.kind === 'lineage').map((b) => ({
    x: b.x0, y0: b.hostBand ? b.hostBand.yc : (yc.get(b.host) ?? rootY), y1: b.yc, lineage: b.lineage,
  }));

  return { root, rootX: root.x, rootY, clades: bands, edges, verticals, connectors };
}
