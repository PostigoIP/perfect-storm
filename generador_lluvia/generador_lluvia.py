import numpy as np
import soundfile as sf
import librosa
from scipy.signal import butter, sosfilt
from pedalboard import Pedalboard, Reverb, HighpassFilter, LowpassFilter
import random
import os

def load_drop(filepath):
    y, sr = librosa.load(filepath, sr=None)
    return y, sr

def trim_drop(y):
    yt, _ = librosa.effects.trim(y, top_db=30)
    return yt

def pitch_shift_fast(y, sr, n_steps):
    return librosa.effects.pitch_shift(y, sr=sr, n_steps=n_steps)

def apply_filter(y, sr, btype, cutoff):
    sos = butter(4, cutoff, btype=btype, fs=sr, output='sos')
    return sosfilt(sos, y)

def create_variations(y, sr, num_variations=15):
    variations = []
    for _ in range(num_variations):
        pitch = random.uniform(-5, 5)
        var_y = pitch_shift_fast(y, sr, pitch)
        variations.append(var_y)
    return variations

def render_layer(variations, sr, duration, num_drops, volume_range, filter_type=None, filter_cutoff=None):
    canvas_length = int(duration * sr)
    canvas = np.zeros((2, canvas_length))
    
    for _ in range(num_drops):
        drop = random.choice(variations)
        
        if filter_type and filter_cutoff:
            drop = apply_filter(drop, sr, filter_type, filter_cutoff)
            
        vol = random.uniform(volume_range[0], volume_range[1])
        drop = drop * vol
        
        pan = random.uniform(0, 1)
        left = drop * (1 - pan)
        right = drop * pan
        
        start_sample = random.randint(0, canvas_length - len(drop) - 1)
        end_sample = start_sample + len(drop)
        
        canvas[0, start_sample:end_sample] += left
        canvas[1, start_sample:end_sample] += right
        
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

def main():
    print("Loading drop...")
    drop, sr = load_drop("drop.wav")
    print(f"Sample rate: {sr}")
    
    print("Trimming drop...")
    drop = trim_drop(drop)
    
    print("Generating variations (pitch shifting)...")
    variations = create_variations(drop, sr, num_variations=15)
    
    duration = 30 # seconds
    
    print("Rendering sparse drops layer...")
    sparse = render_layer(variations, sr, duration, num_drops=150, volume_range=(0.4, 0.8))
    
    print("Rendering fine rain layer...")
    fine = render_layer(variations, sr, duration, num_drops=3000, volume_range=(0.05, 0.15), filter_type='high', filter_cutoff=3000)
    
    print("Rendering heavy drops layer...")
    heavy = render_layer(variations, sr, duration, num_drops=800, volume_range=(0.2, 0.5), filter_type='low', filter_cutoff=1000)
    
    print("Adding noise bed...")
    noise = add_filtered_noise_bed(sr, duration, volume=0.01, cutoff=800)
    
    print("Mixing layers...")
    mix = sparse + fine + heavy + noise
    
    # Normalize mix to prevent clipping before effects
    max_val = np.max(np.abs(mix))
    if max_val > 0:
        mix = mix / max_val * 0.8
        
    print("Applying reverb and EQ...")
    final = apply_effects(mix, sr)
    
    print("Exporting rain_build.wav...")
    sf.write("rain_build.wav", final.T, sr)
    print("Done! 🎉")

if __name__ == "__main__":
    main()
