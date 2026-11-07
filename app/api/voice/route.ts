// 隊長の声（spec v1.36・v1.39）: GET /api/voice?text=… で、VOICEVOX のかわいい声（wav か mp3）を返す。
// 画面（components/ChatTools.tsx の speakCaptain）が隊長の新しい吹き出しを読むときに呼ぶ。同じ文は CDN に1週間残す（同じ点呼の文は町じゅう同じ）。
// GET /api/voice?wake=1 は、眠っている自前の ENGINE（Hugging Face Space）を起こすだけ（画面を開いたときに1回）。
// できないとき（切ってある・外のサービスが混んでいる・ENGINE が眠っている）は 503 → 画面はブラウザの声に戻る。
import { NextResponse } from "next/server";
import { synthesize, voiceEnabled, voiceText, wakeEngine, type Voice } from "@/lib/speech/voicevox";

/** 声ができるまで待てる長さ（秒）。lib/speech/voicevox.ts は 25 秒であきらめる */
export const maxDuration = 30;

const g = globalThis as { __shimaenaVoiceCache?: Map<string, Voice> };
const cache = () => (g.__shimaenaVoiceCache ??= new Map());
const CACHE_MAX = 200;

export async function GET(req: Request): Promise<Response> {
  if (!voiceEnabled()) return NextResponse.json({ ok: false, reason: "off" }, { status: 404 });
  const params = new URL(req.url).searchParams;
  if (params.get("wake")) {
    const awake = await wakeEngine();
    return NextResponse.json({ ok: awake }, { headers: { "cache-control": "no-store" } });
  }
  const text = voiceText(params.get("text") ?? "");
  if (!text) return NextResponse.json({ ok: false, reason: "empty" }, { status: 400 });
  let voice = cache().get(text);
  if (!voice) {
    try {
      const r = await synthesize(text);
      if (!r) return NextResponse.json({ ok: false, reason: "unavailable" }, { status: 503, headers: { "cache-control": "no-store" } });
      voice = r;
      const c = cache();
      c.set(text, voice);
      if (c.size > CACHE_MAX) c.delete(c.keys().next().value as string);
    } catch (e) {
      console.error("[voice] 声を作れませんでした:", e instanceof Error ? e.message : e);
      return NextResponse.json({ ok: false, reason: "error" }, { status: 503, headers: { "cache-control": "no-store" } });
    }
  }
  const { audio } = voice;
  const headers = {
    "content-type": voice.type,
    "accept-ranges": "bytes",
    "cache-control": "public, max-age=86400, s-maxage=604800",
  };
  // 分けて取りに来たとき（Safari の <audio> など）は、その部分だけを 206 で返す
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    const size = audio.byteLength;
    let start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    let end = range[1] && range[2] ? Number(range[2]) : size - 1;
    end = Math.min(end, size - 1);
    if (start > end || start >= size) {
      return new Response(null, { status: 416, headers: { ...headers, "content-range": `bytes */${size}` } });
    }
    start = Math.max(0, start);
    const part = audio.slice(start, end + 1);
    return new Response(part, { status: 206, headers: { ...headers, "content-range": `bytes ${start}-${end}/${size}`, "content-length": String(part.byteLength) } });
  }
  return new Response(new Uint8Array(audio), { headers: { ...headers, "content-length": String(audio.byteLength) } });
}
