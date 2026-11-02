import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import AutoRefresh from "@/components/AutoRefresh";
import MapScreen from "@/components/MapScreen";
import { getDemo } from "@/lib/demo/store";

export const metadata: Metadata = { title: "地図 ・ シマエナGO" };

async function MapContent({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  await connection(); // 毎回いまの状態を読む
  const { as } = await searchParams;
  const state = getDemo().morning;
  // ?as=h3 で「誰の画面か」を切り替えられる（デモで3台のスマホに別の人を出す）
  const viewerId = as && /^h\d+$/.test(as) ? as : state.viewerId;
  return (
    <>
      <AutoRefresh />
      <MapScreen state={{ ...state, viewerId }} />
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
