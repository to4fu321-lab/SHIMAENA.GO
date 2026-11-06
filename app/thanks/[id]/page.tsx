// 声のありがとう（spec v1.29）: 家の人は吹き込む、手伝った人は聞く。1画面（スクロールなし）。
// 気持ちを伝えるところは AI に任せない。声は文字にしない・AI に渡さない。
import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import TabBar from "@/components/TabBar";
import VoiceThanks from "@/components/VoiceThanks";
import { san } from "@/lib/line/messages";
import { loadRoster } from "@/lib/morning/roster";
import { loadMorning } from "@/lib/morning/store";
import { voiceThanksTarget } from "@/lib/morning/ops";
import { canListen, findThanksVoice } from "@/lib/thanks/voice";
import { isDemoViewer, readViewer, VIEWER_COOKIE } from "@/lib/viewer";

export const metadata: Metadata = { title: "声のありがとう ・ シマエナGO" };

async function Thanks({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ as?: string }> }) {
  await connection();
  const [{ id }, { as }, jar, roster, record] = await Promise.all([params, searchParams, cookies(), loadRoster(), loadMorning()]);
  const demoAs = as && isDemoViewer(as) ? as : undefined;
  const viewerId = demoAs ?? readViewer(jar.get(VIEWER_COOKIE)?.value);
  const q = demoAs ? `?as=${demoAs}` : "";
  const target = viewerId ? await voiceThanksTarget(id, viewerId) : undefined;
  const voice = await findThanksVoice(id).catch(() => undefined);
  const listener = Boolean(voice && viewerId && canListen(voice, viewerId));
  // 手伝った人だが、まだ声が届いていない
  const waitingHelper = !voice && Boolean(viewerId && record.morning.sorties.some((x) => x.missionId === id && x.participantId === viewerId));
  const fromName = voice ? roster.participants.find((p) => p.id === voice.requesterId)?.nickname : undefined;

  return (
    <div className="mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden bg-paper text-ink">
      <header className="flex shrink-0 items-center justify-between gap-2 bg-ice-soft px-4 py-2">
        <h1 className="whitespace-nowrap text-xl font-bold">🎤 声のありがとう</h1>
        <Link href={`/chat${q}`} className="btn btn-white min-h-10 whitespace-nowrap px-3 text-sm">
          隊長トーク
        </Link>
      </header>
      <main className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-3 short:gap-2 short:py-2">
        {target && viewerId ? (
          <VoiceThanks
            mode="record"
            viewerId={viewerId}
            missionId={id}
            helperCount={target.helperIds.length}
            savedSrc={voice ? `/api/thanks-voice/${id}${q}` : undefined}
          />
        ) : listener ? (
          <VoiceThanks mode="listen" missionId={id} fromName={fromName ? san(fromName) : "お願いした人"} savedSrc={`/api/thanks-voice/${id}${q}`} seconds={voice?.seconds} />
        ) : waitingHelper ? (
          <p className="text-lg leading-snug">まだ声は届いていません。家の人が吹き込んだら、隊長トークでお知らせします。</p>
        ) : (
          <p className="text-lg leading-snug">この声は、雪かきをお願いした家の人と、手伝った人だけが聞けます。7日たつと消えます。</p>
        )}
      </main>
      <TabBar active="chat" q={q} />
    </div>
  );
}

export default function ThanksPage(props: { params: Promise<{ id: string }>; searchParams: Promise<{ as?: string }> }) {
  return (
    <Suspense fallback={<main className="grid min-h-dvh place-items-center bg-paper text-ink">読み込み中…</main>}>
      <Thanks {...props} />
    </Suspense>
  );
}
