import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import AutoRefresh from "@/components/AutoRefresh";
import MapScreen from "@/components/MapScreen";
import { viewCells } from "@/lib/cells";
import { loadRoster } from "@/lib/morning/roster";
import { loadMorning } from "@/lib/morning/store";
import { viewBases } from "@/lib/morning/view";

export const metadata: Metadata = { title: "地図 ・ シマエナGO" };

async function MapContent({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  await connection(); // 毎回いまの状態を読む
  const { as } = await searchParams;
  const [record, roster] = await Promise.all([loadMorning(), loadRoster()]);
  // ?as=h3 で「誰の画面か」を切り替えられる（デモで3台のスマホに別の人を出す）
  const viewerId = as && /^h\d+$/.test(as) ? as : record.morning.viewerId;
  const state = { ...record.morning, viewerId };
  // 家の正確な位置はサーバーに置いたまま、画面には 50m マスだけを渡す
  const cells = viewCells([...viewBases(state).values()], roster);
  const viewer = roster.participants.find((p) => p.id === viewerId);
  return (
    <>
      <AutoRefresh />
      <MapScreen state={state} cells={cells} bases={roster.bases} viewer={viewer ? { teamId: viewer.teamId } : undefined} />
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
