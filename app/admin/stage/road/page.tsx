// 撮影ステージ（道の危険・自動・1画面）: /admin の合言葉でログインした人だけ。発表の録画用（11/8 本人「雪かきのサンプル動画と同じように」）。
import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { adminGate } from "@/lib/admin-auth";
import AutoStageRoad from "@/components/AutoStageRoad";
import { presentRoadAlert, resetRoadStage } from "../../actions";

export const metadata: Metadata = { title: "撮影ステージ（道の危険） ・ シマエナGO" };

export default function RoadStagePage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#1e3346]" />}>
      <Stage />
    </Suspense>
  );
}

async function Stage() {
  await connection();
  const gate = await adminGate();
  if (gate !== "ok" && gate !== "open") redirect("/admin");
  return <AutoStageRoad actions={{ reset: resetRoadStage, alert: presentRoadAlert }} />;
}
