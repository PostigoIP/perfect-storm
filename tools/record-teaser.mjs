// Record a short conceptual teaser of the live site: a question on black, a few drops,
// a new strain arriving with thunder, and an invitation to listen. The cards and captions
// are overlays injected into the page in the site's own type, so the whole film is one
// real-time take. Every sound event is logged with its time (as in record-live.mjs) and
// rendered offline by the app's engine.
//   node tools/record-teaser.mjs <outDir> [url] [lang]
import { chromium } from 'playwright-core';
import { writeFileSync, readdirSync, renameSync } from 'node:fs';
const OUT = process.argv[2];
const URL = process.argv[3] || 'https://postigoip.github.io/perfect-storm/';
const LANG = process.argv[4] || 'en';
const TEXT = {
  en: { q: 'What if you could hear an epidemic?', a: 'Every case, one drop.', b: 'Every strain, its own sound.',
        end: 'Listen with headphones', url: 'postigoip.github.io/perfect-storm' },
  es: { q: '¿Y si pudieras escuchar una epidemia?', a: 'Cada caso, una gota.', b: 'Cada linaje, su propio sonido.',
        end: 'Escúchalo con auriculares', url: 'postigoip.github.io/perfect-storm' },
}[LANG];

const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
  args: ['--autoplay-policy=no-user-gesture-required', '--hide-scrollbars'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, recordVideo: { dir: OUT, size: { width: 1280, height: 720 } } });
const page = await ctx.newPage();
const videoStart = Date.now();
await page.goto(`${URL}?lang=${LANG}`, { waitUntil: 'networkidle' });
await page.evaluate(async (T) => {
  await document.fonts.ready;
  const css = document.createElement('style');
  css.textContent = `
    .stage__text { visibility: hidden; }
    .tz-card { position: fixed; inset: 0; z-index: 1000; background: var(--ps-paper); color: var(--ps-ink); pointer-events: none;
      display: grid; place-content: center; text-align: center; gap: 28px; transition: opacity 1.2s ease; }
    .tz-card h1 { font-family: var(--ps-font-display); font-weight: 700; font-stretch: 112%; font-size: 64px; line-height: 1.02;
      letter-spacing: -0.02em; margin: 0; max-width: 16ch; }
    .tz-card p { font-family: var(--ps-font-mono); font-size: 18px; color: var(--ps-ink-2); margin: 0; letter-spacing: 0.02em; }
    .tz-cap { position: fixed; left: 48px; top: 120px; z-index: 900; pointer-events: none; color: var(--ps-ink);
      font-family: var(--ps-font-display); font-weight: 700; font-stretch: 112%; font-size: 52px; line-height: 1.02;
      letter-spacing: -0.02em; max-width: 12ch; opacity: 0; transition: opacity 0.9s ease; }
    .tz-hide { opacity: 0 !important; }`;
  document.head.append(css);
  const card = (id, html, shown) => {
    const d = document.createElement('div'); d.id = id; d.className = 'tz-card' + (shown ? '' : ' tz-hide'); d.innerHTML = html;
    document.body.append(d);
  };
  card('tz-q', `<h1>${T.q}</h1>`, true);
  card('tz-black', '', false);
  card('tz-end', `<h1>Perfect Storm</h1><p>${T.end}<br>${T.url}</p>`, false);
  for (const [id, s] of [['tz-a', T.a], ['tz-b', T.b]]) {
    const d = document.createElement('div'); d.id = id; d.className = 'tz-cap'; d.textContent = s; document.body.append(d);
  }
  const a = window.__ps.audio; window.__events = [];
  const origCase = a.playCase.bind(a), origThunder = a.thunder.bind(a);
  a.playCase = (c, material, offset = 0) => {
    window.__events.push({ kind: 'drop', epoch: Date.now() + (0.08 + Math.max(0, offset)) * 1000, material,
      c: { id: c.id, severity: c.severity, detected: c.detected, muts: c.muts, lineage: c.lineage, outcome: c.outcome } });
    return origCase(c, material, offset);
  };
  a.thunder = (intensity = 1) => { window.__events.push({ kind: 'thunder', epoch: Date.now() + 80, intensity }); return origThunder(intensity); };
  // Timecode: 24 black/white cells in the bottom-right corner carry Date.now() in 5 ms
  // steps, so each recorded frame can be put back at its real time (Playwright's video
  // drifts). The strip is painted over in the edit.
  const tc = document.createElement('div');
  tc.style.cssText = 'position:fixed;right:0;bottom:0;width:192px;height:8px;display:flex;z-index:2000;pointer-events:none';
  const cells = [...Array(24)].map(() => { const s = document.createElement('span'); s.style.cssText = 'width:8px;height:8px;background:#000'; tc.append(s); return s; });
  document.body.append(tc);
  window.__tcBase = Date.now();
  const tick = () => {
    const v = Math.round((Date.now() - window.__tcBase) / 5);
    cells.forEach((s, i) => { s.style.background = (v >> (23 - i)) & 1 ? '#fff' : '#000'; });
    requestAnimationFrame(tick);
  };
  tick();
  window.__speed = 1.2;
  window.__speedTimer = setInterval(() => { if (window.__ps.state.running) window.__ps.state.speed = window.__speed; }, 50);
}, TEXT);
const T0 = Date.now();
const at = async (s) => { const w = T0 + s * 1000 - Date.now(); if (w > 0) await page.waitForTimeout(w); };
const show = (id, on) => page.evaluate(([id, on]) => {
  const el = document.getElementById(id);
  if (el.classList.contains('tz-cap')) el.style.opacity = on ? 1 : 0; else el.classList.toggle('tz-hide', !on);
}, [id, on]);
const chapter = (i, speed) => page.evaluate(([i, speed]) => { window.__speed = speed; document.querySelector(`#chapters button[data-i="${i}"]`).click(); }, [i, speed]);

await at(1.6);
await page.click('#start-listen');
await page.waitForSelector('#tutorial:not([hidden])', { timeout: 15000 });
await page.click('#tut-skip');                         // story starts: patient zero's drop under the question
await at(4.4); await show('tz-q', false);
await at(6.5); await show('tz-a', true);
await at(11.5); await show('tz-a', false);
await at(17); await show('tz-black', true);
await at(18.3); await chapter(4, 1.5);                 // plateau: travellers bring in another lineage
await at(18.6); await show('tz-black', false);
await at(24.5); await chapter(5, 1.2);                 // a new variant arrives, with thunder
await at(26.8); await show('tz-b', true);
await at(31.8); await show('tz-b', false);
await at(35); await show('tz-end', true);
await at(42.5);

const events = await page.evaluate(() => window.__events);
const tcBase = await page.evaluate(() => window.__tcBase);
await page.close(); await ctx.close(); await browser.close();
const vid = readdirSync(OUT).find((f) => f.endsWith('.webm'));
renameSync(`${OUT}/${vid}`, `${OUT}/video.webm`);
// Times are seconds from the film's start (T0); the timecode base is given in the same frame.
const ev = events.map((e) => ({ ...e, t: (e.epoch - T0) / 1000 }));
writeFileSync(`${OUT}/events.json`, JSON.stringify({ duration: (Date.now() - T0) / 1000, tcOffset: (tcBase - T0) / 1000, events: ev }));
console.log(`video.webm + ${ev.length} events (${ev.filter((e) => e.kind === 'thunder').length} thunder)`);
