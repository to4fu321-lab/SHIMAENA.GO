// 公開ページ「町の雪解け」（spec v1.3）。LINE 登録前でも、SNS から開いても見られる。
// 出すのは集計だけ（町の雪解け率・今日の人数・今週の活動）。名前・家・マスの位置・拠点番号は出さない。
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import SnsShare from "@/components/SnsShare";
import { lineJoinUrl } from "@/lib/line/join";
import { loadPublicStats } from "@/lib/public/load";
import { shareTextsFor } from "@/lib/sns/refresh";
import { TEAMS } from "@/lib/teams";
import { baseUrl } from "@/lib/url";

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
    <div className="rounded-2xl bg-paper px-2 py-3 text-center ring-1 ring-ink/10">
      <p className="text-sm text-ink/70">{label}</p>
      <p className="text-2xl font-bold tabular-nums">
        {value}
        {unit && <span className="text-base">{unit}</span>}
      </p>
    </div>
  );
}

async function Town() {
  await connection();
  const st = await loadPublicStats();
  const texts = await shareTextsFor(st);
  const join = lineJoinUrl();
  const site = baseUrl();
  const max = Math.max(1, ...Object.values(st.teamTotals));
  return (
    <main className="mx-auto min-h-dvh max-w-md space-y-4 bg-paper px-4 pb-8 pt-5 text-ink">
      <header className="text-center">
        <p className="text-xs font-bold tracking-widest text-neon">公開ページ ・ 登録なしで見られます</p>
        <h1 className="text-3xl font-bold">
          シマエナ<span className="text-neon">GO</span>
        </h1>
        <p className="text-base text-ink/80">寒い冬は、くっついて乗り切る。</p>
      </header>

      {/* 町の雪解け */}
      <section className="space-y-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-ink/10" aria-label="町の雪解け">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-bold">{st.townName}の雪解け</h2>
          <p className="text-sm text-ink/70">{md(st.morningDate)}の朝</p>
        </div>
        <p className="text-center">
          <span className="text-6xl font-bold tabular-nums text-neon">{st.thawPct}</span>
          <span className="text-2xl font-bold">%</span>
        </p>
        <span className="block h-4 overflow-hidden rounded-full bg-ink/10" aria-hidden="true">
          <span className="block h-full rounded-full bg-snow" style={{ width: `${st.thawPct}%` }} />
        </span>
        <p className="text-center text-base">
          {st.housesTotal === 0 ? (
            "雪の朝の作戦はまだです"
          ) : st.allDone ? (
            <b className="text-neon">
              {st.snowName ? `『${st.snowName}』` : "今朝の雪"} 討伐{st.defeatedAt ? ` ${st.defeatedAt}` : ""}！ {st.housesTotal}軒すべて完了
            </b>
          ) : (
            <>
              {st.housesDone} / {st.housesTotal} 軒 ・ あと <b>{st.left}</b> 軒{st.snowName ? `（相手は『${st.snowName}』）` : ""}
            </>
          )}
        </p>
        {st.shortHouses > 0 && (
          <p className="rounded-2xl bg-[#fff0f3] px-3 py-2 text-base ring-1 ring-alert/40">
            <b className="text-alert">{st.shortMissingMin === 1 ? "あと1人で救える家" : "人手が足りない家"}</b> が {st.shortHouses} 軒。5分だけ助けてくれる人を募集中です。
          </p>
        )}
      </section>

      {/* 今日と今週の数字 */}
      <section className="space-y-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-ink/10" aria-label="今日と今週">
        <h2 className="text-lg font-bold">今日の町</h2>
        <div className="grid grid-cols-2 gap-2">
          <Num label="出動した人" value={st.todayPeople} unit="人" />
          <Num label="ミッション達成" value={st.todayMissions} unit="件" />
          <Num label="ソロ出動" value={st.soloPeople} unit="人" />
          <Num label="どけた雪" value={st.snowKg > 0 ? st.snowKgLabel : "—"} />
        </div>
        <h2 className="pt-1 text-lg font-bold">今週の町</h2>
        <div className="grid grid-cols-3 gap-2">
          <Num label="活動した日" value={st.week.days} unit="日" />
          <Num label="助けた家" value={st.week.housesDone} unit="軒" />
          <Num label="活動人数" value={st.week.people} unit="人" />
        </div>
        <ul className="space-y-1 pt-1" aria-label="チームの得点（今朝）">
          {TEAMS.map((t) => (
            <li key={t.id} className="flex items-center gap-2 text-sm">
              <span className="w-28 shrink-0 font-bold" style={{ color: t.color }}>
                {t.name}
              </span>
              <span className="h-3 flex-1 overflow-hidden rounded-full bg-ink/10">
                <span className="block h-full rounded-full" style={{ width: `${(st.teamTotals[t.id] / max) * 100}%`, background: t.color }} />
              </span>
              <span className="w-10 text-right tabular-nums">{st.teamTotals[t.id]}</span>
            </li>
          ))}
        </ul>
        {st.recap && (
          <div className="rounded-2xl bg-[#fff0f6] px-3 py-2">
            <p className="text-xs font-bold tracking-widest text-neon">今朝の実況（エナガ隊長）</p>
            <p className="text-base">{st.recap}</p>
          </div>
        )}
      </section>

      {/* シマエナGO とは・参加 */}
      <section className="space-y-3 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-ink/10" aria-label="シマエナGO とは">
        <h2 className="text-xl font-bold">シマエナGO とは</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>雪の朝、LINE に1問だけの点呼が届きます。</li>
          <li>町内の3チームが、ひとり暮らしの家の雪を5分単位でどけます。</li>
          <li>動いた朝だけのカードが届きます。お金には換えません。</li>
        </ul>
        <h3 className="text-lg font-bold">1人でも「ソロ出動」</h3>
        <p>仲間がいない日も、見回り・雪の報告・自分の家の雪かきなど 3〜5分のミッションで参加できます。羽ポイントとカードがたまり、地図に足あとが残ります。</p>
        {join ? (
          <a href={join} className="block rounded-2xl bg-[#06C755] py-4 text-center text-xl font-bold text-white">
            LINE で参加する
          </a>
        ) : (
          <p className="rounded-2xl bg-paper px-3 py-2 text-base">LINE で「シマエナGO」を検索して友だち追加 → 登録（1分）</p>
        )}
        <Link href="/public/diagnosis" className="block rounded-2xl bg-neon py-4 text-center text-lg font-bold text-white">
          シマエナ診断（あなたは何シマエナ？）
        </Link>
        <Link href="/rules" className="block rounded-2xl bg-white py-4 text-center text-lg font-bold text-ink ring-2 ring-ink/15">
          あそびかた
        </Link>
      </section>

      <SnsShare
        title="この町を SNS で広める"
        options={[
          { key: "town", label: "町の雪解け", text: texts.town.text, image: "/api/share/town.png", page: `${site}/public/share/town?via=sns` },
          { key: "today", label: "今日の出動", text: texts.today.text, image: "/api/share/today.png", page: `${site}/public/share/today?via=sns` },
          { key: "recruit", label: "仲間を募集", text: texts.recruit.text, image: "/api/share/recruit.png", page: `${site}/public/share/recruit?via=sns` },
        ]}
      />
      <p className="text-center text-xs text-ink/50">
        公開しているのは集計だけです。名前や家の場所は出しません。デモの町内と人はすべて架空です。
      </p>
    </main>
  );
}

export default function TownPage() {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-paper p-6 text-ink">読み込み中…</main>}>
      <Town />
    </Suspense>
  );
}
