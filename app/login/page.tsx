import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import LoginButton from "@/components/LoginButton";
import Mascot from "@/components/Mascot";
import { hasLoginKeys, safeNext } from "@/lib/auth/line-login";
import { repo } from "@/lib/repo";
import { readViewer, VIEWER_COOKIE } from "@/lib/viewer";
import { logoutAction } from "./actions";
import Bgm from "@/components/Bgm";
import SnowScene from "@/components/SnowScene";

export const metadata: Metadata = { title: "ログイン ・ シマエナGO" };

const ERRORS: Record<string, string> = {
  denied: "LINE の許可がされませんでした。もう一度どうぞ。",
  state: "ログインの途中で切れました。もう一度押してください。",
  verify: "LINE であなたを確かめられませんでした。しばらくして、もう一度押してください。",
  nokeys: "LINE ログインの鍵がまだ設定されていません（運営者が Vercel に入れます）。",
};

/** ログイン（spec v1.17）: LINE はここ（本人の確認）だけに使う。1画面 */
async function Login({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  await connection();
  const { error, next } = await searchParams;
  const viewerId = readViewer((await cookies()).get(VIEWER_COOKIE)?.value);
  const me = viewerId ? await repo().findParticipant(viewerId) : undefined;
  const to = safeNext(next);
  return (
    <main className="relative mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden px-4 pb-6 pt-[6dvh] text-ink">
      {/* 雪の夜の町（はじめての人をわくわくさせる背景。/start と同じ） */}
      <SnowScene />
      <header className="relative flex flex-col items-center text-center text-white">
        <Mascot size={92} className="captain-idle drop-shadow-[0_6px_14px_rgba(0,0,0,0.35)] short:size-20" />
        <p className="opening-logo mt-1 whitespace-nowrap text-5xl font-black max-[380px]:text-4xl">
          シマエナ<span className="text-[#ffb98a]">GO</span>
        </p>
        <h1 className="opening-rise mt-1 text-xl font-bold text-white/90 [text-shadow:0_1px_6px_rgba(12,28,46,0.9)]" style={{ animationDelay: "0.4s" }}>
          ログイン
        </h1>
      </header>
      <section className="opening-rise relative mt-5 space-y-3 rounded-3xl bg-card/95 p-5 shadow-xl" style={{ animationDelay: "0.6s" }}>
        {me ? (
          <>
            <p className="text-lg font-bold">{me.nickname}さんとしてログインしています。</p>
            <Link href={to} className="btn btn-lamp btn-big w-full">
              つづける
            </Link>
            <form action={logoutAction}>
              <button className="btn btn-white w-full text-lg">ログアウト</button>
            </form>
          </>
        ) : (
          <>
            <p className="text-lg font-bold leading-snug">LINE のアカウントで、あなたを確かめます。</p>
            <p className="text-base leading-snug">LINE は本人の確認にだけ使います。雪の朝のお知らせは、このアプリの「隊長トーク」と通知で届きます。</p>
            {error && ERRORS[error] && <p className="rounded-2xl bg-warm px-3 py-2 text-base">{ERRORS[error]}</p>}
            <LoginButton next={to} />
            {!hasLoginKeys() && <p className="text-sm text-ink-soft">（鍵がない間は、ログインの代わりにデモの架空の人で見られます）</p>}
          </>
        )}
      </section>
      <p className="relative mt-auto rounded-full bg-white/85 px-3 py-1 text-center text-sm text-ink">
        デモ: <Link href="/?as=h3" className="underline">架空の手伝う側として見る</Link>
      </p>
    </main>
  );
}

export default function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  return (
    <>
      <Bgm track="morning" />
      <Suspense fallback={<div className="min-h-dvh bg-paper" />}>
        <Login searchParams={searchParams} />
      </Suspense>
    </>
  );
}
