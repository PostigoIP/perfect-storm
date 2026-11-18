"""Ask an audio-capable model (Gemini 4 Argon via the Antigravity CLI `agy`) to listen.

It hears a real-rain reference and one or more rendered clips, and returns JSON:
realism scores, artifacts with timestamps, likely causes, and concrete fixes in
terms of the engine's parameters. Runs in an empty temp folder; stdin is closed.

Usage: python3 tools/listen.py --ref <real.wav> <clip.wav> [<clip.wav> ...] [--model "Gemini 4 Argon (High)"]
"""
import json, os, shutil, subprocess, sys, tempfile

AGY = '/Users/ignaciopostigo/.local/bin/agy'

ENGINE = """How the clips are made: a simulated epidemic; every new case triggers one 'grain' — a short slice
(0.2–0.5 s, starts ~15 ms before a detected drop impact) cut from a long real rain recording of that
lineage's surface (leaves, glass, stone, metal). Per grain: playback rate 0.97–1.03 (detune), gain by
severity, low-pass 7–18 kHz, stereo pan, envelope = 4 ms fade-in, hold to 45% of length, exponential
fade-out to the end. Grains go to near/mid/far buses (far = high-pass 500 Hz + low-pass 3.2 kHz, quieter),
plus a generated 2.6 s reverb (send ~0.02–0.15). When density rises, per-grain gain falls ~1/sqrt(rate)
and at most 96 grains start per 0.5 s. Source recordings were high-passed at 300 Hz (4th order).
Master: compressor (-18 dB, 3:1) then limiter (-4 dB, 20:1)."""

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
