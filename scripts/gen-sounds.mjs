// Generate the raw sound bank with ElevenLabs Sound Effects (offline, once).
// Usage: node scripts/gen-sounds.mjs [--dry-run] [--set glass]
// Reads ELEVENLABS_API_KEY from .env.local (never printed). Skips takes that already exist.
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(readFileSync(join(root, 'scripts/sound-prompts.json'), 'utf8'));
const args = process.argv.slice(2);
const dry = args.includes('--dry-run');
const only = args.includes('--set') ? args[args.indexOf('--set') + 1] : null;
const RAW = join(root, 'generador_sounds/raw');

function readKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY;
  const f = join(root, '.env.local');
  if (!existsSync(f)) return null;
  const m = readFileSync(f, 'utf8').match(/^\s*ELEVENLABS_API_KEY\s*=\s*["']?([^"'\s]+)/m);
  return m ? m[1] : null;
}

const jobs = [];
for (const [set, s] of Object.entries(cfg.sets)) {
  if (only && set !== only) continue;
  s.prompts.forEach((prompt, pi) => {
    for (let k = 0; k < s.takes; k++) {
      const out = join(RAW, set, `${set}-p${pi}-t${k}.wav`);
      jobs.push({ set, out, body: { text: prompt + cfg.suffix, duration_seconds: s.duration_seconds, prompt_influence: s.prompt_influence, model_id: cfg.model_id } });
    }
  });
}
const todo = jobs.filter((j) => !existsSync(j.out));
const seconds = todo.reduce((a, j) => a + j.body.duration_seconds, 0);
console.log(`${jobs.length} takes defined, ${todo.length} to generate, ${seconds.toFixed(1)} s of audio`);
if (dry || !todo.length) process.exit(0);

const key = readKey();
if (!key) { console.error('ELEVENLABS_API_KEY not found (set it in .env.local). Nothing generated.'); process.exit(1); }

async function gen(job, attempt = 0) {
  const res = await fetch(`https://api.elevenlabs.io/v1/sound-generation?output_format=${cfg.output_format}`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'content-type': 'application/json', accept: 'audio/wav' },
    body: JSON.stringify(job.body),
  });
  if ((res.status === 429 || res.status >= 500) && attempt < 4) {
    await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
    return gen(job, attempt + 1);
  }
  if (!res.ok) throw new Error(`${job.set}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  mkdirSync(dirname(job.out), { recursive: true });
  writeFileSync(job.out, Buffer.from(await res.arrayBuffer()));
  console.log('ok', job.out.replace(root + '/', ''));
}

const queue = [...todo];
const workers = Array.from({ length: 3 }, async () => { while (queue.length) await gen(queue.shift()); });
try { await Promise.all(workers); } catch (e) { console.error(e.message); process.exit(1); }
