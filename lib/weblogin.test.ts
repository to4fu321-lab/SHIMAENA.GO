import { describe, expect, it } from "vitest";
import { bindLogin, claimLogin, createLogin, newNonce, parseLoginText } from "./weblogin";

describe("ブラウザでログイン（LINE で合言葉を送る）", () => {
  it("LINE の文から合言葉を読む（全角・小文字も）", () => {
    expect(parseLoginText("ログイン ABC234")).toBe("ABC234");
    expect(parseLoginText("ログインabc234")).toBe("ABC234");
    expect(parseLoginText("ログイン　ＡＢＣ２３４")).toBe("ABC234");
    expect(parseLoginText("ログインしたい")).toBeUndefined();
    expect(parseLoginText("123456")).toBeUndefined(); // 家族の連携コードとは別
  });

  it("送った本人とだけ結ばれ、合言葉を出したブラウザでだけ1回使える", async () => {
    const nonce = newNonce();
    const code = await createLogin(nonce);
    expect(await claimLogin(code, nonce)).toBeUndefined(); // まだ LINE で送っていない
    expect(await bindLogin(code, "p-me")).toBe(true);
    expect(await bindLogin(code, "p-other")).toBe(false); // 2人目は結べない
    expect(await claimLogin(code, newNonce())).toBeUndefined(); // ほかのブラウザでは使えない
    expect(await claimLogin(code, nonce)).toBe("p-me");
    expect(await claimLogin(code, nonce)).toBeUndefined(); // 1回だけ
  });

  it("10分を過ぎた合言葉は使えない", async () => {
    const nonce = newNonce();
    const t0 = new Date("2026-12-14T01:00:00Z");
    const code = await createLogin(nonce, t0);
    expect(await bindLogin(code, "p-me", new Date(t0.getTime() + 11 * 60_000))).toBe(false);
  });
});
