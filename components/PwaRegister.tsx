"use client";

// ホーム画面に追加できるように、service worker（public/sw.js）を登録する（spec v1.17）。通知の受け取りもこの worker が担う。
import { useEffect } from "react";

export default function PwaRegister() {
  useEffect(() => {
    const sw = navigator.serviceWorker;
    if (!sw || typeof sw.register !== "function") return;
    sw.register("/sw.js").catch(() => undefined);
  }, []);
  return null;
}
