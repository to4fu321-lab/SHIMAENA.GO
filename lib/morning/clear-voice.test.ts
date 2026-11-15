import { describe, expect, it } from "vitest";
import { splitForVoice } from "../speech/split";
import { CLEAR_VOICE_HEAD, clearVoiceText, photoStars, verdictWord } from "./clear-voice";

const ok = { cleared: true, passable: true, icy: false, uncertain: false, comment: "玄関前から道路まで通れます。お疲れさまでした。（撮影用の決まった文）" };

describe("「1軒 完了！」で隊長が言うこと（v1.61）", () => {
  it("完了 → 星 → 隊長のひとこと の順。かっこの注意書きは読まない", () => {
    const t = clearVoiceText({ baseNumber: 7, photo: ok });
    expect(t).toBe("やったー！1軒完了だしま〜！拠点7に灯りがともりました。写真の判定は、星3つ。ばっちり！玄関前から道路まで通れます。お疲れさまでした。");
  });

  it("最初の一言はいつも同じ文で切れる（同じ声を使い回せる）", () => {
    expect(splitForVoice(clearVoiceText({ baseNumber: 3, photo: ok }))[0]).toBe(CLEAR_VOICE_HEAD);
    expect(splitForVoice(clearVoiceText({ baseNumber: 10, photo: { ...ok, icy: true } }))[0]).toBe(CLEAR_VOICE_HEAD);
  });

  it("星は ✓ の数。凍結があれば2つ、確かめきれなければ星なしで「報告として受け付け」", () => {
    expect(photoStars(ok)).toBe(3);
    expect(photoStars({ ...ok, icy: true })).toBe(2);
    expect(photoStars({ ...ok, uncertain: true })).toBeUndefined();
    expect(photoStars(undefined)).toBeUndefined();
    expect(verdictWord(2)).toBe("よくできました");
    expect(clearVoiceText({ baseNumber: 2, photo: { ...ok, icy: true } })).toContain("写真の判定は、星2つ。よくできました。");
    const manual = clearVoiceText({ baseNumber: 2, photo: { ...ok, uncertain: true, comment: "本人の報告で完了にしました（写真では確認していません）。お疲れさまでした。" } });
    expect(manual).toContain("報告として受け付けました");
    expect(manual).not.toContain("星");
    expect(manual).not.toContain("確認していません");
  });

  it("危ないものは1つだけ読む。全体は180字まで", () => {
    const t = clearVoiceText({ baseNumber: 1, photo: { ...ok, comment: "あ".repeat(200) }, hazards: ["屋根の雪に気をつけてください", "つららがあります"] });
    expect(t.length).toBeLessThanOrEqual(180);
    expect(clearVoiceText({ baseNumber: 1, photo: ok, hazards: ["屋根の雪に気をつけてください", "つららがあります"] })).toMatch(/屋根の雪に気をつけてください。$/);
  });
});
