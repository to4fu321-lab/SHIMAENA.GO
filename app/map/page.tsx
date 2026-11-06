import type { Metadata } from "next";
import StormBanner from "@/components/StormBanner";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import AutoRefresh from "@/components/AutoRefresh";
import LiffBridge from "@/components/LiffBridge";
import MapScreen from "@/components/MapScreen";
import { soloCells, viewCells } from "@/lib/cells";
import { latestClear, withInvites } from "@/lib/morning/clear";
import { loadRoster } from "@/lib/morning/roster";
import { loadMorning } from "@/lib/morning/store";
import { viewBases } from "@/lib/morning/view";
import { appToday } from "@/lib/morning/today";
import { listShort } from "@/lib/morning/watch";
import { repo } from "@/lib/repo";
import { agoText, hazard, SHOW_MS } from "@/lib/road/hazards";
import { listRoadReportsSince } from "@/lib/road/store";
import { destinationsFor } from "@/lib/nav";
import { emojiGrid } from "@/lib/share";
import { isDemoViewer, readViewer, VIEWER_COOKIE } from "@/lib/viewer";

export const metadata: Metadata = { title: "地図 ・ シマエナGO" };

async function MapContent({ searchParams }: { searchParams: Promise<{ as?: string; road?: string }> }) {
  await connection(); // 毎回いまの状態を読む
  const { as, road: focusRoad } = await searchParams;
  const [record, roster, cookieStore] = await Promise.all([loadMorning(), loadRoster(), cookies()]);
  // 誰の画面か: ?as=h3（デモで3台のスマホに別の人を出す）→ LIFF でログインした本人（cookie）→ 既定の人
  const demoAs = as && isDemoViewer(as) ? as : undefined;
  const viewerId = demoAs ?? readViewer(cookieStore.get(VIEWER_COOKIE)?.value) ?? record.morning.viewerId;
  const state = { ...record.morning, viewerId };
  // 家の正確な位置はサーバーに置いたまま、画面には 50m マスだけを渡す
  const cells = viewCells([...viewBases(state).values()], roster);
  const viewer = roster.participants.find((p) => p.id === viewerId);
  const myMissionId = state.sorties.find((s) => s.participantId === viewerId)?.missionId;
  const thanks = myMissionId ? record.thanks?.[myMissionId] : undefined;
  // ソロ出動の足あと（今日）。表がまだなければ出さない（画面は止めない）
  const today = appToday(record);
  const solo = soloCells(await repo().listSoloLogsBetween(today, today).catch(() => []));
  // 道の危険（24時間以内）。表がまだなければ出さない
  const now = new Date();
  const road = (await listRoadReportsSince(new Date(now.getTime() - SHOW_MS).toISOString()).catch(() => [])).flatMap((r) => {
    const h = hazard(r.hazard);
    return h ? [{ id: r.id, hazard: h.id, emoji: h.emoji, label: h.label, location: r.location, ago: agoText(r.at, now), fresh: now.getTime() - Date.parse(r.at) < 2 * 3600_000, note: r.note }] : [];
  });
  return (
    <>
      <AutoRefresh />
      <StormBanner />
      <LiffBridge liffId={process.env.NEXT_PUBLIC_LIFF_ID} enabled={!demoAs} />
      <MapScreen
        state={state}
        cells={cells}
        bases={roster.bases}
        viewer={viewer ? { teamId: viewer.teamId, role: viewer.role } : undefined}
        clear={withInvites(latestClear(state, roster, viewerId, record.firstFlights), viewerId ? record.invites?.[viewerId] : undefined)}
        rescue={listShort(record, roster)}
        recap={record.recap?.text}
        thanks={thanks ? { label: thanks.label, sentence: thanks.sentence } : undefined}
        teacher={record.teacherTip?.line}
        shareText={emojiGrid(cells, state)}
        cheers={myMissionId ? (record.cheers?.[myMissionId] ?? []).map((c) => c.label) : []}
        home={viewer?.location}
        destinations={destinationsFor(record, roster, viewerId)}
        solo={solo}
        road={road}
        focusRoad={focusRoad}
      />
    </>
  );
}

export default function MapPage({ searchParams }: { searchParams: Promise<{ as?: string; road?: string }> }) {
  return (
    <Suspense fallback={<div className="grid h-dvh place-items-center bg-paper text-ink">読み込み中…</div>}>
      <MapContent searchParams={searchParams} />
    </Suspense>
  );
}
