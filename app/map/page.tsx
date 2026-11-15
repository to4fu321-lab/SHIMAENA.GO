import type { Metadata } from "next";
import StormBanner from "@/components/StormBanner";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import AutoRefresh from "@/components/AutoRefresh";
import MapScreen from "@/components/MapScreen";
import { soloCells, viewCells } from "@/lib/cells";
import { latestClear, withInvites, daySummary } from "@/lib/morning/clear";
import { loadRoster } from "@/lib/morning/roster";
import { loadMorning } from "@/lib/morning/store";
import { viewBases } from "@/lib/morning/view";
import { appToday } from "@/lib/morning/today";
import { listShort, viewerSpot } from "@/lib/morning/watch";
import { repo } from "@/lib/repo";
import { agoText, hazard, SHOW_MS } from "@/lib/road/hazards";
import { listRoadReportsSince } from "@/lib/road/store";
import { destinationsFor } from "@/lib/nav";
import { emojiGrid } from "@/lib/share";
import { isDemoViewer, readViewer, VIEWER_COOKIE } from "@/lib/viewer";

// v1.24: 完了でカードが出たあと、返事のあとで Claude が絵を描く（after()）。その時間まで関数を止めない
export const maxDuration = 300;

export const metadata: Metadata = { title: "地図 ・ シマエナGO" };

async function MapContent({ searchParams }: { searchParams: Promise<{ as?: string; road?: string; view?: string; fin?: string }> }) {
  await connection(); // 毎回いまの状態を読む
  const { as, road: focusRoad, view, fin } = await searchParams;
  const [record, roster, cookieStore] = await Promise.all([loadMorning(), loadRoster(), cookies()]);
  // 誰の画面か: ?as=h3（デモで3台のスマホに別の人を出す）→ ログインした本人（cookie）→ 既定の人
  const demoAs = as && isDemoViewer(as) ? as : undefined;
  const viewerId = demoAs ?? readViewer(cookieStore.get(VIEWER_COOKIE)?.value) ?? record.morning.viewerId;
  const state = { ...record.morning, viewerId };
  // 家の正確な位置はサーバーに置いたまま、画面には 50m マスだけを渡す
  const cells = viewCells([...viewBases(state).values()], roster);
  const viewer = roster.participants.find((p) => p.id === viewerId);
  const myMissionId = state.sorties.find((s) => s.participantId === viewerId)?.missionId;
  // 自分が行った家に届いた「ありがとう」のうち、いちばん新しいもの（2軒目・3軒目の分も出す。spec v1.59）
  const thanksOf = state.sorties
    .filter((s) => s.participantId === viewerId && record.thanks?.[s.missionId])
    .map((s) => ({ missionId: s.missionId, rec: record.thanks![s.missionId] }))
    .sort((a, b) => a.rec.at.localeCompare(b.rec.at))
    .at(-1);
  const thanks = thanksOf?.rec;
  const thanksBase = thanksOf && roster.bases.find((b) => b.id === state.missions.find((m) => m.id === thanksOf.missionId)?.baseId)?.number;
  // ソロ出動の足あと（今日）。表がまだなければ出さない（画面は止めない）
  const today = appToday(record);
  // 道の危険（24時間以内）。表がまだなければ出さない。足あとと同時に読む（11/7: 画面を待たせない）
  const now = new Date();
  const [soloLogs, roadRows] = await Promise.all([
    repo().listSoloLogsBetween(today, today).catch(() => []),
    listRoadReportsSince(new Date(now.getTime() - SHOW_MS).toISOString()).catch(() => []),
  ]);
  const solo = soloCells(soloLogs);
  const road = roadRows.flatMap((r) => {
    const h = hazard(r.hazard);
    return h ? [{ id: r.id, hazard: h.id, emoji: h.emoji, label: h.label, location: r.location, ago: agoText(r.at, now), fresh: now.getTime() - Date.parse(r.at) < 2 * 3600_000, note: r.note }] : [];
  });
  return (
    <>
      <AutoRefresh />
      <StormBanner />
      <MapScreen
        state={state}
        cells={cells}
        bases={roster.bases}
        viewer={viewer ? { teamId: viewer.teamId, role: viewer.role } : undefined}
        clear={withInvites(latestClear(state, roster, viewerId, record.firstFlights), viewerId ? record.invites?.[viewerId] : undefined)}
        day={
          viewerId
            ? daySummary(state, roster, viewerId, {
                firstFlightIds: record.firstFlights,
                invites: record.invites?.[viewerId],
                cardsTonight: (record.cardsDue ?? []).filter((d) => d.sorties.some((x) => x.participantId === viewerId)).length,
              })
            : null
        }
        rescue={listShort(record, roster, viewerSpot(record, roster, viewerId))}
        recap={record.recap?.text}
        thanks={thanks && thanksOf ? { label: thanks.label, sentence: thanks.sentence, missionId: thanksOf.missionId, baseNumber: thanksBase ?? "?" } : undefined}
        teacher={record.teacherTip?.line}
        shareText={emojiGrid(cells, state)}
        cheers={myMissionId ? (record.cheers?.[myMissionId] ?? []).map((c) => c.label) : []}
        home={viewer?.location}
        destinations={destinationsFor(record, roster, viewerId)}
        solo={solo}
        road={road}
        focusRoad={focusRoad}
        view={view === "road" ? "road" : undefined}
        fin={fin === "1"}
      />
    </>
  );
}

export default function MapPage({ searchParams }: { searchParams: Promise<{ as?: string; road?: string; view?: string; fin?: string }> }) {
  return (
    <Suspense fallback={<div className="mx-auto grid h-dvh max-w-md place-items-center bg-paper text-ink">読み込み中…</div>}>
      <MapContent searchParams={searchParams} />
    </Suspense>
  );
}
