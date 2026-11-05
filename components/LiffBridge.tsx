"use client";

// LINE の中で開いたとき、LIFF でログインしている人を「この画面の自分」にする。
// 11/5: ホーム（リッチメニューの「きょうの町」）にこの部品がなく、LINE の友だちなのに「出動する」「ソロ」の先へ進めなかった。
// → 全ページ共通（app/layout.tsx）で1回だけ動かす。各ページに置いてある分は、同じ1回を使うだけ（二重には動かない）。
// LINE の中のブラウザで未ログインならログインへ。確認中・未登録・失敗は画面の上に出す（行き止まりにしない）。
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { signInWithLiff } from "@/app/map/actions";

type Status = "idle" | "checking" | "ok" | "not_registered" | "error";

const g = globalThis as { __shimaenaLiff?: Promise<Result>; __shimaenaLiffStatus?: Status };

/** LINE のアプリの中のブラウザか（LIFF でない普通のリンクで開いたときも含む） */
const inLineApp = () => typeof navigator !== "undefined" && / Line\//i.test(navigator.userAgent);

type Result = { status: Status; changed?: boolean };

async function signIn(liffId: string, onChecking: () => void): Promise<Result> {
  const { default: liff } = await import("@line/liff");
  await liff.init({ liffId }); // liff.line.me/…/solo で開いたときは、ここで /solo へ移る
  if (!liff.isLoggedIn()) {
    // LINE の中のブラウザなら LINE ログインへ（外のブラウザで公開ページを見ている人には何もしない）
    if (!liff.isInClient() && inLineApp()) liff.login({ redirectUri: location.href });
    return { status: "idle" };
  }
  const token = liff.getAccessToken();
  if (!token) return { status: "error" };
  onChecking();
  const r = await signInWithLiff(token);
  if (r.ok) return { status: "ok", changed: r.changed };
  return { status: r.reason === "not_registered" ? "not_registered" : "error" };
}

/** banner: 確認中・未登録・失敗を画面の上に出す（app/layout.tsx の1つだけ） */
export default function LiffBridge({ liffId, enabled = true, banner = false }: { liffId?: string; enabled?: boolean; banner?: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(g.__shimaenaLiffStatus ?? "idle");
  useEffect(() => {
    if (!enabled || !liffId) return;
    if (new URLSearchParams(location.search).has("as")) return; // デモの架空の人として見ている
    let alive = true;
    const set = (s: Status) => {
      g.__shimaenaLiffStatus = s;
      if (alive) setStatus(s);
    };
    const first = !g.__shimaenaLiff;
    g.__shimaenaLiff ??= signIn(liffId, () => set("checking")).catch((e) => {
      console.warn("[liff]", e);
      return { status: "error" } as Result;
    });
    void g.__shimaenaLiff.then((r) => {
      set(r.status);
      if (r.status === "ok" && r.changed && first) router.refresh(); // 「自分」が分かったので、画面を本人の中身にする
    });
    return () => {
      alive = false;
    };
  }, [liffId, enabled, router]);

  if (!banner) return null;
  if (status === "checking") {
    return (
      <p className="fixed inset-x-0 top-0 z-[2000] bg-ink px-4 py-2 text-center text-base font-bold text-white" role="status">
        LINE であなたを確かめています…
      </p>
    );
  }
  if (status === "not_registered") {
    return (
      <div className="fixed inset-x-0 top-0 z-[2000] space-y-1 bg-warm px-4 py-3 text-center text-ink shadow-md" role="alert">
        <p className="text-lg font-bold">登録がまだ終わっていません</p>
        <p className="text-base">LINE のトークで「登録」と送ると、1分で終わります。</p>
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="fixed inset-x-0 top-0 z-[2000] bg-warm px-4 py-3 text-center text-base text-ink shadow-md" role="alert">
        LINE であなたを確かめられませんでした。LINE に戻って、もう一度開いてください。
      </div>
    );
  }
  return null;
}
