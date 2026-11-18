"""Cut individual thunder events (a clap plus its roll) out of long thunder recordings.
Usage: python3 scripts/cut-thunder.py <out_dir> <file> [<file> ...]   → out_dir/thunder-<k>.mp3 (6–8 s each)"""
import os, subprocess, sys
import numpy as np
SR = 44100
def decode(p):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'], check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2)
out, files = sys.argv[1], sys.argv[2:]
os.makedirs(out, exist_ok=True)
k = 0
for f in files:
    x = decode(f); m = x.mean(axis=1)
    hop = int(0.05 * SR); n = len(m) // hop
    env = 20 * np.log10(np.sqrt((m[: n * hop].reshape(n, hop) ** 2).mean(axis=1)) + 1e-9)
    bg = np.convolve(env, np.ones(60) / 60, 'same')          # ~3 s running mean
    cand = [i for i in range(1, n - 1) if env[i] > bg[i] + 6 and env[i] >= env[i - 1] and env[i] >= env[i + 1]]
    cand.sort(key=lambda i: -(env[i] - bg[i]))
    kept = []
    for i in cand:
        if all(abs(i - j) * 0.05 > 9 for j in kept): kept.append(i)
        if len(kept) >= 4: break
    for i in sorted(kept):
        a = max(0, i * hop - int(0.4 * SR)); b = min(len(x), a + int(7.5 * SR))
        seg = x[a:b].copy()
        seg *= 10 ** (-1 / 20) / max(1e-6, np.abs(seg).max())
        fade = np.linspace(1, 0, int(1.2 * SR))[:, None]; seg[-len(fade):] *= fade
        seg[: int(0.05 * SR)] *= np.linspace(0, 1, int(0.05 * SR))[:, None]
        name = os.path.join(out, f'thunder-{k}.mp3'); k += 1
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', '-c:a', 'libmp3lame', '-b:a', '160k', name], input=seg.astype(np.float32).tobytes(), check=True)
        print(os.path.basename(f), f'clap at {i * 0.05:.1f} s (+{env[i] - bg[i]:.1f} dB) →', os.path.basename(name))
