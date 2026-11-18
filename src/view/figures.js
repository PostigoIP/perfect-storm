// Fig. 1 (phylogeny) and Fig. 2 (case series) share one time axis, so a
// tip and its bar sit on the same vertical. Plain SVG strings, redrawn on a timer.

import { SURFACE_VAR } from './tokens.js';

const M = { l: 44, r: 14, t: 10, b: 24 };

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
export function renderTree(svg, layout, { t0, t1, now, surfaceOf, lineageLabel, fmt, flashSince }) {
  const s = timeScale(svg, t0, t1);
  svg.setAttribute('viewBox', `0 0 ${s.W} ${s.H}`);
  if (!layout.tips.length) {
    svg.innerHTML = `${axisX(s, fmt)}<text x="${s.left}" y="${s.top + 14}" class="fig-empty">No sequenced cases yet.</text>`;
    return;
  }
  const n = layout.tips.length;
  const y = (i) => s.top + ((i + 0.5) / n) * (s.bottom - s.top - 6);
  const paths = new Map();
  const add = (surface, d) => paths.set(surface, (paths.get(surface) ?? '') + d);
  for (const e of layout.edges) add(surfaceOf(e.lineage), `M${s.x(e.x0).toFixed(1)} ${y(e.y).toFixed(1)}H${s.x(e.x1).toFixed(1)}`);
  for (const v of layout.verticals) add(v.lineage < 0 ? 'stone' : surfaceOf(v.lineage), `M${s.x(v.x).toFixed(1)} ${y(v.y0).toFixed(1)}V${y(v.y1).toFixed(1)}`);
  const sw = n > 250 ? 0.75 : 1;
  let out = axisX(s, fmt);
  for (const [surface, d] of paths) out += `<path d="${d}" fill="none" stroke="${fill(surface)}" stroke-width="${sw}" shape-rendering="crispEdges"/>`;

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
  out += nowLine(s, now);
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
