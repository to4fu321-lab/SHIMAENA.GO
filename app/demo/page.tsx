import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import Avatar from "@/components/Avatar";
import { JUDGE_CAST } from "@/lib/demo-cast";
import { demoEnabled } from "@/lib/env";
import { loadRoster } from "@/lib/morning/roster";
import { defaultLook } from "@/lib/mypage/rules";
import { teamTheme } from "@/lib/team-theme";
import { pickDemoAction } from "./actions";

export const metadata: Metadata = { title: "デモの人をえらぶ ・ シマエナGO" };

// 審査員・初めての人が、架空の手伝う人10人から1人をえらんで体験する（11/8）。
// 1人を全員で使うと記録が混ざるので、えらんだ人の ?as= で開く。基本1画面（2列×5段）
async function DemoPick({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  await connection();
  const { next = "/" } = await searchParams;
  if (!demoEnabled()) redirect("/start");
  const roster = await loadRoster();
  const people = JUDGE_CAST.flatMap((id) => {
    const p = roster.participants.find((x) => x.id === id);
    return p ? [p] : [];
  });
  return (
    <main className="mx-auto flex h-dvh w-full max-w-md flex-col gap-3 overflow-hidden bg-paper px-4 pb-4 pt-5 text-ink">
      <header className="shrink-0 space-y-1">
        <h1 className="text-2xl font-bold">デモの人をえらぶ</h1>
        <p className="text-base leading-snug">
          架空の町の、架空の10人です。1人えらぶと、雪が積もった朝から、その人として雪かきを体験できます。
          <span className="text-ink-soft">（ほかの人と記録が混ざらないように）</span>
        </p>
      </header>
      <ul className="grid min-h-0 flex-1 grid-cols-2 grid-rows-5 gap-2">
        {people.map((p) => {
          const look = defaultLook(p.id);
          const t = p.teamId ? teamTheme(p.teamId).team : undefined;
          return (
            <li key={p.id} className="min-h-0">
              <form action={pickDemoAction} className="h-full">
              <input type="hidden" name="as" value={p.id} />
              <input type="hidden" name="next" value={next} />
              <button
                className="flex h-full w-full items-center gap-2 rounded-2xl bg-card px-2.5 text-left shadow-sm ring-1 ring-ink/10 hover:ring-2 hover:ring-lamp"
                data-sound="tap"
              >
                <Avatar icon={look.icon} bg={look.iconBg} size={40} team={p.teamId} />
                <span className="min-w-0">
                  <span className="block truncate text-base font-bold leading-tight">{p.nickname}</span>
                  {t && (
                    <span className="block truncate text-xs font-bold text-ink-soft">
                      <span style={{ color: t.color }}>●</span> {t.name}
                    </span>
                  )}
                </span>
              </button>
              </form>
            </li>
          );
        })}
      </ul>
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
