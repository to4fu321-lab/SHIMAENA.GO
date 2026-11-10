#!/usr/bin/env python3
"""
Objective checks for wav files: sample rate, duration, peak, RMS, clipping, lead/tail silence, mean F0.

  venv/bin/python analyze.py out/*.wav            # table
  venv/bin/python analyze.py --json out/*.wav
"""
from __future__ import annotations

import argparse
import json
import sys
import wave

import numpy as np


def load(path: str):
    with wave.open(path, "rb") as w:
        sr, ch, sw, n = w.getframerate(), w.getnchannels(), w.getsampwidth(), w.getnframes()
        raw = w.readframes(n)
    if sw != 2:
        raise SystemExit(f"{path}: only 16-bit PCM wav is supported")
    x = np.frombuffer(raw, dtype="<i2").reshape(-1, ch)
    return sr, ch, x


def analyze(path: str) -> dict:
    import pyworld

    sr, ch, pcm = load(path)
    mono = pcm.mean(axis=1) / 32768.0
    peak = float(np.abs(pcm).max()) / 32768.0
    clipped = int((np.abs(pcm.astype(np.int32)) >= 32767).sum())
    rms = float(np.sqrt(np.mean(mono**2)))
    # silence = below -45 dBFS in 10 ms frames
    hop = sr // 100
    frames = mono[: len(mono) // hop * hop].reshape(-1, hop)
    loud = np.sqrt((frames**2).mean(axis=1)) > 10 ** (-45 / 20)
    frame_db = 20 * np.log10(np.maximum(np.sqrt((frames**2).mean(axis=1)), 1e-9))
    noise_floor = float(np.percentile(frame_db, 5)) if len(frame_db) else -180.0
    idx = np.flatnonzero(loud)
    lead = float(idx[0] * hop / sr) if idx.size else 0.0
    tail = float((len(loud) - 1 - idx[-1]) * hop / sr) if idx.size else 0.0
    f0, _ = pyworld.harvest(mono.astype(np.float64), sr, f0_floor=60.0, f0_ceil=700.0, frame_period=10.0)
    voiced = f0[f0 > 0]
    return {
        "file": path,
        "sample_rate": sr,
        "channels": ch,
        "duration": round(len(mono) / sr, 2),
        "peak_dbfs": round(20 * np.log10(max(peak, 1e-9)), 2),
        "rms_dbfs": round(20 * np.log10(max(rms, 1e-9)), 1),
        "clipped_samples": clipped,
        "lead_silence": round(lead, 2),
        "tail_silence": round(tail, 2),
        "f0_mean_hz": round(float(voiced.mean()), 1) if voiced.size else None,
        "f0_median_hz": round(float(np.median(voiced)), 1) if voiced.size else None,
        "f0_p05_p95_hz": [round(float(np.percentile(voiced, 5)), 1), round(float(np.percentile(voiced, 95)), 1)]
        if voiced.size else None,
        "voiced_ratio": round(float(voiced.size / max(len(f0), 1)), 2),
        # share of voiced frames far below the median pitch (creaky voice / octave jumps)
        "f0_low_outliers": round(float((voiced < 0.6 * np.median(voiced)).mean()), 3) if voiced.size else None,
        # level of the quietest 5% of 10 ms frames: about -90 = digital silence, > -60 = audible room noise
        "noise_floor_dbfs": round(noise_floor, 1),
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("wavs", nargs="+")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()
    rows = [analyze(w) for w in a.wavs]
    if a.json:
        print(json.dumps(rows, ensure_ascii=False, indent=1))
        return 0
    print("file\tsr\tch\tdur\tpeak_dB\trms_dB\tclipped\tlead\ttail\tf0_mean\tf0_med\tf0_5-95%\tf0_low\tfloor_dB")
    for r in rows:
        rng = "-".join(str(v) for v in r["f0_p05_p95_hz"]) if r["f0_p05_p95_hz"] else "-"
        print(f"{r['file']}\t{r['sample_rate']}\t{r['channels']}\t{r['duration']}\t{r['peak_dbfs']}\t{r['rms_dbfs']}\t"
              f"{r['clipped_samples']}\t{r['lead_silence']}\t{r['tail_silence']}\t{r['f0_mean_hz']}\t"
              f"{r['f0_median_hz']}\t{rng}\t{r['f0_low_outliers']}\t{r['noise_floor_dbfs']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
