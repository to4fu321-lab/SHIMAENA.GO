"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** 数秒ごとに画面を取り直す（デモで別のスマホの操作を地図に映すため） */
export default function AutoRefresh({ seconds = 4 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}
