# 仮の声（合成音声）の道具

紹介動画 v3 のナレーションを、**本人の声を録るまでの代わり**に合成するための道具です。
パソコンの中だけで動きます（外のサービスに文を送りません。CPU だけ。1行 3〜10 秒）。

- しくみ: [Style-Bert-VITS2](https://github.com/litagin02/Style-Bert-VITS2)（JP-Extra）＋ [Aivis のモデルハブ](https://hub.aivis-project.com/)で公開されている声のモデル
- 使っている声: 語り＝**morioki**（ボイス提供: もりおき／モデル作成: yuki）、声のありがとうの孫役＝**まい**。どちらも ACML 1.0（Aivis Common Model License）
- `synth.py`（文 → wav）／`asr.py`（wav を聞き取って、読み間違いを見つける）／`analyze.py`（大きさ・声の高さ・無音を測る）

## 用意する（1回だけ・約 5GB・10分）

```bash
bash scripts/video-v3/tts/setup.sh
```

[uv](https://docs.astral.sh/uv/)・curl・ffmpeg が要ります。`venv/` と `models/` ができます（大きいのでリポジトリには入れません）。

## 使う

ふだんは `node scripts/video-v3/narrate.cjs` が台本（`script.cjs`）から全部の行を作ります。1行だけ試すとき:

```bash
cd scripts/video-v3/tts
venv/bin/python synth.py --model morioki --text "雪の朝に、頼まなくていい。" --out test.wav --speed 1.14
venv/bin/python synth.py --reading-only --text "足りないのは、人じゃない。"   # どう読むかだけ見る（音は作らない）
venv/bin/python asr.py --check ../../../.video/v3/voice/raw/manifest.json      # 作った声を聞き取って、台本と比べる
```

## 読み間違いの直し方（今回あったもの）

合成のたびに `reading:` の行（どう読んだか）が出ます。**必ず目で見る。** 今回は次の2つを、台本の `say`（読み上げ用の文）でかなに直しました。

| 文 | まちがった読み | 直し方 |
|---|---|---|
| 足りないのは、人じゃない。 | ニンジャナイ | `ひとじゃない` と書く |
| コードは一行も書かず | イッコウモ | `コードは、1行も書かず` と書く（「いちぎょうも」とかなにすると、今度は「は」を「ハ」と読んだ） |

- 数字は「じゅっぷん」「ななじゅっさい」のように、読ませたい形でかなにしておくと確実です。
- 「シマエナGO」は `user_dict.json` でアクセントを決めています（シ↑マエナゴ↓ー）。
- 記号（`/`・♪・絵文字）は読まれずに落ちます。「11/8」ではなく「11月8日」と書きます。
- ほかの処理（録画・書き出し）と同時に動かすと 10 倍遅くなります。1つずつ。
