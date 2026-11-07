// 隊長の声（spec v1.38）: Aivis Cloud API（日本の音声合成。最速 0.3 秒）で、かわいい声の mp3 を作る。
// 11/7 本人の指摘「遅すぎて使えない」→ 無料の VOICEVOX Web API は1文 10 秒以上、自前の ENGINE は Hugging Face が有料になっていた → 本人の選択で Aivis に。
// 鍵 AIVIS_API_KEY はサーバー側でだけ使う（画面に出さない）。登録で 500 円分（約 11,000 字）の無料クレジット、その後は 1 万字 440 円（前払い）。
// 声は AIVIS_MODEL（モデル UUID）と AIVIS_STYLE（スタイル名）で選ぶ。ライセンスは ACML 1.0 のモデルだけを候補にした（クレジットは任意だが出す）。
import type { Voice, VoiceEnv } from "./voicevox";

const API = "https://api.aivis-project.com/v1/tts/synthesize";

/** 候補の声（本人が試聴して選ぶ）。キーはモデル UUID、値はクレジットに出す名前 */
export const AIVIS_VOICES: Readonly<Record<string, string>> = {
  "a59cb814-0083-4369-8542-f51a29e72af7": "AivisSpeech: まお",
  "22e8ed77-94fe-4ef2-871f-a86f94e9a579": "AivisSpeech: コハク",
  "1b2830f4-8cf1-4184-a0d9-3a1bace3a844": "AivisSpeech: みちのくあいり",
  "ed0f793d-786c-4fde-8561-e8bbac7bfe1d": "AivisSpeech: 六弦エレキ",
};

/** 既定の声: コハク（子猫のような甘い声）。本人が試聴して決めたら差しかえる */
export const DEFAULT_AIVIS_MODEL = "22e8ed77-94fe-4ef2-871f-a86f94e9a579";
export const DEFAULT_AIVIS_STYLE = "ノーマル";

/** 元気でかわいい調子（11/7 本人の指示）: 少し速く・感情を強めに・緩急を少しつける。ピッチは触らない（変えると遅く・粗くなる） */
export const AIVIS_TONE = { speaking_rate: 1.1, emotional_intensity: 1.3, tempo_dynamics: 1.1 } as const;

/** 1つの文を作る待ち時間。ふつうは 1 秒もかからない */
const AIVIS_MS = 10_000;

export function aivisEnabled(env: VoiceEnv = process.env): boolean {
  return !!env.AIVIS_API_KEY?.trim();
}

export function aivisModel(env: VoiceEnv = process.env): string {
  return env.AIVIS_MODEL?.trim() || DEFAULT_AIVIS_MODEL;
}

export function aivisStyle(env: VoiceEnv = process.env): string {
  return env.AIVIS_STYLE?.trim() || DEFAULT_AIVIS_STYLE;
}

/** 隊長の声のクレジット名（Aivis を使っているとき） */
export function aivisVoiceName(env: VoiceEnv = process.env): string {
  return AIVIS_VOICES[aivisModel(env)] ?? "AivisSpeech";
}

/** Aivis Cloud API で mp3 に。できなければ null（画面はブラウザの声に戻る）。text は整え済み（voiceText）を渡す */
export async function synthesizeAivis(text: string, env: VoiceEnv = process.env, fetchFn: typeof fetch = fetch): Promise<Voice | null> {
  const key = env.AIVIS_API_KEY?.trim();
  if (!key || !text) return null;
  const res = await fetchFn(API, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      model_uuid: aivisModel(env),
      style_name: aivisStyle(env),
      text,
      use_ssml: false,
      output_format: "mp3",
      leading_silence_seconds: 0,
      trailing_silence_seconds: 0.1,
      ...AIVIS_TONE,
    }),
    signal: AbortSignal.timeout(AIVIS_MS),
  });
  if (!res.ok) {
    console.error("[voice] Aivis が声を作れませんでした:", res.status, (await res.text().catch(() => "")).slice(0, 200));
    return null;
  }
  const audio = new Uint8Array(await res.arrayBuffer());
  return audio.byteLength > 0 ? { audio, type: "audio/mpeg", speakerName: aivisVoiceName(env) } : null;
}
