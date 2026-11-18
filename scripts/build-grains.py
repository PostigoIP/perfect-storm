"""Build a grain bank from long rain recordings.

For each surface folder of long recordings, find the individual drop impacts
(onsets), keep the clearest ones, and write:
  public/<out>/<surface>-<k>.mp3   the recording (stereo, 44.1 kHz, 192 kbps)
  public/<out>/manifest.json       version 2: per surface, files with onset times + strength

Each simulated case later plays one grain: a short slice of a real recording
starting just before one real impact, carrying its real background with it.

Usage: python3 scripts/build-grains.py <raw_dir> <out_dir_under_public> [--max-per-file 220]
  raw_dir contains <surface>/<name>.wav|.mp3|.flac  (surfaces: stone glass metal leaf)
"""
import json, os, subprocess, sys
import numpy as np

SR = 44100
HOP = int(0.002 * SR)          # 2 ms envelope hop
MIN_GAP = 0.035                # s between kept onsets
PRE = 0.012                    # grain starts this long before the detected onset
RISE = float(os.environ.get('GRAIN_RISE_DB', '6'))   # dB above local background to count as an impact

def decode(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2)

def onsets(x, max_n):
    mono = x.mean(axis=1)
    # emphasise impacts: first difference acts as a gentle high-pass
    hp = np.diff(mono, prepend=mono[0])
    n = len(hp) // HOP
    env = np.sqrt((hp[: n * HOP].reshape(n, HOP) ** 2).mean(axis=1) + 1e-12)
    ldb = 20 * np.log10(env)
    # local background: running median over ~300 ms
    w = 150
    pad = np.pad(ldb, (w // 2, w // 2), mode='edge')
    bg = np.array([np.median(pad[i:i + w]) for i in range(0, len(ldb))])
    rise = ldb - bg
    flux = np.maximum(0, np.diff(ldb, prepend=ldb[0]))
    score = rise + 0.5 * flux
    cand = [i for i in range(2, len(score) - 2) if score[i] >= score[i - 1] and score[i] >= score[i + 1] and rise[i] > RISE]
    cand.sort(key=lambda i: -score[i])
    kept = []
    for i in cand:
        t = i * HOP / SR
        if all(abs(t - k[0]) >= MIN_GAP for k in kept):
            # walk back to where the rise starts (true onset)
            j = i
            while j > 0 and ldb[j - 1] < ldb[j] and ldb[i] - ldb[j - 1] < 18:
                j -= 1
            kept.append((max(0.0, j * HOP / SR - PRE), float(score[i])))
        if len(kept) >= max_n:
            break
    kept.sort()
    return kept

def main():
    raw_dir, out_name = sys.argv[1], sys.argv[2]
    max_n = int(sys.argv[sys.argv.index('--max-per-file') + 1]) if '--max-per-file' in sys.argv else 220
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out = os.path.join(root, 'public', out_name)
    os.makedirs(out, exist_ok=True)
    manifest = {'version': 2, 'type': 'grains', 'pre': PRE, 'sets': {}, 'source': raw_dir}
    for surface in sorted(os.listdir(raw_dir)):
        d = os.path.join(raw_dir, surface)
        if not os.path.isdir(d):
            continue
        entries = []
        for k, f in enumerate(sorted(x for x in os.listdir(d) if x.rsplit('.', 1)[-1] in ('wav', 'mp3', 'flac', 'ogg'))):
            x = decode(os.path.join(d, f))
            peak = float(np.abs(x).max()) or 1.0
            x = x * (10 ** (-1 / 20) / peak)          # normalise to -1 dBFS
            ons = onsets(x, max_n)
            name = f'{surface}-{k}.mp3'
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-',
                            '-c:a', 'libmp3lame', '-b:a', '192k', os.path.join(out, name)],
                           input=x.astype(np.float32).tobytes(), check=True)
            entries.append({'file': name, 'duration': round(len(x) / SR, 3),
                            'onsets': [round(t, 4) for t, _ in ons], 'strength': [round(s, 1) for _, s in ons], 'from': f})
            print(f'{surface}/{f}: {len(ons)} onsets over {len(x) / SR:.1f} s')
        manifest['sets'][surface] = entries
    thunder = sorted(f for f in os.listdir(out) if f.startswith('thunder-') and f.endswith('.mp3'))
    if thunder:
        manifest['oneshots'] = {'thunder': thunder}
    with open(os.path.join(out, 'manifest.json'), 'w') as fh:
        json.dump(manifest, fh)
    print('manifest written:', {k: sum(len(e['onsets']) for e in v) for k, v in manifest['sets'].items()})

if __name__ == '__main__':
    main()
