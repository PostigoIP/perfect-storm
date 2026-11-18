// Fig. 1 (phylogeny) and Fig. 2 (case series) share one time axis, so a
// tip and its bar sit on the same vertical. Plain SVG strings, redrawn on a timer.

import { SURFACE_VAR } from './tokens.js';

const M = { l: 44, r: 14, t: 10, b: 24 };
export const MARGIN = M;

export function timeScale(svg, t0, t1) {
  const r = svg.getBoundingClientRect();
  const W = Math.max(200, r.width), H = Math.max(80, r.height);
  const pw = W - M.l - M.r;
  const x = (t) => M.l + ((t - t0) / Math.max(1e-6, t1 - t0)) * pw;
  return { W, H, x, t0, t1, top: M.t, bottom: H - M.b, left: M.l, right: W - M.r };
}

function niceStep(span, target = 6) {
  const raw = span / target, p = Math.pow(10, Math.floor(Math.log10(raw)));
  for (const m of [1, 2, 5, 10]) if (raw <= m * p) return m * p;
  return 10 * p;
}

function axisX(s, fmt) {
  const step = Math.max(1, niceStep(s.t1 - s.t0));
  let out = `<g class="axis"><line x1="${s.left}" x2="${s.right}" y1="${s.bottom}" y2="${s.bottom}"/>`;
  for (let t = Math.ceil(s.t0 / step) * step; t <= s.t1; t += step) {
    const x = s.x(t).toFixed(1);
    out += `<line x1="${x}" x2="${x}" y1="${s.bottom}" y2="${s.bottom + 4}"/><text x="${x}" y="${s.bottom + 15}" text-anchor="middle">${fmt(t)}</text>`;
  }
  return out + '</g>';
}

function nowLine(s, now) {
  const x = s.x(now).toFixed(1);
  return `<line x1="${x}" x2="${x}" y1="${s.top}" y2="${s.bottom}" stroke="var(--ps-accent)" stroke-width="1" shape-rendering="crispEdges"/>`;
}

const fill = (surface) => `var(${SURFACE_VAR[surface] ?? '--ps-ink'})`;

// layout: from buildTree(); surfaceOf(lineage) → surface name; labels: lineage → short label
export function renderTree(svg, layout, { t0, t1, now, surfaceOf, lineageLabel, fmt, flashSince, axis = true }) {
  const s = timeScale(svg, t0, t1);
  if (!axis) s.bottom = s.H - 4;
  const ax = axis ? axisX(s, fmt) : '';
  svg.setAttribute('viewBox', `0 0 ${s.W} ${s.H}`);
  if (!layout.tips.length) {
    svg.innerHTML = `${ax}<text x="${s.left}" y="${s.top + 14}" class="fig-empty">No sequenced cases yet.</text>`;
    return;
  }
  const n = layout.tips.length;
  const y = (i) => s.top + ((i + 0.5) / n) * (s.bottom - s.top - 6);
  const paths = new Map();
  const add = (surface, d) => paths.set(surface, (paths.get(surface) ?? '') + d);
  for (const e of layout.edges) add(surfaceOf(e.lineage), `M${s.x(e.x0).toFixed(1)} ${y(e.y).toFixed(1)}H${s.x(e.x1).toFixed(1)}`);
  for (const v of layout.verticals) add(v.lineage < 0 ? 'stone' : surfaceOf(v.lineage), `M${s.x(v.x).toFixed(1)} ${y(v.y0).toFixed(1)}V${y(v.y1).toFixed(1)}`);
  const sw = n > 250 ? 0.75 : 1;
  let out = ax;
  for (const [surface, d] of paths) out += `<path d="${d}" fill="none" stroke="${fill(surface)}" stroke-width="${sw}" shape-rendering="crispEdges"/>`;

  // root branch: a short stem into the root, as in any rooted phylogeny
  const r0 = layout.root, rx = s.x(r0.x), ry = y(r0.y), stem = Math.max(10, (s.right - s.left) * 0.025);
  out += `<path d="M${(rx - stem).toFixed(1)} ${ry.toFixed(1)}H${rx.toFixed(1)}" stroke="var(--ps-ink)" stroke-width="${sw}" fill="none" shape-rendering="crispEdges"/>`;
  if (r0.synthetic) out += `<text class="fig-label" x="${(rx - stem - 4).toFixed(1)}" y="${(ry + 3).toFixed(1)}" text-anchor="end">outside</text>`;

  // tips: 3px squares; newly sampled ones larger
  const sz = n > 250 ? 2 : 3;
  for (const t of layout.tips) {
    const fresh = t.x >= flashSince;
    const k = fresh ? sz + 3 : sz;
    out += `<rect class="${fresh ? 'tip tip--new' : 'tip'}" x="${(s.x(t.x) - k / 2).toFixed(1)}" y="${(y(t.y) - k / 2).toFixed(1)}" width="${k}" height="${k}" fill="${fill(surfaceOf(t.lineage))}"><title>Case ${t.id} · ${lineageLabel(t.lineage)} · sampled ${fmt(t.x)}</title></rect>`;
  }

  // lineage origins: ▲ at the first branch of each non-founder lineage
  const first = new Map();
  for (const e of layout.edges) {
    if (e.lineage <= 0) continue;
    const f = first.get(e.lineage);
    if (!f || e.x0 < f.x0) first.set(e.lineage, e);
  }
  for (const [l, e] of first) {
    const x = s.x(e.x0), yy = y(e.y);
    out += `<path d="M${x - 5} ${yy - 4}L${x} ${yy - 12}L${x + 5} ${yy - 4}Z" fill="${fill(surfaceOf(l))}"/><text class="fig-label" x="${x + 8}" y="${yy - 5}">${lineageLabel(l)}</text>`;
  }
  svg.innerHTML = out;
}

// bins: from binCases(); order: lineage indices in stacking order
export function renderEpicurve(svg, bins, { t0, t1, now, binDays, surfaceOf, order, fmt, unitLabel }) {
  const s = timeScale(svg, t0, t1);
  svg.setAttribute('viewBox', `0 0 ${s.W} ${s.H}`);
  let out = axisX(s, fmt);
  if (!bins.length) { svg.innerHTML = out + nowLine(s, now); return; }
  const max = Math.max(...bins.map((b) => b.total));
  const bw = Math.max(1, s.x(binDays) - s.x(0));
  const gap = bw >= 4 ? 1 : 0;
  const ph = s.bottom - s.top;
  const units = max <= 30 && bw >= 5;
  const yMax = units ? Math.max(10, max) : niceMax(max);
  const unitH = ph / yMax;
  const yv = (v) => s.bottom - (v / yMax) * ph;

  // y axis: 0, mid, max
  out += '<g class="axis">';
  for (const v of [0, yMax / 2, yMax]) {
    out += `<line x1="${s.left - 4}" x2="${s.left}" y1="${yv(v).toFixed(1)}" y2="${yv(v).toFixed(1)}"/><text x="${s.left - 7}" y="${(yv(v) + 3).toFixed(1)}" text-anchor="end">${fmtCount(v)}</text>`;
  }
  out += '</g>';

  for (const b of bins) {
    const x = s.x(b.t0) + gap / 2, w = bw - gap;
    // reported cases form a solid base (stacked by lineage); unreported sit on top, faint
    const layers = [];
    for (const l of order) { const det = b.detectedByLineage[l] ?? 0; if (det) layers.push({ l, n: det, reported: true }); }
    for (const l of order) { const und = (b.byLineage[l] ?? 0) - (b.detectedByLineage[l] ?? 0); if (und) layers.push({ l, n: und, reported: false }); }
    let acc = 0;
    for (const { l, n, reported } of layers) {
      const f = fill(surfaceOf(l));
      if (units) {
        const sq = Math.max(2, Math.min(w, unitH) - 1);
        for (let k = 0; k < n; k++) {
          const yy = yv(acc + k + 1) + (unitH - sq);
          out += reported
            ? `<rect x="${x.toFixed(1)}" y="${yy.toFixed(1)}" width="${sq.toFixed(1)}" height="${sq.toFixed(1)}" fill="${f}"/>`
            : `<rect x="${(x + 0.5).toFixed(1)}" y="${(yy + 0.5).toFixed(1)}" width="${(sq - 1).toFixed(1)}" height="${(sq - 1).toFixed(1)}" fill="none" stroke="${f}"/>`;
        }
      } else {
        out += `<rect x="${x.toFixed(1)}" y="${yv(acc + n).toFixed(1)}" width="${w.toFixed(1)}" height="${(n * ph / yMax).toFixed(2)}" fill="${f}"${reported ? '' : ' fill-opacity="0.28"'}/>`;
      }
      acc += n;
    }
    out += `<rect x="${x.toFixed(1)}" y="${s.top}" width="${Math.max(2, w).toFixed(1)}" height="${ph}" fill="transparent"><title>${fmt(b.t0)}: ${b.total} ${unitLabel} (${b.detected} reported)</title></rect>`;
  }
  out += nowLine(s, now);
  svg.innerHTML = out;
}

function niceMax(v) {
  if (v <= 10) return 10;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (v <= m * p) return m * p;
  return 10 * p;
}
const fmtCount = (v) => (v >= 1000 ? (v / 1000).toFixed(v % 1000 ? 1 : 0) + 'k' : String(Math.round(v)));

// Collapsed phylogeny: backbone lines, one flat wedge per clade, lifted
// lineages connected to where they arose, introductions as thin lines.
// col: from collapseTree(); band y in [0, 1].
export function renderCollapsedTree(svg, col, { t0, t1, surfaceOf, lineageLabel, fmt, now }) {
  const s = timeScale(svg, t0, t1);
  s.bottom = s.H - 4;
  svg.setAttribute('viewBox', `0 0 ${s.W} ${s.H}`);
  if (!col || !col.clades.length) {
    svg.innerHTML = `<text x="${s.left}" y="${s.top + 14}" class="fig-empty">No sequenced cases yet.</text>`;
    return;
  }
  const Y = (v) => s.top + v * (s.bottom - s.top);
  const X = (t) => s.x(t);
  const col_ = (l) => (l < 0 ? 'var(--ps-ink)' : fill(surfaceOf(l)));
  let out = '';

  // backbone
  for (const v of col.verticals) out += `<path d="M${X(v.x).toFixed(1)} ${Y(v.y0).toFixed(1)}V${Y(v.y1).toFixed(1)}" stroke="var(--ps-ink)" stroke-width="1" fill="none" shape-rendering="crispEdges"/>`;
  for (const e of col.edges) out += `<path d="M${X(e.x0).toFixed(1)} ${Y(e.y).toFixed(1)}H${X(e.x1).toFixed(1)}" stroke="var(--ps-ink)" stroke-width="1" fill="none" shape-rendering="crispEdges"/>`;
  // root stem (and "outside" when the root is the world beyond the population)
  const rx = X(col.rootX), ry = Y(col.rootY), stem = Math.max(10, (s.right - s.left) * 0.025);
  out += `<path d="M${(rx - stem).toFixed(1)} ${ry.toFixed(1)}H${rx.toFixed(1)}" stroke="var(--ps-ink)" stroke-width="1" shape-rendering="crispEdges"/>`;
  if (col.root.synthetic) out += `<text class="fig-label" x="${(rx - stem - 4).toFixed(1)}" y="${(ry + 4).toFixed(1)}" text-anchor="end">outside</text>`;

  // connectors: where a lineage arose inside its host clade
  for (const k of col.connectors) {
    const x = X(k.x).toFixed(1);
    out += `<path d="M${x} ${Y(k.y0).toFixed(1)}V${Y(k.y1).toFixed(1)}" stroke="${col_(k.lineage)}" stroke-width="1" stroke-dasharray="2 3" fill="none"/>`;
    out += `<circle cx="${x}" cy="${Y(k.y0).toFixed(1)}" r="2.5" fill="${col_(k.lineage)}"/>`;
  }

  const multi = new Set(col.clades.filter((b) => b.kind !== 'intros').map((b) => b.lineage)).size > 1;
  for (const b of col.clades) {
    const x0 = X(b.x0), x1 = Math.max(X(b.x1), x0 + 2), y0 = Y(b.y0), y1 = Y(b.y1), yc = Y(b.yc);
    const c = col_(b.lineage);
    const title = b.kind === 'intros'
      ? `${b.members.length} separate introductions from outside · ${b.n} sequenced cases`
      : `${b.kind === 'lineage' ? lineageLabel(b.lineage) + ' · ' : ''}${b.n} sequenced case${b.n === 1 ? '' : 's'} · common ancestor ${fmt(b.x0)} · latest ${fmt(b.x1)}`;
    if (b.kind === 'intros') {
      const m = b.members, step = (y1 - y0) / Math.max(1, m.length);
      m.forEach((mb, i) => {
        const yy = y0 + step * (i + 0.5);
        out += `<path d="M${X(mb.x0).toFixed(1)} ${yy.toFixed(1)}H${Math.max(X(mb.x1), X(mb.x0) + 2).toFixed(1)}" stroke="${col_(mb.lineage)}" stroke-width="1.5"/>`;
      });
      out += `<rect x="${x0.toFixed(1)}" y="${y0.toFixed(1)}" width="${(x1 - x0).toFixed(1)}" height="${(y1 - y0).toFixed(1)}" fill="transparent"><title>${title}</title></rect>`;
      out += `<text class="fig-label" x="${(x1 + 6).toFixed(1)}" y="${(yc + 4).toFixed(1)}">outside · ${m.length}</text>`;
      continue;
    }
    if (b.n === 1) {
      out += `<path d="M${x0.toFixed(1)} ${yc.toFixed(1)}H${x1.toFixed(1)}" stroke="${c}" stroke-width="1"/><rect x="${(x1 - 2).toFixed(1)}" y="${(yc - 2).toFixed(1)}" width="4" height="4" fill="${c}"><title>${title}</title></rect>`;
      continue;
    }
    const pad = Math.min(2, (y1 - y0) * 0.1);
    out += `<path class="wedge" d="M${x0.toFixed(1)} ${yc.toFixed(1)}L${x1.toFixed(1)} ${(y0 + pad).toFixed(1)}L${x1.toFixed(1)} ${(y1 - pad).toFixed(1)}Z" fill="${c}"${b.purity < 0.95 ? ' fill-opacity="0.7"' : ''}><title>${title}</title></path>`;
    const label = b.kind === 'lineage' || multi ? `${lineageLabel(b.lineage)} · ${b.n.toLocaleString('en')}` : b.n.toLocaleString('en');
    out += `<text class="fig-label${b.kind === 'lineage' ? ' fig-label--strong' : ''}" x="${(x1 + 6).toFixed(1)}" y="${(yc + 4).toFixed(1)}">${label}</text>`;
  }
  svg.innerHTML = out;
}
