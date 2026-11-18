// The stage: rain that falls into the case series.
// Every drop flies to the top of its own bin and, on landing, that bar grows by
// one (the ledger is fed by main's landing queue, not by these streaks, so a
// visual cap never changes the count). Positions are computed from the clock,
// so a throttled page lands drops on time, in sync with their sound.

import { tokens } from './tokens.js';
import { MARGIN } from './figures.js';

const AXIS_H = 20;          // css px under the bars for time labels
const BARS_SHARE = 0.36;    // share of stage height (above ground) for the bars
const MAX_FLIGHTS = 700;

export function createStage(canvas, { stageEl, groundOffset, domain, ledger, surfaceOf, order, fmt }) {
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1, raf = 0, running = false;
  let reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let spread = 'wide';
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
  const barTop = (t) => baseline() - (ledger().heightOf(t) / yMaxShown) * zoneH();
  const binCentre = (t) => { const b = ledger().binDays; return x(Math.floor(t / b) * b + b / 2); };

  function spawn(c, surface, startAt, landAt) {
    if (flights.length >= MAX_FLIGHTS || reduced) return;           // count still lands via the queue
    const jitter = (((c.id * 0.6180339887) % 1) - 0.5) * Math.max(0, binW() - 2 * dpr);
    const x0 = spread === 'wide' ? left() + Math.random() * (right() - left()) : null;
    flights.push({
      c, surface, startAt, landAt, jitter, x0,
      len: (12 + (c.severity ?? 1) * 8) * dpr,
      w: (c.severity >= 3 ? 2 : 1) * dpr,
      alpha: c.detected ? 1 : 0.35,
    });
  }

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
    const units = yMaxShown <= 30.5 && bw >= 5 * dpr;
    const unit = zh / yMaxShown;
    for (const b of bins) {
      const bx = x(b.t0) + gap / 2, w = bw - gap;
      let acc = 0;
      const layers = [];
      for (const l of order()) if (b.detectedByLineage[l]) layers.push([l, b.detectedByLineage[l], true]);
      for (const l of order()) { const u = b.byLineage[l] - b.detectedByLineage[l]; if (u) layers.push([l, u, false]); }
      for (const [l, n, rep] of layers) {
        const col = tk[surfaceOf(l)] ?? tk.ink;
        if (units) {
          const sq = Math.max(2 * dpr, Math.min(w, unit) - dpr);
          for (let k = 0; k < n; k++) {
            const yy = base - (acc + k + 1) * unit + (unit - sq);
            if (rep) { ctx.fillStyle = col; ctx.fillRect(bx, yy, sq, sq); }
            else { ctx.strokeStyle = col; ctx.lineWidth = dpr; ctx.strokeRect(bx + dpr / 2, yy + dpr / 2, sq - dpr, sq - dpr); }
          }
        } else {
          ctx.globalAlpha = rep ? 1 : 0.28;
          ctx.fillStyle = col;
          ctx.fillRect(bx, base - (acc + n) * unit, w, n * unit);
          ctx.globalAlpha = 1;
        }
        acc += n;
      }
    }
  }

  function drawAxis(tk, now) {
    const { t0, t1 } = domain(), base = baseline();
    ctx.fillStyle = tk.ink;
    ctx.fillRect(left(), base, right() - left(), dpr);
    const span = t1 - t0, raw = span / 6, p = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 5, 10].map((m) => m * p).find((s) => raw <= s) ?? 10 * p;
    ctx.font = `${10 * dpr}px ${getComputedStyle(document.documentElement).getPropertyValue('--ps-font-mono')}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillStyle = tk.ink2;
    for (let t = Math.ceil(t0 / step) * step; t <= t1; t += step) {
      const xx = Math.round(x(t));
      ctx.fillRect(xx, base, dpr, 4 * dpr);
      ctx.fillText(fmt(t), xx, base + 6 * dpr);
    }
    // y reference: the current scale maximum, top-left of the bar zone
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    const yTop = base - zoneH();
    ctx.fillRect(left() - 4 * dpr, Math.round(yTop), 4 * dpr, dpr);
    ctx.fillText(Math.round(yMaxShown).toLocaleString('en'), left() - 7 * dpr, yTop);
    // now
    ctx.fillStyle = tk.accent;
    ctx.fillRect(Math.round(x(now)), base - zoneH(), dpr, zoneH());
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
      ctx.fillRect(binCentre(s.t) - w / 2, barTop(s.t) - 2 * dpr, w, dpr);
    }

    // flights
    const now = performance.now();
    for (let i = flights.length - 1; i >= 0; i--) {
      const f = flights[i];
      if (now < f.startAt) continue;
      const k = (now - f.startAt) / Math.max(1, f.landAt - f.startAt);
      if (k >= 1) { flights.splice(i, 1); continue; }
      const xT = binCentre(f.c.tOnset) + f.jitter;
      const yT = barTop(f.c.tOnset);
      const xs = f.x0 ?? xT, ys = -f.len;
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
    setReducedMotion(b) { reduced = b; },
    clear() { flights.length = 0; splashes.length = 0; yMaxShown = 10; },
    // where the tree should sit (css px, relative to the stage)
    treeBox() { return { top: Math.round(H / dpr * 0.07), bottom: Math.round((baseline() - zoneH()) / dpr) - 8 }; },
    start() { if (running) return; running = true; raf = requestAnimationFrame(frame); },
    stop() { running = false; cancelAnimationFrame(raf); },
  };
}
