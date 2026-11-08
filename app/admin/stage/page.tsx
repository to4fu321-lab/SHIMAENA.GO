// 撮影ステージ（自動・1画面）: /admin の合言葉でログインした人だけ。発表の録画用（11/8 本人の指示）。
import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { adminGate } from "@/lib/admin-auth";
import AutoStage from "@/components/AutoStage";
import { completeOneAuto, presentAllTeams, presentCheer, presentFinish, presentGather, presentGo, presentReset, presentRingFast } from "../actions";

export const metadata: Metadata = { title: "撮影ステージ（自動） ・ シマエナGO" };

export default function StagePage() {
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
  return (
    <AutoStage
      actions={{
        announce: presentReset,
        ring: presentRingFast,
        goA: presentGo.bind(null, "a"),
        goB: presentGo.bind(null, "b"),
        allTeams: presentAllTeams,
        gather: presentGather,
        completeOther: completeOneAuto.bind(null, true),
        finishA: presentFinish,
        cheer: presentCheer,
      }}
    />
  );
}
