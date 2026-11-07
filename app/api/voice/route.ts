// 隊長の声（spec v1.36）: GET /api/voice?text=… で、VOICEVOX のかわいい声の mp3 を返す。
// 画面（components/ChatTools.tsx の speakCaptain）が隊長の新しい吹き出しを読むときに呼ぶ。同じ文は CDN に1週間残す（同じ点呼の文は町じゅう同じ）。
// できないとき（切ってある・外のサービスが混んでいる）は 503 → 画面はブラウザの声に戻る。
import { NextResponse } from "next/server";
import { synthesize, voiceEnabled, voiceText } from "@/lib/speech/voicevox";

const g = globalThis as { __shimaenaVoiceCache?: Map<string, Uint8Array> };
const cache = () => (g.__shimaenaVoiceCache ??= new Map());
const CACHE_MAX = 200;

export async function GET(req: Request): Promise<Response> {
  if (!voiceEnabled()) return NextResponse.json({ ok: false, reason: "off" }, { status: 404 });
  const text = voiceText(new URL(req.url).searchParams.get("text") ?? "");
  if (!text) return NextResponse.json({ ok: false, reason: "empty" }, { status: 400 });
  let mp3 = cache().get(text);
  if (!mp3) {
    try {
      const r = await synthesize(text);
      if (!r) return NextResponse.json({ ok: false, reason: "unavailable" }, { status: 503, headers: { "cache-control": "no-store" } });
      mp3 = r.mp3;
      const c = cache();
      c.set(text, mp3);
      if (c.size > CACHE_MAX) c.delete(c.keys().next().value as string);
    } catch (e) {
      console.error("[voice] 声を作れませんでした:", e instanceof Error ? e.message : e);
      return NextResponse.json({ ok: false, reason: "error" }, { status: 503, headers: { "cache-control": "no-store" } });
    }
  }
  const headers = {
    "content-type": "audio/mpeg",
    "accept-ranges": "bytes",
    "cache-control": "public, max-age=86400, s-maxage=604800",
  };
  // 分けて取りに来たとき（Safari の <audio> など）は、その部分だけを 206 で返す
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    const size = mp3.byteLength;
    let start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    let end = range[1] && range[2] ? Number(range[2]) : size - 1;
    end = Math.min(end, size - 1);
    if (start > end || start >= size) {
      return new Response(null, { status: 416, headers: { ...headers, "content-range": `bytes */${size}` } });
    }
    start = Math.max(0, start);
    const part = mp3.slice(start, end + 1);
    return new Response(part, { status: 206, headers: { ...headers, "content-range": `bytes ${start}-${end}/${size}`, "content-length": String(part.byteLength) } });
  }
  return new Response(new Uint8Array(mp3), { headers: { ...headers, "content-length": String(mp3.byteLength) } });
}
