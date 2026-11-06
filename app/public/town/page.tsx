// 公開ページ「町の雪解け」（spec v1.3）。LINE 登録前でも、SNS から開いても見られる。
// 出すのは集計だけ（町の雪解け率・今日の人数・今週の活動）。名前・家・マスの位置・拠点番号は出さない。
import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import CheerButton from "@/components/CheerButton";
import Pager, { Screen } from "@/components/Pager";
import TownShare from "@/components/TownShare";
import { CHEER_COOKIE, cheeredToday } from "@/lib/public/cheer";
import { lineJoinUrl } from "@/lib/line/join";
import { loadPublicStats } from "@/lib/public/load";
import { shareTextsFor } from "@/lib/sns/refresh";
import { TEAMS } from "@/lib/teams";
import { baseUrl } from "@/lib/url";
import InviteBeacon from "@/components/InviteBeacon";
import { isInviteCode } from "@/lib/invite";

const TITLE = "しらかば町内の雪解け";
const DESC = "町の雪解け率・今日の出動人数・今週の活動。雪かきゲーム「シマエナGO」の公開ページです。";

export const metadata: Metadata = {
  title: `${TITLE} ・ シマエナGO`,
  description: DESC,
  openGraph: { title: TITLE, description: DESC, images: [{ url: "/api/share/town.png?format=og", width: 1200, height: 630 }], type: "website" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC, images: ["/api/share/town.png?format=og"] },
};

const md = (ymd: string) => {
  const [, m, d] = ymd.split("-").map(Number);
  return `${m}月${d}日`;
};

function Num({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div className="rounded-2xl bg-ice-soft px-1 py-2 text-center">
      <p className="text-sm font-bold leading-tight">{label}</p>
      <p className="text-3xl font-bold tabular-nums">
        {value}
        {unit && <span className="text-base">{unit}</span>}
      </p>
    </div>
  );
}

async function Town({ searchParams }: { searchParams: Promise<{ via?: string; r?: string }> }) {
  await connection();
  const { via, r: inviteFrom } = await searchParams;
  const st = await loadPublicStats();
  const texts = await shareTextsFor(st);
  const already = cheeredToday((await cookies()).get(CHEER_COOKIE)?.value, st.today);
  const join = lineJoinUrl();
  const site = baseUrl();
  const max = Math.max(1, ...Object.values(st.teamTotals));
  const joinButton = (
    <Link href={join} className="btn btn-big shrink-0 bg-lamp text-white">
      はじめる（30秒で登録）
    </Link>
  );
  // 1画面に収める（11/5 本人の指示「基本1画面」）: 町 → 数字 → とは → 参加 → 応援 → 広める をタブと横スワイプで
  const tabs = [
    { key: "town", label: "町" },
    { key: "nums", label: "数字" },
    { key: "about", label: "とは" },
    { key: "join", label: "参加" },
    { key: "cheer", label: "応援" },
    { key: "share", label: "SNS" },
  ];
  return (
    <Screen
      header={
        <header className="px-4 pb-2 pt-3 text-center">
          <h1 className="text-2xl font-bold leading-tight">
            シマエナ<span className="text-camellia-deep">GO</span>
          </h1>
          <p className="text-lg font-bold leading-tight">10分の雪かきで、町が変わる。</p>
        </header>
      }
    >
      {isInviteCode(inviteFrom) && <InviteBeacon code={inviteFrom} />}
      <Pager tabs={tabs} initial={via === "cheer" ? 4 : 0}>
        {/* 1. 町: 雪解け率・何のアプリか・LINE で参加 */}
        <div className="contents">
          {via === "invite" && (
            <p className="shrink-0 rounded-2xl bg-camellia-soft px-3 py-2 text-base ring-1 ring-camellia" aria-label="友だちからの招待">
              <b>友だちからお誘いが届きました！⛄</b> ごほうびは「参加」のタブに。
            </p>
          )}
          {via === "cheer" && (
            <p className="shrink-0 rounded-2xl bg-camellia-soft px-3 py-2 text-base ring-1 ring-camellia" aria-label="応援のお願い">
              <b>友だちから応援のお願いが届きました！</b> 「応援」のタブから押せます。
            </p>
          )}
          {via === "sns" && (
            <p className="shrink-0 rounded-2xl bg-warm px-3 py-2 text-base ring-1 ring-lamp/50" aria-label="ようこそ">
              <b>SNS から来てくれて、ありがとう！</b> 札幌のある町内（デモは架空）の雪かきの様子です。見るだけ・応援だけでも大歓迎。
            </p>
          )}
          <section className="flex flex-1 flex-col justify-center gap-1.5 rounded-3xl bg-card p-3 shadow-sm ring-1 ring-ink/10" aria-label="町の雪解け">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-bold">{st.townName}の雪解け</h2>
              <p className="text-sm text-ink-soft">{md(st.morningDate)}の朝</p>
            </div>
            <p className="text-center">
              <span className="text-6xl font-bold tabular-nums">{st.thawPct}</span>
              <span className="text-2xl font-bold">%</span>
            </p>
            <span className="block h-4 shrink-0 overflow-hidden rounded-full bg-ice-soft" aria-hidden="true">
              <span className="block h-full rounded-full bg-ice" style={{ width: `${st.thawPct}%` }} />
            </span>
            <p className="text-center text-base">
              {st.housesTotal === 0 ? (
                "雪の朝の作戦はまだです"
              ) : st.allDone ? (
                <b className="text-camellia-deep">
                  {st.snowName ? `『${st.snowName}』` : "今朝の雪"} 討伐{st.defeatedAt ? ` ${st.defeatedAt}` : ""}！ {st.housesTotal}軒すべて完了
                </b>
              ) : (
                <>
                  {st.housesDone} / {st.housesTotal} 軒 ・ あと <b>{st.left}</b> 軒{st.snowName ? `（相手は『${st.snowName}』）` : ""}
                </>
              )}
            </p>
            {st.shortHouses > 0 && (
              <p className="rounded-2xl bg-alert-soft px-3 py-2 text-base ring-1 ring-alert/40">
                <b className="text-alert">{st.shortMissingMin === 1 ? "あと1人で救える家" : "人手が足りない家"}</b> が {st.shortHouses} 軒。10分だけ助けてくれる人を募集中です。
              </p>
            )}
          </section>
          <p className="shrink-0 text-center text-base">
            3チームで、ひとり暮らしの家の雪を10分ずつどける雪かきゲーム。
          </p>
          {joinButton}
        </div>

        {/* 2. 数字: 今日・今週・チーム・今朝の実況 */}
        <div className="contents">
          <section className="flex flex-col gap-2" aria-label="今日と今週">
            <h2 className="text-lg font-bold">今日の町</h2>
            <div className="grid grid-cols-4 gap-1.5">
              <Num label="出動した人" value={st.todayPeople} unit="人" />
              <Num label="達成" value={st.todayMissions} unit="件" />
              <Num label="ソロ出動" value={st.soloPeople} unit="人" />
              <Num label="どけた雪" value={st.snowKg > 0 ? st.snowKgLabel : "—"} />
            </div>
            <h2 className="text-lg font-bold">今週の町</h2>
            <div className="grid grid-cols-3 gap-1.5">
              <Num label="活動した日" value={st.week.days} unit="日" />
              <Num label="助けた家" value={st.week.housesDone} unit="軒" />
              <Num label="活動人数" value={st.week.people} unit="人" />
            </div>
            <ul className="space-y-1" aria-label="チームの得点（今朝）">
              {TEAMS.map((t) => (
                <li key={t.id} className="flex items-center gap-2 text-sm">
                  <span className="w-32 shrink-0 font-bold">
                    <span className="mr-1 inline-block size-3 rounded-full align-middle" style={{ background: t.color }} aria-hidden="true" />
                    {t.name}
                  </span>
                  <span className="h-3 flex-1 overflow-hidden rounded-full bg-ice-soft">
                    <span className="block h-full rounded-full" style={{ width: `${(st.teamTotals[t.id] / max) * 100}%`, background: t.color }} />
                  </span>
                  <span className="w-12 text-right font-bold tabular-nums">{st.teamTotals[t.id]}点</span>
                </li>
              ))}
            </ul>
            {st.recap && (
              <div className="rounded-2xl bg-warm px-3 py-2">
                <p className="eyebrow">今朝の実況（シマエナ隊長）</p>
                <p className="text-base">{st.recap}</p>
              </div>
            )}
          </section>
        </div>

        {/* 3. とは */}
        <div className="contents">
          <section className="flex flex-col gap-2" aria-label="シマエナGO とは">
            <h2 className="text-xl font-bold">シマエナGO とは</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>雪の朝、LINE に1問だけの点呼が届きます。</li>
              <li>町内の3チームが、ひとり暮らしの家の雪を10分単位でどけます。</li>
              <li>動いた時だけのカードが届きます。お金には換えません。</li>
            </ul>
            <h3 className="text-lg font-bold">1人でも「ソロ出動」</h3>
            <p>仲間がいない日も、自分の家の雪かき・道の危険の報告のミッションで、10分から参加できます。羽ポイントとカードがたまり、地図に足あとが残ります。</p>
            <p className="text-lg font-bold">寒い冬は、くっついて乗り切る。</p>
          </section>
        </div>

        {/* 4. 参加のしかた */}
        <div className="contents">
          <section className="flex flex-1 flex-col justify-center gap-3" aria-label="参加する">
            <h2 className="text-xl font-bold">参加する</h2>
            {via === "invite" && (
              <p className="rounded-2xl bg-camellia-soft px-3 py-2 text-base ring-1 ring-camellia">
                🎴 このページから LINE で参加して最初の出動をすると、あなたと誘ってくれた友だちの<b>二人に限定カード「ふたりの群れ」</b>が届きます。
              </p>
            )}
            <p className="text-base">LINE で登録すると、1人の10分（ソロ出動）から参加できます。</p>
            {joinButton}
            <Link href="/public/diagnosis" className="btn btn-white btn-big">
              シマエナ診断（あなたは何シマエナ？）
            </Link>
            <Link href="/rules" className="btn btn-white text-lg">
              使い方
            </Link>
            <p className="text-center text-sm text-ink-soft">公開ページ ・ 登録なしで見られます</p>
          </section>
        </div>

        {/* 5. 応援（得点・羽には入れない） */}
        <div className="contents">
          <div id="cheer" className="flex flex-1 flex-col justify-center gap-3">
            {via === "cheer" && (
              <p className="rounded-2xl bg-camellia-soft px-3 py-2 text-base ring-1 ring-camellia">
                <b>友だちから応援のお願いが届きました！</b> 下の「町を応援する」を押すと、町の応援ゲージに入ります（登録なし・1日1回）。
              </p>
            )}
            {via === "invite" && (
              <p className="rounded-2xl bg-camellia-soft px-3 py-2 text-base ring-1 ring-camellia">
                まずは見るだけ、町を応援するだけでも、誘ってくれた友だちに届きます。
              </p>
            )}
            <CheerButton count={st.cheers} already={already} />
            <p className="text-center text-base">応援したら、となりの「SNS」で友だちにも知らせられます。</p>
          </div>
        </div>

        {/* 6. 広める */}
        <div className="contents">
          <TownShare
            title="この町を SNS で広める"
            options={[
              { key: "town", label: "町の雪解け", text: texts.town.text, image: "/api/share/town.png", page: `${site}/public/share/town?via=sns` },
              { key: "today", label: "今日の出動", text: texts.today.text, image: "/api/share/today.png", page: `${site}/public/share/today?via=sns` },
              { key: "recruit", label: "仲間を募集", text: texts.recruit.text, image: "/api/share/recruit.png", page: `${site}/public/share/recruit?via=sns` },
            ]}
          />
          <p className="shrink-0 text-sm text-ink-soft">公開しているのは集計だけです。名前や家の場所は出しません。デモの町内と人はすべて架空です。</p>
        </div>
      </Pager>
    </Screen>
  );
}

export default function TownPage({ searchParams }: { searchParams: Promise<{ via?: string; r?: string }> }) {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-paper p-6 text-ink">読み込み中…</main>}>
      <Town searchParams={searchParams} />
    </Suspense>
  );
}
