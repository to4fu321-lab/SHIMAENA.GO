// 設定: 登録の確認と、やり直し・連携コード・お知らせの説明（spec v1.17: 画面で）。
// 1画面（11/5 本人の指示）: タブ「あなたの登録／やり直す／お知らせ／音」を横スワイプ。縦にはスクロールしない。
// 「音」（spec v1.19）: 効果音と BGM のオン・オフ（端末に保存）。
import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import Icon from "@/components/Icon";
import LoginButton from "@/components/LoginButton";
import Pager, { Screen } from "@/components/Pager";
import NudgeSwitch from "@/components/NudgeSwitch";
import RedoRegistration from "@/components/RedoRegistration";
import SoundToggle from "@/components/SoundToggle";
import { loadNudge } from "@/lib/nudge/store";
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
  const nudgeOn = me?.role === "helper" ? !(await loadNudge(me.id).catch(() => undefined))?.off : undefined;

  return (
    <Screen
      header={
      <header className="flex items-center justify-between gap-2 px-4 pb-2 pt-4">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Icon name="settings" size={34} accent="var(--ice)" />
          設定
        </h1>
        <Link href={`/${q}`} className="btn btn-white min-h-11 px-3 text-sm">
          ホーム
        </Link>
      </header>
      }
      footer={
      <nav className="grid grid-cols-2 gap-3 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-2">
        <Link href="/rules" className="btn btn-white text-lg">
          使い方
        </Link>
        <Link href={`/${q}`} className="btn btn-white text-lg">
          ホームへ戻る
        </Link>
      </nav>
      }
    >
      <Pager tabs={[{ key: "me", label: "登録" }, { key: "redo", label: "やり直す" }, { key: "notice", label: "お知らせ" }, { key: "sound", label: "音" }]}>

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
          <LoginButton next="/settings" />
          <p className="text-base">はじめての方は、LINE でログインして30秒で登録できます。</p>
          <Link href="/start" className="btn btn-white text-lg">
            はじめての方: 30秒で登録
          </Link>
        </section>
      )}

      <section className="space-y-3 rounded-3xl bg-card p-4 shadow-sm ring-1 ring-ink/10" aria-label="登録をやり直す">
        <h2 className="text-lg font-bold">登録をやり直す</h2>
        <p className="text-base">役わり・家の場所・動ける時間を変えたいときは、もう一度登録します。羽やカードは消えません。</p>
        <RedoRegistration />
        <p className="text-base">ご家族から6桁の連携コードをもらった方は、「はじめる」の画面で入れられます。</p>
        <Link href="/start?redo=1" className="btn btn-white text-lg">
          連携コードを入れる
        </Link>
      </section>

      <section className="space-y-2 rounded-3xl bg-warm p-4 ring-1 ring-ink/10" aria-label="お知らせについて">
        <h2 className="text-lg font-bold">お知らせの届き方</h2>
        <ul className="list-disc space-y-1 pl-5 text-base">
          <li>雪が降りそうな前の夜に「明日の朝」のお知らせ。</li>
          <li>雪の朝 6:30 に、1問だけの点呼。ボタンを1回押すだけです。</li>
          <li>どれも下のタブ「隊長」（隊長トーク）に届きます。LINE は本人の確認（ログイン）にだけ使います。</li>
        </ul>
        {me && nudgeOn !== undefined && <NudgeSwitch viewerId={me.id} initial={nudgeOn} />}
        <p className="text-sm text-ink-soft">お知らせを止めたいときは、スマホの通知をオフにしてください。いつでも戻せます。</p>
      </section>

      <SoundToggle />

      </Pager>
    </Screen>
  );
}

export default function SettingsPage({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-paper p-6 text-ink">読み込み中…</main>}>
      <Settings searchParams={searchParams} />
    </Suspense>
  );
}
