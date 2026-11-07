"use client";

// はじめる（spec v1.17）。LINE でログイン → 画面で30秒の登録 → そのままソロ出動へ。
// 登録は1画面ずつ大きなボタンで: ①手伝う／手伝ってほしい／家族の代わりに ②家の場所 ③2問 → 「はじめる！」。
// 家族の代わりの登録は、最後に6桁の連携コードを出す（ご本人・ほかの家族が「連携コードを入れる」で紐づく）。
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import dynamic from "next/dynamic";
import { linkCodeAction, registerAction } from "@/app/start/actions";
import type { LatLng } from "@/lib/types";
import LoginButton from "./LoginButton";
import Mascot from "./Mascot";
import { play } from "@/lib/sound/engine";
import SnowScene from "./SnowScene";
import WelcomeOpening from "./WelcomeOpening";

const PinAdjust = dynamic(() => import("./PinAdjust"), { ssr: false });

/** guest = ログインしていない、pending = ログイン済みで未登録、member = 登録済み、redo = 登録のやり直し */
export type StartStatus = "guest" | "pending" | "member" | "redo";
type Phase = "role" | "place" | "questions" | "saving" | "code" | "done";
type Role = "helper" | "requester" | "family";

const Q: Record<"helper" | "requester", { q1: { title: string; options: [string, string][] }; q2: { title: string; options: [string, string][] } }> = {
  helper: {
    q1: { title: "雪の朝、何分くらい動けますか？", options: [["15", "15分"], ["30", "30分"], ["60", "60分"]] },
    q2: { title: "スコップなどの道具はありますか？", options: [["yes", "ある"], ["no", "ない"]] },
  },
  requester: {
    // spec v1.20: 頼み方を登録で分ける（おまかせ／一緒にやる）。毎朝の質問はしない
    q1: { title: "家の人も一緒に雪かきしますか？", options: [["omakase", "おまかせしたい"], ["together", "一緒にやる"]] },
    q2: { title: "どこまで雪かきが要りますか？", options: [["entrance", "玄関前まで"], ["garage", "車庫前まで"], ["road", "道路まで"]] },
  },
};

export default function StartScreen({ status, name, center, next, opening = false }: { status: StartStatus; name: string; center: LatLng; next: string; opening?: boolean }) {
  const router = useRouter();
  // はじめてログインした人（pending）には、登録の前にオープニングを1回見せる。opening = デモ撮影用に誰でも見られる（?opening=1）
  const [showOpening, setShowOpening] = useState(status === "pending" || opening);
  // 登録できた瞬間の「入隊！」スタンプ
  const [joined, setJoined] = useState(false);
  const [phase, setPhase] = useState<Phase>("role");
  const [role, setRole] = useState<Role>();
  const [place, setPlace] = useState<LatLng>();
  const [picking, setPicking] = useState<LatLng>();
  const [q1, setQ1] = useState<string>();
  const [q2, setQ2] = useState<string>();
  const [msg, setMsg] = useState<string>();
  const [locating, setLocating] = useState(false);
  const [code, setCode] = useState("");
  const [linkCode, setLinkCode] = useState<string>();
  const [doneText, setDoneText] = useState<string>();

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
    if (!role || !place || !q1 || !q2) return;
    setPhase("saving");
    const r = await registerAction({ role, location: place, q1, q2 }).catch(() => ({ ok: false as const, text: "うまくいきませんでした。" }));
    if (r.ok) {
      play("welcome");
      play("cardStamp", { delay: 0.35 });
      if (role === "family") {
        setLinkCode("linkCode" in r ? r.linkCode : undefined);
        setPhase("done");
        return;
      }
      setJoined(true);
      const to = status === "redo" ? "/settings" : next === "/" ? "/solo?welcome=1" : next;
      setTimeout(() => router.replace(to), 1400);
      return;
    }
    setMsg(r.text);
    setPhase("questions");
    play("error");
  };

  const link = async (whoAmI: "self" | "family") => {
    setMsg(undefined);
    const r = await linkCodeAction(code, whoAmI).catch(() => ({ ok: false as const, text: "うまくいきませんでした。" }));
    if (!r.ok) {
      play("error");
      return setMsg(r.text);
    }
    play("welcome");
    setDoneText(r.text);
    setPhase("done");
    if (whoAmI === "self") setTimeout(() => router.replace("/"), 1500);
  };

  const big = "min-h-20 w-full rounded-3xl px-4 text-left text-xl font-bold ring-2";
  const qRole = role === "helper" ? "helper" : "requester";
  const registering = status === "pending" || status === "redo";

  if (status === "guest") {
    // ログイン前: 雪の夜の町を背景に、このゲームの約束を3つ。下に「LINE でログイン」
    return (
      <div className="relative mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-[6dvh] text-center text-white">
        {showOpening && <WelcomeOpening name={name} onDone={() => setShowOpening(false)} />}
        <SnowScene />
        <div className="relative flex min-h-0 flex-1 flex-col items-center">
          <Mascot size={96} className="captain-idle drop-shadow-[0_6px_14px_rgba(0,0,0,0.35)] short:size-20" />
          <h1 className="opening-logo mt-1 whitespace-nowrap text-5xl font-black max-[380px]:text-4xl">
            シマエナ<span className="text-[#ffb98a]">GO</span>
          </h1>
          <p className="opening-rise mt-1 text-lg font-bold text-white/90 [text-shadow:0_1px_6px_rgba(12,28,46,0.9)]" style={{ animationDelay: "0.4s" }}>
            寒い冬は、くっついて乗り切る。
          </p>
          <ul className="mt-[4dvh] w-full space-y-2 text-left text-ink short:mt-3">
            {[
              ["❄️", "雪の朝、点呼が届く"],
              ["👥", "町内ランダム3チーム"],
              ["🏠", "ひとり暮らしの家を救う"],
            ].map(([icon, text], i) => (
              <li key={text} className="opening-pillar flex items-center gap-3 rounded-2xl bg-white/90 px-4 py-2 text-lg font-bold shadow-md short:py-1.5" style={{ animationDelay: `${0.6 + i * 0.25}s` }}>
                <span className="text-2xl" aria-hidden="true">{icon}</span>
                {text}
              </li>
            ))}
          </ul>
          <div className="mt-auto w-full space-y-2 rounded-3xl bg-white/95 p-3 text-ink shadow-xl">
            <p className="text-base font-bold leading-snug">LINE でログインすると、30秒で始められます。</p>
            <LoginButton next="/start" />
            <Link href="/?as=h3" className="btn btn-white min-h-12 w-full text-lg">
              デモを見る（登録なし）
            </Link>
            <p className="text-sm text-ink-soft">LINE は本人の確認にだけ使います</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden bg-paper px-4 pb-4 pt-5 text-ink">
      {showOpening && <WelcomeOpening name={name} onDone={() => setShowOpening(false)} />}
      {joined && (
        // 登録できた: 「入隊！」のスタンプ（このあとソロ出動へ）
        <div className="fixed inset-0 z-50 mx-auto grid max-w-md place-items-center overflow-hidden bg-ink/85 text-white" role="status">
          <span className="flash-rays absolute left-1/2 top-1/2 size-[180vmax]" aria-hidden="true" />
          <div className="relative text-center">
            <Mascot size={120} mood="happy" className="team-reveal mx-auto" />
            <p className="flash-stamp mt-2 inline-block rounded-2xl border-4 border-[#ffd27a] px-6 py-1 text-5xl font-black text-[#ffd27a]">入隊！</p>
            <p className="flash-sub mt-3 text-xl font-bold">{name ? `${name}隊員、` : ""}よろしくね</p>
          </div>
        </div>
      )}
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
          <h1 className="text-2xl font-bold leading-tight max-[400px]:text-xl">{name ? `${name}さん、ようこそ` : "はじめる"}</h1>
        </div>
      </header>
      {registering && ["role", "place", "questions", "saving"].includes(phase) && (
        <ol className="mt-3 flex shrink-0 gap-1.5" aria-label="すすみぐあい">
          {(["role", "place", "questions"] as const).map((p, i) => (
            <li key={p} className={`h-2 flex-1 rounded-full ${["role", "place", "questions", "saving"].indexOf(phase) >= i ? "bg-lamp" : "bg-ink/15"}`} />
          ))}
        </ol>
      )}

      <main key={phase} className="step-in mt-4 flex min-h-0 flex-1 flex-col gap-3">
        {msg && <p className="shrink-0 rounded-2xl bg-warm px-3 py-2 text-base">{msg}</p>}

        {status === "member" && (
          <>
            <p className="text-xl font-bold leading-snug">もう登録が終わっています。</p>
            <Link href="/" className="btn btn-lamp btn-big mt-auto w-full">
              きょうの町へ
            </Link>
            <Link href="/start?redo=1" className="btn btn-white text-lg">
              登録をやり直す
            </Link>
          </>
        )}

        {registering && phase === "role" && (
          <>
            <h2 className="text-xl font-bold">{status === "redo" ? "もう一度、どちらですか？" : "あなたはどちらですか？"}</h2>
            <button onClick={() => (setRole("helper"), setPhase("place"))} className={`${big} opening-pillar bg-card ring-ink/15`} style={{ animationDelay: `0.1s` }}>
              🧤 手伝う
              <span className="block text-base font-normal text-ink-soft">近所の雪かきを10分から</span>
            </button>
            <button onClick={() => (setRole("requester"), setPhase("place"))} className={`${big} opening-pillar bg-card ring-ink/15`} style={{ animationDelay: `0.22s` }}>
              🏠 手伝ってほしい
              <span className="block text-base font-normal text-ink-soft">10cm 積もった朝、近所に応援が届く（自分も手伝えます）</span>
            </button>
            <button onClick={() => (setRole("family"), setPhase("place"))} className={`${big} opening-pillar bg-card ring-ink/15`} style={{ animationDelay: `0.33999999999999997s` }}>
              👪 家族の代わりに登録
              <span className="block text-base font-normal text-ink-soft">離れて住む親の家を登録。終わると知らせが届きます</span>
            </button>
            <button onClick={() => setPhase("code")} className="mt-auto text-base underline">
              連携コード（6桁）をお持ちの方はこちら
            </button>
          </>
        )}

        {registering && phase === "place" && (
          <>
            <h2 className="text-xl font-bold">{role === "family" ? "ご家族の家の場所を教えてください" : "家の場所を教えてください"}</h2>
            <p className="text-lg leading-snug">近くの雪かきを知らせるために使います。地図には 50m のマスでしか出ず、名前や住所は出ません。</p>
            {role !== "family" && (
              <button disabled={locating} onClick={here} className="btn btn-lamp btn-big mt-auto w-full">
                {locating ? "いまの場所を調べています…" : "📍 いま家にいる（いまの場所）"}
              </button>
            )}
            <button onClick={() => setPicking(center)} className={`btn btn-big w-full ${role === "family" ? "btn-lamp mt-auto" : "btn-white"}`}>
              🗺 地図で選ぶ
            </button>
            <button onClick={() => setPhase("role")} className="text-base underline">
              ‹ もどる
            </button>
          </>
        )}

        {registering && (phase === "questions" || phase === "saving") && role && (
          <>
            {(["q1", "q2"] as const).map((k) => {
              const q = Q[qRole][k];
              const val = k === "q1" ? q1 : q2;
              const set = k === "q1" ? setQ1 : setQ2;
              return (
                <section key={k} className="shrink-0 space-y-2">
                  <h2 className="text-lg font-bold leading-snug">{role === "family" ? q.title.replace("家の人も", "ご本人も") : q.title}</h2>
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
              {phase === "saving" ? "登録しています…" : role === "family" ? "登録する" : "はじめる！"}
            </button>
            <button onClick={() => setPhase("place")} className="text-base underline">
              ‹ 家の場所を選び直す
            </button>
          </>
        )}

        {registering && phase === "code" && (
          <>
            <h2 className="text-xl font-bold">連携コードを入れてください</h2>
            <p className="text-lg leading-snug">ご家族が登録したときに出た6桁の番号です。</p>
            <input
              inputMode="numeric"
              pattern="\d*"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              className="min-h-16 w-full rounded-2xl bg-card text-center text-3xl font-bold tracking-widest ring-2 ring-ink/15 focus:outline-none focus:ring-lamp"
              aria-label="連携コード（6桁）"
            />
            <p className="text-lg font-bold">あなたは？</p>
            <button disabled={code.length !== 6} onClick={() => link("self")} className="btn btn-lamp btn-big w-full disabled:opacity-40">
              お願いする本人です
            </button>
            <button disabled={code.length !== 6} onClick={() => link("family")} className="btn btn-white btn-big w-full disabled:opacity-40">
              家族です（知らせを受け取る）
            </button>
            <button onClick={() => setPhase("role")} className="mt-auto text-base underline">
              ‹ もどる
            </button>
          </>
        )}

        {phase === "done" && (
          <>
            {linkCode ? (
              <>
                <h2 className="text-xl font-bold">ご家族の登録ができました</h2>
                <p className="text-lg leading-snug">連携コード</p>
                <p className="rounded-2xl bg-card py-3 text-center text-4xl font-bold tracking-widest ring-2 ring-lamp">{linkCode}</p>
                <p className="text-base leading-snug">ご本人がこのアプリに LINE でログインして、この6桁を入れると、ご本人にも雪かきのお知らせが届きます。ほかのご家族も同じ番号で知らせを受け取れます。番号は控えておいてください。</p>
                <p className="text-base leading-snug">雪かきが終わると、あなたにも知らせが届きます（隊長トークと通知。次の画面で「通知を受け取る」を押してください）。</p>
              </>
            ) : (
              <p className="text-xl font-bold leading-snug">{doneText ?? "できました。"}</p>
            )}
            <Link href="/chat" className="btn btn-lamp btn-big mt-auto w-full">
              隊長トークを開く
            </Link>
            <Link href="/" className="btn btn-white text-lg">
              きょうの町へ
            </Link>
          </>
        )}
      </main>
    </div>
  );
}
