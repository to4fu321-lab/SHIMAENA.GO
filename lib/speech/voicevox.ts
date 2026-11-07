// 隊長の声（spec v1.36・v1.37）: VOICEVOX のかわいい声を作る。作り方は2つ。
// 1) VOICEVOX_URL があれば、自前の VOICEVOX ENGINE（Hugging Face Spaces の無料枠。deploy/voicevox-space/）で直接作る。wav が 1〜2 秒で返る。
// 2) なければ、無料の VOICEVOX Web API（api.tts.quest）。鍵があっても1文に 10 秒以上かかる（11/7 本人の指摘「遅すぎて使えない」）ので、確かめ用。
// どちらもサーバー側でだけ呼ぶ（URL や鍵を画面に出さない）。失敗したら画面はブラウザの声に戻る（止まらない）。
// 声の主は VOICEVOX のキャラクター。使うときはクレジット「VOICEVOX:春日部つむぎ」などを出す決まり（画面の「ことば」の紙と README に）。
// 切るときは Vercel の環境変数 CAPTAIN_VOICE=off。

/** 読む設定（環境変数の一部。確かめ用に差しかえられる） */
export type VoiceEnv = Readonly<Record<string, string | undefined>>;

/** できあがった声。wav（自前の ENGINE）か mp3（Web API） */
export interface Voice {
  audio: Uint8Array;
  type: "audio/wav" | "audio/mpeg";
  speakerName?: string;
}

/**
 * 既定の声: 8 = VOICEVOX:春日部つむぎ（ノーマル）。元気でかわいい声（11/7 本人が8つを聞きくらべて「8か54」→ 8。
 * 54 = 春歌ナナ にするときは VOICEVOX_SPEAKER=54。前は 70 = 満別花丸・10 = 雨晴はう）。
 * VOICEVOX_SPEAKER で変えられる（番号は VOICEVOX ENGINE のスタイル ID。api.tts.quest/v3/voicevox/speakers_array の順と同じ）
 */
export const DEFAULT_SPEAKER = 8;
/** 1回に読む長さの上限（文字）。長い文は前から */
export const VOICE_TEXT_MAX = 200;
const API = "https://api.tts.quest/v3/voicevox/synthesis";

/** 元気でかわいい調子（11/7 本人の指示）: 少し速く・少し高く・抑揚つよめ。前後の無音は短く（鳴り始めを早く） */
export const CAPTAIN_STYLE = { speedScale: 1.1, pitchScale: 0.03, intonationScale: 1.3, prePhonemeLength: 0.05, postPhonemeLength: 0.1 } as const;

/** 自前の ENGINE に「読み方」を聞く待ち時間。眠っている Space は 1 分ほど起きないので、その間はブラウザの声 */
const ENGINE_QUERY_MS = 8_000;
/** 自前の ENGINE が声を作る待ち時間 */
const ENGINE_SYNTH_MS = 15_000;

export function voiceEnabled(env: VoiceEnv = process.env): boolean {
  return (env.CAPTAIN_VOICE ?? "on").trim().toLowerCase() !== "off";
}

export function speakerId(env: VoiceEnv = process.env): number {
  const n = Number(env.VOICEVOX_SPEAKER);
  return Number.isInteger(n) && n >= 0 ? n : DEFAULT_SPEAKER;
}

/** 自前の VOICEVOX ENGINE の URL（例 https://xxx.hf.space）。末尾の / は落とす。なければ undefined */
export function engineUrl(env: VoiceEnv = process.env): string | undefined {
  const u = env.VOICEVOX_URL?.trim().replace(/\/+$/, "");
  return u ? u : undefined;
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

// ---- 1) 自前の VOICEVOX ENGINE ----

/**
 * 自前の ENGINE で作る: /audio_query で読み方をもらい、調子を元気に直して /synthesis で wav に。
 * できなければ null（眠っている・落ちている）
 */
export async function synthesizeEngine(text: string, env: VoiceEnv = process.env, fetchFn: typeof fetch = fetch): Promise<Voice | null> {
  const base = engineUrl(env);
  const t = voiceText(text);
  if (!base || !t) return null;
  const sp = speakerId(env);
  const q = await fetchFn(`${base}/audio_query?${new URLSearchParams({ text: t, speaker: String(sp) })}`, { method: "POST", signal: AbortSignal.timeout(ENGINE_QUERY_MS) });
  if (!q.ok) return null;
  const query = { ...((await q.json()) as Record<string, unknown>), ...CAPTAIN_STYLE };
  const s = await fetchFn(`${base}/synthesis?speaker=${sp}`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "audio/wav" },
    body: JSON.stringify(query),
    signal: AbortSignal.timeout(ENGINE_SYNTH_MS),
  });
  if (!s.ok) return null;
  const audio = new Uint8Array(await s.arrayBuffer());
  return audio.byteLength > 0 ? { audio, type: "audio/wav" } : null;
}

/** 眠っている Space を起こす（画面を開いたときに1回）。起きていれば true。ENGINE がなければ false */
export async function wakeEngine(env: VoiceEnv = process.env, fetchFn: typeof fetch = fetch): Promise<boolean> {
  const base = engineUrl(env);
  if (!base) return false;
  const r = await fetchFn(`${base}/version`, { signal: AbortSignal.timeout(3_000) }).catch(() => null);
  return !!r?.ok;
}

// ---- 2) 無料の VOICEVOX Web API（api.tts.quest） ----

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
  errorMessage?: string | number;
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

/** 429 で待ってよい長さ（ここまでに頼み直せるなら待つ）。全体は 25 秒であきらめる */
const RETRY_BUDGET_MS = 18_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Web API で mp3 に。できなければ null。全体で 25 秒まで待つ（鍵なしは長い文ほど遅い） */
export async function synthesizeQuest(text: string, fetchFn: typeof fetch = fetch, env: VoiceEnv = process.env): Promise<Voice | null> {
  const t = voiceText(text);
  if (!t) return null;
  const started = Date.now();
  // 鍵なしは「前の声を作ってすぐ」だと 429 と「あと何秒」（retryAfter）が返る。隊長の返事は2つに分けて続けて頼むので、
  // 2つ目がいつもここで断られ、読み上げが最初の「。」で止まっていた（11/7 本人の指摘）→ 言われた秒数だけ待ってもう一度
  let j: SynthResponse;
  for (;;) {
    const res = await fetchFn(synthesisUrl(t, env), { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    j = (await res.json()) as SynthResponse;
    const wait = (j.retryAfter ?? 0) * 1000 + 300;
    if (j.success || !j.retryAfter || Date.now() - started + wait > RETRY_BUDGET_MS) break;
    await sleep(wait);
  }
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
  return mp3.byteLength > 0 ? { audio: mp3, type: "audio/mpeg", speakerName: j.speakerName } : null;
}

/** 文を声に。VOICEVOX_URL があれば自前の ENGINE、なければ Web API。できなければ null（画面はブラウザの声に戻る） */
export async function synthesize(text: string, fetchFn: typeof fetch = fetch, env: VoiceEnv = process.env): Promise<Voice | null> {
  return engineUrl(env) ? synthesizeEngine(text, env, fetchFn) : synthesizeQuest(text, fetchFn, env);
}
