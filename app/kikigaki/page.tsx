// 雪の聞き書き（spec v1.26）: 雪かきを頼む家の人に、隊長が雪の思い出を聞く。声で答えられる。
// できたお話と絵は、本人が「届ける」を選んだときだけ、その家の雪かきに来てくれた人に届く。1画面（スクロールなし）。
import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import KikigakiScreen from "@/components/KikigakiScreen";
import LoginButton from "@/components/LoginButton";
import { storyOf } from "@/lib/kikigaki/store";
import { toView } from "@/lib/kikigaki/view";
import { repo } from "@/lib/repo";
import { isDemoViewer, readViewer, VIEWER_COOKIE } from "@/lib/viewer";

// お話と絵を Claude が書いて描く（1〜3分）。その時間まで関数を止めない
export const maxDuration = 300;

export const metadata: Metadata = { title: "雪の聞き書き ・ シマエナGO" };

async function Kikigaki({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  await connection();
  const { as } = await searchParams;
  const jar = await cookies();
  const demoAs = as && isDemoViewer(as) ? as : undefined;
  const viewerId = demoAs ?? readViewer(jar.get(VIEWER_COOKIE)?.value);
  const me = viewerId ? await repo().findParticipant(viewerId) : undefined;
  const q = demoAs ? `?as=${demoAs}` : "";
  const story = me?.role === "requester" ? await storyOf(me.id) : undefined;

  return (
    <div className="mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden bg-paper text-ink">
      <header className="flex shrink-0 items-center justify-between gap-2 bg-warm px-4 py-2">
        <h1 className="whitespace-nowrap text-xl font-bold">📖 雪の聞き書き</h1>
        <Link href={`/ask${q}`} className="btn btn-white min-h-10 whitespace-nowrap px-3 text-sm">
          もどる
        </Link>
      </header>
      <main className="flex min-h-0 flex-1 flex-col px-4 py-2.5 short:py-2">
        {!me ? (
          <>
            <p className="text-lg leading-snug">雪の思い出を話すには、LINE でログインしてください。</p>
            <LoginButton next="/kikigaki" className="mt-auto" />
          </>
        ) : me.role !== "requester" ? (
          <p className="text-lg leading-snug">雪の聞き書きは、雪かきを頼む家の人に、隊長がお話を聞くページです。「お願いする」から頼む家として登録すると使えます。</p>
        ) : (
          <KikigakiScreen viewerId={me.id} nickname={me.nickname} existing={story ? toView(story) : undefined} />
        )}
      </main>
    </div>
  );
}

export default function KikigakiPage({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  return (
    <Suspense fallback={<main className="grid min-h-dvh place-items-center bg-paper text-ink">読み込み中…</main>}>
      <Kikigaki searchParams={searchParams} />
    </Suspense>
  );
}
