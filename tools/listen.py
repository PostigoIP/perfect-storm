"""Ask an audio-capable model (Gemini 4 Argon via the Antigravity CLI `agy`) to listen.

It hears a real-rain reference and one or more rendered clips, and returns JSON:
realism scores, artifacts with timestamps, likely causes, and concrete fixes in
terms of the engine's parameters. Runs in an empty temp folder; stdin is closed.

Usage: python3 tools/listen.py --ref <real.wav> <clip.wav> [<clip.wav> ...] [--model "Gemini 4 Argon (High)"]
"""
import json, os, shutil, subprocess, sys, tempfile

AGY = '/Users/ignaciopostigo/.local/bin/agy'

ENGINE = """How the clips are made: a simulated epidemic; every new case triggers one short drop grain
(50–150 ms, starting ~3 ms before an impact, 3 ms attack, exponential decay) cut from CLEAN recordings of
isolated drips (drops into a puddle, dripping water 'plinks', drips on leaves), one set per virus lineage.
Per drop: distance d (most drops far): gain 0 to -24 dB, low-pass 18 kHz near → ~5 kHz far, reverb send
grows with distance; high-pass 250 Hz; playback rate 0.95–1.2; pan. At most ~28 distinct drops start per
second. A continuous bed of real rain recordings (looping) fades in with the case rate (silent below
2 drops/s, full at 50/s), its texture following the lineage mix. A very faint constant room tone avoids
digital silence. 0.4 s reverb; gentle master compression and a limiter; -3 dB shelf above 5 kHz.
Thunder = real thunder recordings plus mild saturated harmonics. Sparse silence at low case counts is
intentional: early in an outbreak only a few drops fall."""

def listen(ref, clips, model):
    d = tempfile.mkdtemp(prefix='listen-')
    try:
        names = []
        shutil.copy(ref, os.path.join(d, 'ref.wav'))
        for i, c in enumerate(clips):
            n = f'clip{i + 1}.wav'; shutil.copy(c, os.path.join(d, n)); names.append((n, os.path.basename(c)))
        files = ' '.join(f'@{os.path.join(d, n)}' for n, _ in names)
        prompt = f"""You are an expert sound designer and field recordist. Listen carefully.
Reference (a real rain field recording): @{os.path.join(d, 'ref.wav')}
Candidates (synthesised rain): {files}
{ENGINE}
For EACH candidate: rate realism 1-10 versus the reference; list the audible artifacts that make it
sound unlike rain (e.g. sizzle/frying pan, zaps, clicks, bricks/thuds, machine-gun repetition, phasing,
pumping), each with a timestamp and the most likely cause in the engine described above; then give the
3 most effective concrete changes to the engine parameters, ordered by impact.
If you cannot hear the audio, reply {{"error": "CANNOT_HEAR"}}.
Answer ONLY with JSON: {{"candidates": [{{"file": "clip1.wav", "realism": 0, "summary": "", "artifacts": [{{"t": "0:00", "what": "", "cause": ""}}], "fixes": [""]}}]}}"""
        r = subprocess.run([AGY, '-p', prompt, '--model', model], stdin=subprocess.DEVNULL, capture_output=True, text=True, cwd=d, timeout=600)
        t = r.stdout.strip()
        data = json.loads(t[t.find('{'): t.rfind('}') + 1])
        for c in data.get('candidates', []):
            c['source'] = dict(names).get(c.get('file'), c.get('file'))
        return data
    finally:
        shutil.rmtree(d, ignore_errors=True)

if __name__ == '__main__':
    a = sys.argv[1:]
    model = a[a.index('--model') + 1] if '--model' in a else 'Gemini 4 Argon (Medium)'
    if '--model' in a:
        i = a.index('--model'); del a[i:i + 2]
    ref = a[a.index('--ref') + 1]; i = a.index('--ref'); del a[i:i + 2]
    out = {'candidates': []}
    for clip in a:   # one clip per call keeps each call short and reliable
        try:
            out['candidates'] += listen(ref, [clip], model).get('candidates', [])
        except Exception as e:
            out['candidates'].append({'source': os.path.basename(clip), 'error': str(e)[:200]})
    print(json.dumps(out, indent=2, ensure_ascii=False))
