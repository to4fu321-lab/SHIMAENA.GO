import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import LiffBridge from "@/components/LiffBridge";
import { lineJoinUrl } from "@/lib/line/join";
import SoloScreen from "@/components/SoloScreen";
import { loadRoster } from "@/lib/morning/roster";
import { loadMorning } from "@/lib/morning/store";
import { listShort } from "@/lib/morning/watch";
import { SOLO_MISSIONS } from "@/lib/solo/missions";
import { soloStatus } from "@/lib/solo/ops";
import { loadPublicStats } from "@/lib/public/load";
import { loadMeStats } from "@/lib/sns/me";
import { shareTextsFor } from "@/lib/sns/refresh";
import { mockShareText } from "@/lib/sns/text";
import { baseUrl } from "@/lib/url";
import { isDemoViewer, readViewer, VIEWER_COOKIE } from "@/lib/viewer";

export const metadata: Metadata = { title: "ソロ出動 ・ シマエナGO" };

async function SoloContent({ searchParams }: { searchParams: Promise<{ as?: string; pick?: string }> }) {
  await connection();
  const { as, pick } = await searchParams;
  const [record, roster, cookieStore] = await Promise.all([loadMorning(), loadRoster(), cookies()]);
  const demoAs = as && isDemoViewer(as) ? as : undefined;
  const viewerId = demoAs ?? readViewer(cookieStore.get(VIEWER_COOKIE)?.value);
  const me = viewerId ? roster.participants.find((p) => p.id === viewerId) : undefined;
  const q = demoAs ? `?as=${demoAs}` : "";

  if (!me) {
    const join = lineJoinUrl();
    return (
      <main className="mx-auto min-h-dvh max-w-md space-y-5 bg-paper px-4 py-6 text-ink">
        <LiffBridge liffId={process.env.NEXT_PUBLIC_LIFF_ID} enabled={!demoAs} />
        <h1 className="text-2xl font-bold">
          ソロ<span className="text-neon">出動</span>
        </h1>
        <section className="space-y-3 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-ink/10">
          <p className="text-lg font-bold">仲間がいなくても、自分の5分で町を変えられる。</p>
          <p>見回り・雪の報告・自分の家の雪かき。1人でできる 3〜5分のミッションで、羽ポイントとカードがたまります。</p>
          <p className="text-sm text-ink/70">ソロ出動は LINE で登録した人の画面です。LINE の「シマエナGO」から開いてください。</p>
          {join ? (
            <a href={join} className="block rounded-2xl bg-[#06C755] py-4 text-center text-lg font-bold text-white">
              LINE で参加する
            </a>
          ) : (
            <p className="rounded-2xl bg-paper px-3 py-2 text-base">LINE で「シマエナGO」を検索して友だち追加 → 登録（1分）</p>
          )}
          <Link href="/rules" className="block rounded-2xl bg-white py-4 text-center text-lg font-bold text-ink ring-2 ring-ink/15">
            あそびかた
          </Link>
          <p className="text-xs text-ink/50">
            デモ: <Link href="/solo?as=h3" className="underline">架空の手伝う側として開く</Link>
          </p>
        </section>
      </main>
    );
  }

  const status = await soloStatus(me.id, new Date());
  const planned = record.morning.rollcall.status === "planned";
  const canHelpHouse = planned && me.role === "helper" && Boolean(me.teamId);
  const shorts = listShort(record, roster);
  const [stats, meStats] = await Promise.all([loadPublicStats(), loadMeStats(me.id)]);
  const texts = await shareTextsFor(stats);
  const site = baseUrl();
  const v = `v=${status.totalFeathers}`; // 羽が増えたら画像を取り直す
  const shareOptions = [
    {
      key: "me",
      label: "わたしの活動",
      text: mockShareText("me", stats, meStats),
      image: `/api/share/me.png?${v}${demoAs ? `&as=${demoAs}` : ""}`,
      page: `${site}/public/share/today?via=sns`,
    },
    { key: "recruit", label: "仲間を募集", text: texts.recruit.text, image: "/api/share/recruit.png", page: `${site}/public/share/recruit?via=sns` },
  ];
  return (
    <>
      <LiffBridge liffId={process.env.NEXT_PUBLIC_LIFF_ID} enabled={!demoAs} />
      <SoloScreen
        viewerId={me.id}
        nickname={me.nickname}
        role={me.role}
        status={status}
        missions={SOLO_MISSIONS}
        canHelpHouse={canHelpHouse}
        shortHouses={shorts.length}
        pickFive={pick === "5"}
        q={q}
        shareOptions={shareOptions}
      />
    </>
  );
}

export default function SoloPage({ searchParams }: { searchParams: Promise<{ as?: string; pick?: string }> }) {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-paper p-6 text-ink">読み込み中…</main>}>
      <SoloContent searchParams={searchParams} />
    </Suspense>
  );
}
