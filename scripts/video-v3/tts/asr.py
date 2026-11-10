#!/usr/bin/env python3
"""
Transcribe wav files in Japanese with faster-whisper (CPU, int8) to check TTS pronunciation.

  venv/bin/python asr.py out/*.wav
  venv/bin/python asr.py --model small out/a.wav       # small | medium (default) | large-v3 | path
  venv/bin/python asr.py --json out/*.wav > asr.json   # machine readable (with a kana version)
  venv/bin/python asr.py --check out/manifest.json     # compare with the text in synth.py's manifest

Prints:  <file>\t<transcript>
With --check each line also gets a 0..1 score (kana similarity of what was asked vs. what was heard)
and the differing parts, e.g.  ュー[ゴ>モ]ネン  = asked ゴ, heard モ.  ok = identical reading,
minor = 1-2 morae differ (often the ASR, not the voice: confirm with --model large-v3), CHECK = below 0.95.
New words (product names) and very short clips score low even when the audio is fine.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
WHISPER_DIR = HERE / "models" / "whisper"
os.environ.setdefault("HF_HOME", str(HERE / ".cache" / "hf"))  # keep downloads inside this folder


def to_kana(text: str) -> str:
    """Katakana reading of a transcript (so 15年 and 十五年 compare equal). Best effort."""
    try:
        import pyopenjtalk

        return pyopenjtalk.g2p(text, kana=True).replace("ヲ", "オ").replace("、", "").replace("。", "")
    except Exception:
        return ""


def kana_diff(expected_text: str, heard_text: str) -> tuple[float, str]:
    """similarity (0..1) of the two katakana readings + the parts that differ ('asked>heard')."""
    import difflib

    a, b = to_kana(expected_text), to_kana(heard_text)
    sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
    parts = []
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag != "equal":
            lo, hi = max(0, i1 - 2), min(len(a), i2 + 2)
            parts.append(f"{a[lo:i1]}[{a[i1:i2]}>{b[j1:j2]}]{a[i2:hi]}")
    return round(sm.ratio(), 3), "  ".join(parts)


def decode_16k(path: str):
    """Decode any audio file to 16 kHz mono float32 with ffmpeg.
    (faster-whisper 1.2.1's own decoder does not work with the PyAV version that pip installs here.)"""
    import subprocess

    import numpy as np

    cmd = ["ffmpeg", "-nostdin", "-v", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", "16000", "-"]
    raw = subprocess.run(cmd, check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("wavs", nargs="*")
    ap.add_argument("--check", metavar="MANIFEST", help="manifest.json written by synth.py --batch: "
                    "transcribe its files and compare with the requested text")
    ap.add_argument("--model", default="medium", help="small | medium | large-v3 | local path (default medium)")
    ap.add_argument("--beam", type=int, default=5)
    ap.add_argument("--threads", type=int, default=os.cpu_count() or 4)
    ap.add_argument("--json", action="store_true", help="print one JSON list instead of tab separated lines")
    ap.add_argument("--kana", action="store_true", help="also print a katakana reading of each transcript")
    a = ap.parse_args()

    expected = {}
    if a.check:
        for m in json.loads(Path(a.check).read_text(encoding="utf-8")):
            expected[m["file"]] = m["text"]
        a.wavs = list(expected) + a.wavs
    if not a.wavs:
        ap.error("give wav files or --check manifest.json")

    os.environ.setdefault("HF_HUB_DISABLE_PROGRESS_BARS", "1")
    from faster_whisper import WhisperModel

    local = WHISPER_DIR / f"faster-whisper-{a.model}"
    if Path(a.model).is_dir():
        src = a.model
    elif (local / "model.bin").exists():
        src = str(local)
    else:  # first use of this size: download from Hugging Face into models/whisper/
        from huggingface_hub import snapshot_download

        local.mkdir(parents=True, exist_ok=True)
        src = snapshot_download(f"Systran/faster-whisper-{a.model}", local_dir=str(local))
    model = WhisperModel(src, device="cpu", compute_type="int8", cpu_threads=a.threads)

    results = []
    for wav in a.wavs:
        t0 = time.time()
        segments, info = model.transcribe(
            decode_16k(wav), language="ja", beam_size=a.beam, temperature=0.0,
            condition_on_previous_text=False, vad_filter=False,
        )
        text = "".join(s.text for s in segments).strip()
        row = {"file": wav, "text": text, "audio_seconds": round(info.duration, 2),
               "asr_seconds": round(time.time() - t0, 1)}
        if a.kana or a.json:
            row["kana"] = to_kana(text)
        if wav in expected:
            row["expected"] = expected[wav]
            row["score"], row["diff"] = kana_diff(expected[wav], text)
        results.append(row)
        if not a.json:
            print(f"{wav}\t{text}", flush=True)
            if wav in expected:
                flag = "ok   " if row["score"] == 1.0 else ("minor" if row["score"] >= 0.95 else "CHECK")
                print(f"    {flag} score={row['score']:.2f}  {row['diff']}", flush=True)
            if a.kana:
                print(f"    kana: {row['kana']}", flush=True)
    if a.json:
        print(json.dumps(results, ensure_ascii=False, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
