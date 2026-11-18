// Time-resolved phylogeny of sampled cases, derived from the transmission
// genealogy. The pathogen lineage inside case i runs from i's infection
// time to its sampling time; each onward transmission to j is a split at
// j's infection time. Splits with only one sampled descendant collapse.
//
// getNode(id) → { id, parent (-1 = reservoir), t (infection / branch time), lineage }
// tips: [{ id, t (sampling time) }]

const SYNTHETIC_ROOT_LEAD = 5; // days before earliest reservoir introduction

export function buildTree(getNode, tips) {
  const empty = { root: null, tips: [], internal: [], edges: [], verticals: [], tMin: 0, tMax: 0 };
  if (!tips.length) return empty;

  const sampleT = new Map(tips.map((x) => [x.id, x.t]));
  const kids = new Map();      // case id → relevant child ids
  const tops = new Set();      // relevant cases whose parent is the reservoir
  for (const tip of tips) {
    let id = tip.id;
    if (!kids.has(id)) kids.set(id, []);
    for (;;) {
      const n = getNode(id);
      if (n.parent < 0) { tops.add(id); break; }
      const seen = kids.has(n.parent);
      if (!seen) kids.set(n.parent, []);
      const arr = kids.get(n.parent);
      if (!arr.includes(id)) arr.push(id);
      if (seen) break;
      id = n.parent;
    }
  }
  for (const arr of kids.values()) arr.sort((a, b) => getNode(a).t - getNode(b).t);

  const internal = [];
  // Subtree for case i's lineage from its k-th relevant transmission onward.
  function build(i, k) {
    const ks = kids.get(i);
    if (k >= ks.length) {
      return sampleT.has(i) ? { id: `tip:${i}`, caseId: i, x: sampleT.get(i), lineage: getNode(i).lineage, children: [], tip: true } : null;
    }
    const j = ks[k];
    const a = build(j, 0);
    const b = build(i, k + 1);
    if (a && b) {
      const node = { id: `n:${i}:${k}`, caseId: i, x: getNode(j).t, lineage: getNode(i).lineage, children: [a, b], tip: false };
      internal.push(node);
      return node;
    }
    return a || b;
  }

  const topNodes = [...tops].sort((a, b) => getNode(a).t - getNode(b).t);
  const subtrees = topNodes.map((i) => build(i, 0)).filter(Boolean);
  let root;
  if (subtrees.length === 1) root = subtrees[0];
  else {
    const x = getNode(topNodes[0]).t - SYNTHETIC_ROOT_LEAD;
    root = { id: 'root', caseId: -1, x, lineage: -1, children: subtrees, tip: false, synthetic: true };
    internal.push(root);
  }

  // ladderize (larger clade first) and assign y by DFS
  const size = new Map();
  (function count(n) { size.set(n, n.tip ? 1 : n.children.reduce((s, c) => s + count(c), 0)); return size.get(n); })(root);
  const outTips = [], edges = [], verticals = [];
  let next = 0;
  (function place(n) {
    if (n.tip) { n.y = next++; outTips.push({ id: n.caseId, x: n.x, y: n.y, lineage: n.lineage }); return; }
    n.children.sort((a, b) => size.get(b) - size.get(a));
    for (const c of n.children) place(c);
    const ys = n.children.map((c) => c.y);
    n.y = (Math.min(...ys) + Math.max(...ys)) / 2;
    verticals.push({ x: n.x, y0: Math.min(...ys), y1: Math.max(...ys), lineage: n.lineage });
    for (const c of n.children) edges.push({ from: n.id, to: c.id, x0: n.x, x1: c.x, y: c.y, lineage: c.lineage });
  })(root);

  let tMax = -Infinity;
  for (const tip of outTips) tMax = Math.max(tMax, tip.x);
  return { root, tips: outTips, internal, edges, verticals, tMin: root.x, tMax };
}

// Keep at most maxTips, evenly spread over sampling time (first and last kept).
export function thinTips(tips, maxTips) {
  const sorted = [...tips].sort((a, b) => a.t - b.t);
  if (sorted.length <= maxTips) return sorted;
  const out = [];
  for (let k = 0; k < maxTips; k++) out.push(sorted[Math.round(k * (sorted.length - 1) / (maxTips - 1))]);
  return out;
}
