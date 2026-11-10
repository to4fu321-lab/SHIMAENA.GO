#!/usr/bin/env bash
# Download the AIVM (Safetensors) voice models from the public Aivis model hub (no auth needed).
set -u
mkdir -p "$(dirname "$0")/models/aivm"
cd "$(dirname "$0")/models/aivm"
dl() { # uuid slug
  local uuid="$1" slug="$2"
  if [ -s "$slug.aivm" ]; then echo "have $slug.aivm"; return; fi
  echo "downloading $slug ..."
  curl -sS -L --fail --retry 3 -o "$slug.aivm.part" \
    "https://api.aivis-project.com/v1/aivm-models/$uuid/download?model_type=AIVM" \
    && mv "$slug.aivm.part" "$slug.aivm" && ls -la "$slug.aivm"
}

dl baaae3c0-7b22-4605-8ba5-80c959b41a48 morioki

dl e9339137-2ae3-4d41-9394-fb757a7e61e6 mai

# 紹介動画 v4 の語り（アプリの隊長と同じ声: 雪降白華。Tαkoe プロジェクト）
dl 37e49039-522f-4608-b8d6-fc6716ada80e yukifuri

echo done
