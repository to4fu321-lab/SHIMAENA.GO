import type { Metadata } from "next";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import StartScreen, { type StartStatus } from "@/components/StartScreen";
import { PENDING_COOKIE, readPending } from "@/lib/auth/pending";
import { hasLoginKeys, safeNext } from "@/lib/auth/line-login";
import { repo } from "@/lib/repo";
import { TOWN } from "@/lib/town";
import { readViewer, VIEWER_COOKIE } from "@/lib/viewer";
import Bgm from "@/components/Bgm";

export const metadata: Metadata = { title: "はじめる ・ シマエナGO" };

// ログインの途中で止まったときの説明（前の /login から移した。spec v1.63）
const ERRORS: Record<string, string> = {
  denied: "LINE の許可がされませんでした。もう一度どうぞ。",
  state: "ログインの途中で切れました。もう一度押してください。",
  verify: "LINE であなたを確かめられませんでした。しばらくして、もう一度押してください。",
  nokeys: "LINE ログインの鍵がまだ設定されていません（運営者が Vercel に入れます）。",
};
type Q = { next?: string; redo?: string; opening?: string; error?: string; bye?: string };

// はじめる（spec v1.17）: どの「参加する」もここ。ログイン画面もここにまとめた（spec v1.63、前の /login は転送）。LINE でログイン → 画面で30秒の登録（役割 → 家の場所 → 2問）→ ソロ出動へ。
async function Start({ searchParams }: { searchParams: Promise<Q> }) {
  await connection();
  const { next, redo, opening, error, bye } = await searchParams;
  const jar = await cookies();
  const pending = readPending(jar.get(PENDING_COOKIE)?.value);
  const viewerId = readViewer(jar.get(VIEWER_COOKIE)?.value);
  const me = viewerId ? await repo().findParticipant(viewerId) : undefined;
  const status: StartStatus = me ? (redo ? "redo" : "member") : pending ? "pending" : "guest";
  const name = me?.nickname ?? pending?.displayName ?? "";
  // ?opening=1: はじめてログインしたときのオープニングを、誰でも見られる（デモの撮影用）
  const notice = bye ? "退会しました。登録と記録を消しました。これまでありがとうございました。" : error ? ERRORS[error] : undefined;
  return (
    <StartScreen status={status} name={name} center={TOWN.center} next={safeNext(next)} opening={opening === "1"} notice={notice} warn={Boolean(error && !bye)} hasKeys={hasLoginKeys()} />
  );
}

export default function StartPage({ searchParams }: { searchParams: Promise<Q> }) {
  return (
    <>
      <Bgm track="morning" />
      <Suspense fallback={<div className="min-h-dvh bg-paper" />}>
        <Start searchParams={searchParams} />
      </Suspense>
    </>
  );
}
