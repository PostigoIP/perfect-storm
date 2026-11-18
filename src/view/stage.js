// The stage: rain that falls into the case series.
// Every drop flies to the top of its own bin and, on landing, that bar grows by
// one (the ledger is fed by main's landing queue, not by these streaks, so a
// visual cap never changes the count). Positions are computed from the clock,
// so a throttled page lands drops on time, in sync with their sound.

import { tokens } from './tokens.js';
import { MARGIN } from './figures.js';
import { yScale } from './scale.js';

const AXIS_H = 20;          // css px under the bars for time labels
const BARS_SHARE = 0.3;     // share of stage height (above ground) for the bars; leaves air under the text
const MAX_FLIGHTS = 700;

export function createStage(canvas, { stageEl, groundOffset, domain, ledger, surfaceOf, order, fmt }) {
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1, raf = 0, running = false;
  let reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let spread = 'wide';
  let scaleKind = 'linear';
  let events = [];          // [{ t, label }] story events marked on the time axis
  let unitLabel = 'cases per day';
  let yMaxShown = 10, lastTs = 0;
  const flights = [], splashes = [];

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    W = canvas.width = Math.max(1, Math.floor(r.width * dpr));
    H = canvas.height = Math.max(1, Math.floor(r.height * dpr));
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  // geometry (device px)
  const ground = () => H - groundOffset() * dpr;
  const baseline = () => ground() - AXIS_H * dpr;
  const zoneH = () => (ground() - AXIS_H * dpr) * BARS_SHARE;
  const left = () => MARGIN.l * dpr, right = () => W - MARGIN.r * dpr;
  function x(t) { const { t0, t1 } = domain(); return left() + ((t - t0) / Math.max(1e-6, t1 - t0)) * (right() - left()); }
  const binW = () => Math.max(1, x(ledger().binDays) - x(0));
  const ys = () => yScale(scaleKind, yMaxShown);
  const barTop = (t) => baseline() - ys().f(ledger().heightOf(t)) * zoneH();
  const binCentre = (t) => { const b = ledger().binDays; return x(Math.floor(t / b) * b + b / 2); };
  function tAt(px) { const { t0, t1 } = domain(); return t0 + ((px - left()) / Math.max(1, right() - left())) * (t1 - t0); }
  // the surface under a point: the top of the bar there, or the baseline
  const surfaceY = (px) => barTop(tAt(px));
  const SLANT = -0.05;   // a light, constant wind: every drop falls at the same angle

  function spawn(c, surface, startAt, landAt) {
    if (flights.length >= MAX_FLIGHTS || reduced) return;           // count still lands via the queue
    const jitter = (((c.id * 0.6180339887) % 1) - 0.5) * Math.max(0, binW() - 2 * dpr);
    const x0 = spread === 'wide' ? left() + Math.random() * (right() - left()) : null;   // where it lands
    flights.push({
      c, surface, startAt, landAt, jitter, x0,
      len: (12 + (c.severity ?? 1) * 8) * dpr,
      w: (c.severity >= 3 ? 2 : 1) * dpr,
      alpha: c.detected ? 1 : 0.35,
    });
  }

  // the case counted: a tick on top of its own bar (always), as the bar grows by one
  function splash(c, surface) {
    const b = ledger().binDays;
    splashes.push({ t: Math.floor(c.tOnset / b) * b + b / 2, surface, alpha: c.detected ? 1 : 0.35, life: 0 });
    if (splashes.length > 300) splashes.splice(0, splashes.length - 300);
  }

  function flash() {
    stageEl.classList.remove('is-flash');
    void stageEl.offsetWidth;
    stageEl.classList.add('is-flash');
  }

  function niceMax(v) {
    if (v <= 10) return 10;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (v <= m * p) return m * p;
    return 10 * p;
  }

  function drawBars(tk) {
    const bins = ledger().bins();
    const bw = binW(), gap = bw >= 4 * dpr ? dpr : 0, zh = zoneH(), base = baseline();
    const sc = ys();
    const units = scaleKind === 'linear' && yMaxShown <= 30.5 && bw >= 5 * dpr;
    const unit = zh / yMaxShown;
    for (const b of bins) {
      const bx = x(b.t0) + gap / 2, w = bw - gap;
      const layers = [];
      for (const l of order()) if (b.detectedByLineage[l]) layers.push([l, b.detectedByLineage[l], true]);
      for (const l of order()) { const u = b.byLineage[l] - b.detectedByLineage[l]; if (u) layers.push([l, u, false]); }
      // the bar's height encodes its total on the current scale; layers share it in proportion
      const H = sc.f(b.total) * zh;
      let acc = 0;
      for (const [l, n, rep] of layers) {
        const col = tk[surfaceOf(l)] ?? tk.ink;
        if (units) {
          const sq = Math.max(2 * dpr, Math.min(w, unit) - dpr);
          for (let k = 0; k < n; k++) {
            const yy = base - (acc + k + 1) * unit + (unit - sq);
            if (rep) { ctx.fillStyle = col; ctx.fillRect(bx, yy, sq, sq); }
            else { ctx.strokeStyle = col; ctx.lineWidth = dpr; ctx.strokeRect(bx + dpr / 2, yy + dpr / 2, sq - dpr, sq - dpr); }
          }
          acc += n;
        } else {
          const h0 = (acc / b.total) * H, h1 = ((acc + n) / b.total) * H;
          ctx.globalAlpha = rep ? 1 : 0.28;
          ctx.fillStyle = col;
          ctx.fillRect(bx, base - h1, w, h1 - h0);
          ctx.globalAlpha = 1;
          acc += n;
        }
      }
    }
  }

  const monoFont = (px) => `${px * dpr}px ${getComputedStyle(document.documentElement).getPropertyValue('--ps-font-mono')}`;

  function drawAxis(tk, now) {
    const { t0, t1 } = domain(), base = baseline(), zh = zoneH(), yTop = base - zh;
    // time axis
    ctx.fillStyle = tk.ink;
    ctx.fillRect(left(), base, right() - left(), dpr);
    const span = t1 - t0, raw = span / 6, p = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 5, 10].map((m) => m * p).find((q) => raw <= q) ?? 10 * p;
    ctx.font = monoFont(10);
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillStyle = tk.ink2;
    for (let t = Math.ceil(t0 / step) * step; t <= t1; t += step) {
      const xx = Math.round(x(t));
      ctx.fillRect(xx, base, dpr, 4 * dpr);
      ctx.fillText(fmt(t), xx, base + 6 * dpr);
    }
    // value scale: faint reference lines with quiet labels, and what the bars count
    const sc = ys();
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (const tick of sc.ticks) {
      const yy = Math.round(base - tick.f * zh);
      ctx.globalAlpha = 0.12; ctx.fillStyle = tk.ink;
      ctx.fillRect(left(), yy, right() - left(), dpr);
      ctx.globalAlpha = 1; ctx.fillStyle = tk.ink2;
      ctx.fillText(tick.v >= 1000 ? `${tick.v / 1000}k` : String(tick.v), left() - 6 * dpr, yy);
    }
    ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ctx.fillStyle = tk.ink2;
    ctx.fillText(`${unitLabel}${scaleKind === 'log' ? ' · log scale' : ''}`, left(), yTop - 6 * dpr);
    // story events: a hairline and a short label, alternating rows to avoid collisions
    ctx.font = monoFont(9.5);
    events.forEach((e, k) => {
      const xx = Math.round(x(e.t));
      if (xx < left() || xx > right()) return;
      ctx.globalAlpha = 0.45; ctx.fillStyle = tk.ink;
      ctx.fillRect(xx, yTop, dpr, zh);
      ctx.globalAlpha = 1; ctx.fillStyle = tk.ink2;
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(e.label, xx + 4 * dpr, yTop + (k % 2 ? 14 : 2) * dpr);
    });
    // now
    ctx.fillStyle = tk.accent;
    ctx.fillRect(Math.round(x(now)), yTop, dpr, zh);
  }

  function frame(ts) {
    if (!running) return;
    const tk = tokens();
    ctx.clearRect(0, 0, W, H);
    const dt = Math.min(1000, lastTs ? ts - lastTs : 16);
    lastTs = ts;
    const target = niceMax(ledger().max());
    yMaxShown += (target - yMaxShown) * (reduced ? 1 : Math.min(1, dt / 300));   // time-based ease
    yMaxShown = Math.max(yMaxShown, ledger().max());                              // bars never overshoot
    drawBars(tk);

    // splashes on bar tops
    for (let i = splashes.length - 1; i >= 0; i--) {
      const s = splashes[i];
      s.life += dt;
      const k = s.life / 900;
      if (k >= 1) { splashes.splice(i, 1); continue; }
      ctx.globalAlpha = (1 - k) * s.alpha;
      ctx.fillStyle = tk[s.surface] ?? tk.ink;
      const w = (5 + 12 * k) * dpr;
      const sx = s.x ?? binCentre(s.t), sy = s.y ?? barTop(s.t);
      ctx.fillRect(sx - w / 2, sy - 2 * dpr, w, dpr);
    }

    // flights
    const now = performance.now();
    for (let i = flights.length - 1; i >= 0; i--) {
      const f = flights[i];
      if (now < f.startAt) continue;
      const k = (now - f.startAt) / Math.max(1, f.landAt - f.startAt);
      const xT = f.x0 ?? binCentre(f.c.tOnset) + f.jitter;
      const yT = f.x0 == null ? barTop(f.c.tOnset) : surfaceY(xT);
      if (k >= 1) {
        // the drop hits whatever is under it
        if (f.x0 != null) splashes.push({ x: xT, y: yT, surface: f.surface, alpha: f.alpha * 0.7, life: 0 });
        flights.splice(i, 1);
        continue;
      }
      const ys = -f.len, xs = xT - SLANT * (yT - ys);
      const px = xs + (xT - xs) * k, py = ys + (yT - ys) * k;
      const dx = xT - xs, dy = yT - ys, n = Math.hypot(dx, dy) || 1;
      ctx.globalAlpha = f.alpha;
      ctx.strokeStyle = tk[f.surface] ?? tk.ink;
      ctx.lineWidth = f.w;
      ctx.beginPath();
      ctx.moveTo(px - (dx / n) * f.len, py - (dy / n) * f.len);
      ctx.lineTo(px, py);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    drawAxis(tk, domain().now);
    raf = requestAnimationFrame(frame);
  }

  return {
    spawn, splash, flash,
    setSpread(s) { spread = s; },
    setScale(k) { scaleKind = k; },
    setEvents(list) { events = list; },
    setUnitLabel(l) { unitLabel = l; },
    setReducedMotion(b) { reduced = b; },
    clear() { flights.length = 0; splashes.length = 0; yMaxShown = 10; },
    // where the tree should sit (css px, relative to the stage)
    treeBox() { return { top: Math.round(H / dpr * 0.07), bottom: Math.round((baseline() - zoneH()) / dpr) - 8 }; },
    start() { if (running) return; running = true; raf = requestAnimationFrame(frame); },
    stop() { running = false; cancelAnimationFrame(raf); },
  };
}
