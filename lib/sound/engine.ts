"use client";
// 音の入れ物（spec v1.19）。画面に1つだけの AudioContext と、master／効果音／BGM の3つの音量。
// - スマホは最初のタップまで音を出せない → unlock() を最初の操作で呼ぶ（SoundProvider）
// - 画面を裏に回したら止め、戻ったら続きから（BGM 側が onVisibility で聞く）
// - 設定（効果音・BGM のオン／オフ）はここが持ち、useSoundPrefs() で画面が同期する
import { useSyncExternalStore } from "react";
import { DEFAULT_SOUND_PREFS, readSoundPrefs, writeSoundPrefs, type SoundPrefs } from "./prefs";
import { SFX, VIBRATE_MS, type SfxName } from "./sfx";

const VOL = { master: 0.8, sfx: 1.0, bgm: 0.16 } as const;

interface Engine {
  ctx: AudioContext;
  master: GainNode;
  sfx: GainNode;
  bgm: GainNode;
}

let engine: Engine | null = null;
/** 一度でも人の操作があったか（それより前に予約した音は、最初のタップで一斉に鳴ってしまうので捨てる） */
let gestureSeen = false;
let prefs: SoundPrefs | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => void listeners.delete(cb);
};

/** いまの設定（画面の外でも読める） */
export function soundPrefs(): SoundPrefs {
  if (!prefs) prefs = typeof window === "undefined" ? { ...DEFAULT_SOUND_PREFS } : readSoundPrefs();
  return prefs;
}

export function setSoundPrefs(next: Partial<SoundPrefs>): void {
  prefs = { ...soundPrefs(), ...next };
  writeSoundPrefs(prefs);
  if (engine) engine.bgm.gain.setTargetAtTime(prefs.bgm ? bgmLevel : 0, engine.ctx.currentTime, 0.05);
  emit();
}

/** 設定が変わったら知らせる（BGM 側が聞く） */
export const onSoundPrefs = subscribe;

/** 設定を画面で使う（変わったら描き直す）。サーバーでは初期値 */
export function useSoundPrefs(): SoundPrefs {
  return useSyncExternalStore(subscribe, soundPrefs, () => DEFAULT_SOUND_PREFS);
}

/** 音が使える端末か（AudioContext があるか） */
export function soundSupported(): boolean {
  return typeof window !== "undefined" && Boolean(window.AudioContext ?? (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext);
}

/** AudioContext を作る（1回だけ）。作れない端末では null */
export function getEngine(): Engine | null {
  if (engine) return engine;
  if (!soundSupported()) return null;
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctor();
    const master = ctx.createGain();
    master.gain.value = VOL.master;
    master.connect(ctx.destination);
    const sfx = ctx.createGain();
    sfx.gain.value = VOL.sfx;
    sfx.connect(master);
    const bgm = ctx.createGain();
    bgm.gain.value = soundPrefs().bgm ? VOL.bgm : 0;
    bgm.connect(master);
    engine = { ctx, master, sfx, bgm };
    return engine;
  } catch {
    return null;
  }
}

/** 最初のタップで呼ぶ: 止まっている AudioContext を動かす。動いたら true */
export async function unlock(): Promise<boolean> {
  const e = getEngine();
  if (!e) return false;
  gestureSeen = true;
  try {
    if (e.ctx.state !== "running") await e.ctx.resume();
  } catch {
    /* 解放できなければ次のタップでもう一度 */
  }
  const ok = e.ctx.state === "running";
  if (ok) unlockedHooks.forEach((h) => h());
  return ok;
}

export function isUnlocked(): boolean {
  return engine?.ctx.state === "running";
}

const unlockedHooks = new Set<() => void>();
/** 音が解放された瞬間に1回したいこと（BGM を始める など） */
export function onUnlocked(h: () => void): () => void {
  if (isUnlocked()) h();
  unlockedHooks.add(h);
  return () => void unlockedHooks.delete(h);
}

/** 効果音を鳴らす。delay は秒（CSS の演出に合わせて予約するとき）。設定がオフなら何もしない */
export function play(name: SfxName, opts: { delay?: number; gain?: number } = {}): void {
  if (!soundPrefs().sfx) return;
  const e = getEngine();
  if (!e || !gestureSeen || e.ctx.state === "closed") return;
  try {
    let out: AudioNode = e.sfx;
    if (opts.gain !== undefined && opts.gain !== 1) {
      const g = e.ctx.createGain();
      g.gain.value = opts.gain;
      g.connect(e.sfx);
      out = g;
    }
    SFX[name](e.ctx, out, e.ctx.currentTime + (opts.delay ?? 0));
  } catch {
    /* 音で画面を壊さない */
  }
  const v = VIBRATE_MS[name];
  if (v && !opts.delay) vibrate(v);
}

/** 振動（Android だけ）。効果音オフなら振動もしない */
export function vibrate(ms: number): void {
  if (!soundPrefs().sfx) return;
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* 使えない端末 */
  }
}

// ---- BGM の音量（トークでは半分） ----
let bgmLevel: number = VOL.bgm;
export function setBgmLevel(mult = 1): void {
  bgmLevel = VOL.bgm * mult;
  if (engine) engine.bgm.gain.setTargetAtTime(soundPrefs().bgm ? bgmLevel : 0, engine.ctx.currentTime, 0.3);
}

/** 画面が裏に回った／戻った（SoundProvider が呼ぶ）。BGM 側が聞く */
const visibilityHooks = new Set<(hidden: boolean) => void>();
export function onVisibility(h: (hidden: boolean) => void): () => void {
  visibilityHooks.add(h);
  return () => void visibilityHooks.delete(h);
}
export function notifyVisibility(hidden: boolean): void {
  visibilityHooks.forEach((h) => h(hidden));
  const e = engine;
  if (!e) return;
  try {
    if (hidden) void e.ctx.suspend();
    else void e.ctx.resume();
  } catch {
    /* どちらでも画面は動く */
  }
}
