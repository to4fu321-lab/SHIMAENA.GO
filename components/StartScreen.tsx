"use client";

// LINE で1タップ開始（spec v1.14）。LINE アプリの中で開くと、最初の1回の「許可する」で本人確認と友だち追加が済む（LIFF の友だち追加オプション）。
// 登録は1画面ずつ大きなボタンで: ①手伝う／お願いする ②家の場所 ③2問 → そのままソロ出動へ。トークの会話の登録と同じ中身。
// 家族の代わりに登録するときは、今までどおりトークで（連携コードが要るため）。
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { signInWithLiff } from "@/app/map/actions";
import { registerWithLiff } from "@/app/start/actions";
import type { LatLng } from "@/lib/types";
import Mascot from "./Mascot";
import LineLoginButton from "./LineLoginButton";

const PinAdjust = dynamic(() => import("./PinAdjust"), { ssr: false });

type Phase = "loading" | "outside" | "role" | "place" | "questions" | "saving" | "error";
type Role = "helper" | "requester";

const Q: Record<Role, { q1: { title: string; options: [string, string][] }; q2: { title: string; options: [string, string][] } }> = {
  helper: {
    q1: { title: "雪の朝、何分くらい動けますか？", options: [["15", "15分"], ["30", "30分"], ["60", "60分"]] },
    q2: { title: "スコップなどの道具はありますか？", options: [["yes", "ある"], ["no", "ない"]] },
  },
  requester: {
    q1: { title: "ひとりだと、いつも何分かかりますか？", options: [["15", "15分くらい"], ["30", "30分くらい"], ["60", "60分以上"], ["unknown", "わからない"]] },
    q2: { title: "どこまで雪かきが要りますか？", options: [["entrance", "玄関前まで"], ["garage", "車庫前まで"], ["road", "道路まで"]] },
  },
};

export default function StartScreen({ liffId, center }: { liffId?: string; center: LatLng }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>(liffId ? "loading" : "outside");
  const [token, setToken] = useState<string>();
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>();
  const [place, setPlace] = useState<LatLng>();
  const [picking, setPicking] = useState<LatLng>();
  const [q1, setQ1] = useState<string>();
  const [q2, setQ2] = useState<string>();
  const [msg, setMsg] = useState<string>();
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!liffId) return;
    (async () => {
      try {
        // LINE が別の画面（町の地図など）へ移す途中なら、ここでは何もしない（11/5 本人の報告: 地図→ソロへ勝手に移った）
        const passing = () => new URLSearchParams(location.search).has("liff.state") || location.pathname !== "/start";
        if (passing()) return;
        const { default: liff } = await import("@line/liff");
        await liff.init({ liffId });
        if (passing()) return;
        if (!liff.isLoggedIn()) {
          setPhase("outside"); // Safari など。LINE アプリで開き直してもらう
          return;
        }
        const t = liff.getAccessToken() ?? undefined;
        if (!t) return setPhase("outside");
        setToken(t);
        const prof = await liff.getProfile().catch(() => undefined);
        if (prof?.displayName) setName(prof.displayName);
        const r = await signInWithLiff(t);
        if (r.ok) {
          if (passing()) return;
          router.replace("/"); // もう登録している人は、いつものホームへ（勝手に出動の画面へは進めない。11/5 本人の報告）
          return;
        }
        setPhase(r.reason === "not_registered" ? "role" : "error");
        if (r.reason !== "not_registered") setMsg("LINE であなたを確かめられませんでした。LINE アプリで開き直してください。");
      } catch (e) {
        console.warn("[start]", e);
        setPhase("outside");
      }
    })();
  }, [liffId, router]);

  const here = () => {
    setMsg(undefined);
    if (!navigator.geolocation) {
      setPicking(center);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setPicking([pos.coords.latitude, pos.coords.longitude]); // 地図で家の上に合わせてから決める
      },
      () => {
        setLocating(false);
        setMsg("いまの場所が取れませんでした。地図で家の場所を選んでください。");
        setPicking(center);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const save = async () => {
    if (!token || !role || !place || !q1 || !q2) return;
    setPhase("saving");
    const r = await registerWithLiff(token, { role, location: place, q1, q2 }).catch(() => ({ ok: false, text: "うまくいきませんでした。" }));
    if (r.ok) {
      router.replace("/solo?welcome=1");
      return;
    }
    setMsg(r.text);
    setPhase("questions");
  };

  const openInLine = `https://liff.line.me/${liffId}/start`;
  const big = "min-h-20 w-full rounded-3xl px-4 text-left text-xl font-bold ring-2";

  return (
    <div className="mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden bg-paper px-4 pb-4 pt-5 text-ink">
      {picking && (
        <PinAdjust
          start={picking}
          emoji="🏠"
          onDone={(at) => {
            setPlace(at);
            setPicking(undefined);
            setPhase("questions");
          }}
          onCancel={() => setPicking(undefined)}
        />
      )}
      <header className="flex shrink-0 items-center gap-3">
        <Mascot size={56} />
        <div>
          <p className="text-sm font-bold">
            シマエナ<span className="text-lamp-deep">GO</span>
          </p>
          <h1 className="text-2xl font-bold leading-tight">{name ? `${name}さん、ようこそ` : "はじめる"}</h1>
        </div>
      </header>
      {phase !== "loading" && phase !== "outside" && phase !== "error" && (
        <ol className="mt-3 flex shrink-0 gap-1.5" aria-label="すすみぐあい">
          {(["role", "place", "questions"] as const).map((p, i) => (
            <li key={p} className={`h-2 flex-1 rounded-full ${["role", "place", "questions", "saving"].indexOf(phase) >= i ? "bg-lamp" : "bg-ink/15"}`} />
          ))}
        </ol>
      )}

      <main className="mt-4 flex min-h-0 flex-1 flex-col gap-3">
        {msg && <p className="shrink-0 rounded-2xl bg-warm px-3 py-2 text-base">{msg}</p>}

        {phase === "loading" && <p className="m-auto text-lg">LINE であなたを確かめています…</p>}

        {phase === "outside" && (
          <>
            <p className="text-xl font-bold leading-snug">LINE アプリで開くと、1タップで始められます。</p>
            <p className="text-lg leading-snug">「許可する」を押すだけで、本人の確認と友だち追加が終わります。そのあと30秒の登録で、すぐ出動できます。</p>
            {liffId ? (
              <a href={openInLine} className="btn btn-big mt-auto bg-[#06C755] text-white">
                LINE アプリで始める
              </a>
            ) : (
              <p className="rounded-2xl bg-card px-3 py-2 text-base">LINE で「シマエナGO」を検索して友だち追加してください。</p>
            )}
            <p className="text-base font-bold">もう LINE で登録している方</p>
            <LineLoginButton />
            <Link href="/?as=h3" className="btn btn-white text-lg">
              デモを見る（登録なし）
            </Link>
          </>
        )}

        {phase === "error" && (
          <a href={openInLine} className="btn btn-big mt-auto bg-[#06C755] text-white">
            LINE アプリで開き直す
          </a>
        )}

        {phase === "role" && (
          <>
            <h2 className="text-xl font-bold">あなたはどちらですか？</h2>
            <button onClick={() => (setRole("helper"), setPhase("place"))} className={`${big} bg-card ring-ink/15`}>
              🧤 手伝う
              <span className="block text-base font-normal text-ink-soft">近所の雪かきを10分から</span>
            </button>
            <button onClick={() => (setRole("requester"), setPhase("place"))} className={`${big} bg-card ring-ink/15`}>
              🏠 手伝ってほしい
              <span className="block text-base font-normal text-ink-soft">自分の家の雪かきを頼みたい（自分も参加できます）</span>
            </button>
            <p className="mt-auto text-base text-ink-soft">家族の代わりに登録するときは、LINE のトークで「登録」と送ってください。</p>
          </>
        )}

        {phase === "place" && (
          <>
            <h2 className="text-xl font-bold">家の場所を教えてください</h2>
            <p className="text-lg leading-snug">近くの雪かきを知らせるために使います。地図には 50m のマスでしか出ず、名前や住所は出ません。</p>
            <button disabled={locating} onClick={here} className="btn btn-lamp btn-big mt-auto w-full">
              {locating ? "いまの場所を調べています…" : "📍 いま家にいる（いまの場所）"}
            </button>
            <button onClick={() => setPicking(center)} className="btn btn-white btn-big w-full">
              🗺 地図で選ぶ
            </button>
            <button onClick={() => setPhase("role")} className="text-base underline">
              ‹ もどる
            </button>
          </>
        )}

        {(phase === "questions" || phase === "saving") && role && (
          <>
            {(["q1", "q2"] as const).map((k) => {
              const q = Q[role][k];
              const val = k === "q1" ? q1 : q2;
              const set = k === "q1" ? setQ1 : setQ2;
              return (
                <section key={k} className="shrink-0 space-y-2">
                  <h2 className="text-lg font-bold leading-snug">{q.title}</h2>
                  <div className={`grid gap-2 ${q.options.length === 4 ? "grid-cols-2" : q.options.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
                    {q.options.map(([v, label]) => (
                      <button
                        key={v}
                        aria-pressed={val === v}
                        onClick={() => set(v)}
                        className={`min-h-14 rounded-2xl px-1 text-lg font-bold ring-2 ${val === v ? "bg-lamp text-white ring-lamp" : "bg-card ring-ink/15"}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </section>
              );
            })}
            <button disabled={!q1 || !q2 || phase === "saving"} onClick={save} className="btn btn-lamp btn-big mt-auto w-full disabled:opacity-40">
              {phase === "saving" ? "登録しています…" : "はじめる！"}
            </button>
            <button onClick={() => setPhase("place")} className="text-base underline">
              ‹ 家の場所を選び直す
            </button>
          </>
        )}
      </main>
    </div>
  );
}
