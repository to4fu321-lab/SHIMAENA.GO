import { isNight } from "@/lib/night";
import StormBanner from "@/components/StormBanner";
import type { Metadata } from "next";
import { onTeam } from "@/lib/member";
import Link from "next/link";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import LiffBridge from "@/components/LiffBridge";
import LineLoginButton from "@/components/LineLoginButton";
import { lineJoinUrl } from "@/lib/line/join";
import SoloScreen from "@/components/SoloScreen";
import { loadRoster } from "@/lib/morning/roster";
import { loadMorning } from "@/lib/morning/store";
import { listShort } from "@/lib/morning/watch";
import { SOLO_MISSIONS } from "@/lib/solo/missions";
import { getAlertPref } from "@/lib/road/store";
import { soloStatus } from "@/lib/solo/ops";
import { loadPublicStats } from "@/lib/public/load";
import { loadMeStats } from "@/lib/sns/me";
import { shareTextsFor } from "@/lib/sns/refresh";
import { mockShareText } from "@/lib/sns/text";
import { baseUrl } from "@/lib/url";
import { isDemoViewer, readViewer, VIEWER_COOKIE } from "@/lib/viewer";

export const metadata: Metadata = { title: "雪かきGO！ ・ シマエナGO" };

async function SoloContent({ searchParams }: { searchParams: Promise<{ as?: string; pick?: string; focus?: string }> }) {
  await connection();
  const { as, pick, focus } = await searchParams;
  const [record, roster, cookieStore] = await Promise.all([loadMorning(), loadRoster(), cookies()]);
  const demoAs = as && isDemoViewer(as) ? as : undefined;
  const viewerId = demoAs ?? readViewer(cookieStore.get(VIEWER_COOKIE)?.value);
  const me = viewerId ? roster.participants.find((p) => p.id === viewerId) : undefined;
  const q = demoAs ? `?as=${demoAs}` : "";

  if (!me) {
    const join = lineJoinUrl();
    return (
      <main className="mx-auto min-h-dvh max-w-md space-y-4 bg-paper px-4 py-5 text-ink">
        <LiffBridge liffId={process.env.NEXT_PUBLIC_LIFF_ID} enabled={!demoAs} />
        <h1 className="text-2xl font-bold">
          雪かきGO！ <span className="block text-base font-normal text-ink-soft">ひとりで10分（ソロ出動）</span>
        </h1>
        <section className="space-y-3 rounded-3xl bg-card p-5 shadow-sm ring-1 ring-ink/10">
          <p className="text-lg font-bold">仲間がいなくても、自分の10分で町を変えられる。</p>
          <p className="text-base">ソロ出動は LINE で登録した人の画面です。</p>
          <LineLoginButton liffId={process.env.NEXT_PUBLIC_LIFF_ID} />
          {join ? (
            <a href={join} className="btn btn-white text-lg">
              はじめての方: LINE で友だち追加
            </a>
          ) : (
            <p className="rounded-2xl bg-paper px-3 py-2 text-base">LINE で「シマエナGO」を検索して友だち追加 → 登録（1分）</p>
          )}
          <Link href="/rules" className="btn btn-white text-lg">
            使い方
          </Link>
          <p className="text-sm text-ink-soft">
            デモ: <Link href="/solo?as=h3" className="underline">架空の手伝う側として開く</Link>
          </p>
        </section>
      </main>
    );
  }

  const status = await soloStatus(me.id, new Date());
  const planned = record.morning.rollcall.status === "planned";
  const canHelpHouse = planned && onTeam(me);
  const shorts = listShort(record, roster);
  const [stats, meStats, roadAlerts] = await Promise.all([loadPublicStats(), loadMeStats(me.id), getAlertPref(me.id).catch(() => undefined)]);
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
      <StormBanner />
      <SoloScreen
        viewerId={me.id}
        nickname={me.nickname}
        role={me.role}
        status={status}
        missions={SOLO_MISSIONS}
        canHelpHouse={canHelpHouse}
        shortHouses={shorts.length}
        pickFive={pick === "10" || pick === "5"}
        night={isNight()}
        focus={SOLO_MISSIONS.some((m) => m.kind === focus && m.kind !== "help_house") ? focus : undefined}
        q={q}
        shareOptions={shareOptions}
        roadAlerts={roadAlerts}
      />
    </>
  );
}

export default function SoloPage({ searchParams }: { searchParams: Promise<{ as?: string; pick?: string; focus?: string }> }) {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-paper p-6 text-ink">読み込み中…</main>}>
      <SoloContent searchParams={searchParams} />
    </Suspense>
  );
}
