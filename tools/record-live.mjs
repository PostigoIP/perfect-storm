// Record the live site in real time (video) and log every sound event with its time,
// so the audio can be rendered offline by the app's own engine and muxed in.
import { chromium } from 'playwright-core';
import { writeFileSync, readdirSync, renameSync } from 'node:fs';
const OUT = process.argv[2];
const URL = process.argv[3] || 'https://postigoip.github.io/perfect-storm/';
const STORY_SECONDS = +(process.argv[4] || 52), SPEED = +(process.argv[5] || 6);
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
  args: ['--autoplay-policy=no-user-gesture-required', '--hide-scrollbars'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, recordVideo: { dir: OUT, size: { width: 1280, height: 720 } } });
const page = await ctx.newPage();
const videoStart = Date.now();
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);                       // the start screen, as a title card
await page.evaluate(() => {
  const a = window.__ps.audio; window.__events = [];
  const origCase = a.playCase.bind(a), origThunder = a.thunder.bind(a);
  a.playCase = (c, material, offset = 0) => {
    window.__events.push({ kind: 'drop', epoch: Date.now() + (0.08 + Math.max(0, offset)) * 1000, material,
      c: { id: c.id, severity: c.severity, detected: c.detected, muts: c.muts, lineage: c.lineage, outcome: c.outcome } });
    return origCase(c, material, offset);
  };
  a.thunder = (intensity = 1) => { window.__events.push({ kind: 'thunder', epoch: Date.now() + 80, intensity }); return origThunder(intensity); };
});
await page.click('#start-listen');
await page.waitForSelector('#tutorial:not([hidden])', { timeout: 15000 });
await page.waitForTimeout(400);
await page.click('#tut-skip');
await page.evaluate((speed) => { window.__speedTimer = setInterval(() => { window.__ps.state.speed = speed; }, 50); }, SPEED);
await page.waitForTimeout(STORY_SECONDS * 1000);
const events = await page.evaluate(() => window.__events);
const chapter = await page.evaluate(() => document.getElementById('chapter-title').textContent);
await page.close(); await ctx.close(); await browser.close();
const vid = readdirSync(OUT).find((f) => f.endsWith('.webm'));
renameSync(`${OUT}/${vid}`, `${OUT}/video.webm`);
const ev = events.map((e) => ({ ...e, t: (e.epoch - videoStart) / 1000 }));
writeFileSync(`${OUT}/events.json`, JSON.stringify({ duration: (Date.now() - videoStart) / 1000, events: ev }));
console.log(`video.webm + ${ev.length} events (${ev.filter((e) => e.kind === 'thunder').length} thunder), ended on "${chapter}"`);
