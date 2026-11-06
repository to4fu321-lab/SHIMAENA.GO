import type { Metadata } from "next";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import StartScreen, { type StartStatus } from "@/components/StartScreen";
import { PENDING_COOKIE, readPending } from "@/lib/auth/pending";
import { safeNext } from "@/lib/auth/line-login";
import { repo } from "@/lib/repo";
import { TOWN } from "@/lib/town";
import { readViewer, VIEWER_COOKIE } from "@/lib/viewer";
import Bgm from "@/components/Bgm";

export const metadata: Metadata = { title: "はじめる ・ シマエナGO" };

// はじめる（spec v1.17）: どの「参加する」もここ。LINE でログイン → 画面で30秒の登録（役割 → 家の場所 → 2問）→ ソロ出動へ。
async function Start({ searchParams }: { searchParams: Promise<{ next?: string; redo?: string; opening?: string }> }) {
  await connection();
  const { next, redo, opening } = await searchParams;
  const jar = await cookies();
  const pending = readPending(jar.get(PENDING_COOKIE)?.value);
  const viewerId = readViewer(jar.get(VIEWER_COOKIE)?.value);
  const me = viewerId ? await repo().findParticipant(viewerId) : undefined;
  const status: StartStatus = me ? (redo ? "redo" : "member") : pending ? "pending" : "guest";
  const name = me?.nickname ?? pending?.displayName ?? "";
  // ?opening=1: はじめてログインしたときのオープニングを、誰でも見られる（デモの撮影用）
  return <StartScreen status={status} name={name} center={TOWN.center} next={safeNext(next)} opening={opening === "1"} />;
}

export default function StartPage({ searchParams }: { searchParams: Promise<{ next?: string; redo?: string; opening?: string }> }) {
  return (
    <>
      <Bgm track="morning" />
      <Suspense fallback={<div className="min-h-dvh bg-paper" />}>
        <Start searchParams={searchParams} />
      </Suspense>
    </>
  );
}
