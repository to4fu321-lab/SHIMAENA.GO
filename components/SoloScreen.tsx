"use client";

// ソロ出動の画面（spec v1.3）。今日の自分 → ミッション一覧（現地／オンライン）→ 完了の演出 → 活動記録。
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { fiveMinutesAction } from "@/app/map/actions";
import { completeSoloAction, type SoloActionResult } from "@/app/solo/actions";
import { soloTeamPoints, type SoloMission } from "@/lib/solo/missions";
import type { SoloClearSummary, SoloStatus } from "@/lib/solo/ops";
import type { Role } from "@/lib/types";
import { shrink } from "./shrink";
import FriendShare from "./FriendShare";
import QuickShare from "./QuickShare";
import SnsShare, { type ShareOption } from "./SnsShare";
import { clearMessage } from "@/lib/share-links";
import SoloClear from "./SoloClear";
import Mascot, { SnowTown } from "./Mascot";
import TabBar from "./TabBar";

const DIFF = ["", "★", "★★", "★★★"];

export default function SoloScreen({
  viewerId,
  nickname,
  role,
  status,
  missions,
  canHelpHouse,
  shortHouses,
  pickFive,
  focus,
  q,
  shareOptions = [],
}: {
  viewerId: string;
  nickname: string;
  role: Role;
  status: SoloStatus;
  missions: SoloMission[];
  /** 今朝の作戦中で、手伝う側（チームあり）なら家の雪かきに加われる */
  canHelpHouse: boolean;
  shortHouses: number;
  /** ホームの「10分だけ出動」から来た */
  pickFive: boolean;
  /** LINE のコンシェルジュがすすめたミッション（最初に大きく出す） */
  focus?: string;
  q: string;
  /** SNS に投稿する下書き（わたしの活動・仲間を募集） */
  shareOptions?: ShareOption[];
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<SoloActionResult | null>(null);
  const [clear, setClear] = useState<SoloClearSummary | null>(null);
  const [busyKind, setBusyKind] = useState<string | null>(null);
  const [doneToday, setDoneToday] = useState<string[]>(status.doneToday);
  const [helpText, setHelpText] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const photoKind = useRef<string | null>(null);

  const submit = (kind: string, file?: File) => {
    setBusyKind(kind);
    start(async () => {
      try {
        const fd = new FormData();
        fd.set("viewerId", viewerId);
        fd.set("kind", kind);
        if (file) fd.set("photo", new File([await shrink(file)], "solo.jpg", { type: "image/jpeg" }));
        const r = await completeSoloAction(fd);
        setResult(r);
        if (r.ok && r.summary) {
          setClear(r.summary);
          setDoneToday((d) => [...d, kind]);
        }
      } catch (e) {
        setResult({ ok: false, text: e instanceof Error ? e.message : "うまくいきませんでした" });
      } finally {
        setBusyKind(null);
      }
    });
  };

  const helpHouse = () =>
    start(async () => {
      try {
        const r = await fiveMinutesAction(viewerId);
        setHelpText(r.text);
      } catch (e) {
        setHelpText(e instanceof Error ? e.message : "うまくいきませんでした");
      }
    });

  const [pickedKind, setPickedKind] = useState<string | null>(focus ?? null);
  const [showAll, setShowAll] = useState(false);
  const onsite = missions.filter((m) => m.onsite && m.kind !== "help_house");
  const online = missions.filter((m) => !m.onsite);
  const house = missions.find((m) => m.kind === "help_house");

  const featured =
    missions.find((m) => m.kind === pickedKind) ??
    onsite.find((m) => !doneToday.includes(m.kind)) ??
    online.find((m) => !doneToday.includes(m.kind)) ??
    onsite[0];
  const featuredDone = doneToday.includes(featured.kind);
  const featuredBusy = pending && busyKind === featured.kind;
  const doneCount = missions.filter((m) => doneToday.includes(m.kind)).length;

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-paper text-ink">
    <main className="flex-1 space-y-3 px-4 pb-4 pt-3">
      {clear && (
        <SoloClear summary={clear} onClose={() => setClear(null)} q={q}>
          <QuickShare text={clearMessage("solo", clear.onsite ? 5 : 3)} image={shareOptions[0]?.image ?? "/api/share/today.png"} page={shareOptions[0]?.page} />
          <button
            onClick={() => {
              setClear(null);
              setTimeout(() => document.getElementById("share")?.scrollIntoView({ behavior: "smooth" }), 50);
            }}
            className="btn btn-white mt-3 w-full text-base"
          >
            投稿文を直してから投稿する
          </button>
        </SoloClear>
      )}
      <header className="snowfield relative -mx-4 -mt-3 h-36 overflow-hidden px-4 pt-3">
        <SnowTown className="absolute inset-x-0 bottom-0 h-[60%] w-full" />
        <Link href={`/${q}`} aria-label="ホームへ戻る" className="absolute left-3 top-3 z-10 grid size-12 place-items-center rounded-full bg-card text-2xl font-bold shadow-md">
          ‹
        </Link>
        <div className="relative z-10 px-14 text-center">
          <p className="text-sm font-bold">シマエナ<span className="text-lamp-deep">GO</span></p>
          <h1 className="text-3xl font-bold leading-tight">ソロミッション</h1>
          <p className="sr-only">{nickname}さん</p>
          <p className="text-sm font-bold">ひとりでも楽しめます</p>
        </div>
        <Mascot size={84} className="absolute bottom-0 right-3 z-10 drop-shadow-md" />
      </header>

      {pickFive && (
        <p className="rounded-2xl bg-camellia-soft px-3 py-2 text-base ring-1 ring-camellia">
          <b className="text-camellia-deep">10分だけ出動</b>: 下のミッションから1つどうぞ。
        </p>
      )}
      {result && !result.ok && (
        <p className="rounded-2xl bg-warm px-3 py-2 text-base" role="status">
          {result.text}
        </p>
      )}

      {/* 今日のミッション（1つ大きく） */}
      <section className="space-y-3 rounded-3xl bg-card p-4 shadow-md ring-1 ring-ink/10" aria-label="今日のミッション">
        <span className="inline-block rounded-full bg-ink px-3 py-0.5 text-sm font-bold text-white">ミッション</span>
        {focus === featured.kind && (
          <span className="ml-2 inline-block rounded-full bg-camellia-soft px-3 py-0.5 text-sm font-bold text-camellia-deep ring-1 ring-camellia">
            <span aria-hidden="true">🐦</span> 隊長のおすすめ
          </span>
        )}
        <h2 className="text-2xl font-bold leading-tight">{featured.label}</h2>
        <p className="text-base leading-snug">{featured.description}</p>
        <div className="grid grid-cols-3 divide-x divide-ink/15 rounded-2xl bg-paper py-2 text-center text-sm font-bold">
          <p><span className="block text-2xl tabular-nums">{featured.minutes}分</span>時間</p>
          <p><span className="block text-2xl text-lamp">{DIFF[featured.difficulty]}</span>むずかしさ</p>
          <p><span className="block text-2xl tabular-nums text-camellia-deep">+{featured.feathers}</span>羽{soloTeamPoints(featured) !== null && <b className="block text-ink">チーム +{soloTeamPoints(featured)}点</b>}</p>
        </div>
        <div className="flex items-center gap-2 rounded-2xl bg-ice-soft px-3 py-2">
          <span className="text-sm font-bold">進行状況</span>
          <span className="h-3 flex-1 overflow-hidden rounded-full bg-white">
            <span className="block h-full rounded-full bg-ice" style={{ width: featuredDone ? "100%" : "0%" }} />
          </span>
          <b className="tabular-nums">{featuredDone ? 1 : 0} / 1</b>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => setShowAll((v) => !v)} aria-expanded={showAll} className="btn btn-white rounded-full text-base">
            {showAll ? "とじる" : "ほかを見る"}
          </button>
          {featuredDone ? (
            <span className="btn rounded-full bg-ice-soft text-base">✓ 今日は完了</span>
          ) : (
            <button disabled={pending} onClick={() => submit(featured.kind)} className="btn btn-lamp rounded-full text-lg">
              {featuredBusy ? "…" : "完了にする"}
            </button>
          )}
        </div>
        {featured.photo === "optional" && !featuredDone && (
          <button
            disabled={pending}
            onClick={() => {
              photoKind.current = featured.kind;
              fileRef.current?.click();
            }}
            className="btn btn-white w-full text-base"
          >
            📷 写真をつけて完了にする
          </button>
        )}
      </section>

      {showAll && (
        <section className="space-y-2" aria-label="ミッションの一覧">
          <p className="text-sm font-bold">えらぶと、上の大きなミッションが切りかわります。</p>
          <ul className="space-y-2">
            {missions
              .filter((m) => m.kind !== "help_house")
              .map((m) => (
                <li key={m.kind}>
                  <button
                    onClick={() => {
                      setPickedKind(m.kind);
                      setShowAll(false);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="flex min-h-14 w-full items-center gap-2 rounded-2xl bg-card px-3 py-2 text-left ring-1 ring-ink/15"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-base font-bold leading-snug">{doneToday.includes(m.kind) ? "✓ " : ""}{m.label}</span>
                      <span className="block text-sm">{m.minutes}分 ・ {m.onsite ? "外に出る" : "家の中"} ・ +{m.feathers}羽</span>
                    </span>
                    <span aria-hidden="true">›</span>
                  </button>
                </li>
              ))}
          </ul>
        </section>
      )}

      {/* ミッションのコツ */}
      <section className="flex items-center gap-3 rounded-3xl bg-ice-soft p-3" aria-label="ミッションのコツ">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-2xl" aria-hidden="true">💡</span>
        <p className="text-base leading-snug">
          <b>ミッションのコツ</b>
          <span className="block">{featured.photo === "optional" ? "雪の様子を撮影しておくと、確認済みの印がつきます。" : "無理はしない。10分でやめても大丈夫です。"}</span>
        </p>
      </section>

      <details className="rounded-2xl bg-card ring-1 ring-ink/15">
        <summary className="flex min-h-14 cursor-pointer items-center justify-between px-4 text-base font-bold">
          <span>📊 最近の記録（7日）</span>
          <span aria-hidden="true">›</span>
        </summary>
        <div className="px-4 pb-3">
          <div className="grid grid-cols-3 gap-2 text-center text-sm font-bold">
            <p>今日の羽<span className="block text-2xl tabular-nums text-camellia-deep">{status.todayFeathers}</span></p>
            <p>連続出動<span className="block text-2xl tabular-nums">{status.streak}日</span></p>
            <p>合計の羽<span className="block text-2xl tabular-nums">{status.totalFeathers}</span></p>
          </div>
          {status.recent.length === 0 ? (
            <p className="mt-2 text-sm">まだありません。最初の10分をどうぞ。</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {status.recent.map((l) => (
                <li key={l.id} className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate">{l.date.slice(5).replace("-", "/")} {l.label}</span>
                  <b className="shrink-0 tabular-nums text-camellia-deep">+{l.feathers}</b>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-sm">次のカード: <b>{status.nextCard.label}</b>（{status.nextCard.hint}）</p>
        </div>
      </details>

      <div className="flex min-h-14 items-center justify-between rounded-2xl bg-card px-4 ring-1 ring-ink/15">
        <span className="text-base font-bold">🏆 今日のミッション達成</span>
        <b className="text-2xl tabular-nums">{doneCount} / {missions.length}</b>
      </div>

      <section className="space-y-2" aria-label="1軒の雪かきを手伝う">
        {house && (
          <div className="rounded-2xl bg-card px-3 py-3 ring-1 ring-ink/15">
            <p className="text-base font-bold leading-snug">{house.label}</p>
            <p className="text-sm text-ink-soft">{house.description}</p>
            <p className="mt-1 text-sm text-ink-soft">
              10分〜 ・ むずかしさ {DIFF[house.difficulty]} ・ <b className="text-camellia-deep">+{house.feathers}羽</b>（完了は写真で）
            </p>
            {canHelpHouse ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button disabled={pending} onClick={helpHouse} className="btn btn-lamp text-base">
                  {shortHouses > 0 ? `10分だけ助けに行く（あと1人の家 ${shortHouses} 軒）` : "10分だけ参加（偵察・補給）"}
                </button>
                <Link href={`/map${q}`} className="btn btn-white text-base">
                  町の地図で見る
                </Link>
              </div>
            ) : (
              <p className="mt-2 rounded-2xl bg-paper px-3 py-2 text-sm text-ink-soft">
                {role === "helper" ? "今は家の募集がありません（雪の朝の作戦中に出ます）。見回りをどうぞ。" : "家の雪かきの募集は手伝う側の画面に出ます。自分の家の雪かきをどうぞ。"}
              </p>
            )}
            {helpText && (
              <p className="mt-2 rounded-2xl bg-ice-soft px-3 py-2 text-sm" role="status">
                {helpText} <Link href={`/map${q}`} className="font-bold underline">町の地図へ</Link>
              </p>
            )}
          </div>
        )}
      </section>

      {shareOptions.length > 0 && <SnsShare options={shareOptions} title="今日の出動を SNS に" />}
      <FriendShare />

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f && photoKind.current) submit(photoKind.current, f);
          e.target.value = "";
        }}
      />
    </main>
    <div className="sticky bottom-0 z-20">
      <TabBar active="home" q={q} />
    </div>
    </div>
  );
}
