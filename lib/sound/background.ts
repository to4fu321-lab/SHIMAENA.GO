"use client";
// 雪かき中の BGM を、画面を消しても・別のアプリに移っても鳴らす（spec v1.38）。
// Web Audio は裏に回ると止まる（iPhone）ので、曲の1周をその場で音のデータ（WAV）に書き出し、
// ふつうの音楽再生（<audio>）で流す。リポジトリに音ファイルは置かない（v1.19 のまま。音は端末の中で作る）。
// ロック画面には曲名と ▶︎/⏸ を出す（Media Session）。
import { createSpace } from "./space";
import type { Song } from "./bgm";

const RATE = 32000; // 16kHz まで出れば BGM には十分。データを小さく
const TAIL = 3; // 残響・やまびこの尾（秒）。ループの頭に重ねて、つなぎ目を消す

/** 1周ぶんを書き出す（OfflineAudioContext）。gain は画面での BGM の大きさ（iPhone は <audio> の音量を変えられないので、ここで焼き込む） */
export async function renderLoop(song: Song, gain: number): Promise<AudioBuffer> {
  const beat = 60 / song.bpm;
  const barSec = beat * 4;
  const loop = barSec * song.bars;
  const len = Math.ceil((loop + TAIL) * RATE);
  const Off = window.OfflineAudioContext ?? (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  const ctx = new Off(2, len, RATE);
  const space = createSpace(ctx, ctx.destination);
  space.setTempo(song.bpm);
  const g = ctx.createGain();
  g.gain.value = gain;
  g.connect(space.input);
  for (let b = 0; b < song.bars; b++) song.bar(ctx, g, b, b * barSec + 0.001, beat);
  const out = await ctx.startRendering();
  return foldTail(out, Math.round(loop * RATE));
}

/** 尾（ループの長さより後ろ）を頭に足して、ちょうど1周の長さにする。くり返したときに響きが切れない */
export function foldTail(buf: AudioBuffer, loopLen: number): AudioBuffer {
  const chans: Float32Array[] = [];
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    const o = new Float32Array(loopLen);
    o.set(d.subarray(0, loopLen));
    for (let i = loopLen; i < d.length; i++) o[(i - loopLen) % loopLen] += d[i];
    chans.push(o);
  }
  return { numberOfChannels: chans.length, length: loopLen, sampleRate: buf.sampleRate, getChannelData: (c: number) => chans[c] } as unknown as AudioBuffer;
}

/** AudioBuffer → 16bit の WAV */
export function encodeWav(buf: AudioBuffer): Blob {
  const ch = buf.numberOfChannels;
  const n = buf.length;
  const data = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const str = (o: number, s: string) => [...s].forEach((c, i) => data.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  data.setUint32(4, 36 + n * ch * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  data.setUint32(16, 16, true);
  data.setUint16(20, 1, true);
  data.setUint16(22, ch, true);
  data.setUint32(24, buf.sampleRate, true);
  data.setUint32(28, buf.sampleRate * ch * 2, true);
  data.setUint16(32, ch * 2, true);
  data.setUint16(34, 16, true);
  str(36, "data");
  data.setUint32(40, n * ch * 2, true);
  const cs = Array.from({ length: ch }, (_, c) => buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++)
    for (let c = 0; c < ch; c++) {
      const v = Math.max(-1, Math.min(1, cs[c][i]));
      data.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true);
      o += 2;
    }
  return new Blob([data.buffer], { type: "audio/wav" });
}

// ---- 1つだけの <audio> ----
let el: HTMLAudioElement | null = null;
let primed = false;
const cache = new WeakMap<Song, Promise<string>>();

/** 裏で鳴らせる端末か（<audio> と OfflineAudioContext がある） */
export function backgroundSupported(): boolean {
  return typeof window !== "undefined" && typeof Audio !== "undefined" && Boolean(window.OfflineAudioContext ?? (window as unknown as { webkitOfflineAudioContext?: unknown }).webkitOfflineAudioContext);
}

function element(): HTMLAudioElement {
  if (!el) {
    el = new Audio();
    el.loop = true;
    el.preload = "auto";
    el.setAttribute("playsinline", "");
  }
  return el;
}

/** 最初のタップの中で呼ぶ: 無音を一瞬鳴らして <audio> を「鳴らしてよい」状態にする（iPhone は、あとから自動で鳴らせない） */
export function primeBackground(): void {
  if (primed || !backgroundSupported()) return;
  try {
    const a = element();
    if (!a.paused) return;
    const silent = encodeWav({ numberOfChannels: 1, length: 800, sampleRate: 8000, getChannelData: () => new Float32Array(800) } as unknown as AudioBuffer);
    a.src = URL.createObjectURL(silent);
    void a
      .play()
      .then(() => {
        primed = true;
        if (a.dataset.track === undefined) a.pause();
      })
      .catch(() => undefined);
  } catch {
    /* 鳴らせない端末では今までどおり（画面の間だけ） */
  }
}

/** 書き出し（同じ曲は1回だけ）→ blob の URL */
function urlFor(song: Song, gain: number): Promise<string> {
  let p = cache.get(song);
  if (!p) {
    p = renderLoop(song, gain).then((b) => URL.createObjectURL(encodeWav(b)));
    cache.set(song, p);
    p.catch(() => cache.delete(song));
  }
  return p;
}

let token = 0;

/** 曲を <audio> で鳴らし始める。鳴り始めたら onPlaying（つなぎの Web Audio を止める合図）。鳴らせなければ false で終わる */
export async function playBackground(song: Song, gain: number, onPlaying: () => void): Promise<boolean> {
  if (!backgroundSupported()) return false;
  const my = ++token;
  try {
    const url = await urlFor(song, gain);
    if (my !== token) return false; // 待っている間に別の曲・停止になった
    const a = element();
    a.dataset.track = song.title;
    a.src = url;
    a.currentTime = 0;
    a.volume = 1;
    await a.play();
    if (my !== token) {
      a.pause();
      return false;
    }
    mediaSession(song, a);
    document.documentElement.dataset.bgmBg = "playing"; // 確かめ用（scripts/sound-check.cjs）
    onPlaying();
    return true;
  } catch {
    return false;
  }
}

/** 止める（曲が変わった・BGM をオフにした） */
export function stopBackground(): void {
  token++;
  const a = el;
  delete document.documentElement.dataset.bgmBg;
  if (!a) return;
  delete a.dataset.track;
  try {
    a.pause();
  } catch {
    /* 止められなくても次で上書き */
  }
  try {
    if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "none";
  } catch {
    /* 対応していない端末 */
  }
}

/** いま裏で鳴らせる <audio> が鳴っているか（確かめ用） */
export function backgroundPlaying(): boolean {
  return Boolean(el && !el.paused && el.dataset.track);
}

/** ロック画面・通知の欄に曲名と ▶︎/⏸ */
function mediaSession(song: Song, a: HTMLAudioElement): void {
  if (!("mediaSession" in navigator)) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: `雪かき中「${song.title}」`,
      artist: "シマエナGO",
      album: "BGM（Claude が作曲）",
      artwork: [
        { src: "/api/icon/192.png", sizes: "192x192", type: "image/png" },
        { src: "/api/icon/512.png", sizes: "512x512", type: "image/png" },
      ],
    });
    navigator.mediaSession.playbackState = "playing";
    navigator.mediaSession.setActionHandler("play", () => {
      void a.play().then(() => (navigator.mediaSession.playbackState = "playing"));
    });
    navigator.mediaSession.setActionHandler("pause", () => {
      a.pause();
      navigator.mediaSession.playbackState = "paused";
    });
  } catch {
    /* 対応していない端末では出ないだけ */
  }
}
