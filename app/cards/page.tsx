import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import LiffBridge from "@/components/LiffBridge";
import { loadRoster } from "@/lib/morning/roster";
import { repo } from "@/lib/repo";
import { TEAMS } from "@/lib/teams";
import { readViewer, VIEWER_COOKIE } from "@/lib/viewer";

export const metadata: Metadata = { title: "カード帳 ・ シマエナGO" };

/** 10枚で町内会からのご褒美（デモでは架空の銭湯券） */
const REWARD_AT = 10;

async function CardsContent({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  await connection();
  const { as } = await searchParams;
  const [roster, cookieStore] = await Promise.all([loadRoster(), cookies()]);
  const viewerId = (as && /^h\d+$/.test(as) ? as : undefined) ?? readViewer(cookieStore.get(VIEWER_COOKIE)?.value) ?? "h7";
  const me = roster.participants.find((p) => p.id === viewerId);
  const cards = await repo().listCardsByRecipient(viewerId);
  const team = TEAMS.find((t) => t.id === me?.teamId);
  const left = Math.max(0, REWARD_AT - cards.length);

  return (
    <main className="mx-auto min-h-dvh max-w-xl space-y-5 bg-paper px-4 py-5 text-ink">
      <LiffBridge liffId={process.env.NEXT_PUBLIC_LIFF_ID} enabled={!as} />
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">
          <span className="text-neon">カード帳</span>
        </h1>
        <Link href={`/map${as ? `?as=${as}` : ""}`} className="text-base underline">
          地図へ
        </Link>
      </header>
      <p className="text-base">
        {me ? (
          <>
            <b>{me.nickname}</b>さん{team && <>（<b style={{ color: team.color }}>{team.name}</b>）</>}のカード <b>{cards.length}</b> 枚
          </>
        ) : (
          "まだ登録がありません"
        )}
        {left > 0 ? <span className="text-ink/60"> ・ あと {left} 枚で銭湯券（架空）</span> : <span className="text-neon"> ・ 銭湯券（架空）をゲット！</span>}
      </p>

      {cards.length === 0 && (
        <p className="rounded-2xl bg-white p-4 text-base shadow-sm ring-1 ring-ink/10">
          雪の朝に動くと、その朝だけのカードがここに増えていきます。二度と同じカードは発行されません。
        </p>
      )}

      <ul className="grid grid-cols-1 gap-5">
        {cards.map((c) => (
          <li key={c.id} className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-ink/10">
            {/* 表面（SVG。レアはホログラムが動く）。SVG なので next/image は使わない */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/cards/${c.id}/front.svg`} alt={`${c.designName} のカード`} className="aspect-[600/840] w-full" />
            <div className="space-y-1 p-4">
              <p className="text-lg font-bold">
                {c.designName} <span className="text-sm font-normal text-ink/60">{c.designNameEn}</span>
              </p>
              <p className="text-sm text-ink/70">
                {c.rarityLabel} {"★".repeat(c.stars)} ・ No.{String(c.serial).padStart(3, "0")}/{c.issuedCount} ・ 排雪 {c.snowKg}kg（{c.snowKgComparison}）
              </p>
              <div className="flex flex-wrap gap-2 pt-1 text-sm">
                <a className="rounded-full bg-ink px-3 py-1 text-white" href={`/api/cards/${c.id}/back.png`}>
                  裏面
                </a>
                <a className="rounded-full bg-ink/10 px-3 py-1" href={`/api/cards/${c.id}/front.png?format=square`}>
                  正方形で保存
                </a>
                <a className="rounded-full bg-ink/10 px-3 py-1" href={`/api/cards/${c.id}/front.png?format=portrait`}>
                  4:5 で保存
                </a>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}

export default function CardsPage({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-paper p-6 text-ink">読み込み中…</main>}>
      <CardsContent searchParams={searchParams} />
    </Suspense>
  );
}
