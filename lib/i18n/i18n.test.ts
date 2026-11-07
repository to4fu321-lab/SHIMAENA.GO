import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatBubble } from "../inbox/view";
import { applyStrings, collectStrings, localizeBubbles, LOCALIZE_LAST } from "./bubbles";
import { isLang, LANG_INFO, LANGS, parseLang } from "./langs";
import { clearTranslationCache, textHash, toJapanese, TRANSLATE_MAX_ITEMS, translateTexts } from "./translate";
import { t, UI } from "./ui";

const captain = (id: string, text?: string, extra: Partial<ChatBubble> = {}): ChatBubble => ({ id, from: "captain", at: "2026-12-01T00:00:00Z", text, buttons: [], quick: [], ...extra });
const me = (id: string, text: string): ChatBubble => ({ id, from: "me", at: "2026-12-01T00:00:00Z", text, buttons: [], quick: [] });

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "");
  clearTranslationCache();
});
afterEach(() => vi.unstubAllEnvs());

describe("ことば", () => {
  it("知らない値・空は日本語。5つのことばに読み上げの印がある", () => {
    expect(parseLang(undefined)).toBe("ja");
    expect(parseLang("xx")).toBe("ja");
    expect(parseLang("en")).toBe("en");
    expect(isLang("vi")).toBe(true);
    for (const l of LANGS) expect(LANG_INFO[l].speech).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
  });

  it("画面の決まった文字は、5つのことば全部に同じ鍵で入っている", () => {
    const keys = Object.keys(UI.ja);
    for (const l of LANGS) {
      expect(Object.keys(UI[l]).sort()).toEqual([...keys].sort());
      for (const k of keys) expect((UI[l] as Record<string, string>)[k].trim()).not.toBe("");
    }
    expect(t("ja", "title")).toBe("隊長トーク");
    expect(t("en", "title")).toBe("Captain Talk");
    expect(t("ko", "send")).not.toBe(t("ja", "send"));
  });
});

describe("吹き出しの訳", () => {
  const bubbles: ChatBubble[] = [
    me("1", "こんにちは"),
    captain("2", "今朝は 12cm 積もったしま〜！"),
    captain("3", undefined, {
      lines: [
        { text: "拠点3へ", strong: true },
        { text: "隊長が調べたこと: 🗺 町の様子 ・ ☁ 天気と安全", steps: ["🗺 町の様子", "☁ 天気と安全"] },
      ],
      buttons: [{ kind: "postback", label: "行く", data: "go:yes", tone: "main" }],
      quick: [{ kind: "say", label: "使い方を教えて", text: "使い方を教えて", tone: "line" }],
    }),
  ];

  it("集めるのは隊長の文・行・ボタンの文字だけ（重複なし）。本人の文と「調べた」札は集めない", () => {
    const s = collectStrings(bubbles);
    expect(s).toEqual(["今朝は 12cm 積もったしま〜！", "拠点3へ", "行く", "使い方を教えて"]);
    expect(s).not.toContain("こんにちは");
    expect(collectStrings([captain("a", "x"), captain("b", "x")])).toEqual(["x"]);
  });

  it("はめるときはボタンの中身（data・text）と本人の文は変えない。古い吹き出しは日本語のまま", async () => {
    const out = await localizeBubbles(bubbles, "en", async (texts) => texts.map((x) => `EN(${x})`));
    expect(out[0].text).toBe("こんにちは");
    expect(out[1].text).toBe("EN(今朝は 12cm 積もったしま〜！)");
    expect(out[2].lines?.[0]).toEqual({ text: "EN(拠点3へ)", strong: true });
    expect(out[2].lines?.[1].steps).toEqual(["🗺 町の様子", "☁ 天気と安全"]);
    expect(out[2].buttons[0]).toEqual({ kind: "postback", label: "EN(行く)", data: "go:yes", tone: "main" });
    expect(out[2].quick[0]).toMatchObject({ label: "EN(使い方を教えて)", text: "使い方を教えて" });
    expect(bubbles[1].text).toBe("今朝は 12cm 積もったしま〜！"); // 元は触らない

    const many = Array.from({ length: LOCALIZE_LAST + 5 }, (_, i) => captain(`c${i}`, `文${i}`));
    const applied = applyStrings(many, new Map(many.map((b) => [b.text!, "訳"])));
    expect(applied[0].text).toBe("文0");
    expect(applied.at(-1)!.text).toBe("訳");
  });

  it("日本語を選んでいればそのまま（訳す関数を呼ばない）", async () => {
    const tr = vi.fn(async (texts: string[]) => texts);
    expect(await localizeBubbles(bubbles, "ja", tr)).toBe(bubbles);
    expect(tr).not.toHaveBeenCalled();
  });
});

describe("訳のキャッシュ", () => {
  it("鍵がなければ元の文のまま（訳す関数を呼ばない）", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const tr = vi.fn(async (texts: string[]) => texts.map((x) => `X${x}`));
    expect(await translateTexts(["あ", "い"], "en", tr)).toEqual(["あ", "い"]);
    expect(tr).not.toHaveBeenCalled();
  });

  it("同じ文は2度訳さない。数が合わない答えは元の文。上限を超えた古い文は日本語のまま", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test");
    const tr = vi.fn(async (texts: string[]) => texts.map((x) => `EN:${x}`));
    expect(await translateTexts(["おはよう", "雪かき", "おはよう"], "en", tr)).toEqual(["EN:おはよう", "EN:雪かき", "EN:おはよう"]);
    expect(tr).toHaveBeenCalledTimes(1);
    expect(tr.mock.calls[0][0]).toHaveLength(2);
    expect(await translateTexts(["雪かき", "新しい文"], "en", tr)).toEqual(["EN:雪かき", "EN:新しい文"]);
    expect(tr).toHaveBeenCalledTimes(2);
    expect(tr.mock.calls[1][0]).toEqual(["新しい文"]);

    const bad = vi.fn(async () => ["x"]);
    expect(await translateTexts(["a", "b"], "ko", bad)).toEqual(["a", "b"]);

    const many = Array.from({ length: TRANSLATE_MAX_ITEMS + 10 }, (_, i) => `文${i}`);
    const big = vi.fn(async (texts: string[]) => texts.map((x) => `VI:${x}`));
    const out = await translateTexts(many, "vi", big);
    expect(big.mock.calls[0][0]).toHaveLength(TRANSLATE_MAX_ITEMS);
    expect(out.at(-1)).toBe(`VI:文${TRANSLATE_MAX_ITEMS + 9}`); // 新しいほうから
    expect(out[0]).toBe("文0");
    expect(textHash("a")).toHaveLength(32);
  });

  it("本人の文を日本語に: 日本語ならそのまま、ほかは訳して貯める", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test");
    const tr = vi.fn(async (text: string) => `JA(${text})`);
    expect(await toJapanese("こんにちは", "ja", tr)).toBe("こんにちは");
    expect(await toJapanese("I want to help", "en", tr)).toBe("JA(I want to help)");
    expect(await toJapanese("I want to help", "en", tr)).toBe("JA(I want to help)");
    expect(tr).toHaveBeenCalledTimes(1);
    expect(await toJapanese("   ", "en", tr)).toBe("   ");
  });
});
