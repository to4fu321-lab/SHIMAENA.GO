import { describe, expect, it } from "vitest";
import { captainVoiceName } from "./credit";
import { CAPTAIN_STYLE, DEFAULT_SPEAKER, engineUrl, speakerId, synthesize, synthesisUrl, VOICE_TEXT_MAX, voiceEnabled, voiceText, wakeEngine } from "./voicevox";

describe("隊長の声（VOICEVOX）", () => {
  it("設定: 既定はオン・満別花丸（元気）。CAPTAIN_VOICE=off で切れる。VOICEVOX_SPEAKER で声を変える", () => {
    expect(voiceEnabled({})).toBe(true);
    expect(voiceEnabled({ CAPTAIN_VOICE: "off" })).toBe(false);
    expect(speakerId({})).toBe(DEFAULT_SPEAKER);
    expect(speakerId({ VOICEVOX_SPEAKER: "8" })).toBe(8);
    expect(speakerId({ VOICEVOX_SPEAKER: "abc" })).toBe(DEFAULT_SPEAKER);
    expect(captainVoiceName({})).toBe("VOICEVOX:満別花丸");
    expect(captainVoiceName({ VOICEVOX_SPEAKER: "8" })).toBe("VOICEVOX:春日部つむぎ");
    expect(captainVoiceName({ VOICEVOX_SPEAKER: "999" })).toBe("VOICEVOX");
    expect(captainVoiceName({ CAPTAIN_VOICE: "off" })).toBeUndefined();
  });

  it("読む前の整え: 絵文字を落とし、口癖の「〜」を伸ばす音に、長さの上限", () => {
    expect(voiceText("☃️ 今朝は 12cm 積もったしま〜！🎉")).toBe("今朝は 12cm 積もったしまー！");
    expect(voiceText("行けるえな〜 【拠点3】")).toBe("行けるえなー 拠点3");
    expect(voiceText("   ")).toBe("");
    expect(voiceText("あ".repeat(500))).toHaveLength(VOICE_TEXT_MAX);
  });

  it("呼び出しの URL: 文と声の番号、鍵は環境変数にあるときだけ", () => {
    const u = new URL(synthesisUrl("こんにちは", {}));
    expect(u.hostname).toBe("api.tts.quest");
    expect(u.searchParams.get("text")).toBe("こんにちは");
    expect(u.searchParams.get("speaker")).toBe(String(DEFAULT_SPEAKER));
    expect(u.searchParams.has("key")).toBe(false);
    expect(new URL(synthesisUrl("a", { VOICEVOX_API_KEY: "k1" })).searchParams.get("key")).toBe("k1");
  });

  it("作る: 申し込み → できあがりを待つ → mp3。混んでいる・失敗は null", async () => {
    const calls: string[] = [];
    let status = 0;
    const fakeFetch = (async (input: string | URL | Request) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("/synthesis")) {
        return new Response(JSON.stringify({ success: true, speakerName: "VOICEVOX:ずんだもん（ノーマル）", audioStatusUrl: "https://x/status.json", mp3DownloadUrl: "https://x/audio.mp3" }));
      }
      if (url.endsWith("status.json")) return new Response(JSON.stringify({ success: true, isAudioReady: ++status >= 2 }));
      return new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "audio/mpeg" } });
    }) as typeof fetch;
    const r = await synthesize("こんにちは", fakeFetch);
    expect(r?.audio).toEqual(new Uint8Array([1, 2, 3]));
    expect(r?.type).toBe("audio/mpeg");
    expect(r?.speakerName).toContain("ずんだもん");
    expect(calls.filter((c) => c.endsWith("status.json"))).toHaveLength(2);

    const busy = (async () => new Response(JSON.stringify({ success: false, errorMessage: "points", retryAfter: 60 }))) as typeof fetch;
    expect(await synthesize("こんにちは", busy)).toBeNull();
    // 「あと少し待って」（retryAfter が短い）は待って頼み直す（2つ目の文が止まらないように）
    let tries = 0;
    const soon = (async (input: string | URL | Request) => {
      if (String(input).includes("/synthesis") && ++tries === 1) return new Response(JSON.stringify({ success: false, errorMessage: 429, retryAfter: 0.01 }));
      return fakeFetch(input);
    }) as typeof fetch;
    expect((await synthesize("こんにちは", soon))?.audio).toEqual(new Uint8Array([1, 2, 3]));
    expect(tries).toBe(2);
    const down = (async () => new Response("", { status: 503 })) as typeof fetch;
    expect(await synthesize("こんにちは", down)).toBeNull();
    expect(await synthesize("🎉", fakeFetch)).toBeNull();
  });

  it("自前の ENGINE（VOICEVOX_URL）: 読み方をもらい → 元気な調子に直して → wav。眠っていれば null", async () => {
    const env = { VOICEVOX_URL: "https://x.hf.space/", VOICEVOX_SPEAKER: "8" };
    expect(engineUrl(env)).toBe("https://x.hf.space");
    expect(engineUrl({})).toBeUndefined();
    const calls: { url: string; body?: string }[] = [];
    const fakeFetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, body: typeof init?.body === "string" ? init.body : undefined });
      if (url.includes("/audio_query")) return new Response(JSON.stringify({ accent_phrases: [], speedScale: 1, pitchScale: 0, outputSamplingRate: 24000 }));
      if (url.includes("/synthesis")) return new Response(new Uint8Array([9, 8]), { headers: { "content-type": "audio/wav" } });
      if (url.endsWith("/version")) return new Response(JSON.stringify("0.26.1"));
      return new Response("", { status: 404 });
    }) as typeof fetch;
    const r = await synthesize("こんにちは〜", fakeFetch, env);
    expect(r?.type).toBe("audio/wav");
    expect(r?.audio).toEqual(new Uint8Array([9, 8]));
    expect(calls[0].url).toBe("https://x.hf.space/audio_query?text=%E3%81%93%E3%82%93%E3%81%AB%E3%81%A1%E3%81%AF%E3%83%BC&speaker=8");
    expect(calls[1].url).toBe("https://x.hf.space/synthesis?speaker=8");
    const sent = JSON.parse(calls[1].body!);
    expect(sent.speedScale).toBe(CAPTAIN_STYLE.speedScale);
    expect(sent.outputSamplingRate).toBe(24000);
    expect(await wakeEngine(env, fakeFetch)).toBe(true);
    expect(await wakeEngine({}, fakeFetch)).toBe(false);

    const asleep = (async () => new Response("<html>starting</html>", { status: 503 })) as typeof fetch;
    expect(await synthesize("こんにちは", asleep, env)).toBeNull();
    expect(await wakeEngine(env, asleep)).toBe(false);
  });
});
