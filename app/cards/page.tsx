import type { Metadata } from "next";
import Link from "next/link";
import { onTeam } from "@/lib/member";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import Icon from "@/components/Icon";
import LiffBridge from "@/components/LiffBridge";
import Mascot, { SnowTown } from "@/components/Mascot";
import TabBar from "@/components/TabBar";
import { nextReward } from "@/lib/cards/collection";
import { loadRoster } from "@/lib/morning/roster";
import { repo } from "@/lib/repo";
import { soloStatus } from "@/lib/solo/ops";
import { readViewer, VIEWER_COOKIE } from "@/lib/viewer";

export const metadata: Metadata = { title: "活動カード ・ シマエナGO" };

/** 丸い進み具合（カードの枚数 / 次のご褒美まで） */
function Ring({ value, goal }: { value: number; goal: number }) {
  const r = 52;
  const len = 2 * Math.PI * r;
  const pct = goal > 0 ? Math.min(1, value / goal) : 1;
  return (
    <div className="relative mx-auto size-44 shrink-0 short:size-32">
      <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="60" cy="60" r={r} fill="#ffffff" stroke="#e3eef3" strokeWidth="10" />
        {pct > 0 && <circle cx="60" cy="60" r={r} fill="none" stroke="var(--lamp)" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${len * pct} ${len}`} />}
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center leading-tight">
        <svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true" className="mx-auto short:hidden" fill="none" stroke="#29445c" strokeWidth="2" strokeLinejoin="round">
          <path d="M7 4 H17 V9 A5 5 0 0 1 7 9 Z" fill="#29445c" />
          <path d="M7 6 H4 A3 3 0 0 0 7 11 M17 6 H20 A3 3 0 0 1 17 11 M12 14 V18 M8 20 H16" />
        </svg>
        <p>
          <span className="text-4xl font-bold tabular-nums short:text-3xl">{value}</span>
          <span className="text-2xl font-bold"> / {goal}</span>
        </p>
        <p className="text-sm font-bold">集めたカード</p>
      </div>
    </div>
  );
}

const when = (iso: string) =>
  new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

/** 活動カード: スクロールしない1画面（進み具合 → ひとこと → 最近の活動）。図鑑・カードの一覧は /cards/book */
async function CardsContent({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  await connection();
  const { as } = await searchParams;
  const [roster, cookieStore] = await Promise.all([loadRoster(), cookies()]);
  const demoAs = as && /^h\d+$/.test(as) ? as : undefined;
  const viewerId = demoAs ?? readViewer(cookieStore.get(VIEWER_COOKIE)?.value) ?? "h7";
  const me = roster.participants.find((p) => p.id === viewerId);
  const cards = await repo().listCardsByRecipient(viewerId).catch(() => []);
  const reward = nextReward(cards.length);
  const solo = me ? await soloStatus(me.id, new Date()) : undefined;
  const recent = solo?.recent.slice(0, 3) ?? [];
  const q = demoAs ? `?as=${demoAs}` : "";

  return (
    <div className="mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden bg-paper text-ink">
      <LiffBridge liffId={process.env.NEXT_PUBLIC_LIFF_ID} enabled={!demoAs} />
      <header className="grid shrink-0 grid-cols-[auto_1fr_auto] items-center bg-ice-soft px-2 pt-2">
        <Link href={`/${q}`} className="btn min-h-12 px-2 text-base">
          ‹ ホーム
        </Link>
        <h1 className="text-center text-xl font-bold">活動カード</h1>
        <Link href={`/cards/book${q}`} className="flex min-h-12 flex-col items-center justify-center px-2 text-xs font-bold">
          <Icon name="guide" size={28} accent="var(--ice)" />
          図鑑
        </Link>
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden bg-gradient-to-b from-ice-soft to-paper px-4 pt-2">
        <Ring value={cards.length} goal={reward?.at ?? cards.length} />

        <div className="flex items-center gap-2 rounded-3xl bg-card px-3 py-2 shadow-sm ring-1 ring-ink/10">
          <Mascot size={60} team={onTeam(me) ? me?.teamId : undefined} className="shrink-0" />
          <p className="text-base font-bold leading-snug">
            {!me ? (
              "LINE で登録すると、ここに活動がたまります。"
            ) : reward ? (
              <>
                あと <span className="text-xl text-lamp-deep">{reward.left}</span> 枚で
                <br />
                {reward.label}！
              </>
            ) : (
              "ご褒美をぜんぶ受け取りました！"
            )}
          </p>
        </div>

        {solo && (
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              ["今日の羽", `${solo.todayFeathers}`],
              ["連続出動", `${solo.streak}日`],
              ["羽の合計", `${solo.totalFeathers}`],
            ].map(([label, value]) => (
              <p key={label} className="rounded-2xl bg-card px-1 py-1 leading-tight ring-1 ring-ink/10">
                <span className="block text-xs font-bold">{label}</span>
                <span className="text-2xl font-bold tabular-nums">{value}</span>
              </p>
            ))}
          </div>
        )}

        <section aria-label="最近の活動" className="min-h-0">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-bold">最近の活動</h2>
            <Link href={`/cards/book${q}`} className="text-sm font-bold underline">
              すべて見る ›
            </Link>
          </div>
          {recent.length > 0 ? (
            <ul className="mt-1 space-y-2">
              {recent.map((l) => (
                <li key={l.id} className="flex items-center gap-3 rounded-2xl bg-card px-3 py-1.5 shadow-sm ring-1 ring-ink/10">
                  <Icon name="house" size={34} accent="var(--lamp)" className="shrink-0 text-ink" />
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block text-xs">{when(l.at)}</span>
                    <span className="block truncate text-base font-bold">{l.label}</span>
                  </span>
                  <b className="shrink-0 text-lg tabular-nums text-lamp-deep">+{l.feathers}羽</b>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-1 space-y-2 rounded-2xl bg-card px-3 py-3 ring-1 ring-ink/10">
              <p className="text-base">まだ活動がありません。10分だけでも、町の力になります。</p>
              <Link href={`/solo${q}`} className="btn btn-lamp text-lg">
                出動する
              </Link>
            </div>
          )}
        </section>

        <SnowTown className="-mx-4 mt-auto h-16 min-h-0 w-[calc(100%+2rem)] shrink" />
      </main>

      <TabBar active="card" q={q} />
    </div>
  );
}

export default function CardsPage({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-paper p-6 text-ink">読み込み中…</main>}>
      <CardsContent searchParams={searchParams} />
    </Suspense>
  );
}
