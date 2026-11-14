"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { quietly } from "@/lib/ui/loading";

/** 数秒ごとに画面を取り直す（デモで別のスマホの操作を地図に映すため）。画面が隠れている（別のアプリ・別のタブ）あいだは取り直さない */
export default function AutoRefresh({ seconds = 4 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") quietly(() => router.refresh()); // 裏の取り直しは「読み込み中」に数えない
    }, seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}
