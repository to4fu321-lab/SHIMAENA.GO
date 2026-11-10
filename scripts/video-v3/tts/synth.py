#!/usr/bin/env python3
"""
Local Japanese neural TTS (CPU) -- Style-Bert-VITS2 (JP-Extra) voices from the Aivis model hub.

Single line:
  venv/bin/python synth.py --model aida --style ノーマル --text "こんにちは。" --out out.wav
      [--speed 1.0] [--style-weight 1.0] [--sdp-ratio 0.2] [--noise 0.6] [--noise-w 0.8]
      [--pitch 1.0] [--intonation 1.0] [--seed 0] [--split] [--pause 0.4] [--reading "..."]
      [--peak-db -1 | --rms-db -20] [--user-dict user_dict.json]

Batch (BERT and each voice are loaded once per process):
  venv/bin/python synth.py --batch lines.json --outdir out/
      lines.json = [{"id": "n01", "model": "aida", "style": "ノーマル", "text": "...", "speed": 1.0, ...}, ...]
      -> out/n01.wav ..., out/manifest.json, one line per file on stdout (duration etc.)

Other:
  venv/bin/python synth.py --list                 # voices and their styles
  venv/bin/python synth.py --reading-only --text "10分だけ"   # show how the text will be read (no audio)

Route: PyPI style-bert-vits2 2.5.0 (torch, CPU) + AIVM (Safetensors) files; config and style vectors
are read from the metadata embedded in the .aivm file. Text front-end: pyopenjtalk-plus.
"""
from __future__ import annotations

import argparse
import base64
import io
import json
import os
import re
import struct
import sys
import time
import unicodedata
import wave
from pathlib import Path

HERE = Path(__file__).resolve().parent
MODELS_DIR = HERE / "models"
AIVM_DIR = MODELS_DIR / "aivm"
BERT_DIR = MODELS_DIR / "bert" / "deberta-v2-large-japanese-char-wwm"
BERT_REPO = "ku-nlp/deberta-v2-large-japanese-char-wwm"
CACHE_DIR = HERE / ".cache"
DEFAULT_USER_DICT = HERE / "user_dict.json"

# short names -> file stem in models/aivm (the model's own name from its manifest also works)
ALIASES = {
    "aida": "aida", "阿井田": "aida", "阿井田茂": "aida", "47e53151-a378-46f3-abee-ce13aa07feb1": "aida",
    "fumifumi": "fumifumi", "71e72188-2726-4739-9aa9-39567396fb2a": "fumifumi",
    "morioki": "morioki", "baaae3c0-7b22-4605-8ba5-80c959b41a48": "morioki",
    "lux": "lux", "3dabea2b-cc10-41da-955b-4618ce84e716": "lux",
    "yukifuri": "yukifuri", "雪降白華": "yukifuri", "白華": "yukifuri",
    "37e49039-522f-4608-b8d6-fc6716ada80e": "yukifuri",
    "mai": "mai", "まい": "mai", "e9339137-2ae3-4d41-9394-fb757a7e61e6": "mai",
    "kanon": "kanon", "花音": "kanon", "a670e6b8-0852-45b2-8704-1bc9862f2fe6": "kanon",
}

# per-line parameters and their defaults (JSON keys; "-" and "_" are interchangeable)
DEFAULTS = {
    "style": None,          # style name (default: the model's first style, usually ノーマル)
    "speed": 1.0,           # >1 faster, <1 slower (length_scale = 1/speed)
    "style_weight": 1.0,    # strength of the style vector (0..~5; higher = more expressive, less stable)
    "sdp_ratio": 0.2,       # 0..1 mix of stochastic duration predictor (higher = more tempo variation)
    "noise": 0.6,           # decoder noise (timbre/pitch variation; lower = flatter and steadier)
    "noise_w": 0.8,         # duration noise (rhythm variation)
    "pitch": 1.0,           # mean pitch multiplier (WORLD re-synthesis when != 1.0; slight quality loss)
    "intonation": 1.0,      # pitch range multiplier around the mean (WORLD re-synthesis when != 1.0)
    "seed": 0,              # same seed + same inputs -> identical audio; change it for another "take"
    "split": False,         # synthesize sentence by sentence (。！？ and newlines) and join with `pause`
    "pause": 0.4,           # seconds of silence between sentences when split is on
    "assist_text": None,    # optional text whose mood is blended into the BERT features
    "assist_text_weight": 0.7,
    "reading": None,        # explicit reading+accent, e.g. "シ[マエナゴ]オワ" (see --reading-only output)
    "peak_db": -1.0,        # peak-normalize each file to this dBFS; use "none" to keep the raw level
    "rms_db": None,         # instead of peak_db: bring the speech RMS to this dBFS (e.g. -20) so that all
                            # lines/voices are equally loud; gain is reduced if the peak would pass -1 dBFS
}


def _norm_key(s: str) -> str:
    return re.sub(r"[\s_\-　]+", "", unicodedata.normalize("NFKC", str(s))).lower()


# --------------------------------------------------------------------------------------
# AIVM files (= Safetensors with the manifest / hyper-parameters / style vectors in metadata)
# --------------------------------------------------------------------------------------
def read_aivm_metadata(path: Path) -> dict:
    with open(path, "rb") as f:
        (n,) = struct.unpack("<Q", f.read(8))
        if n > 200 * 1024 * 1024:
            raise ValueError(f"{path}: not a safetensors/AIVM file")
        header = json.loads(f.read(n))
    meta = header.get("__metadata__") or {}
    if "aivm_hyper_parameters" not in meta:
        raise ValueError(f"{path}: no AIVM metadata found (is this an .aivm file?)")
    return meta


def model_index(refresh: bool = False) -> dict:
    """{stem: {file, name, uuid, styles, speakers, version}} for models/aivm/*.aivm (cached)."""
    CACHE_DIR.mkdir(exist_ok=True)
    idx_path = CACHE_DIR / "model_index.json"
    idx = {}
    if idx_path.exists() and not refresh:
        try:
            idx = json.loads(idx_path.read_text(encoding="utf-8"))
        except Exception:
            idx = {}
    changed = False
    files = {p.stem: p for p in sorted(AIVM_DIR.glob("*.aivm"))}
    for stem in list(idx):
        if stem not in files:
            del idx[stem]
            changed = True
    for stem, p in files.items():
        st = p.stat()
        key = f"{st.st_size}:{int(st.st_mtime)}"
        if idx.get(stem, {}).get("key") == key:
            continue
        meta = read_aivm_metadata(p)
        man = json.loads(meta["aivm_manifest"])
        hp = json.loads(meta["aivm_hyper_parameters"])
        idx[stem] = {
            "key": key,
            "file": str(p),
            "name": man.get("name"),
            "uuid": man.get("uuid"),
            "version": hp.get("version"),
            "sampling_rate": hp.get("data", {}).get("sampling_rate"),
            "speakers": hp.get("data", {}).get("spk2id", {}),
            "styles": hp.get("data", {}).get("style2id", {}),
        }
        changed = True
    if changed:
        idx_path.write_text(json.dumps(idx, ensure_ascii=False, indent=1), encoding="utf-8")
    return idx


def resolve_model(name: str) -> Path:
    p = Path(name).expanduser()
    if p.is_file():
        return p.resolve()
    if p.is_dir():  # a normal Style-Bert-VITS2 model folder
        return p.resolve()
    idx = model_index()
    q = _norm_key(name)
    alias = {_norm_key(k): v for k, v in ALIASES.items()}
    if q in alias and alias[q] in idx:
        return Path(idx[alias[q]]["file"])
    for stem, info in idx.items():
        if q in (_norm_key(stem), _norm_key(info["name"] or ""), _norm_key(info["uuid"] or "")):
            return Path(info["file"])
    for stem, info in idx.items():  # prefix match on the manifest name (雪降白華 -> 雪降白華_T3モデル)
        if q and _norm_key(info["name"] or "").startswith(q):
            return Path(info["file"])
    known = ", ".join(f"{s} ({i['name']})" for s, i in idx.items())
    raise SystemExit(f"unknown model '{name}'. available: {known}")


# --------------------------------------------------------------------------------------
# Text front-end: keep digits so that OpenJTalk reads them with their counters
# (stock style-bert-vits2 turns 10分 into 十分 = ジュウブン and silently drops "%")
# --------------------------------------------------------------------------------------
SYMBOL_READINGS = {
    "%": "パーセント", "‰": "パーミル", "℃": "度", "+": "プラス", "=": "イコール",
    "&": "アンド", "@": "アット", "×": "かける", "÷": "わる", "#": "シャープ",
}
_CURRENCY = {"$": "ドル", "¥": "円", "£": "ポンド", "€": "ユーロ"}
_CURRENCY_RE = re.compile(r"([$¥£€])([0-9.]*[0-9])")
_NUM_SEP_RE = re.compile(r"[0-9]{1,3}(,[0-9]{3})+")
_TIME_RE = re.compile(r"(?<![0-9:])([0-9]{1,2}):([0-9]{2})(?![0-9:])")
_NEGATIVE_RE = re.compile(r"(?<![0-9A-Za-z])-(?=[0-9])")
_PERIOD_BETWEEN_DIGITS_RE = re.compile(r"(?<=[0-9])([。\n]+)(?=[0-9])")
_DIGITS_RE = re.compile(r"[0-9]+")
_KANJI_DIGITS = "零一二三四五六七八九"


def _build_frontend():
    """Create normalize_text() and run_frontend() replacements and install them into style_bert_vits2."""
    import pyopenjtalk
    from num2words import num2words
    import style_bert_vits2.nlp.japanese.normalizer as sbv2_norm
    import style_bert_vits2.nlp.japanese.pyopenjtalk_worker as sbv2_ojt
    from style_bert_vits2.nlp.symbols import PUNCTUATIONS

    replace_map = getattr(sbv2_norm, "__REPLACE_MAP")
    replace_re = getattr(sbv2_norm, "__REPLACE_PATTERN")
    keep_re = re.compile(
        r"[^぀-ゟ゠-ヿ一-鿿㐀-䶿々"
        r"A-Za-zＡ-Ｚａ-ｚ"
        r"Ͱ-Ͽἀ-῿"
        r"0-9" + "".join(re.escape(p) for p in PUNCTUATIONS) + r"]+"
    )
    dropped: list[str] = []

    def normalize_text(text: str) -> str:
        res = text.replace("℃", "度")  # NFKC would turn it into "°C"
        res = unicodedata.normalize("NFKC", res)
        res = _NUM_SEP_RE.sub(lambda m: m[0].replace(",", ""), res)
        res = _CURRENCY_RE.sub(lambda m: m[2] + _CURRENCY.get(m[1], m[1]), res)
        res = _TIME_RE.sub(lambda m: f"{m[1]}時" + ("" if m[2] == "00" else f"{int(m[2])}分"), res)  # 20:00, 7:30
        res = _NEGATIVE_RE.sub("マイナス", res)
        for k, v in SYMBOL_READINGS.items():
            res = res.replace(k, v)
        res = res.replace("~", "ー").replace("～", "ー").replace("〜", "ー")
        # "合計15。3人" must not be read as the decimal 15.3 once 。 has become "."
        res = _PERIOD_BETWEEN_DIGITS_RE.sub(lambda m: m[1] + "、", res)
        res = res.replace(":", ",").replace(";", ",")  # (NFKC made them ASCII; SBV2 only maps the full-width ones)
        # decimal points must survive as "." between digits; everything else as in style-bert-vits2
        res = replace_re.sub(lambda m: replace_map[m.group()], res)
        for m in keep_re.finditer(res):
            if m.group().strip():
                dropped.append(m.group())
        res = keep_re.sub("", res)
        res = res.replace("゙", "").replace("゚", "")
        return res

    def _fix_string(feat: dict) -> str:
        s = unicodedata.normalize("NFKC", feat["string"])
        if s == "." and feat.get("pron") == "テン":
            return "点"
        if _DIGITS_RE.search(s):
            if _DIGITS_RE.fullmatch(s):
                s = "".join(_KANJI_DIGITS[int(c)] for c in s)
            else:  # dictionary words such as １１月
                s = _DIGITS_RE.sub(lambda m: num2words(m[0], lang="ja"), s)
            return s
        return feat["string"]

    unit_digits = set("一二三四五六七八九")

    def _fix_teen_accent(feats: list) -> None:
        """OpenJTalk splits 15年 / 25分 / 14本 ... into two accent phrases (ジュ'ー | ゴネン), which sounds odd
        and made Whisper hear aida's 15年 as "10もね". Join them the way it already treats 13年 / 16年:
        one phrase with the fall right after the number (ジューゴ'ネン)."""
        for i in range(len(feats) - 2):
            ten, unit, counter = feats[i], feats[i + 1], feats[i + 2]
            if not (ten["string"] == "十" and ten.get("pos_group1") == "数"
                    and unit["string"] in unit_digits and unit.get("pos_group1") == "数"
                    and unit.get("chain_flag") == 0
                    and counter.get("pos_group1") == "接尾" and counter.get("chain_flag") == 1
                    and int(counter.get("mora_size") or 9) <= 2):  # 年 人 分 歳 回 本 ...; not パーセント etc.
                continue
            head = i
            if ten.get("chain_flag") == 1:  # 25年: the phrase starts at 二
                prev = feats[i - 1] if i >= 1 else None
                if prev and prev["string"] in unit_digits and prev.get("pos_group1") == "数" \
                        and prev.get("chain_flag") != 1:
                    head = i - 1
                else:
                    continue  # 115年 etc.: leave as OpenJTalk made it
            morae = sum(int(f["mora_size"]) for f in feats[head:i + 2])
            if unit["pron"].replace("’", "").endswith("ン"):
                morae -= 1
            unit["chain_flag"] = 1
            feats[head]["acc"] = morae

    def run_frontend(text: str):
        feats = pyopenjtalk.run_frontend(text)
        _fix_teen_accent(feats)
        for f in feats:
            if f.get("pron") == "！":  # pyopenjtalk-plus marks "!" like this; style-bert-vits2 2.5.0 expects "、"
                f["pron"] = "、"
            new = _fix_string(f)
            if new != f["string"]:
                f["string"] = new
            # anything OpenJTalk can read but the BERT text cannot hold -> use its kana reading
            if f.get("pron") not in ("、", "？", "！", "") and sbv2_norm.replace_punctuation(f["string"]) == "":
                f["string"] = f.get("read") or f["pron"].replace("’", "")
        return feats

    sbv2_norm.normalize_text = normalize_text
    sbv2_ojt.run_frontend = run_frontend
    return normalize_text, dropped


def _mora_count(kana: str) -> int:
    return len([c for c in kana if c not in "ャュョァィゥェォヮ"])


def load_user_dict(path: Path) -> int:
    """user_dict.json: [{"surface": "シマエナGO", "pron": "シマエナゴー", "accent": 5, "priority": 8}, ...]
    accent = mora position of the pitch fall (0 = flat/heiban). Returns the number of words loaded."""
    import pyopenjtalk

    words = json.loads(path.read_text(encoding="utf-8"))
    if not words:
        return 0
    costs = [14176, 9110, 8984, 8859, 8734, 8609, 7328, 6048, 4768, 3488, -988]  # priority 0..10
    rows = []
    for w in words:
        surface = unicodedata.normalize("NFKC", w["surface"])
        surface = "".join(chr(ord(c) + 0xFEE0) if 0x21 <= ord(c) <= 0x7E else c for c in surface)
        pron = w["pron"]
        acc = int(w.get("accent", 0))
        cost = costs[max(0, min(10, int(w.get("priority", 8))))]
        rows.append(f"{surface},1348,1348,{cost},名詞,固有名詞,一般,*,*,*,{surface},{pron},{pron},"
                    f"{acc}/{_mora_count(pron)},C1")
    # compiled dictionary is cached by content, written atomically (safe with parallel runs)
    import hashlib

    CACHE_DIR.mkdir(exist_ok=True)
    csv_text = "\n".join(rows) + "\n"
    digest = hashlib.sha1(csv_text.encode("utf-8")).hexdigest()[:12]
    dic_path = CACHE_DIR / f"user_dict_{digest}.dic"
    if not dic_path.exists():
        csv_path = CACHE_DIR / f"user_dict_{digest}_{os.getpid()}.csv"
        tmp_dic = CACHE_DIR / f"user_dict_{digest}_{os.getpid()}.dic.tmp"
        csv_path.write_text(csv_text, encoding="utf-8")
        # the dictionary compiler prints progress to the C-level stdout/stderr; keep our stdout clean
        sys.stdout.flush()
        saved = os.dup(1), os.dup(2)
        devnull = os.open(os.devnull, os.O_WRONLY)
        try:
            os.dup2(devnull, 1)
            os.dup2(devnull, 2)
            pyopenjtalk.mecab_dict_index(str(csv_path), str(tmp_dic))
        finally:
            os.dup2(saved[0], 1)
            os.dup2(saved[1], 2)
            for fd in (*saved, devnull):
                os.close(fd)
            csv_path.unlink(missing_ok=True)
        tmp_dic.replace(dic_path)
    pyopenjtalk.update_global_jtalk_with_user_dict(str(dic_path))
    return len(rows)


def tones_to_marked(kata_tone: list[tuple[str, int]]) -> str:
    """[(サ,0),(ッ,1)...] -> 'サ[ッポロニキ]テ'  ('[' = pitch goes up, ']' = pitch goes down)"""
    out, prev = [], 0
    for kana, tone in kata_tone:
        if tone != prev:
            out.append("[" if tone == 1 else "]")
        out.append(kana)
        prev = tone
    return "".join(out)


def marked_to_tones(marked: str) -> list[tuple[str, int]]:
    """inverse of tones_to_marked(); also accepts ー, hiragana and Japanese punctuation."""
    from style_bert_vits2.nlp.japanese.mora_list import MORA_KATA_TO_MORA_PHONEMES
    from style_bert_vits2.nlp.symbols import PUNCTUATIONS

    s = unicodedata.normalize("NFKC", marked)
    s = "".join(chr(ord(c) + 0x60) if "ぁ" <= c <= "ゖ" else c for c in s)  # hiragana -> katakana
    for a, b in (("。", "."), ("、", ","), ("!", "!"), ("?", "?"), ("ヲ", "オ")):
        s = s.replace(a, b)
    keys = sorted(MORA_KATA_TO_MORA_PHONEMES, key=len, reverse=True)
    vowel_of = {"a": "ア", "i": "イ", "u": "ウ", "e": "エ", "o": "オ", "N": "ン"}
    out: list[tuple[str, int]] = []
    tone, i = 0, 0
    while i < len(s):
        c = s[i]
        if c == "[":
            tone = 1
        elif c == "]":
            tone = 0
        elif c in PUNCTUATIONS:
            out.append((c, 0))
            tone = 0
        elif c == "ー":
            if not out or out[-1][0] in PUNCTUATIONS:
                raise ValueError(f"reading: ー with nothing before it in {marked!r}")
            out.append((vowel_of[MORA_KATA_TO_MORA_PHONEMES[out[-1][0]][1]], tone))
        elif c.isspace() or c in "/|":
            pass
        else:
            for k in keys:
                if s.startswith(k, i):
                    out.append((k, tone))
                    i += len(k) - 1
                    break
            else:
                raise ValueError(f"reading: cannot parse {c!r} in {marked!r} (use katakana, [ ] and punctuation)")
        i += 1
    return out


# --------------------------------------------------------------------------------------
# Engine
# --------------------------------------------------------------------------------------
class Engine:
    def __init__(self, threads: int | None = None, user_dict: Path | None = None, verbose: bool = False,
                 load_bert: bool = True):
        t0 = time.time()
        import warnings

        warnings.filterwarnings("ignore")
        os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
        os.environ.setdefault("HF_HOME", str(CACHE_DIR / "hf"))  # keep any download inside this folder
        os.environ.setdefault("HF_HUB_DISABLE_PROGRESS_BARS", "1")
        os.environ.setdefault("TRANSFORMERS_VERBOSITY", "error")
        import numpy as np
        import torch
        from loguru import logger

        import style_bert_vits2.logging  # noqa: F401  (installs its own stdout handler; replace it)
        logger.remove()
        logger.add(sys.stderr, level="INFO" if verbose else "WARNING", format="{level}: {message}")

        from style_bert_vits2.constants import Languages
        from style_bert_vits2.nlp import bert_models

        self.np, self.torch, self.Languages = np, torch, Languages
        # Denormal floats make some voices 5-10x slower on CPU. Must be set before torch starts its
        # worker threads (they inherit the setting from this thread).
        torch.set_flush_denormal(True)
        if threads:
            torch.set_num_threads(threads)
        torch.set_grad_enabled(False)

        bert_src = str(BERT_DIR) if (BERT_DIR / "config.json").exists() else BERT_REPO
        try:
            from transformers.utils import logging as hf_logging

            hf_logging.disable_progress_bar()
        except Exception:
            pass
        bert_models.load_tokenizer(Languages.JP, bert_src)
        if load_bert:  # the 1.3 GB model is only needed for audio, not for --reading-only
            # config.json says torch_dtype=float16 and recent transformers honour it; CPU needs float32
            bert_models.load_model(Languages.JP, bert_src).float().eval()

        self.normalize_text, self._dropped = _build_frontend()
        self.user_words = 0
        ud = user_dict if user_dict is not None else (DEFAULT_USER_DICT if DEFAULT_USER_DICT.exists() else None)
        if ud is not None:
            self.user_words = load_user_dict(Path(ud))
        self.voices: dict[str, dict] = {}
        self.load_seconds = time.time() - t0

    # ---- voices -------------------------------------------------------------------
    def voice(self, name: str) -> dict:
        path = resolve_model(name)
        key = str(path)
        if key in self.voices:
            return self.voices[key]
        np = self.np
        from style_bert_vits2.models.hyper_parameters import HyperParameters
        from style_bert_vits2.models.infer import get_net_g

        t0 = time.time()
        if path.is_dir():
            st = sorted(path.glob("*.safetensors"))
            if not st:
                raise SystemExit(f"{path}: no .safetensors file")
            weights = st[0]
            hps = HyperParameters.load_from_json(path / "config.json")
            style_vectors = np.load(path / "style_vectors.npy")
            display = path.name
        else:
            meta = read_aivm_metadata(path)
            hps = HyperParameters.model_validate_json(meta["aivm_hyper_parameters"])
            style_vectors = np.load(io.BytesIO(base64.b64decode(meta["aivm_style_vectors"])))
            display = json.loads(meta["aivm_manifest"]).get("name", path.stem)
            # style-bert-vits2 picks the loader from the file extension
            CACHE_DIR.mkdir(exist_ok=True)
            weights = CACHE_DIR / f"{path.stem}.safetensors"
            if weights.is_symlink() and weights.resolve() != path.resolve():
                weights.unlink()
            if not weights.exists():
                weights.symlink_to(path.resolve())
        net_g = get_net_g(model_path=str(weights), version=hps.version, device="cpu", hps=hps)
        v = {
            "name": display,
            "path": str(path),
            "hps": hps,
            "net_g": net_g,
            "style_vectors": style_vectors.astype(np.float32),
            "style2id": dict(hps.data.style2id),
            "sr": int(hps.data.sampling_rate),
            "load_seconds": time.time() - t0,
        }
        self.voices[key] = v
        return v

    @staticmethod
    def style_id(v: dict, style) -> tuple[int, str]:
        s2i = v["style2id"]
        names = list(s2i)
        if style is None or style == "":
            return s2i[names[0]], names[0]
        if isinstance(style, int) or str(style).isdigit():
            i = int(style)
            for n, j in s2i.items():
                if j == i:
                    return j, n
        q = _norm_key(style)
        for n, j in s2i.items():
            if _norm_key(n) == q:
                return j, n
        if q in ("ノーマル", "normal", "neutral", "default"):  # the base style, whatever it is called
            for n, j in s2i.items():
                if j == 0:
                    return j, n
        raise SystemExit(f"style '{style}' not found in {v['name']}. available: {', '.join(names)}")

    # ---- text ---------------------------------------------------------------------
    def reading(self, text: str) -> dict:
        from style_bert_vits2.nlp.japanese.g2p_utils import g2kata_tone

        del self._dropped[:]
        norm = self.normalize_text(text)
        kt = g2kata_tone(norm)
        return {
            "norm": norm,
            "kana": "".join(k for k, _ in kt),
            "reading": tones_to_marked(kt),
            "dropped": "".join(self._dropped),
        }

    @staticmethod
    def split_sentences(text: str) -> list[str]:
        parts = re.split(r"(?<=[。！？!?])(?![。！？!?」』）)])|\n+", text)
        return [p.strip() for p in parts if p and p.strip()]

    # ---- synthesis ----------------------------------------------------------------
    def _infer(self, v: dict, text: str, style_vec, p: dict, given=None):
        from style_bert_vits2.models.infer import infer

        kw = {}
        if given is not None:
            kw = {"given_phone": [ph for ph, _ in given], "given_tone": [t for _, t in given]}
        return infer(
            text=text,
            style_vec=style_vec,
            sdp_ratio=float(p["sdp_ratio"]),
            noise_scale=float(p["noise"]),
            noise_scale_w=float(p["noise_w"]),
            length_scale=1.0 / float(p["speed"]),
            sid=0 if len(v["hps"].data.spk2id) == 0 else min(v["hps"].data.spk2id.values()),
            language=self.Languages.JP,
            hps=v["hps"],
            net_g=v["net_g"],
            device="cpu",
            assist_text=p.get("assist_text") or None,
            assist_text_weight=float(p["assist_text_weight"]),
            **kw,
        )

    def synth(self, line: dict) -> tuple:
        """line: dict with model, text and optional DEFAULTS keys -> (float32 audio, sr, info)"""
        np, torch = self.np, self.torch
        p = dict(DEFAULTS)
        p.update({k.replace("-", "_"): val for k, val in line.items() if val is not None})
        if float(p["speed"]) <= 0:
            raise SystemExit("speed must be > 0")
        v = self.voice(p["model"])
        sid, sname = self.style_id(v, p["style"])
        vecs = v["style_vectors"]
        style_vec = vecs[0] + (vecs[sid] - vecs[0]) * float(p["style_weight"])

        text = str(p["text"])
        chunks = self.split_sentences(text) if p["split"] else [text.replace("\n", "。")]
        given = None
        if p.get("reading"):
            if len(chunks) != 1:
                raise SystemExit("'reading' cannot be combined with 'split'")
            from style_bert_vits2.nlp.japanese.g2p_utils import kata_tone2phone_tone

            given = kata_tone2phone_tone(marked_to_tones(p["reading"]))

        t0 = time.time()
        torch.manual_seed(int(p["seed"]))
        np.random.seed(int(p["seed"]) % (2**32))
        audios, readings, dropped = [], [], ""
        for i, chunk in enumerate(chunks):
            r = self.reading(chunk)
            dropped += r["dropped"]
            readings.append(p["reading"] if given is not None else r["reading"])
            audios.append(self._infer(v, chunk, style_vec, p, given))
            if i != len(chunks) - 1:
                audios.append(np.zeros(int(v["sr"] * float(p["pause"])), dtype=np.float32))
        audio = np.concatenate(audios).astype(np.float32)

        if float(p["pitch"]) != 1.0 or float(p["intonation"]) != 1.0:
            from style_bert_vits2.voice import adjust_voice

            _, audio = adjust_voice(fs=v["sr"], wave=audio, pitch_scale=float(p["pitch"]),
                                    intonation_scale=float(p["intonation"]))
            audio = np.asarray(audio, dtype=np.float32)

        raw_peak = float(np.abs(audio).max()) if audio.size else 0.0
        pk, rms_target = p["peak_db"], p.get("rms_db")
        if rms_target is not None and str(rms_target).lower() != "none" and raw_peak > 0:
            gain = 10 ** (float(rms_target) / 20.0) / max(speech_rms(audio, v["sr"]), 1e-9)
            gain = min(gain, 10 ** (-1.0 / 20.0) / raw_peak)  # keep 1 dB of headroom
            audio = audio * gain
        elif pk is not None and str(pk).lower() != "none" and raw_peak > 0:
            audio = audio * (10 ** (float(pk) / 20.0) / raw_peak)
        elif raw_peak > 1.0:
            audio = audio / raw_peak  # never clip
        info = {
            "voice": v["name"],
            "style": sname,
            "duration": round(len(audio) / v["sr"], 3),
            "synth_seconds": round(time.time() - t0, 2),
            "sample_rate": v["sr"],
            "peak_dbfs": round(20 * float(np.log10(max(float(np.abs(audio).max()), 1e-9))), 2) if audio.size else None,
            "speech_rms_dbfs": round(20 * float(np.log10(max(speech_rms(audio, v["sr"]), 1e-9))), 1),
            "reading": " ".join(readings),
            "dropped_chars": dropped,
            "seed": int(p["seed"]),
            "speed": float(p["speed"]),
        }
        return audio, v["sr"], info


def speech_rms(audio, sr: int) -> float:
    """RMS of the frames that contain speech (20 ms frames within 35 dB of the loudest one)."""
    import numpy as np

    hop = max(1, sr // 50)
    n = len(audio) // hop
    if n == 0:
        return 0.0
    e = (audio[: n * hop].reshape(n, hop).astype(np.float64) ** 2).mean(axis=1)
    active = e[e > e.max() * 10 ** (-35 / 10)]
    return float(np.sqrt(active.mean())) if active.size else 0.0


def write_wav(path: Path, audio, sr: int) -> None:
    import numpy as np

    path.parent.mkdir(parents=True, exist_ok=True)
    pcm = np.clip(np.round(audio * 32767.0), -32768, 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm.tobytes())


def report(ident: str, out: Path, info: dict) -> None:
    rtf = info["synth_seconds"] / info["duration"] if info["duration"] else 0
    print(f"{ident}\t{info['duration']:.2f}s\tvoice={info['voice']}/{info['style']}\t"
          f"synth={info['synth_seconds']:.1f}s (x{rtf:.2f})\tpeak={info['peak_dbfs']}dB rms={info['speech_rms_dbfs']}dB\t"
          f"{out}", flush=True)
    print(f"    reading: {info['reading']}", flush=True)
    if info["dropped_chars"]:
        print(f"    WARNING: unreadable characters were skipped: {info['dropped_chars']!r}", flush=True)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--model", help="voice: short name (aida, fumifumi, morioki, lux, yukifuri, mai, kanon), "
                                    "model name (阿井田 茂 ...), uuid, or path to .aivm / SBV2 model folder")
    ap.add_argument("--style", help="style name, e.g. ノーマル / Calm (default: the model's first style)")
    ap.add_argument("--text", help="Japanese text to speak")
    ap.add_argument("--out", help="output wav path (single mode)")
    ap.add_argument("--batch", help="JSON file: list of {id, model, style, text, speed, ...}")
    ap.add_argument("--outdir", help="output directory for --batch (writes <id>.wav and manifest.json)")
    ap.add_argument("--speed", type=float, help="speaking rate, 1.0 = normal, 1.2 = 20%% faster")
    ap.add_argument("--style-weight", type=float, help="style strength (default 1.0)")
    ap.add_argument("--sdp-ratio", type=float, help="tempo variation 0..1 (default 0.2)")
    ap.add_argument("--noise", type=float, help="voice variation noise (default 0.6)")
    ap.add_argument("--noise-w", type=float, help="duration noise (default 0.8)")
    ap.add_argument("--pitch", type=float, help="mean pitch multiplier (default 1.0 = untouched)")
    ap.add_argument("--intonation", type=float, help="pitch range multiplier (default 1.0 = untouched)")
    ap.add_argument("--seed", type=int, help="random seed (default 0); same seed -> same audio")
    ap.add_argument("--split", action="store_true", default=None,
                    help="synthesize sentence by sentence and join with --pause seconds of silence")
    ap.add_argument("--pause", type=float, help="silence between sentences with --split (default 0.4)")
    ap.add_argument("--assist-text", help="optional text whose mood guides the delivery")
    ap.add_argument("--assist-text-weight", type=float)
    ap.add_argument("--reading", help="explicit reading with accent marks, e.g. 'シ[マエナゴ]オワ' "
                                      "(copy the 'reading:' line printed for the text and edit it)")
    ap.add_argument("--peak-db", help="peak level of the wav in dBFS (default -1.0), or 'none' for raw level")
    ap.add_argument("--rms-db", help="normalize speech loudness (RMS) to this dBFS instead, e.g. -20: "
                                     "same loudness for every line and voice")
    ap.add_argument("--user-dict", help=f"JSON word list for names (default: {DEFAULT_USER_DICT.name} if present)")
    ap.add_argument("--threads", type=int, help="CPU threads for torch (default: all cores)")
    ap.add_argument("--list", action="store_true", help="list available voices and styles")
    ap.add_argument("--reading-only", action="store_true", help="print how --text will be read; no audio")
    ap.add_argument("--verbose", action="store_true")
    a = ap.parse_args()

    if a.list:
        for stem, info in model_index().items():
            print(f"{stem}\t{info['name']}\tstyles: {', '.join(info['styles'])}\t"
                  f"{info['sampling_rate']} Hz\t{info['version']}\t{info['uuid']}")
        return 0

    cli = {k: getattr(a, k) for k in ("model", "style", "text", "speed", "style_weight", "sdp_ratio", "noise",
                                      "noise_w", "pitch", "intonation", "seed", "split", "pause", "assist_text",
                                      "assist_text_weight", "reading", "peak_db", "rms_db")}
    cli = {k: v for k, v in cli.items() if v is not None}

    if a.reading_only:
        if not a.text:
            ap.error("--reading-only needs --text")
        eng = Engine(threads=a.threads, user_dict=Path(a.user_dict) if a.user_dict else None, verbose=a.verbose,
                     load_bert=False)
        for chunk in (eng.split_sentences(a.text) if a.split else [a.text]):
            r = eng.reading(chunk)
            print(f"text:    {chunk}\nnorm:    {r['norm']}\nkana:    {r['kana']}\nreading: {r['reading']}")
            if r["dropped"]:
                print(f"WARNING: unreadable characters skipped: {r['dropped']!r}")
        return 0

    if a.batch:
        if not a.outdir:
            ap.error("--batch needs --outdir")
        data = json.loads(Path(a.batch).read_text(encoding="utf-8"))
        defaults = {}
        if isinstance(data, dict):
            defaults = {k.replace("-", "_"): v for k, v in (data.get("defaults") or {}).items()}
            data = data.get("lines") or []
        lines = []
        for i, item in enumerate(data):
            line = dict(cli)             # command-line flags = defaults for every line
            line.update(defaults)        # then the file's "defaults"
            line.update({k.replace("-", "_"): v for k, v in item.items() if v is not None})
            line.setdefault("id", f"line{i + 1:03d}")
            if not line.get("model") or not line.get("text"):
                raise SystemExit(f"line {i + 1} ({line['id']}): 'model' and 'text' are required")
            lines.append(line)
        outdir = Path(a.outdir)
        outdir.mkdir(parents=True, exist_ok=True)
        eng = Engine(threads=a.threads, user_dict=Path(a.user_dict) if a.user_dict else None, verbose=a.verbose)
        print(f"# engine ready in {eng.load_seconds:.1f}s (BERT loaded once), {len(lines)} lines", flush=True)
        manifest, t0 = [], time.time()
        for line in lines:
            audio, sr, info = eng.synth(line)
            out = outdir / f"{line['id']}.wav"
            write_wav(out, audio, sr)
            report(str(line["id"]), out, info)
            manifest.append({"id": line["id"], "file": str(out), "text": line["text"], "model": line["model"], **info})
        (outdir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")
        total = sum(m["duration"] for m in manifest)
        print(f"# done: {len(manifest)} files, {total:.1f}s of audio in {time.time() - t0:.1f}s "
              f"-> {outdir / 'manifest.json'}", flush=True)
        return 0

    if not (a.model and a.text and a.out):
        ap.error("need --model, --text and --out (or --batch/--outdir, --list, --reading-only)")
    eng = Engine(threads=a.threads, user_dict=Path(a.user_dict) if a.user_dict else None, verbose=a.verbose)
    audio, sr, info = eng.synth(cli)
    out = Path(a.out)
    write_wav(out, audio, sr)
    report(out.stem, out, info)
    return 0


if __name__ == "__main__":
    sys.exit(main())
