// Collapse a phylogeny into a few readable bands.
//
//  1. Lineage clades (a variant arising inside the tree) are lifted out whole
//     and become their own band, connected to the place they arose.
//  2. Independent introductions from outside (children of a synthetic root,
//     other than the main tree) are gathered into one "introductions" band.
//  3. What remains (the founder tree) is opened from the root, largest clade
//     first, until the band budget is used. Opened nodes are the backbone;
//     unopened ones are wedges: point = common ancestor, tail = latest
//     sampled case, height ∝ √(sequenced cases); counts are printed.

function tipStats(root) {
  const stats = new Map();
  (function walk(n) {
    if (n.tip) { stats.set(n, { n: 1, xMax: n.x, xMin: n.x, counts: new Map([[n.lineage, 1]]) }); return; }
    const s = { n: 0, xMax: -Infinity, xMin: Infinity, counts: new Map() };
    for (const c of n.children) {
      walk(c);
      const cs = stats.get(c);
      s.n += cs.n; s.xMax = Math.max(s.xMax, cs.xMax); s.xMin = Math.min(s.xMin, cs.xMin);
      for (const [l, k] of cs.counts) s.counts.set(l, (s.counts.get(l) ?? 0) + k);
    }
    stats.set(n, s);
  })(root);
  return stats;
}

export function collapseTree(root, { maxClades = 10, gap = 0.025 } = {}) {
  const stats = tipStats(root);
  const major = (n) => [...stats.get(n).counts].sort((a, b) => b[1] - a[1])[0][0];
  const purity = (n) => { const s = stats.get(n); return Math.max(...s.counts.values()) / s.n; };

  // 2. introductions: if the root is synthetic, its largest child is the main tree
  let main = root;
  const intros = [];
  if (root.synthetic && root.children.length > 1) {
    const sorted = [...root.children].sort((a, b) => stats.get(b).n - stats.get(a).n);
    main = sorted[0];
    intros.push(...sorted.slice(1));
  }

  // 1. lineage clades: topmost nodes whose lineage differs from their parent's
  const lifted = [];                     // { node, host: parent node, at: parent x }
  const removed = new Set();
  (function scan(n) {
    if (n.tip) return;
    for (const c of n.children) {
      if (major(c) !== n.lineage && purity(c) >= 0.8 && major(c) !== major(main)) { lifted.push({ node: c, host: n, at: n.x }); removed.add(c); }
      else scan(c);
    }
  })(main);

  // keep only the largest few lifted clades (≥3 tips); the rest stay in place
  lifted.sort((a, b) => stats.get(b.node).n - stats.get(a.node).n);
  for (const L of lifted.splice(Math.max(1, Math.floor(maxClades / 3)))) removed.delete(L.node);
  for (let i = lifted.length - 1; i >= 0; i--) if (stats.get(lifted[i].node).n < 3) { removed.delete(lifted[i].node); lifted.splice(i, 1); }

  const kids = (n) => n.children.filter((c) => !removed.has(c));
  const nMain = (n) => {   // tips left in a subtree once lifted clades are removed
    if (n.tip) return 1;
    return kids(n).reduce((s, c) => s + nMain(c), 0);
  };
  const mainCount = new Map();
  (function walk(n) { mainCount.set(n, nMain(n)); if (!n.tip) kids(n).forEach(walk); })(main);
  const xMaxMain = (n) => (n.tip ? n.x : Math.max(...kids(n).map(xMaxMain)));

  // 3. open the founder tree, largest first
  const budget = Math.max(1, maxClades - lifted.length - (intros.length ? 1 : 0));
  let clades = [main];
  const opened = new Set();
  for (;;) {
    const cand = clades.map((n, i) => ({ n, i }))
      .filter(({ n }) => !n.tip && kids(n).length && clades.length - 1 + kids(n).length <= budget)
      .sort((a, b) => mainCount.get(b.n) - mainCount.get(a.n));
    if (!cand.length) break;
    const { n, i } = cand[0];
    opened.add(n);
    clades = [...clades.slice(0, i), ...kids(n), ...clades.slice(i + 1)];
  }

  // band order: founder clades in DFS order, each lifted clade right after the clade hosting it
  const hostOf = (node) => { // which visible founder clade contains this host node
    for (const c of clades) { let found = false; (function f(n) { if (n === node) found = true; else if (!n.tip) kids(n).forEach(f); })(c); if (found) return c; }
    return null;
  };
  const bands = [];
  for (const c of clades) {
    bands.push({ kind: 'clade', node: c, n: mainCount.get(c), x0: c.x, x1: xMaxMain(c), lineage: c.tip ? c.lineage : major(c), purity: 1 });
    for (const L of lifted) {
      const h = hostOf(L.host) ?? (opened.has(L.host) ? null : null);
      if (h === c || (!h && c === clades.at(-1))) bands.push({ kind: 'lineage', node: L.node, n: stats.get(L.node).n, x0: L.at, x1: stats.get(L.node).xMax, lineage: major(L.node), purity: purity(L.node), host: L.host, hostClade: h });
    }
  }
  // lifted clades whose host is on the opened backbone: put them after the nearest clade
  for (const L of lifted) if (!bands.some((b) => b.node === L.node)) bands.push({ kind: 'lineage', node: L.node, n: stats.get(L.node).n, x0: L.at, x1: stats.get(L.node).xMax, lineage: major(L.node), purity: purity(L.node), host: L.host, hostClade: null });
  if (intros.length) {
    const n = intros.reduce((s, c) => s + stats.get(c).n, 0);
    bands.push({
      kind: 'intros', node: { id: 'intros' }, n, lineage: major(intros[0]), purity: 1,
      x0: Math.min(...intros.map((c) => c.x)), x1: Math.max(...intros.map((c) => stats.get(c).xMax)),
      members: intros.map((c) => ({ x0: c.x, x1: stats.get(c).xMax, n: stats.get(c).n, lineage: major(c) })),
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

  // backbone over the founder tree (and the synthetic root, if any)
  const yc = new Map(bands.filter((b) => b.kind === 'clade').map((b) => [b.node, b.yc]));
  const edges = [], verticals = [];
  (function place(n) {
    if (yc.has(n)) return yc.get(n);
    const ch = kids(n);
    const ys = ch.map(place);
    const lo = Math.min(...ys), hi = Math.max(...ys);
    yc.set(n, (lo + hi) / 2);
    if (ch.length > 1) verticals.push({ x: n.x, y0: lo, y1: hi, lineage: n.lineage });
    ch.forEach((c, k) => edges.push({ from: n.id, to: c.id, x0: n.x, x1: c.x, y: ys[k], lineage: c.tip ? c.lineage : major(c) }));
    return yc.get(n);
  })(main);
  const introBand = bands.find((b) => b.kind === 'intros');
  let rootY = yc.get(main);
  if (root.synthetic && introBand) {
    rootY = (yc.get(main) + introBand.yc) / 2;
    verticals.push({ x: root.x, y0: Math.min(yc.get(main), introBand.yc), y1: Math.max(yc.get(main), introBand.yc), lineage: -1, synthetic: true });
    edges.push({ from: root.id, to: main.id, x0: root.x, x1: main.x, y: yc.get(main), lineage: major(main) });
    edges.push({ from: root.id, to: 'intros', x0: root.x, x1: introBand.x0, y: introBand.yc, lineage: introBand.lineage });
  }
  // connectors: where each lifted lineage arose, inside its host
  const connectors = bands.filter((b) => b.kind === 'lineage').map((b) => {
    const from = b.hostClade ? bands.find((x) => x.node === b.hostClade).yc : (yc.get(b.host) ?? rootY);
    return { x: b.x0, y0: from, y1: b.yc, lineage: b.lineage };
  });

  return { root, rootX: root.x, rootY, clades: bands, edges, verticals, connectors };
}
