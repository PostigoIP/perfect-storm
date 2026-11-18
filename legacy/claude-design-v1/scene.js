// scene.js — Canvas storm scene
// Renders falling drops, optional lightning halos, and a subtle incidence
// horizon curve. Drops are pushed by external `spawnDrop()` calls.

(function(){
  function makeScene(canvas, opts){
    opts = opts || {};
    const ctx = canvas.getContext('2d');
    let W = 0, H = 0, dpr = 1;
    let running = false;
    let raf = 0;
    let drops = [];
    let splashes = [];
    let lightnings = [];
    let history = [];     // incidence per day for horizon
    let lastTs = 0;

    let style = {
      hue: 230,
      dropColor: null,
      density: 1.0,
      reducedMotion: false,
      showHorizon: true,
      treatment: 'streak',     // streak | drops | bokeh
    };

    function resize(){
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = canvas.getBoundingClientRect();
      W = canvas.width = Math.floor(r.width * dpr);
      H = canvas.height = Math.floor(r.height * dpr);
      canvas.style.width = r.width + 'px';
      canvas.style.height = r.height + 'px';
    }

    function spawnDrop(opts){
      opts = opts || {};
      const x = Math.random() * W;
      const size = (opts.size || 1) * (0.8 + Math.random()*1.4);
      const speed = (style.reducedMotion ? 4 : 9) + Math.random()*8;
      const len = (opts.length || 1) * (style.reducedMotion ? 14 : 38 + Math.random()*60);
      drops.push({
        x, y: -len, vx: -1.2 - Math.random()*0.6, vy: speed * dpr,
        len: len * dpr,
        size: size * dpr,
        opacity: opts.opacity != null ? opts.opacity : 0.9,
        hue: opts.hue != null ? opts.hue : style.hue,
        life: 0,
      });
      if (drops.length > 600) drops.splice(0, drops.length - 600);
    }

    function spawnLightning(opts){
      lightnings.push({
        t: 0,
        duration: 700 + Math.random()*200,
        hue: opts.hue != null ? opts.hue : 60,
        intensity: opts.intensity || 1,
      });
    }

    function setHistory(arr){ history = arr.slice(-280); }

    function setStyle(s){ Object.assign(style, s); }

    function step(ts){
      if (!running) return;
      if (!lastTs) lastTs = ts;
      const dt = Math.min(50, ts - lastTs);
      lastTs = ts;

      // background — clear with subtle deep wash
      ctx.fillStyle = 'rgba(8,11,22,0.32)';
      ctx.fillRect(0,0,W,H);

      // horizon curve
      if (style.showHorizon){
        drawHorizon();
      }

      // drops
      ctx.lineCap = 'round';
      for (let i=drops.length-1; i>=0; i--){
        const d = drops[i];
        d.x += d.vx;
        d.y += d.vy * (dt/16.67);
        d.life += dt;

        if (style.treatment === 'bokeh'){
          // soft circular drops
          const grad = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.size*6);
          grad.addColorStop(0, `oklch(0.85 0.10 ${d.hue} / ${d.opacity})`);
          grad.addColorStop(1, `oklch(0.85 0.10 ${d.hue} / 0)`);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(d.x, d.y, d.size*6, 0, Math.PI*2);
          ctx.fill();
        } else if (style.treatment === 'drops'){
          ctx.fillStyle = `oklch(0.82 0.10 ${d.hue} / ${d.opacity})`;
          ctx.beginPath();
          ctx.ellipse(d.x, d.y, d.size*1.2, d.size*2.2, 0, 0, Math.PI*2);
          ctx.fill();
        } else {
          // streak — gradient line
          const grad = ctx.createLinearGradient(d.x - d.vx*d.len/d.vy*0.6, d.y - d.len, d.x, d.y);
          grad.addColorStop(0, `oklch(0.78 0.08 ${d.hue} / 0)`);
          grad.addColorStop(1, `oklch(0.86 0.10 ${d.hue} / ${d.opacity})`);
          ctx.strokeStyle = grad;
          ctx.lineWidth = d.size * 0.9;
          ctx.beginPath();
          ctx.moveTo(d.x - d.vx * d.len / Math.max(d.vy,1) * 0.5, d.y - d.len);
          ctx.lineTo(d.x, d.y);
          ctx.stroke();
        }

        // ground
        if (d.y > H - 12*dpr){
          splashes.push({
            x: d.x, y: H - 8*dpr, r: 2*dpr, max: (8 + Math.random()*8)*dpr,
            life: 0, dur: 380, hue: d.hue, opacity: d.opacity,
          });
          drops.splice(i,1);
        } else if (d.y > H + 60){
          drops.splice(i,1);
        }
      }

      // splashes — ground ripples
      for (let i=splashes.length-1; i>=0; i--){
        const s = splashes[i];
        s.life += dt;
        const k = s.life / s.dur;
        if (k >= 1){ splashes.splice(i,1); continue; }
        const r = s.r + (s.max - s.r) * k;
        ctx.strokeStyle = `oklch(0.85 0.08 ${s.hue} / ${(1-k) * s.opacity * 0.6})`;
        ctx.lineWidth = 0.8 * dpr;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y, r, r*0.35, 0, 0, Math.PI*2);
        ctx.stroke();
      }

      // lightning halos (canvas-rendered glow that bleeds upward)
      for (let i=lightnings.length-1; i>=0; i--){
        const L = lightnings[i];
        L.t += dt;
        const k = L.t / L.duration;
        if (k >= 1){ lightnings.splice(i,1); continue; }
        // double-pulse envelope
        const env = Math.max(0, Math.sin(k * Math.PI) * (k < 0.1 ? 1 : 0.4 + 0.6*Math.exp(-(k-0.1)*6)));
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const cx = W * (0.2 + 0.6*Math.random());
        const cy = H * 0.1;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, H*0.9);
        grad.addColorStop(0, `oklch(0.95 0.09 ${L.hue} / ${env * 0.45 * L.intensity})`);
        grad.addColorStop(1, `oklch(0.95 0.09 ${L.hue} / 0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(0,0,W,H);
        ctx.restore();
      }

      raf = requestAnimationFrame(step);
    }

    function drawHorizon(){
      if (!history.length) return;
      const max = Math.max(8, ...history);
      const baseY = H - 24*dpr;
      const amp = Math.min(H*0.34, 14*dpr + max * 0.6 * dpr);
      ctx.beginPath();
      const n = history.length;
      for (let i=0;i<n;i++){
        const x = (i / (n-1)) * W;
        const v = history[i] / max;
        const y = baseY - v * amp;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.lineTo(W, H);
      ctx.lineTo(0, H);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, baseY - amp, 0, H);
      grad.addColorStop(0, `oklch(0.78 0.10 ${style.hue} / 0.18)`);
      grad.addColorStop(1, `oklch(0.78 0.10 ${style.hue} / 0)`);
      ctx.fillStyle = grad;
      ctx.fill();

      // crisp line on top
      ctx.beginPath();
      for (let i=0;i<n;i++){
        const x = (i / (n-1)) * W;
        const v = history[i] / max;
        const y = baseY - v * amp;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `oklch(0.85 0.10 ${style.hue} / 0.55)`;
      ctx.lineWidth = 1 * dpr;
      ctx.stroke();
    }

    function start(){ if (running) return; running = true; lastTs = 0; raf = requestAnimationFrame(step); }
    function stop(){ running = false; cancelAnimationFrame(raf); }
    function clear(){ drops.length = 0; splashes.length = 0; lightnings.length = 0; }

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    return { start, stop, clear, spawnDrop, spawnLightning, setHistory, setStyle, resize };
  }

  window.PSScene = { makeScene };
})();
