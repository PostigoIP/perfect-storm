import numpy as np
import soundfile as sf
import librosa
from scipy.signal import butter, sosfilt
from pedalboard import Pedalboard, Reverb, HighpassFilter, LowpassFilter
import random
import os
import glob

def trim_drop(y):
    yt, _ = librosa.effects.trim(y, top_db=30)
    return yt

def pitch_shift_fast(y, sr, n_steps):
    return librosa.effects.pitch_shift(y, sr=sr, n_steps=n_steps)

def apply_filter(y, sr, btype, cutoff):
    sos = butter(4, cutoff, btype=btype, fs=sr, output='sos')
    return sosfilt(sos, y)

def create_variations(y, sr, num_variations=10):
    variations = []
    for _ in range(num_variations):
        pitch = random.uniform(-5, 5)
        var_y = pitch_shift_fast(y, sr, pitch)
        variations.append(var_y)
    return variations

def render_layer(variations, sr, duration, num_drops, volume_range, filter_type=None, filter_cutoff=None):
    canvas_length = int(duration * sr)
    canvas = np.zeros((2, canvas_length))
    if not variations:
        return canvas
    
    for _ in range(num_drops):
        drop = random.choice(variations)
        
        if filter_type and filter_cutoff:
            drop = apply_filter(drop, sr, filter_type, filter_cutoff)
            
        vol = random.uniform(volume_range[0], volume_range[1])
        drop = drop * vol
        
        pan = random.uniform(0, 1)
        left = drop * (1 - pan)
        right = drop * pan
        
        start_sample = random.randint(0, max(0, canvas_length - len(drop) - 1))
        slice_len = min(len(drop), canvas_length - start_sample)
        if slice_len <= 0: continue
        
        canvas[0, start_sample:start_sample+slice_len] += left[:slice_len]
        canvas[1, start_sample:start_sample+slice_len] += right[:slice_len]
        
    return canvas

def add_filtered_noise_bed(sr, duration, volume, cutoff):
    canvas_length = int(duration * sr)
    noise = np.random.normal(0, 1, (2, canvas_length))
    noise[0] = apply_filter(noise[0], sr, 'low', cutoff)
    noise[1] = apply_filter(noise[1], sr, 'low', cutoff)
    return noise * volume

def apply_effects(canvas, sr):
    board = Pedalboard([
        HighpassFilter(cutoff_frequency_hz=100),
        LowpassFilter(cutoff_frequency_hz=10000),
        Reverb(room_size=0.6, wet_level=0.3, dry_level=0.8),
    ])
    effected = board(canvas, sr)
    return effected

def generate_rain(sources, output_path, sr=44100, duration=20):
    print(f"\nGenerating rain for: {os.path.basename(output_path)}")
    print(f"Sources: {[os.path.basename(s) for s in sources]}")
    
    all_variations = []
    
    for src in sources:
        try:
            drop, file_sr = librosa.load(src, sr=sr)
            drop = trim_drop(drop)
            vars = create_variations(drop, sr, num_variations=10) # 10 to speed up
            all_variations.extend(vars)
        except Exception as e:
            print(f"Error processing {src}: {e}")
            
    if not all_variations:
        print("No valid variations created. Skipping.")
        return
        
    # Scale num_drops based on duration so density is the same
    dur_ratio = duration / 30.0
    
    sparse = render_layer(all_variations, sr, duration, num_drops=int(150*dur_ratio), volume_range=(0.4, 0.8))
    fine = render_layer(all_variations, sr, duration, num_drops=int(3000*dur_ratio), volume_range=(0.05, 0.15), filter_type='high', filter_cutoff=3000)
    heavy = render_layer(all_variations, sr, duration, num_drops=int(800*dur_ratio), volume_range=(0.2, 0.5), filter_type='low', filter_cutoff=1000)
    noise = add_filtered_noise_bed(sr, duration, volume=0.01, cutoff=800)
    
    mix = sparse + fine + heavy + noise
    max_val = np.max(np.abs(mix))
    if max_val > 0:
        mix = mix / max_val * 0.8
        
    final = apply_effects(mix, sr)
    sf.write(output_path, final.T, sr)
    print(f"Saved to {output_path}")

def main():
    base_dir = "."
    sources_dir = os.path.join(base_dir, "sources")
    indiv_dir = os.path.join(base_dir, "resultados_individuales")
    comb_dir = os.path.join(base_dir, "resultados_combinados")
    
    os.makedirs(indiv_dir, exist_ok=True)
    os.makedirs(comb_dir, exist_ok=True)
    
    all_files = sorted(glob.glob(os.path.join(sources_dir, "*")))
    
    # 1. Individual outputs
    for file in all_files:
        name = os.path.splitext(os.path.basename(file))[0]
        out_path = os.path.join(indiv_dir, f"rain_{name}.wav")
        generate_rain([file], out_path, duration=15)
        
    # 2. Combinations
    floraphonics = [f for f in all_files if "floraphonic" in os.path.basename(f).lower()]
    wav_drops = [f for f in all_files if "water-droplet" in os.path.basename(f).lower() and not "floraphonic" in os.path.basename(f).lower()]
    
    if len(floraphonics) > 1:
        generate_rain(floraphonics, os.path.join(comb_dir, "rain_comb_floraphonics.wav"), duration=20)
    
    if len(wav_drops) > 1:
        generate_rain(wav_drops, os.path.join(comb_dir, "rain_comb_wav_drops.wav"), duration=20)
        
    if len(all_files) > 1:
        generate_rain(all_files, os.path.join(comb_dir, "rain_comb_all_drops.wav"), duration=30)
        
    print("\nAll generations completed! 🎉")

if __name__ == "__main__":
    main()
