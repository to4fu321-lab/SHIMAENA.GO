"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** 数秒ごとに画面を取り直す（デモで別のスマホの操作を地図に映すため）。画面が隠れている（別のアプリ・別のタブ）あいだは取り直さない */
export default function AutoRefresh({ seconds = 4 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}
