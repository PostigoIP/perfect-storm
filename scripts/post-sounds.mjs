// Turn raw ElevenLabs takes into the shipped bank: trim, fade, normalise, encode, manifest.
// Usage: node scripts/post-sounds.mjs        (reads generador_sounds/raw, writes public/sounds)
import { readdirSync, existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateManifest, DROP_SETS, MAX_DROP_SECONDS } from './manifest.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = join(root, 'generador_sounds/raw');
const OUT = join(root, 'public/sounds');
const rejectsFile = join(root, 'scripts/rejects.json');
const rejects = new Set(existsSync(rejectsFile) ? JSON.parse(readFileSync(rejectsFile, 'utf8')) : []);

const ff = (args) => execFileSync('ffmpeg', ['-hide_banner', '-nostdin', '-y', ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
function maxVolume(file) {
  const err = execFileSync('sh', ['-c', `ffmpeg -hide_banner -nostdin -i "${file}" -af volumedetect -f null - 2>&1 | grep max_volume`], { encoding: 'utf8' });
  return parseFloat(err.match(/max_volume:\s*(-?[\d.]+)/)[1]);
}
const duration = (file) => parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' }));

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const manifest = { version: 1, sets: {}, durations: {}, source: 'ElevenLabs Sound Effects (eleven_text_to_sound_v3), prompts in scripts/sound-prompts.json' };
const tmp = join(root, 'generador_sounds/tmp');
mkdirSync(tmp, { recursive: true });

for (const set of readdirSync(RAW)) {
  const isDrop = DROP_SETS.includes(set);
  const takes = readdirSync(join(RAW, set)).filter((f) => f.endsWith('.wav') && !rejects.has(f.replace('.wav', ''))).sort();
  manifest.sets[set] = [];
  takes.forEach((f, i) => {
    const src = join(RAW, set, f);
    const mid = join(tmp, `${set}-${i}.wav`);
    const maxLen = isDrop ? MAX_DROP_SECONDS - 0.05 : 12;
    const pre = (isDrop ? -3 : -1) - maxVolume(src);     // normalise first so trimming is relative to the take
    const chain = [
      `volume=${pre.toFixed(2)}dB`,
      'silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.003',
      'areverse', 'silenceremove=start_periods=1:start_threshold=-60dB:start_silence=0.02', 'areverse',
      `atrim=0:${maxLen}`,
      'afade=t=in:d=0.002',
    ].join(',');
    ff(['-i', src, '-af', chain, '-ac', isDrop ? '1' : '2', '-ar', '44100', mid]);
    const d = duration(mid);
    const fadeOut = isDrop ? Math.min(0.06, d * 0.3) : 1.2;
    const gain = (isDrop ? -3 : -1) - maxVolume(mid);
    const name = isDrop ? `${set}-${i}.wav` : `${set}-${i}.mp3`;
    const out = join(OUT, name);
    const af = `afade=t=out:st=${Math.max(0, d - fadeOut).toFixed(3)}:d=${fadeOut.toFixed(3)},volume=${gain.toFixed(2)}dB`;
    ff(['-i', mid, '-af', af, ...(isDrop ? ['-c:a', 'pcm_s16le'] : ['-c:a', 'libmp3lame', '-b:a', '192k']), out]);
    manifest.sets[set].push(name);
    manifest.durations[name] = +duration(out).toFixed(3);
    console.log(`${set}/${f} → ${name} ${manifest.durations[name]} s, gain ${gain.toFixed(1)} dB`);
  });
}
rmSync(tmp, { recursive: true, force: true });
const errs = validateManifest(manifest, (f) => existsSync(join(OUT, f)));
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
if (errs.length) { console.error('manifest problems:\n ' + errs.join('\n ')); process.exit(1); }
console.log('manifest ok:', Object.entries(manifest.sets).map(([k, v]) => `${k} ${v.length}`).join(', '));
