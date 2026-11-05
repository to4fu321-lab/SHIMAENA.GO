"use client";

// LINE の中で開いたとき、LIFF でログインしている人を「この画面の自分」にする。
// 11/5: ホーム（リッチメニューの「きょうの町」）にこの部品がなく、LINE の友だちなのに「出動する」「ソロ」の先へ進めなかった。
// → 全ページ共通（app/layout.tsx）で1回だけ動かす。各ページに置いてある分は、同じ1回を使うだけ（二重には動かない）。
// LINE の中の普通のブラウザなら LIFF で開き直す。確認中・未登録・失敗は画面の上に出す（行き止まりにしない）。
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
    // LINE のトークのリンクを LINE の中の普通のブラウザで開いたとき: LIFF（LINE の中のログイン済みの画面）で開き直す。
    // ウェブのログイン（liff.login）は access.line.me が 400 を返したので使わない（11/5）。外のブラウザの人には何もしない
    let tried = false;
    try {
      tried = sessionStorage.getItem("liff-reopen") === "1"; // 開き直しは1回だけ（行ったり来たりしないように）
      sessionStorage.setItem("liff-reopen", "1");
    } catch {}
    if (!liff.isInClient() && inLineApp() && !tried) {
      const here = `${location.pathname}${location.search}`;
      location.href = `https://liff.line.me/${liffId}${here === "/" ? "" : here}`;
    }
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
      // LINE の友だちでも登録がまだなら、その場で登録の画面へ（spec v1.14 LINE で1タップ開始）
      if (r.status === "not_registered" && first && location.pathname !== "/start" && !new URLSearchParams(location.search).has("liff.state")) router.replace("/start");
    });
    return () => {
      alive = false;
    };
  }, [liffId, enabled, router]);

  if (!banner) return null;
  if (status === "error") {
    return (
      <div className="fixed inset-x-0 top-0 z-[2000] bg-warm px-4 py-3 text-center text-base text-ink shadow-md" role="alert">
        LINE であなたを確かめられませんでした。LINE に戻って、もう一度開いてください。
      </div>
    );
  }
  return null;
}
