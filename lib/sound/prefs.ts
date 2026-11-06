// 音の設定（spec v1.19）: 効果音と BGM を別々にオン・オフ。端末の localStorage に持つ（鍵は PushSetup と同じ付け方）。
// 初期値は両方オン（本人の決定 11/6）。読めないとき・壊れているときは初期値。

export interface SoundPrefs {
  sfx: boolean;
  bgm: boolean;
}

export const SOUND_PREFS_KEY = "shimaena-sound";
export const DEFAULT_SOUND_PREFS: SoundPrefs = { sfx: true, bgm: true };

/** 保存した文字列から設定へ。足りない項目・壊れた JSON は初期値で埋める */
export function parseSoundPrefs(raw: string | null | undefined): SoundPrefs {
  if (!raw) return { ...DEFAULT_SOUND_PREFS };
  try {
    const o = JSON.parse(raw) as Partial<Record<keyof SoundPrefs, unknown>>;
    if (!o || typeof o !== "object") return { ...DEFAULT_SOUND_PREFS };
    return {
      sfx: typeof o.sfx === "boolean" ? o.sfx : DEFAULT_SOUND_PREFS.sfx,
      bgm: typeof o.bgm === "boolean" ? o.bgm : DEFAULT_SOUND_PREFS.bgm,
    };
  } catch {
    return { ...DEFAULT_SOUND_PREFS };
  }
}

export function serializeSoundPrefs(p: SoundPrefs): string {
  return JSON.stringify({ sfx: p.sfx, bgm: p.bgm });
}

export function readSoundPrefs(): SoundPrefs {
  try {
    return parseSoundPrefs(localStorage.getItem(SOUND_PREFS_KEY));
  } catch {
    return { ...DEFAULT_SOUND_PREFS };
  }
}

export function writeSoundPrefs(p: SoundPrefs): void {
  try {
    localStorage.setItem(SOUND_PREFS_KEY, serializeSoundPrefs(p));
  } catch {
    /* プライベートモードなどで覚えられなくても、この画面の間は効く */
  }
}
