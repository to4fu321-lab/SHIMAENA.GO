#!/usr/bin/env python3
"""デモ動画のナレーション（仮の声）を作る。
本番は本人の声を録って差し替える（docs/video/howto.md）。ここでは gTTS（Google 翻訳の読み上げ）で仮の声を作り、
各行の長さ（秒）を out/narration.json に書く。隊長の声と娘さん役の声は、同じ声の高さを変えて区別する。

使い方: python3 scripts/demo-video/narration.py <出力フォルダ>
"""
import json, os, subprocess, sys
from gtts import gTTS

OUT = sys.argv[1] if len(sys.argv) > 1 else ".video/narration"
os.makedirs(OUT, exist_ok=True)

# id, 話す人（narr=本人 / captain=隊長 / daughter=娘さん役）, 文
LINES = [
    ("n01", "narr", "15年前、埼玉から札幌に来ました。雪かきは、毎年、腰を痛めます。庭に毎日、何メートルも穴を掘っているようなものです。"),
    ("n02", "narr", "この問題を、なんとかしたい。そう思い立ったのは、ソファーの上でした。"),
    ("c01", "captain", "シマエナ隊長だしま！"),
    ("n03", "narr", "札幌の冬の朝は、静かです。みんな、ひとりで雪かきをしている。"),
    ("n04", "narr", "シマエナGOは、雪かきを、ひとりの作業から、チームの朝に変えるアプリです。エリアを3チームに分けて、毎週シャッフル。"),
    ("n05", "narr", "お願いしたい家は、冬の初めに一度だけ登録。雪の朝に、手伝ってと頼む必要はありません。"),
    ("n06", "narr", "10センチ積もった朝、登録した家の雪かきが、自動で近所に届く。Claudeの隊長が、家ごとに、人数と担当と理由を決めます。"),
    ("n07", "narr", "知らない人の家でも、チームなら行ける。10分でもいい。"),
    ("n08", "narr", "写真1枚で、Claudeが、通れるか、凍っていないかを確かめます。二度と出ないカードが届き、家族にも、終わりましたが届きます。"),
    ("n09", "narr", "ありがとうは、AIに書かせません。文字にもしません。"),
    ("d01", "daughter", "今朝はありがとうね。おかげで病院に行けたよ。今度、お茶でも飲んでいって。"),
    ("n10", "narr", "感情を乗せるところまで任せたら、自分がいなくなる気がした。だから、気持ちは、人の声で。"),
    ("n11", "narr", "相談は隊長に。つながりか、運動か、地域貢献か、ゲームか。その人に合う参加の仕方をすすめます。"),
    ("n12", "narr", "高齢者は、助けられる側だけじゃない。雪かきのコツを教える側に。雪の思い出は、町の絵本の1ページになります。"),
    ("n13", "narr", "AIは段取りを。人は、会いに行く。"),
    ("n14", "narr", "プログラミングは初心者。コードを書いた時間、0分。ゴロゴロした時間、6日。全部、スマホから日本語で話しかけただけです。"),
    ("n15", "narr", "学生服の営業をしています。子どもたちに、やってみようと話している自分が、40代でやってみました。"),
    ("n16", "narr", "子どもたちが大人になる頃、隣の人と雪をどけるのが、当たり前の町に。出会って、人生が変わる人が、ひとりでも出てきてほしい。"),
    ("c02", "captain", "あしたの朝は、6時半に起こすしま！"),
]

def ff(*args):
    subprocess.run(["ffmpeg", "-v", "error", "-y", *args], check=True)

def dur(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path], capture_output=True, text=True, check=True)
    return float(r.stdout.strip())

meta = {}
for id_, who, text in LINES:
    raw = os.path.join(OUT, f"{id_}.raw.mp3")
    wav = os.path.join(OUT, f"{id_}.wav")
    if not os.path.exists(raw):
        gTTS(text, lang="ja").save(raw)
    # 声の加工: 本人役は少し速く（1.12 倍）。隊長は高く速く、娘さん役は少し高く。
    if who == "narr":
        filt = "atempo=1.2,silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse"
    elif who == "captain":
        filt = "asetrate=24000*1.35,aresample=24000,atempo=0.95,silenceremove=start_periods=1:start_threshold=-45dB"
    else:
        filt = "asetrate=24000*1.12,aresample=24000,atempo=0.98,highpass=f=200,lowpass=f=3400,silenceremove=start_periods=1:start_threshold=-45dB"
    ff("-i", raw, "-af", filt, "-ar", "48000", "-ac", "2", wav)
    meta[id_] = {"who": who, "text": text, "seconds": round(dur(wav), 2)}
    print(f"{id_} {who:8s} {meta[id_]['seconds']:5.1f}s  {text}")

json.dump(meta, open(os.path.join(OUT, "narration.json"), "w"), ensure_ascii=False, indent=1)
print("合計", round(sum(m["seconds"] for m in meta.values()), 1), "秒")
