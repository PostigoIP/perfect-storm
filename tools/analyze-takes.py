# Objective check of raw one-shot takes: onset, peak, decay, noise floor, brightness.
# Usage: python3 tools/analyze-takes.py generador_sounds/raw/<set>
import sys, wave, glob, os
import numpy as np

def load(p):
    with wave.open(p) as w:
        n, ch, sr, sw = w.getnframes(), w.getnchannels(), w.getframerate(), w.getsampwidth()
        x = np.frombuffer(w.readframes(n), dtype={2: np.int16, 4: np.int32}[sw]).astype(np.float64)
        x /= float(2 ** (8 * sw - 1))
        return x.reshape(-1, ch).mean(axis=1), sr

def db(v): return 20 * np.log10(max(v, 1e-9))

rows = []
for p in sorted(glob.glob(os.path.join(sys.argv[1], '*.wav'))):
    x, sr = load(p)
    a = np.abs(x); peak = a.max(); ip = int(a.argmax())
    env = np.convolve(a, np.ones(int(sr * .005)) / int(sr * .005), 'same')
    onset = int(np.argmax(env > peak * 0.1)) / sr
    rms = lambda s: np.sqrt(np.mean(s ** 2)) if len(s) else 0
    head = rms(x[ip:ip + int(sr * .05)]); tail = rms(x[-int(sr * .08):])
    # time for the envelope to fall 30 dB below peak after the peak
    below = np.where(env[ip:] < peak * 10 ** (-30 / 20))[0]
    decay = below[0] / sr if len(below) else float('nan')
    seg = x[ip:ip + int(sr * .1)]
    spec = np.abs(np.fft.rfft(seg * np.hanning(len(seg)))); f = np.fft.rfftfreq(len(seg), 1 / sr)
    centroid = (spec * f).sum() / max(spec.sum(), 1e-9)
    rows.append((os.path.basename(p), onset, db(peak), decay, db(tail) - db(head), centroid))
print(f"{'take':22} onset  peak_dB  decay30  tail_vs_head_dB  centroid_Hz")
for r in rows:
    flag = []
    if r[1] > 0.15: flag.append('late onset')
    if r[4] > -25: flag.append('noisy tail')
    if np.isnan(r[3]): flag.append('never decays')
    print(f"{r[0]:22} {r[1]:.3f}  {r[2]:6.1f}  {r[3]:.3f}    {r[4]:6.1f}          {r[5]:6.0f}  {' '.join(flag)}")
