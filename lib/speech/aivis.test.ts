import { describe, expect, it } from "vitest";
import { AIVIS_TONE, aivisEnabled, aivisVoiceName, DEFAULT_AIVIS_MODEL, synthesizeAivis } from "./aivis";
import { captainVoiceName } from "./credit";
import { synthesize } from "./voicevox";

describe("隊長の声（Aivis Cloud API）", () => {
  it("設定: AIVIS_API_KEY があれば使う。声は AIVIS_MODEL・AIVIS_STYLE。クレジットも Aivis の名前に", () => {
    expect(aivisEnabled({})).toBe(false);
    expect(aivisEnabled({ AIVIS_API_KEY: " k " })).toBe(true);
    expect(aivisVoiceName({ AIVIS_API_KEY: "k" })).toBe("AivisSpeech: コハク");
    expect(aivisVoiceName({ AIVIS_MODEL: "a59cb814-0083-4369-8542-f51a29e72af7" })).toBe("AivisSpeech: まお");
    expect(aivisVoiceName({ AIVIS_MODEL: "00000000-0000-0000-0000-000000000000" })).toBe("AivisSpeech");
    expect(captainVoiceName({ AIVIS_API_KEY: "k" })).toBe("AivisSpeech: コハク");
    expect(captainVoiceName({ AIVIS_API_KEY: "k", CAPTAIN_VOICE: "off" })).toBeUndefined();
  });

  it("作る: 鍵を Bearer で送り、元気な調子で mp3。失敗・鍵なしは null。synthesize は Aivis を先に使う", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const ok = (async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      return new Response(new Uint8Array([7, 7]), { headers: { "content-type": "audio/mpeg" } });
    }) as typeof fetch;
    const env = { AIVIS_API_KEY: "k1", AIVIS_STYLE: "あまあま", VOICEVOX_URL: "https://x.hf.space" };
    const r = await synthesize("こんにちは〜🎉", ok, env);
    expect(r).toEqual({ audio: new Uint8Array([7, 7]), type: "audio/mpeg", speakerName: "AivisSpeech: コハク" });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.aivis-project.com/v1/tts/synthesize");
    expect((calls[0].init?.headers as Record<string, string>).authorization).toBe("Bearer k1");
    const body = JSON.parse(String(calls[0].init?.body));
    expect(body).toMatchObject({ model_uuid: DEFAULT_AIVIS_MODEL, style_name: "あまあま", text: "こんにちはー", output_format: "mp3", ...AIVIS_TONE });

    const down = (async () => new Response("{}", { status: 402 })) as typeof fetch;
    expect(await synthesizeAivis("こんにちは", env, down)).toBeNull();
    expect(await synthesizeAivis("こんにちは", {}, ok)).toBeNull();
  });
});
