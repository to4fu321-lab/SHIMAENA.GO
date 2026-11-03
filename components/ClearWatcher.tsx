"use client";

// MISSION CLEAR を出す係（画面に1つだけ）。
// - 自分の「終わりました」: MorningButtons が openClear() を呼ぶ（閉じるまで残る）
// - 他の人の完了: 地図は4秒ごとに更新されるので、「いちばん最近の完了」が前に見たものと違えば出す（9秒で自動で閉じる）
// 「前に見たもの」は sessionStorage に持つ（画面を閉じると消える）。最初に開いたときは覚えるだけで出さない。
import { useEffect, useSyncExternalStore } from "react";
import type { ClearSummary } from "@/lib/morning/clear";
import MissionClear from "./MissionClear";

const KEY = "shimaena:lastClear";

function readLast(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null; // プライベートモードなどで使えないときは、気づく機能だけ止まる
  }
}

function rememberClear(missionId: string): void {
  try {
    sessionStorage.setItem(KEY, missionId);
  } catch {
    /* 覚えられなくても表示はできる */
  }
}

// ---- いま出している完了画面（このタブの中で1つ） ----
interface Active {
  clear: ClearSummary;
  autoCloseMs?: number;
}
let active: Active | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => void listeners.delete(cb);
};

/** 完了画面を出す。自分の完了は閉じるまで残す（autoCloseMs なし） */
export function openClear(clear: ClearSummary, opts: { autoCloseMs?: number } = {}): void {
  active = { clear, autoCloseMs: opts.autoCloseMs };
  rememberClear(clear.missionId);
  emit();
}

export function closeClear(): void {
  active = null;
  emit();
}

export default function ClearWatcher({ clear }: { clear: ClearSummary | null }) {
  const act = useSyncExternalStore(subscribe, () => active, () => null);

  useEffect(() => {
    if (!clear) return;
    const last = readLast();
    if (last === null) {
      rememberClear(clear.missionId); // 初めて開いたとき: いまの最新を覚えるだけ
      return;
    }
    if (last !== clear.missionId && active?.clear.missionId !== clear.missionId) openClear(clear, { autoCloseMs: 9000 });
  }, [clear]);

  return act ? <MissionClear clear={act.clear} onClose={closeClear} autoCloseMs={act.autoCloseMs} /> : null;
}
