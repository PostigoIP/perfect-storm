// The storm stage. One falling stroke per audible case; flat, no glow.
// Colour = lineage surface token; reported cases solid, unreported faint.
// Thunder = a brief full-stage inversion.

import { tokens } from './tokens.js';

export function createRain(canvas, { groundOffset = () => 0 } = {}) {
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1, raf = 0, running = false, last = 0;
  let reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const drops = [], ticks = [], flashes = [];

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    W = canvas.width = Math.max(1, Math.floor(r.width * dpr));
    H = canvas.height = Math.max(1, Math.floor(r.height * dpr));
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  function ground() { return H - groundOffset() * dpr; }

  function drop(c, colorVar) {
    const sev = c.severity ?? 1;
    const x = (0.02 + 0.96 * ((c.id * 0.6180339887) % 1)) * W;
    drops.push({
      x, y: reduced ? ground() - 40 * dpr : -40 * dpr,
      len: (14 + sev * 10) * dpr,
      w: (sev >= 3 ? 2 : 1) * dpr,
      vy: (0.9 + 0.25 * ((c.id * 0.37) % 1)) * H / 1100,   // px per ms; ~1.1 s to fall
      color: colorVar,
      alpha: c.detected ? 1 : 0.32,
      life: 0,
    });
    if (drops.length > 900) drops.splice(0, drops.length - 900);
  }

  function lightning() { flashes.push({ t: 0, dur: reduced ? 200 : 520 }); }

  function frame(ts) {
    if (!running) return;
    const dt = Math.min(50, last ? ts - last : 16);
    last = ts;
    const tk = tokens();
    const g = ground();
    ctx.fillStyle = tk.paper;
    ctx.fillRect(0, 0, W, H);

    // ground ticks: where drops landed, fading
    for (let i = ticks.length - 1; i >= 0; i--) {
      const t = ticks[i];
      t.life += dt;
      const k = t.life / 1400;
      if (k >= 1) { ticks.splice(i, 1); continue; }
      ctx.globalAlpha = (1 - k) * t.alpha;
      ctx.fillStyle = tk[t.color] ?? tk.ink;
      const w = (6 + 10 * k) * dpr;
      ctx.fillRect(t.x - w / 2, g - dpr, w, dpr);
    }

    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.life += dt;
      if (reduced) {
        if (d.life > 600) { drops.splice(i, 1); continue; }
        ctx.globalAlpha = d.alpha * (1 - d.life / 600);
      } else {
        d.y += d.vy * dt;
        ctx.globalAlpha = d.alpha;
        if (d.y >= g) {
          ticks.push({ x: d.x, color: d.color, alpha: d.alpha, life: 0 });
          drops.splice(i, 1);
          continue;
        }
      }
      ctx.fillStyle = tk[d.color] ?? tk.ink;
      ctx.fillRect(d.x, Math.min(d.y, g) - d.len, d.w, d.len);
    }
    ctx.globalAlpha = 1;

    // thunder: invert, then release
    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i];
      f.t += dt;
      const k = f.t / f.dur;
      if (k >= 1) { flashes.splice(i, 1); continue; }
      ctx.globalCompositeOperation = 'difference';
      ctx.globalAlpha = k < 0.15 ? 1 : Math.max(0, 1 - (k - 0.15) / 0.85) * (k < 0.3 ? 0.4 : 1);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
    raf = requestAnimationFrame(frame);
  }

  return {
    drop, lightning,
    setReducedMotion(b) { reduced = b; },
    clear() { drops.length = 0; ticks.length = 0; flashes.length = 0; },
    start() { if (running) return; running = true; last = 0; raf = requestAnimationFrame(frame); },
    stop() { running = false; cancelAnimationFrame(raf); },
  };
}
