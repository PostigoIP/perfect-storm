"""Band-energy profile of audio files (share of energy per band, and centroid).
Usage: python3 tools/spectrum.py file1 [file2 ...]"""
import subprocess, sys
import numpy as np
SR = 44100
BANDS = [(20, 250), (250, 1000), (1000, 4000), (4000, 10000), (10000, 20000)]
def dec(p, secs=None):
    args = ['ffmpeg', '-v', 'error', '-i', p, '-ac', '1', '-ar', str(SR)] + (['-t', str(secs)] if secs else []) + ['-f', 'f32le', '-']
    return np.frombuffer(subprocess.run(args, check=True, capture_output=True).stdout, dtype=np.float32)
print(f"{'file':42} " + ' '.join(f'{a}-{b}Hz'.rjust(11) for a, b in BANDS) + '   centroid')
for p in sys.argv[1:]:
    x = dec(p, 60)
    n = 8192; frames = [x[i:i + n] * np.hanning(n) for i in range(0, len(x) - n, n // 2)]
    P = np.mean([np.abs(np.fft.rfft(f)) ** 2 for f in frames], axis=0); f = np.fft.rfftfreq(n, 1 / SR)
    tot = P[(f >= 20)].sum()
    shares = [P[(f >= a) & (f < b)].sum() / tot for a, b in BANDS]
    cen = (P * f).sum() / P.sum()
    print(f"{p.split('/')[-1][:42]:42} " + ' '.join(f'{100 * s:10.1f}%' for s in shares) + f'   {cen:6.0f} Hz')
