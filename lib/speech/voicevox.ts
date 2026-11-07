// 隊長の声（spec v1.36）: 無料の VOICEVOX Web API（api.tts.quest。鍵なしでも少しずつ使える）で、かわいい声の mp3 を作る。
// サーバー側でだけ呼ぶ（任意の API キー VOICEVOX_API_KEY を画面に出さない）。失敗したら画面はブラウザの声に戻る（止まらない）。
// 声の主は VOICEVOX のキャラクター。使うときはクレジット「VOICEVOX:雨晴はう」などを出す決まり（画面の「ことば」の紙と README に）。
// 鍵なしの枠は小さい（1分に数回。超えると 429）→ その回はブラウザの声に戻る。本番で使うなら無料の鍵を VOICEVOX_API_KEY に。
// 切るときは Vercel の環境変数 CAPTAIN_VOICE=off。

/** 読む設定（環境変数の一部。確かめ用に差しかえられる） */
export type VoiceEnv = Readonly<Record<string, string | undefined>>;

/**
 * 既定の声: 10 = VOICEVOX:雨晴はう（ノーマル）。シマエナガらしい、小さくてふんわり高めの声（11/7 本人の指示「ずんだもん以外で、シマエナガっぽいやつで」。
 * 候補9つを同じ文で合成して測り、高め（基本周波数の中央値 393Hz）で声の大きさの揺れがやさしいものを選んだ）。
 * VOICEVOX_SPEAKER で変えられる（番号は api.tts.quest/v3/voicevox/speakers_array の順）
 */
export const DEFAULT_SPEAKER = 10;
/** 1回に読む長さの上限（文字）。長い文は前から */
export const VOICE_TEXT_MAX = 200;
const API = "https://api.tts.quest/v3/voicevox/synthesis";

export function voiceEnabled(env: VoiceEnv = process.env): boolean {
  return (env.CAPTAIN_VOICE ?? "on").trim().toLowerCase() !== "off";
}

export function speakerId(env: VoiceEnv = process.env): number {
  const n = Number(env.VOICEVOX_SPEAKER);
  return Number.isInteger(n) && n >= 0 ? n : DEFAULT_SPEAKER;
}

/** 読む前の整え: 絵文字・飾りを落とし、隊長の口癖の「〜」を伸ばす音に。空なら "" */
export function voiceText(text: string): string {
  return text
    .replace(/\p{Extended_Pictographic}️?|[☀-➿]|[☃️🎉📷🔔💡🗺📍🪪🎓👟]/gu, "")
    .replace(/[【】\[\]「」『』]/g, " ")
    .replace(/しま〜/g, "しまー")
    .replace(/えな〜/g, "えなー")
    .replace(/〜/g, "ー")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, VOICE_TEXT_MAX);
}

export function synthesisUrl(text: string, env: VoiceEnv = process.env): string {
  const u = new URL(API);
  u.searchParams.set("text", text);
  u.searchParams.set("speaker", String(speakerId(env)));
  const key = env.VOICEVOX_API_KEY?.trim();
  if (key) u.searchParams.set("key", key);
  return u.toString();
}

interface SynthResponse {
  success: boolean;
  errorMessage?: string;
  retryAfter?: number;
  speakerName?: string;
  audioStatusUrl?: string;
  mp3DownloadUrl?: string;
  mp3StreamingUrl?: string;
}
interface StatusResponse {
  success: boolean;
  isAudioReady?: boolean;
  isAudioError?: boolean;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 文を mp3 に。できなければ null（画面はブラウザの声に戻る）。全体で 25 秒まで待つ（鍵なしは長い文ほど遅い。11/7 本人の指摘「読み上げない」） */
export async function synthesize(text: string, fetchFn: typeof fetch = fetch): Promise<{ mp3: Uint8Array; speakerName?: string } | null> {
  const t = voiceText(text);
  if (!t) return null;
  const started = Date.now();
  const res = await fetchFn(synthesisUrl(t), { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;
  const j = (await res.json()) as SynthResponse;
  if (!j.success || !j.mp3DownloadUrl) return null;
  // できあがりを待つ（短い文なら 1〜2 秒）
  if (j.audioStatusUrl) {
    for (;;) {
      const s = await fetchFn(j.audioStatusUrl, { signal: AbortSignal.timeout(5000) }).then((r) => (r.ok ? (r.json() as Promise<StatusResponse>) : null)).catch(() => null);
      if (s?.isAudioReady) break;
      if (s?.isAudioError || Date.now() - started > 25_000) return null;
      await sleep(400);
    }
  }
  const audio = await fetchFn(j.mp3DownloadUrl, { signal: AbortSignal.timeout(8000) });
  if (!audio.ok) return null;
  const mp3 = new Uint8Array(await audio.arrayBuffer());
  return mp3.byteLength > 0 ? { mp3, speakerName: j.speakerName } : null;
}
