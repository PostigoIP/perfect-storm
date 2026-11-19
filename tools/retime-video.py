"""Put each frame of a Playwright recording back at its real time, using the timecode
strip that tools/record-teaser.mjs paints in the bottom-right corner (24 cells of 8 px,
Date.now() in 5 ms steps). Writes frames/ and a concat list whose times are seconds from
the film's start, then renders a constant-30-fps video with the strip painted over.

    python tools/retime-video.py <takeDir>    # needs video.webm and events.json
"""
import json, subprocess, sys, os
import numpy as np

take = sys.argv[1]
meta = json.load(open(f'{take}/events.json'))
W, H = 1280, 720
frames_dir = f'{take}/frames'
os.makedirs(frames_dir, exist_ok=True)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f'{take}/video.webm', '-fps_mode', 'passthrough',
                f'{frames_dir}/%05d.png'], check=True)
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', f'{take}/video.webm', '-fps_mode', 'passthrough',
                      '-vf', f'crop=192:8:{W - 192}:{H - 8},format=gray', '-f', 'rawvideo', '-'],
                     capture_output=True, check=True).stdout
strip = np.frombuffer(raw, dtype=np.uint8).reshape(-1, 8, 192)
bits = strip[:, 2:6, :].mean(axis=1).reshape(-1, 24, 8)[:, :, 2:6].mean(axis=2) > 128
vals = (bits * (1 << np.arange(23, -1, -1))).sum(axis=1)
t = vals * 0.005 + meta['tcOffset']                      # seconds from the film's start
names = sorted(os.listdir(frames_dir))
assert len(names) == len(t), (len(names), len(t))
# keep frames whose code moves forward (drops the load screen and any misread)
keep, last = [], -1e9
for i, x in enumerate(t):
    if x > last and x - last < 5 or (last < -1e8 and abs(x) < 60):
        keep.append(i); last = x
print(f'{len(keep)}/{len(t)} frames, film time {t[keep[0]]:.2f} → {t[keep[-1]]:.2f} s')
with open(f'{take}/frames.txt', 'w') as f:
    for a, b in zip(keep, keep[1:] + [None]):
        dur = (t[b] - t[a]) if b is not None else 0.04
        f.write(f"file 'frames/{names[a]}'\nduration {dur:.4f}\n")
    f.write(f"file 'frames/{names[keep[-1]]}'\n")
json.dump({'first': float(t[keep[0]])}, open(f'{take}/retime.json', 'w'))
