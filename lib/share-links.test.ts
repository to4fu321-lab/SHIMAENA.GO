import { describe, expect, it } from "vitest";
import { cheerRequestMessage, clearMessage, inviteMessage, lineShareUrl, xShareUrl } from "./share-links";

describe("共有のリンク", () => {
  it("LINE は文とリンクを1つにまとめて送る画面を開く", () => {
    const u = lineShareUrl("こんにちは", "https://example.com/a?b=1");
    expect(u.startsWith("https://line.me/R/share?text=")).toBe(true);
    expect(decodeURIComponent(u.split("text=")[1])).toBe("こんにちは\nhttps://example.com/a?b=1");
  });
  it("X は投稿画面に文とリンクを渡す", () => {
    const u = new URL(xShareUrl("雪かき", "https://example.com"));
    expect(u.host).toBe("x.com");
    expect(u.searchParams.get("text")).toBe("雪かき");
    expect(u.searchParams.get("url")).toBe("https://example.com");
  });
  it("誘うリンクは友だち追加 URL があればそれ、なければ公開ページ", () => {
    expect(inviteMessage("https://s.example", "https://lin.ee/abc").url).toBe("https://lin.ee/abc");
    expect(inviteMessage("https://s.example").url).toBe("https://s.example/public/town?via=sns");
  });
  it("応援を頼むリンクは公開ページの応援へ", () => {
    expect(cheerRequestMessage("https://s.example").url).toBe("https://s.example/public/town?via=cheer#cheer");
  });
  it("投稿文に名前や拠点の番号を入れない", () => {
    for (const t of [clearMessage("house"), clearMessage("solo", 3), inviteMessage("x").text, cheerRequestMessage("x").text]) {
      expect(t).not.toMatch(/拠点|さん/);
    }
  });
});

describe("応援を呼ぶ（ミッション中）", () => {
  it("ミッションの名前が入り、名前・場所は入らない", async () => {
    const { cheerRequestMessage } = await import("./share-links");
    const m = cheerRequestMessage("https://example.com", "自分の家の雪かき");
    expect(m.text).toContain("「自分の家の雪かき」に出動中");
    expect(m.url).toBe("https://example.com/public/town?via=cheer#cheer");
    expect(cheerRequestMessage("https://example.com").text).toContain("出動しています");
  });
});
