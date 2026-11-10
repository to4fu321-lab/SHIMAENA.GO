#!/usr/bin/env bash
# 仮の声（合成音声）の道具を用意する。1回だけ。約 5GB・10分（CPU だけで動く）。
#   bash scripts/video-v3/tts/setup.sh
# 要るもの: uv（https://docs.astral.sh/uv/）・curl・ffmpeg。Python は 3.12 を使う（uv が入れる）。
set -euo pipefail
cd "$(dirname "$0")"
uv venv --python 3.12 venv
uv pip install --python venv/bin/python torch --index-url https://download.pytorch.org/whl/cpu
uv pip install --python venv/bin/python style-bert-vits2==2.5.0 faster-whisper
# 読みの辞書は pyopenjtalk-plus を使う（pyopenjtalk-dict は numpy 2 で動かない）
uv pip uninstall --python venv/bin/python pyopenjtalk-dict || true
uv pip install --python venv/bin/python pyopenjtalk-plus
# 声のモデル（Aivis のモデルハブ。語り morioki・孫の声 まい）
./download_models.sh
# ことばのモデル（BERT）と、読み間違いを確かめる用の音声認識（Whisper medium）
venv/bin/python - <<'PY'
from huggingface_hub import snapshot_download
snapshot_download("ku-nlp/deberta-v2-large-japanese-char-wwm", local_dir="models/bert/deberta-v2-large-japanese-char-wwm",
    allow_patterns=["config.json", "model.safetensors", "special_tokens_map.json", "tokenizer_config.json", "vocab.txt"])
snapshot_download("Systran/faster-whisper-medium", local_dir="models/whisper/faster-whisper-medium",
    allow_patterns=["config.json", "model.bin", "tokenizer.json", "vocabulary.txt"])
PY
echo "できた。ためしに: venv/bin/python synth.py --model morioki --text 'こんにちは。' --out test.wav"
