import type { Metadata } from "next";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import AutoRefresh from "@/components/AutoRefresh";
import LiffBridge from "@/components/LiffBridge";
import MapScreen from "@/components/MapScreen";
import { viewCells } from "@/lib/cells";
import { latestClear } from "@/lib/morning/clear";
import { loadRoster } from "@/lib/morning/roster";
import { loadMorning } from "@/lib/morning/store";
import { viewBases } from "@/lib/morning/view";
import { listShort } from "@/lib/morning/watch";
import { emojiGrid } from "@/lib/share";
import { readViewer, VIEWER_COOKIE } from "@/lib/viewer";

export const metadata: Metadata = { title: "地図 ・ シマエナGO" };

async function MapContent({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  await connection(); // 毎回いまの状態を読む
  const { as } = await searchParams;
  const [record, roster, cookieStore] = await Promise.all([loadMorning(), loadRoster(), cookies()]);
  // 誰の画面か: ?as=h3（デモで3台のスマホに別の人を出す）→ LIFF でログインした本人（cookie）→ 既定の人
  const demoAs = as && /^h\d+$/.test(as) ? as : undefined;
  const viewerId = demoAs ?? readViewer(cookieStore.get(VIEWER_COOKIE)?.value) ?? record.morning.viewerId;
  const state = { ...record.morning, viewerId };
  // 家の正確な位置はサーバーに置いたまま、画面には 50m マスだけを渡す
  const cells = viewCells([...viewBases(state).values()], roster);
  const viewer = roster.participants.find((p) => p.id === viewerId);
  const myMissionId = state.sorties.find((s) => s.participantId === viewerId)?.missionId;
  const thanks = myMissionId ? record.thanks?.[myMissionId] : undefined;
  return (
    <>
      <AutoRefresh />
      <LiffBridge liffId={process.env.NEXT_PUBLIC_LIFF_ID} enabled={!demoAs} />
      <MapScreen
        state={state}
        cells={cells}
        bases={roster.bases}
        viewer={viewer ? { teamId: viewer.teamId, role: viewer.role } : undefined}
        clear={latestClear(state, roster, viewerId, record.firstFlights)}
        rescue={listShort(record, roster)}
        recap={record.recap?.text}
        thanks={thanks ? { label: thanks.label, sentence: thanks.sentence } : undefined}
        shareText={emojiGrid(cells, state)}
        cheers={myMissionId ? (record.cheers?.[myMissionId] ?? []).map((c) => c.label) : []}
      />
    </>
  );
}

export default function MapPage({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  return (
    <Suspense fallback={<div className="grid h-dvh place-items-center bg-paper text-ink">読み込み中…</div>}>
      <MapContent searchParams={searchParams} />
    </Suspense>
  );
}
