"use client";
// 音の係（画面に1つ、layout に置く。spec v1.19）。
// 1. 最初のタップで音を解放する（スマホはそれまで鳴らせない）
// 2. ボタンのタップ音を1本の listener で: 主役（btn-lamp／btn-ink／btn-big／btn-alert）は「ピポッ」、
//    白いボタン（btn-white）は「プッ」、チェック（aria-pressed）は「カチッ」、それ以外のボタン・下のタブは「ポッ」。
//    data-sound="none" で鳴らさない、data-sound="confirm" のように指定もできる。disabled は鳴らさない
// 3. 画面を裏に回したら止める・戻したら続きから
// 11/8 本人の指摘「BGM が起動時のトップ画面で流れない、別ページに行くと流れる」: スマホは最初のタップまで音を出せない。
// iPhone はタップの「指を離したとき（touchend・click）」でないと音を解放しないことがあるので、押したときに加えて離したときにも解放する
// （ホームでどこかを触れば、その場で BGM が始まる）
import { useEffect } from "react";
import { isUnlocked, notifyVisibility, play, unlock } from "@/lib/sound/engine";
import type { SfxName } from "@/lib/sound/sfx";

const TARGET = 'button, a.btn, [role="button"], nav[aria-label="メニュー"] a, [data-sound]';

/** ボタンの見た目から、どの音にするか */
export function soundForButton(el: Element): SfxName | null {
  const explicit = el.getAttribute("data-sound");
  if (explicit === "none") return null;
  if (explicit) return explicit as SfxName;
  if ((el as HTMLButtonElement).disabled || el.getAttribute("aria-disabled") === "true") return null;
  const pressed = el.getAttribute("aria-pressed");
  if (pressed === "true") return "toggleOff";
  if (pressed === "false") return "toggleOn";
  const cl = el.classList;
  if (cl.contains("btn-lamp") || cl.contains("btn-ink") || cl.contains("btn-big") || cl.contains("btn-alert")) return "confirm";
  if (cl.contains("btn-white")) return "back";
  return "tap";
}

export default function SoundProvider() {
  useEffect(() => {
    const onDown = (e: Event) => {
      void unlock();
      const t = e.target as Element | null;
      const el = t?.closest?.(TARGET);
      if (!el) return;
      const name = soundForButton(el);
      if (name) play(name);
    };
    const onKey = () => void unlock();
    const onUp = () => {
      if (!isUnlocked()) void unlock();
    };
    const onVis = () => notifyVisibility(document.hidden);
    document.addEventListener("pointerdown", onDown, { capture: true, passive: true });
    document.addEventListener("keydown", onKey, { passive: true });
    document.addEventListener("touchend", onUp, { capture: true, passive: true });
    document.addEventListener("click", onUp, { capture: true, passive: true });
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("pointerdown", onDown, { capture: true });
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("touchend", onUp, { capture: true });
      document.removeEventListener("click", onUp, { capture: true });
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);
  return null;
}
