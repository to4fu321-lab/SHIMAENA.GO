# 隊長の声を作る VOICEVOX ENGINE を、Hugging Face Spaces（Docker・無料の CPU）で動かす（spec v1.37）。
# 使い方は docs/setup.md の「隊長の声」。この Dockerfile と同じ場所の README.md を、Space にそのまま置く。
FROM voicevox/voicevox_engine:cpu-latest

# Spaces はユーザー ID 1000 で動かす（root ではない）。元のイメージの入口（gosu で user に切り替える）は root が要るので使わず、
# user（ID 1000）のまま ENGINE を直接起動する
RUN [ "$(id -u user)" = "1000" ] || usermod -u 1000 user
USER user
ENV HOME=/home/user

# 50021 は VOICEVOX ENGINE の決まったポート。README.md の app_port と合わせる
EXPOSE 50021
ENTRYPOINT ["/opt/voicevox_engine/run", "--host", "0.0.0.0", "--port", "50021", "--cors_policy_mode", "all"]
