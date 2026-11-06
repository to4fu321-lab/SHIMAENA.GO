// 雪かきを頼む（spec v1.20 お互いさま）: 同じアプリで、手伝うことも頼むこともできる。
// 頼む家として登録していない人 → 登録（頼み方 おまかせ／一緒に・どこまで）。登録した人 → 今日頼む・頼み方を変える。
// 1画面（スクロールなし）。
import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import AskScreen from "@/components/AskScreen";
import LoginButton from "@/components/LoginButton";
import TabBar from "@/components/TabBar";
import Bgm from "@/components/Bgm";
import { styleOf } from "@/lib/morning/flow";
import { loadMorning } from "@/lib/morning/store";
import { loadRoster } from "@/lib/morning/roster";
import { isNight } from "@/lib/night";
import { isDemoViewer, readViewer, VIEWER_COOKIE } from "@/lib/viewer";

export const metadata: Metadata = { title: "雪かきを頼む ・ シマエナGO" };

async function Ask({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  await connection();
  const { as } = await searchParams;
  const [roster, record, jar] = await Promise.all([loadRoster(), loadMorning(), cookies()]);
  const demoAs = as && isDemoViewer(as) ? as : undefined;
  const viewerId = demoAs ?? readViewer(jar.get(VIEWER_COOKIE)?.value);
  const me = viewerId ? roster.participants.find((p) => p.id === viewerId) : undefined;
  const q = demoAs ? `?as=${demoAs}` : "";
  const base = me ? roster.bases.find((b) => b.requesterId === me.id) : undefined;
  const house = me?.role === "requester" && base ? base : undefined;
  // いま雪かき待ちか（今日の記録に、まだ終わっていないこの家のミッションがある）
  const waiting = house ? record.morning.missions.some((m) => m.baseId === house.id && m.status !== "done") : false;

  return (
    <div className="mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden bg-paper text-ink">
      <header className="flex shrink-0 items-center justify-between gap-2 bg-ice-soft px-4 pb-2 pt-4">
        <h1 className="text-2xl font-bold">🏠 雪かきを頼む</h1>
        <Link href={`/${q}`} className="btn btn-white min-h-11 px-3 text-sm">
          ホーム
        </Link>
      </header>
      <main className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-3">
        {!me ? (
          <>
            <p className="text-lg leading-snug">雪かきを頼むには、LINE でログインして登録してください。手伝う人も、頼む人も、同じアプリです。</p>
            <LoginButton next="/ask" className="mt-auto" />
          </>
        ) : (
          <AskScreen
            viewerId={me.id}
            registered={Boolean(house)}
            baseNumber={house?.number}
            style={house ? styleOf(me) : undefined}
            area={me.clearArea}
            waiting={waiting}
            night={isNight()}
          />
        )}
      </main>
      <TabBar active="home" q={q} />
    </div>
  );
}

export default function AskPage({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  return (
    <>
      <Bgm track="morning" />
      <Suspense fallback={<main className="grid min-h-dvh place-items-center bg-paper text-ink">読み込み中…</main>}>
        <Ask searchParams={searchParams} />
      </Suspense>
    </>
  );
}
