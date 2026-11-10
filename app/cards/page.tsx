import type { Metadata } from "next";
import Link from "next/link";
import { listBooks } from "@/lib/book/store";
import { onTeam } from "@/lib/member";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import Icon from "@/components/Icon";
import Mascot, { SnowTown } from "@/components/Mascot";
import TabBar from "@/components/TabBar";
import { nextReward } from "@/lib/cards/collection";
import { loadRoster } from "@/lib/morning/roster";
import { repo } from "@/lib/repo";
import { soloStatus } from "@/lib/solo/ops";
import { isDemoViewer, readViewer, VIEWER_COOKIE } from "@/lib/viewer";
import LoginButton from "@/components/LoginButton";
import Bgm from "@/components/Bgm";
import RecentRecords from "@/components/RecentRecords";
import { appNow } from "@/lib/clock";

export const metadata: Metadata = { title: "活動カード ・ シマエナGO" };

/** 丸い進み具合（カードの枚数。輪は次のご褒美までの進み）。カードは毎回1枚で上限なしなので「/10」は出さない。タップで図鑑へ */
function Ring({ value, goal, href }: { value: number; goal: number; href: string }) {
  const r = 52;
  const len = 2 * Math.PI * r;
  const pct = goal > 0 ? Math.min(1, value / goal) : 1;
  return (
    <Link href={href} aria-label={`集めたカード ${value}枚。図鑑を開く`} className="relative mx-auto block size-44 shrink-0 rounded-full active:scale-95 short:size-32">
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
          <span className="text-2xl font-bold"> 枚</span>
        </p>
        <p className="text-sm font-bold">集めたカード ›</p>
      </div>
    </Link>
  );
}

const when = (iso: string) =>
  new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

/** 活動カード: スクロールしない1画面（進み具合 → ひとこと → 最近の活動）。図鑑・カードの一覧は /cards/book */
async function CardsContent({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  await connection();
  const { as } = await searchParams;
  const [roster, cookieStore] = await Promise.all([loadRoster(), cookies()]);
  const demoAs = as && isDemoViewer(as) ? as : undefined;
  // 誰の画面か: デモの架空の人 → ログインした本人。どちらでもなければ「登録すると、ここにたまります」（他人のカードは見せない）
  const viewerId = demoAs ?? readViewer(cookieStore.get(VIEWER_COOKIE)?.value);
  const me = viewerId ? roster.participants.find((p) => p.id === viewerId) : undefined;
  const cards = me ? await repo().listCardsByRecipient(me.id).catch(() => []) : [];
  const reward = nextReward(cards.length);
  const solo = me ? await soloStatus(me.id, appNow()) : undefined;
  const recent = solo?.recent.slice(0, 3) ?? [];
  const q = demoAs ? `?as=${demoAs}` : "";
  const hasBook = (await listBooks(1).catch(() => [])).length > 0; // 町の週刊絵本（spec v1.27）

  return (
    <div className="mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden bg-paper text-ink">
      <header className="grid shrink-0 grid-cols-[auto_1fr_auto] items-center bg-ice-soft px-2 pt-2">
        <Link href={`/${q}`} className="btn min-h-12 px-2 text-base">
          ‹ ホーム
        </Link>
        <h1 className="text-center text-xl font-bold">活動カード</h1>
        <div className="flex">
          <Link href={`/connect${q}`} className="flex min-h-12 flex-col items-center justify-center px-2 text-xs font-bold">
            <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12M7 8l5-5 5 5" />
              <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
            </svg>
            広める
          </Link>
          <Link href={`/cards/book${q}`} className="flex min-h-12 flex-col items-center justify-center px-2 text-xs font-bold">
            <Icon name="guide" size={28} accent="var(--ice)" />
            図鑑
          </Link>
          {hasBook && (
            <Link href={`/book${q}`} className="flex min-h-12 flex-col items-center justify-center px-2 text-xs font-bold">
              <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
                <path d="M12 6 C9 4 5 4 3 5 V19 C5 18 9 18 12 20 C15 18 19 18 21 19 V5 C19 4 15 4 12 6 Z" fill="#ffe7a0" />
                <path d="M12 6 V20" />
              </svg>
              絵本
            </Link>
          )}
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden bg-gradient-to-b from-ice-soft to-paper px-4 pt-2">
        <Ring value={cards.length} goal={reward?.at ?? cards.length} href={`/cards/book${q}`} />

        <div className="flex items-center gap-2 rounded-3xl bg-card px-3 py-2 shadow-sm ring-1 ring-ink/10">
          <Mascot size={60} team={onTeam(me) ? me?.teamId : undefined} className="shrink-0" />
          <p className="text-base font-bold leading-snug">
            {!me ? (
              "登録すると、ここに活動がたまります。"
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

        {!me && !demoAs && <LoginButton next="/cards" />}
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

        <section aria-label="最近の記録" className="flex min-h-0 flex-1 flex-col">
          {/* 「すべて見る」は見出しのすぐ右に（右端は端からのぞく隊長と重なるため。11/8 点検） */}
          <div className="flex items-baseline gap-3">
            <h2 className="text-lg font-bold">最近の記録</h2>
            <Link href={`/cards/book${q}`} className="text-sm font-bold underline">
              すべて見る ›
            </Link>
          </div>
          {recent.length > 0 ? (
            <RecentRecords
              items={recent.map((l) => ({
                id: l.id,
                when: when(l.at),
                label: l.label,
                feathers: l.feathers,
                hitokoto: l.hitokoto,
                note: l.note,
                photoChecked: l.photoChecked,
                strokes: l.strokes,
                onsite: l.onsite,
              }))}
            />
          ) : (
            <div className="mt-1 space-y-2 rounded-2xl bg-card px-3 py-3 ring-1 ring-ink/10">
              <p className="text-base">まだ記録がありません。10分だけでも、町の力になります。</p>
              <Link href={`/solo${q}`} className="btn btn-lamp text-lg">
                雪かきGO！
              </Link>
            </div>
          )}
        </section>

        <SnowTown className="-mx-4 h-16 w-[calc(100%+2rem)] shrink-0 short:h-12" />
      </main>

      <TabBar active="card" q={q} />
    </div>
  );
}

export default function CardsPage({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  return (
    <>
      <Bgm track="morning" />
      <Suspense fallback={<main className="min-h-dvh bg-paper p-6 text-ink">読み込み中…</main>}>
        <CardsContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
