"use client";

// はじめる（spec v1.17）。LINE でログイン → オープニング → 「このアプリでできること」（動く絵、11/7）→ 隊長とのチャットで30秒の登録 → そのままソロ出動へ。
// 登録の中身は ①手伝う／手伝ってほしい（絵のカードで両方えらべる。spec v1.33）／家族の代わりに ②家の場所 ③質問（両方なら4問。お願いする側は絵で）→ 「はじめる！」（components/RegisterChat.tsx）。
// 家族の代わりの登録は、最後に6桁の連携コードを出す（ご本人・ほかの家族が「連携コードを入れる」で紐づく）。
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { linkCodeAction, registerAction } from "@/app/start/actions";
import type { LatLng } from "@/lib/types";
import AppTour from "./AppTour";
import LoginButton from "./LoginButton";
import Mascot from "./Mascot";
import { play } from "@/lib/sound/engine";
import RegisterChat, { type ChatForm } from "./RegisterChat";
import SnowScene from "./SnowScene";
import WelcomeOpening from "./WelcomeOpening";

/** guest = ログインしていない、pending = ログイン済みで未登録、member = 登録済み、redo = 登録のやり直し */
export type StartStatus = "guest" | "pending" | "member" | "redo";
type Phase = "chat" | "done";

export default function StartScreen({ status, name, center, next, opening = false }: { status: StartStatus; name: string; center: LatLng; next: string; opening?: boolean }) {
  const router = useRouter();
  // はじめてログインした人（pending）には、登録の前にオープニングと「できること」を1回見せる。opening = デモ撮影用に誰でも見られる（?opening=1）
  const [showOpening, setShowOpening] = useState(status === "pending" || opening);
  const [showTour, setShowTour] = useState(false);
  // 登録できた瞬間の「入隊！」スタンプ
  const [joined, setJoined] = useState(false);
  const [phase, setPhase] = useState<Phase>("chat");
  const [linkCode, setLinkCode] = useState<string>();
  const [doneText, setDoneText] = useState<string>();

  const save = async (f: ChatForm): Promise<string | undefined> => {
    const r = await registerAction(f).catch(() => ({ ok: false as const, text: "うまくいきませんでした。" }));
    if (!r.ok) {
      play("error");
      return r.text ?? "うまくいきませんでした。";
    }
    play("welcome");
    play("cardStamp", { delay: 0.35 });
    if (f.role === "family") {
      setLinkCode("linkCode" in r ? r.linkCode : undefined);
      setPhase("done");
      return undefined;
    }
    setJoined(true);
    const to = status === "redo" ? "/settings" : next === "/" ? "/solo?welcome=1" : next;
    setTimeout(() => router.replace(to), 1400);
    return undefined;
  };

  const link = async (code: string, whoAmI: "self" | "family"): Promise<string | undefined> => {
    const r = await linkCodeAction(code, whoAmI).catch(() => ({ ok: false as const, text: "うまくいきませんでした。" }));
    if (!r.ok) {
      play("error");
      return r.text ?? "うまくいきませんでした。";
    }
    play("welcome");
    setDoneText(r.text);
    setPhase("done");
    if (whoAmI === "self") setTimeout(() => router.replace("/"), 1500);
    return undefined;
  };

  const registering = status === "pending" || status === "redo";
  const overlays = (
    <>
      {showOpening && (
        <WelcomeOpening
          name={name}
          onDone={() => {
            setShowOpening(false);
            setShowTour(true);
          }}
        />
      )}
      {showTour && <AppTour onDone={() => setShowTour(false)} />}
    </>
  );

  if (status === "guest") {
    // ログイン前: 雪の夜の町を背景に、このゲームの約束を3つ。下に「LINE でログイン」
    return (
      <div className="relative mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-[6dvh] text-center text-white">
        {overlays}
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
              ["👥", "エリアでランダム3チーム"],
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
            <Link href="/demo" className="btn btn-white min-h-12 w-full text-lg">
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
      {overlays}
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
      <header className="flex shrink-0 items-center gap-3">
        <Mascot size={56} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">
            シマエナ<span className="text-lamp-deep">GO</span>
          </p>
          <h1 className="truncate text-2xl font-bold leading-tight max-[400px]:text-xl">{status === "member" ? "登録ずみ" : name ? `${name}さんの隊員登録` : "隊員登録"}</h1>
        </div>
        {registering && (
          <button type="button" onClick={() => setShowTour(true)} className="min-h-11 shrink-0 rounded-full bg-card px-3 text-sm font-bold ring-1 ring-ink/15">
            できること
          </button>
        )}
      </header>

      <main className="mt-3 flex min-h-0 flex-1 flex-col gap-3">
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

        {registering && phase === "chat" && <RegisterChat name={name} center={center} redo={status === "redo"} onRegister={save} onLink={link} />}

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
