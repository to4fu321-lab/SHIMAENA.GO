// 隊長の声（spec v1.33）: GET /api/voice?text=… で、VOICEVOX のかわいい声の mp3 を返す。
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
  return new Response(new Uint8Array(mp3), {
    headers: {
      "content-type": "audio/mpeg",
      "content-length": String(mp3.byteLength),
      "cache-control": "public, max-age=86400, s-maxage=604800",
    },
  });
}
