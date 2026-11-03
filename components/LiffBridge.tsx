"use client";

// LINE の中で地図を開いたとき、LIFF でログインしている人を「この画面の自分」にする。
// LIFF の ID がない・LINE の外で開いた（デモの ?as=）ときは何もしない。
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { signInWithLiff } from "@/app/map/actions";

export default function LiffBridge({ liffId, enabled }: { liffId?: string; enabled: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!enabled || !liffId) return;
    let cancelled = false;
    (async () => {
      try {
        const { default: liff } = await import("@line/liff");
        await liff.init({ liffId });
        if (cancelled || !liff.isLoggedIn()) return;
        const token = liff.getAccessToken();
        if (!token) return;
        const r = await signInWithLiff(token);
        if (r.ok && !cancelled) router.refresh();
      } catch (e) {
        console.warn("[liff]", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [liffId, enabled, router]);
  return null;
}
