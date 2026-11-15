import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import DemoPicker, { type DemoPerson } from "@/components/DemoPicker";
import { JUDGE_CAST } from "@/lib/demo-cast";
import { demoEnabled } from "@/lib/env";
import { loadRoster } from "@/lib/morning/roster";
import { defaultLook } from "@/lib/mypage/rules";
import { teamTheme } from "@/lib/team-theme";

export const metadata: Metadata = { title: "デモの人をえらぶ ・ シマエナGO" };

// 審査員・初めての人が、架空の手伝う人10人から1人をえらんで体験する（11/8）。
// 1人を全員で使うと記録が混ざるので、えらんだ人の ?as= で開く。基本1画面（2列×5段）。1回押すとすぐ始まる（components/DemoPicker.tsx。spec v1.59）
async function DemoPick({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  await connection();
  const { next = "/" } = await searchParams;
  if (!demoEnabled()) redirect("/start");
  const roster = await loadRoster();
  const people = JUDGE_CAST.flatMap((id) => {
    const p = roster.participants.find((x) => x.id === id);
    return p ? [p] : [];
  });
  const list: DemoPerson[] = people.map((p) => {
    const look = defaultLook(p.id);
    const t = p.teamId ? teamTheme(p.teamId).team : undefined;
    return { id: p.id, nickname: p.nickname, icon: look.icon, iconBg: look.iconBg, teamId: p.teamId, teamName: t?.name, teamColor: t?.color };
  });
  return (
    <main className="mx-auto flex h-dvh w-full max-w-md flex-col gap-2.5 overflow-hidden bg-paper px-4 pb-4 pt-5 text-ink">
      <header className="shrink-0 space-y-1">
        <h1 className="text-2xl font-bold">デモの人をえらぶ</h1>
        <p className="text-base leading-snug">
          <b>1人を押すと、すぐ始まります。</b>架空の町の、架空の10人です。雪が積もった朝から、その人として雪かきを体験できます。
        </p>
      </header>
      <DemoPicker people={list} next={next} />
      {/* デモの町は、いま見ている人みんなで1つ（spec v1.59: 入口で一言） */}
      <p className="shrink-0 rounded-2xl bg-ice-soft px-3 py-1.5 text-sm leading-snug">
        🏘 デモの町は、いま見ている人みんなで<b>1つ</b>です。ほかの人が押すと、家が先に終わったり、仲間が増えたりします（本番の町と同じ動きです）。
      </p>
      <Link href="/" className="btn btn-white min-h-12 shrink-0 text-base" data-sound="back">
        もどる
      </Link>
    </main>
  );
}

export default function DemoPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  return (
    <Suspense fallback={<div className="mx-auto grid h-dvh max-w-md place-items-center bg-paper text-ink">読み込み中…</div>}>
      <DemoPick searchParams={searchParams} />
    </Suspense>
  );
}
