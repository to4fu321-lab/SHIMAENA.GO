import { describe, expect, it } from "vitest";
import { DEFAULT_SOUND_PREFS, parseSoundPrefs, serializeSoundPrefs } from "./prefs";

describe("音の設定", () => {
  it("何もなければ両方オン", () => {
    expect(parseSoundPrefs(null)).toEqual({ sfx: true, bgm: true, ownMusic: false });
    expect(parseSoundPrefs("")).toEqual(DEFAULT_SOUND_PREFS);
  });
  it("保存した形を読み戻せる", () => {
    const s = serializeSoundPrefs({ sfx: false, bgm: true, ownMusic: true });
    expect(parseSoundPrefs(s)).toEqual({ sfx: false, bgm: true, ownMusic: true });
  });
  it("壊れていても落ちない・足りない項目は初期値", () => {
    expect(parseSoundPrefs("{oops")).toEqual(DEFAULT_SOUND_PREFS);
    expect(parseSoundPrefs('{"bgm":false}')).toEqual({ sfx: true, bgm: false, ownMusic: false });
    expect(parseSoundPrefs('{"sfx":"yes"}')).toEqual(DEFAULT_SOUND_PREFS);
    expect(parseSoundPrefs("null")).toEqual(DEFAULT_SOUND_PREFS);
  });
});
