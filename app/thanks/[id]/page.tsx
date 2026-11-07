// 声のありがとう（spec v1.29）: 家の人は吹き込む、手伝った人は聞く。1画面（スクロールなし）。
// 気持ちを伝えるところは AI に任せない。声は文字にしない・AI に渡さない。
// 離れて暮らす家族（11/7 本人の指示）: 家族の代わりに登録した人は、その家の雪かきに声を吹き込める（家の人の声とは別の枠 <ID>-family）。
// デモ（架空の家の人）では ?family=1 で「家族として」吹き込む画面になる（撮影用）。
import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import TabBar from "@/components/TabBar";
import VoiceThanks from "@/components/VoiceThanks";
import { PENDING_COOKIE, readPending } from "@/lib/auth/pending";
import { san } from "@/lib/line/messages";
import { loadRoster } from "@/lib/morning/roster";
import { loadMorning } from "@/lib/morning/store";
import { familyVoiceRequester, voiceThanksTarget } from "@/lib/morning/ops";
import { canListen, familyVoiceId, findThanksVoice, isFamilyVoiceId, missionIdOfVoice, voiceFromName } from "@/lib/thanks/voice";
import { isDemoViewer, readViewer, VIEWER_COOKIE } from "@/lib/viewer";

export const metadata: Metadata = { title: "声のありがとう ・ シマエナGO" };

type Search = { as?: string; family?: string };

async function Thanks({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Search> }) {
  await connection();
  const [{ id }, { as, family }, jar, roster, record] = await Promise.all([params, searchParams, cookies(), loadRoster(), loadMorning()]);
  const demoAs = as && isDemoViewer(as) ? as : undefined;
  const viewerId = demoAs ?? readViewer(jar.get(VIEWER_COOKIE)?.value);
  const q = demoAs ? `?as=${demoAs}` : "";
  const isFamilyVoice = isFamilyVoiceId(id);
  const missionId = missionIdOfVoice(id);

  // 家の人として吹き込む
  const asHouse = !isFamilyVoice && family !== "1" && viewerId ? await voiceThanksTarget(missionId, viewerId) : undefined;
  // 家族として吹き込む: デモは家の人の画面に ?family=1、本物は家族の代わりに登録した人（参加者ではない）
  const demoFamily = !isFamilyVoice && family === "1" && demoAs ? await voiceThanksTarget(missionId, demoAs) : undefined;
  const pending = !viewerId ? readPending(jar.get(PENDING_COOKIE)?.value) : undefined;
  const familyRequester = !isFamilyVoice && pending ? await familyVoiceRequester(missionId, pending.lineUserId) : undefined;
  const realFamily = familyRequester ? await voiceThanksTarget(missionId, familyRequester) : undefined;
  const asFamily = demoFamily ?? realFamily;
  const familySaved = asFamily ? await findThanksVoice(familyVoiceId(missionId)).catch(() => undefined) : undefined;

  const voice = await findThanksVoice(id).catch(() => undefined);
  const listener = Boolean(voice && viewerId && canListen(voice, viewerId));
  // 手伝った人だが、まだ声が届いていない
  const waitingHelper = !voice && Boolean(viewerId && record.morning.sorties.some((x) => x.missionId === missionId && x.participantId === viewerId));
  const requesterName = voice ? roster.participants.find((p) => p.id === voice.requesterId)?.nickname : undefined;
  const fromName = voice ? san(voiceFromName(requesterName, isFamilyVoice)) : "お願いした人";

  return (
    <div className="mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden bg-paper text-ink">
      <header className="flex shrink-0 items-center justify-between gap-2 bg-ice-soft px-4 py-2">
        <h1 className="whitespace-nowrap text-xl font-bold">🎤 声のありがとう</h1>
        <Link href={`/chat${q}`} className="btn btn-white min-h-10 whitespace-nowrap px-3 text-sm">
          隊長トーク
        </Link>
      </header>
      <main className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-3 short:gap-2 short:py-2">
        {asHouse && viewerId ? (
          <VoiceThanks
            mode="record"
            viewerId={viewerId}
            missionId={missionId}
            helperCount={asHouse.helperIds.length}
            savedSrc={voice ? `/api/thanks-voice/${missionId}${q}` : undefined}
          />
        ) : asFamily ? (
          <VoiceThanks
            mode="record"
            family
            viewerId={demoFamily && demoAs ? demoAs : ""}
            missionId={missionId}
            helperCount={asFamily.helperIds.length}
            savedSrc={familySaved ? `/api/thanks-voice/${familyVoiceId(missionId)}${q}` : undefined}
          />
        ) : listener ? (
          <VoiceThanks mode="listen" missionId={id} fromName={fromName} savedSrc={`/api/thanks-voice/${id}${q}`} seconds={voice?.seconds} />
        ) : waitingHelper ? (
          <p className="text-lg leading-snug">まだ声は届いていません。家の人が吹き込んだら、隊長トークでお知らせします。</p>
        ) : (
          <p className="text-lg leading-snug">この声は、雪かきをお願いした家の人と、手伝った人だけが聞けます。7日たつと消えます。</p>
        )}
      </main>
      <TabBar q={q} />
    </div>
  );
}

export default function ThanksPage(props: { params: Promise<{ id: string }>; searchParams: Promise<Search> }) {
  return (
    <Suspense fallback={<main className="grid min-h-dvh place-items-center bg-paper text-ink">読み込み中…</main>}>
      <Thanks {...props} />
    </Suspense>
  );
}
