"use client";

// 家の人の「ありがとう」が届いた知らせ（spec v1.59）。地図を見ているあいだに届いたら、上にやさしく出す（1軒に1回）。
// この作品でいちばん大事な瞬間なので、完了の知らせ（ClearToast）より長く残し、押すと隊長トークへ行ける。
// 「もう見た」は sessionStorage に持つ。地図を開いた時点でもう届いていた分も、まだ見ていなければ1回出す。
import Link from "next/link";
import { useEffect, useState } from "react";
import { play } from "@/lib/sound/engine";

const KEY = "shimaena:thanksSeen";

function seen(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

export default function ThanksToast({ missionId, baseNumber, label, chatHref, ms = 12000 }: { missionId: string; baseNumber: number | string; label: string; chatHref: string; ms?: number }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const list = seen();
    if (list.includes(missionId)) return;
    try {
      sessionStorage.setItem(KEY, JSON.stringify([...list, missionId].slice(-20)));
    } catch {
      /* 覚えられなくても、出すことはできる */
    }
    // 完了の知らせ（上の帯）と重ならないように、少しあとに出す
    const t0 = setTimeout(() => {
      setShow(true);
      play("lamp");
    }, 600);
    const t1 = setTimeout(() => setShow(false), ms);
    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
    };
  }, [missionId, ms]);
  if (!show) return null;
  return (
    <div className="toast-in fixed inset-x-3 top-[max(12px,env(safe-area-inset-top))] z-[1450] mx-auto max-w-sm rounded-2xl bg-camellia-soft px-3 py-3 text-ink shadow-xl ring-2 ring-camellia" role="status" aria-label="ありがとうが届きました">
      <div className="flex items-center gap-2.5">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-white text-2xl" aria-hidden="true">
          💌
        </span>
        <p className="min-w-0 flex-1 leading-tight">
          <span className="block text-sm font-bold text-ink-soft">拠点{baseNumber}の家の人から</span>
          <b className="block text-2xl">「{label}」</b>
        </p>
        <button type="button" onClick={() => setShow(false)} className="grid size-11 shrink-0 place-items-center rounded-full text-xl font-bold text-ink-soft" aria-label="閉じる">
          ×
        </button>
      </div>
      <Link href={chatHref} className="btn btn-white mt-2 min-h-12 w-full text-base">
        隊長トークで見る
      </Link>
    </div>
  );
}
