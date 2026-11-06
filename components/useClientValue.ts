"use client";

// 端末にしか分からない値（localStorage・ブラウザの機能の有無）を、画面が出たあとに読む。
// サーバーで描いた中身（initial）と最初は同じにして、読めたら差し替える（描き直しの連鎖を起こさない）。
import { useEffect, useState } from "react";

export function useClientValue<T>(initial: T, read: () => T): T {
  const [v, setV] = useState<T>(initial);
  useEffect(() => {
    let alive = true;
    void Promise.resolve().then(() => {
      if (alive) setV(read());
    });
    return () => {
      alive = false;
    };
  }, [read]);
  return v;
}
