import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import LiffBridge from "@/components/LiffBridge";
import { collection, nextReward, REWARDS } from "@/lib/cards/collection";
import { loadRoster } from "@/lib/morning/roster";
import { loadMorning } from "@/lib/morning/store";
import { repo } from "@/lib/repo";
import { TEAMS } from "@/lib/teams";
import { readViewer, VIEWER_COOKIE } from "@/lib/viewer";

export const metadata: Metadata = { title: "カード帳 ・ シマエナGO" };

/** 5つのタッチの、未入手のときの影の色 */
const STYLE_SWATCH: Record<string, string> = {
  kawaii: "linear-gradient(135deg,#ffd1e8,#c7e8ff)",
  retrowave: "linear-gradient(135deg,#2b1055,#ff4f8b)",
  eijin: "linear-gradient(135deg,#0b2fa8,#ffd400)",
  kirie: "linear-gradient(135deg,#f6f0e6,#2a3a5a)",
  pixel: "linear-gradient(135deg,#1a1a2e,#17c964)",
};

async function CardsContent({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  await connection();
  const { as } = await searchParams;
  const [roster, cookieStore, record] = await Promise.all([loadRoster(), cookies(), loadMorning()]);
  const viewerId = (as && /^h\d+$/.test(as) ? as : undefined) ?? readViewer(cookieStore.get(VIEWER_COOKIE)?.value) ?? "h7";
  const me = roster.participants.find((p) => p.id === viewerId);
  const cards = await repo().listCardsByRecipient(viewerId);
  const team = TEAMS.find((t) => t.id === me?.teamId);
  const col = collection(cards);
  const reward = nextReward(cards.length);
  const title = record.weekly?.titles.find((t) => t.participantId === viewerId);

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
      </p>

      {/* 図鑑: 5つのタッチとリボン。未入手は影で見せる */}
      <section className="space-y-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-ink/10" aria-label="図鑑">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-bold">図鑑</h2>
          <p className="text-sm text-ink/60">
            タッチ {col.styles.filter((s) => s.got).length}/{col.styles.length} ・ リボン {col.ribbons.filter((r) => r.got).length}/{col.ribbons.length}
          </p>
        </div>
        <ul className="grid grid-cols-5 gap-2">
          {col.styles.map((s) => (
            <li key={s.style} className="text-center">
              <div
                className={`aspect-[5/7] w-full rounded-xl ring-1 ring-ink/10 ${s.got ? "" : "opacity-30 grayscale"}`}
                style={{ background: STYLE_SWATCH[s.style] }}
                aria-label={`${s.name}${s.got ? "（取得）" : "（未入手）"}`}
              >
                {s.got && <span className="block pt-2 text-xs font-bold text-white drop-shadow">×{s.count}</span>}
              </div>
              <p className="mt-1 text-[11px] leading-tight">{s.name}</p>
              {!s.got && <p className="text-[10px] leading-tight text-ink/50">{s.hint}</p>}
            </li>
          ))}
        </ul>
        <ul className="flex flex-wrap gap-2" aria-label="リボン">
          {col.ribbons.map((r) => (
            <li
              key={r.key}
              className={`rounded-full px-3 py-1 text-sm font-bold ring-1 ${r.got ? "bg-[#ffd400] text-ink ring-[#e0b800]" : "bg-white text-ink/40 ring-ink/15"}`}
              title={r.hint}
            >
              {r.got ? "★ " : "☆ "}
              {r.label}
            </li>
          ))}
        </ul>
        <p className="text-sm text-ink/70">
          今週の称号: {title ? <b className="text-neon">{title.title}</b> : <span>まだ（週に3日出撃で称号、5日でレアカード確定）</span>}
        </p>
      </section>

      {/* ご褒美（想定）: 町内会から。デモは架空 */}
      <section className="space-y-2 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-ink/10" aria-label="ご褒美">
        <h2 className="text-lg font-bold">ご褒美（想定）</h2>
        {reward ? (
          <>
            <p className="text-base">
              あと <b className="text-neon">{reward.left}</b> 枚で <b>{reward.label}</b>
              <span className="text-sm text-ink/60">（{reward.from}）</span>
            </p>
            <span className="block h-3 overflow-hidden rounded-full bg-ink/10">
              <span className="block h-full rounded-full bg-neon" style={{ width: `${Math.min(100, (cards.length / reward.at) * 100)}%` }} />
            </span>
          </>
        ) : (
          <p className="text-base text-neon">ご褒美をぜんぶ受け取りました！</p>
        )}
        <ul className="text-sm text-ink/70">
          {REWARDS.map((r) => (
            <li key={r.at}>
              {cards.length >= r.at ? "✓" : "・"} {r.at}枚で {r.label}（{r.from}）
            </li>
          ))}
        </ul>
        <p className="text-xs text-ink/50">
          地元の銭湯やお店と町内会がつながる想定です。デモは架空で、実在の店ではありません。お金には換えません。
        </p>
      </section>

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
