// 設定（v1.4）: LINE のリッチメニューから外して Web に置いた。登録の確認と、やり直しの方法だけ。
import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import Icon from "@/components/Icon";
import LiffBridge from "@/components/LiffBridge";
import RedoRegistration from "@/components/RedoRegistration";
import { lineJoinUrl } from "@/lib/line/join";
import { loadRoster } from "@/lib/morning/roster";
import { TEAMS } from "@/lib/teams";
import { isDemoViewer, readViewer, VIEWER_COOKIE } from "@/lib/viewer";

export const metadata: Metadata = { title: "設定 ・ シマエナGO" };

const ROLE = { helper: "雪かきを手伝う", requester: "雪かきをお願いする" } as const;
const AREA = { entrance: "玄関前まで", garage: "車庫前まで", road: "道路まで" } as const;

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-ink/10 py-2 last:border-0">
      <dt className="shrink-0 text-base text-ink-soft">{label}</dt>
      <dd className="text-right text-lg font-bold">{value}</dd>
    </div>
  );
}

async function Settings({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  await connection();
  const { as } = await searchParams;
  const [roster, cookieStore] = await Promise.all([loadRoster(), cookies()]);
  const demoAs = as && isDemoViewer(as) ? as : undefined;
  const viewerId = demoAs ?? readViewer(cookieStore.get(VIEWER_COOKIE)?.value);
  const me = viewerId ? roster.participants.find((p) => p.id === viewerId) : undefined;
  const q = demoAs ? `?as=${demoAs}` : "";
  const team = TEAMS.find((t) => t.id === me?.teamId);
  const join = lineJoinUrl();

  return (
    <main className="mx-auto min-h-dvh max-w-md space-y-4 bg-paper px-4 pb-8 pt-5 text-ink">
      <LiffBridge liffId={process.env.NEXT_PUBLIC_LIFF_ID} enabled={!demoAs} />
      <header className="flex items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Icon name="settings" size={34} accent="var(--ice)" />
          設定
        </h1>
        <Link href={`/${q}`} className="btn btn-white min-h-11 px-3 text-sm">
          ホーム
        </Link>
      </header>

      {me ? (
        <section className="rounded-3xl bg-card p-4 shadow-sm ring-1 ring-ink/10" aria-label="あなたの登録">
          <h2 className="text-lg font-bold">あなたの登録</h2>
          <dl className="mt-1">
            <Row label="呼び名" value={`${me.nickname}さん`} />
            <Row label="役わり" value={ROLE[me.role]} />
            {team && (
              <Row
                label="チーム"
                value={
                  <>
                    <span className="mr-1 inline-block size-3 rounded-full align-middle" style={{ background: team.color }} aria-hidden="true" />
                    {team.name}（{team.colorName}）
                  </>
                }
              />
            )}
            {me.morningMinutes && <Row label="雪の朝に動ける時間" value={`${me.morningMinutes}分`} />}
            {me.hasTools !== undefined && <Row label="スコップなどの道具" value={me.hasTools ? "ある" : "ない"} />}
            {me.clearArea && <Row label="雪かきが必要なところ" value={AREA[me.clearArea]} />}
            {me.soloMinutes && <Row label="ひとりでかかる時間" value={me.soloMinutes === "unknown" ? "わからない" : `${me.soloMinutes}分くらい`} />}
          </dl>
          <p className="mt-2 text-sm text-ink-soft">家の場所は、地図には 50m のマスでしか出ません。名前や住所は出ません。</p>
        </section>
      ) : (
        <section className="space-y-3 rounded-3xl bg-card p-4 shadow-sm ring-1 ring-ink/10">
          <h2 className="text-lg font-bold">まだ登録がありません</h2>
          <p className="text-base">LINE で「シマエナGO」を友だち追加すると、1分で登録できます。</p>
          {join ? (
            <a href={join} className="btn btn-big bg-[#06C755] text-white">
              LINE で参加する
            </a>
          ) : (
            <p className="rounded-2xl bg-ice-soft px-3 py-2 text-base">LINE で「シマエナGO」を検索して友だち追加 → 登録（1分）</p>
          )}
        </section>
      )}

      <section className="space-y-3 rounded-3xl bg-card p-4 shadow-sm ring-1 ring-ink/10" aria-label="登録をやり直す">
        <h2 className="text-lg font-bold">登録をやり直す</h2>
        <p className="text-base">役わり・家の場所・動ける時間を変えたいときは、もう一度登録します。羽やカードは消えません。</p>
        <RedoRegistration liffId={process.env.NEXT_PUBLIC_LIFF_ID} />
      </section>

      <section className="space-y-2 rounded-3xl bg-warm p-4 ring-1 ring-ink/10" aria-label="お知らせについて">
        <h2 className="text-lg font-bold">LINE のお知らせ</h2>
        <ul className="list-disc space-y-1 pl-5 text-base">
          <li>雪が降りそうな前の夜に「明日の朝」のお知らせ。</li>
          <li>雪の朝 6:30 に、1問だけの点呼。ボタンを1回押すだけです。</li>
          <li>家族の連携は、6桁の連携コードを LINE のトークに送ります。</li>
        </ul>
        <p className="text-sm text-ink-soft">お知らせを止めたいときは、LINE で「シマエナGO」をブロックしてください。いつでも戻せます。</p>
      </section>

      <nav className="grid grid-cols-2 gap-3">
        <Link href="/rules" className="btn btn-white text-lg">
          使い方
        </Link>
        <Link href={`/${q}`} className="btn btn-white text-lg">
          ホームへ戻る
        </Link>
      </nav>
    </main>
  );
}

export default function SettingsPage({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-paper p-6 text-ink">読み込み中…</main>}>
      <Settings searchParams={searchParams} />
    </Suspense>
  );
}
