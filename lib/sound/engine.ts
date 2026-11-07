"use client";
// 音の入れ物（spec v1.19）。画面に1つだけの AudioContext と、master／効果音／BGM の3つの音量。
// - スマホは最初のタップまで音を出せない → unlock() を最初の操作で呼ぶ（SoundProvider）
// - 画面を裏に回したら止め、戻ったら続きから（BGM 側が onVisibility で聞く）
// - 設定（効果音・BGM のオン／オフ）はここが持ち、useSoundPrefs() で画面が同期する
import { useSyncExternalStore } from "react";
import { DEFAULT_SOUND_PREFS, readSoundPrefs, writeSoundPrefs, type SoundPrefs } from "./prefs";
import { SFX, VIBRATE_MS, type SfxName } from "./sfx";
import { createSpace, type Space } from "./space";
import { primeBackground } from "./background";

const VOL = { master: 0.8, sfx: 1.0, bgm: 0.55 } as const; // BGM は効果音より小さく（書き出して測った: 山 0.2〜0.3）

interface Engine {
  ctx: AudioContext;
  master: GainNode;
  sfx: GainNode;
  bgm: GainNode;
  /** BGM の響き（やまびこ・残響）。spec v1.37 */
  space: Space | null;
}

let engine: Engine | null = null;
/** 一度でも人の操作があったか（それより前に予約した音は、最初のタップで一斉に鳴ってしまうので捨てる） */
let gestureSeen = false;
/** 一度でも音が動いたか（動いたあとに止まっている＝裏から戻った直後など。その間の効果音は捨てる） */
let wasRunning = false;
/** 画面が裏にいるか */
let hiddenNow = false;
/**
 * 戻ったのに音が動かない（iPhone で別のアプリから戻ると、AudioContext が「動いている」と言いながら時計が止まったまま鳴らないことがある）
 * → 次のタップで AudioContext を作り直す（11/6 本人の指摘「別のアプリに移動してから再度開くと音が出なくなる」）
 */
let needsRebuild = false;
let healthTimer: number | undefined;
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
  applyAudioSession();
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
    // BGM は響き（やまびこ・残響）を通して master へ。組めない端末では直接
    let space: Space | null = null;
    try {
      space = createSpace(ctx, master);
      bgm.connect(space.input);
    } catch {
      bgm.connect(master);
    }
    engine = { ctx, master, sfx, bgm, space };
    return engine;
  } catch {
    return null;
  }
}

/**
 * 音の出し方（Safari の Audio Session）: 自分の音楽を聴きながら使うときは "ambient"＝ほかのアプリの音楽を止めずに重ねる。
 * ふだんは "auto"（端末にまかせる）。対応していない端末では何もしない（spec v1.38）
 */
function applyAudioSession(): void {
  try {
    const s = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
    if (s) s.type = soundPrefs().ownMusic ? "ambient" : "auto";
  } catch {
    /* 対応していない端末 */
  }
}

/** 最初のタップで呼ぶ: 止まっている AudioContext を動かす。壊れていれば作り直す。動いたら true */
export async function unlock(): Promise<boolean> {
  if (!gestureSeen) applyAudioSession(); // 音を出す前に決める
  primeBackground(); // 雪かき中の曲を裏で鳴らすための <audio> を、タップの中で鳴らせる状態に
  let e = needsRebuild ? rebuild() : getEngine();
  if (!e) return false;
  gestureSeen = true;
  try {
    if (e.ctx.state !== "running") await e.ctx.resume();
  } catch {
    /* 解放できなければ次のタップでもう一度 */
  }
  // タップの中でも動かなかった（iPhone の割り込みのあと など）: 1回だけ作り直して、もう一度
  if (e.ctx.state !== "running" && wasRunning) {
    e = rebuild();
    if (!e) return false;
    try {
      await e.ctx.resume();
    } catch {
      /* 次のタップでもう一度 */
    }
  }
  const ok = e.ctx.state === "running";
  if (ok) {
    wasRunning = true;
    unlockedHooks.forEach((h) => h());
    healthCheck(e);
  }
  return ok;
}

export function isUnlocked(): boolean {
  return engine?.ctx.state === "running";
}

/** AudioContext を作り直す（古いものは閉じる）。BGM 側は onRebuild で知って、曲を新しい入れ物で鳴らし直す */
function rebuild(): Engine | null {
  const old = engine;
  engine = null;
  needsRebuild = false;
  try {
    void old?.ctx.close();
  } catch {
    /* 閉じられなくても新しいものを使う */
  }
  const e = getEngine();
  rebuildHooks.forEach((h) => h());
  return e;
}

const rebuildHooks = new Set<() => void>();
/** AudioContext を作り直したとき（BGM を鳴らし直す など） */
export function onRebuild(h: () => void): () => void {
  rebuildHooks.add(h);
  return () => void rebuildHooks.delete(h);
}

/** 動いているはずなのに時計が進まなければ「壊れた」とみなし、次のタップで作り直す */
function healthCheck(e: Engine): void {
  if (typeof window === "undefined") return;
  window.clearTimeout(healthTimer);
  const t0 = e.ctx.currentTime;
  healthTimer = window.setTimeout(() => {
    if (engine !== e || hiddenNow) return;
    if (e.ctx.state !== "running" || e.ctx.currentTime <= t0) needsRebuild = true;
  }, 700);
}

/** 確かめ用: 作り直しが要る状態か */
export function soundNeedsRebuild(): boolean {
  return needsRebuild;
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
  if (!e || !gestureSeen || e.ctx.state === "closed" || hiddenNow) return;
  // 一度動いたあとに止まっている（裏から戻った直後・割り込みのあと）: 予約すると次のタップで一斉に鳴るので捨てる
  if (e.ctx.state !== "running" && wasRunning) return;
  try {
    let out: AudioNode = e.sfx;
    if (opts.gain !== undefined && opts.gain !== 1) {
      const g = e.ctx.createGain();
      g.gain.value = opts.gain;
      g.connect(e.sfx);
      out = g;
    }
    SFX[name](e.ctx, out, e.ctx.currentTime + (opts.delay ?? 0));
    document.dispatchEvent(new CustomEvent("shimaena:sfx", { detail: { name, delay: opts.delay ?? 0 } })); // 確かめ用（scripts/sound-check.cjs）
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

/** BGM が実際に出る大きさ（BGM × master）。<audio> に焼き込むとき用 */
export function bgmOutputGain(): number {
  return VOL.bgm * VOL.master;
}

// ---- BGM の音量（トークでは半分） ----
let bgmLevel: number = VOL.bgm;
export function setBgmLevel(mult = 1): void {
  bgmLevel = VOL.bgm * mult;
  if (engine) engine.bgm.gain.setTargetAtTime(soundPrefs().bgm ? bgmLevel : 0, engine.ctx.currentTime, 0.3);
}

/** 曲が変わったら、やまびこの間隔を曲のテンポに合わせる */
export function setBgmTempo(bpm: number): void {
  try {
    engine?.space?.setTempo(bpm);
  } catch {
    /* 響きが組めていない端末 */
  }
}

/** 画面が裏に回った／戻った（SoundProvider が呼ぶ）。BGM 側が聞く */
const visibilityHooks = new Set<(hidden: boolean) => void>();
export function onVisibility(h: (hidden: boolean) => void): () => void {
  visibilityHooks.add(h);
  return () => void visibilityHooks.delete(h);
}
export function notifyVisibility(hidden: boolean): void {
  hiddenNow = hidden;
  visibilityHooks.forEach((h) => h(hidden));
  const e = engine;
  if (!e) return;
  try {
    if (hidden) {
      window.clearTimeout(healthTimer);
      void e.ctx.suspend();
      return;
    }
    // 戻った: 動かしてみる。タップなしでは動かせない端末もあるので、動かなければ次のタップ（unlock）で作り直す
    const p = e.ctx.state !== "running" ? e.ctx.resume() : Promise.resolve();
    void p.catch(() => undefined).then(() => healthCheck(e));
  } catch {
    /* どちらでも画面は動く */
  }
}
