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

  const onsite = missions.filter((m) => m.onsite && m.kind !== "help_house");
  const online = missions.filter((m) => !m.onsite);
  const house = missions.find((m) => m.kind === "help_house");

  const row = (m: SoloMission) => {
    const done = doneToday.includes(m.kind);
    const busy = pending && busyKind === m.kind;
    return (
      <li key={m.kind} className={`rounded-2xl px-3 py-3 ring-1 ${done ? "bg-paper ring-ink/10" : "bg-card ring-ink/15 shadow-sm"}`}>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold leading-snug">{m.label}</p>
            <p className="text-sm text-ink-soft">{m.description}</p>
            <p className="mt-1 text-sm text-ink-soft">
              {m.minutes}分 ・ むずかしさ {DIFF[m.difficulty]} ・ <b className="text-camellia-deep">+{m.feathers}羽</b>
              {soloTeamPoints(m) !== null && (
                <>
                  {" "}・ <b className="text-ink">チーム +{soloTeamPoints(m)}点</b>
                </>
              )}
              {m.photo === "optional" && (soloTeamPoints(m) !== null ? "（写真で +2点）" : " ・ 写真OK")}
            </p>
          </div>
          {done ? (
            <span className="flex min-h-14 shrink-0 items-center rounded-2xl bg-ice-soft px-3 text-base font-bold">✓ 今日は完了</span>
          ) : (
            <div className="flex shrink-0 flex-col gap-1">
              <button
                disabled={pending}
                onClick={() => submit(m.kind)}
                className="btn btn-ink min-w-24 text-lg"
              >
                {busy ? "…" : "完了"}
              </button>
              {m.photo === "optional" && (
                <button
                  disabled={pending}
                  onClick={() => {
                    photoKind.current = m.kind;
                    fileRef.current?.click();
                  }}
                  className="btn btn-white min-h-11 px-2 text-sm"
                >
                  写真をつけて
                </button>
              )}
            </div>
          )}
        </div>
      </li>
    );
  };

  return (
    <main className="mx-auto min-h-dvh max-w-md space-y-4 bg-paper px-4 pb-8 pt-5 text-ink">
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
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">
          出動する <span className="text-base font-normal text-ink-soft">ひとりで10分（ソロ出動）</span>
        </h1>
        <Link href={`/${q}`} className="btn btn-white min-h-11 px-3 text-sm">
          ホーム
        </Link>
      </header>
      <p className="text-base">
        <b>{nickname}</b>さん。仲間がいなくても、自分の10分で町を変えられる。
      </p>
      {status.totalFeathers === 0 && (
        <section className="rounded-3xl bg-warm p-4 ring-1 ring-lamp/50" aria-label="はじめての方へ">
          <p className="text-lg font-bold">はじめての方へ（3ステップ）</p>
          <ol className="mt-1 list-decimal space-y-1 pl-6 text-base">
            <li>下の「雪の状況を見回る」をえらぶ</li>
            <li>家のまわりを10分だけ歩く（無理はしない）</li>
            <li>「完了」を押す → 羽と最初のカード</li>
          </ol>
        </section>
      )}
      {pickFive && (
        <p className="rounded-2xl bg-camellia-soft px-3 py-2 text-base ring-1 ring-camellia">
          <b className="text-camellia-deep">10分だけ出動</b>: 今朝は作戦がない（か、まだ割り当てがない）ので、下の 10分ミッションから1つどうぞ。
        </p>
      )}

      {/* 今日の自分 */}
      <section className="rounded-3xl bg-card p-4 shadow-sm ring-1 ring-ink/10" aria-label="今日の自分">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-sm font-bold">今日の羽</p>
            <p className="text-3xl font-bold tabular-nums text-camellia-deep">{status.todayFeathers}</p>
          </div>
          <div>
            <p className="text-sm font-bold">連続出動</p>
            <p className="text-3xl font-bold tabular-nums">{status.streak}日</p>
          </div>
          <div>
            <p className="text-sm font-bold">合計の羽</p>
            <p className="text-3xl font-bold tabular-nums">{status.totalFeathers}</p>
          </div>
        </div>
        <p className="mt-2 text-sm text-ink-soft">
          次に獲得できるカード: <b className="text-ink">{status.nextCard.label}</b>（{status.nextCard.hint}）
        </p>
      </section>

      {result && !result.ok && (
        <p className="rounded-2xl bg-warm px-3 py-2 text-base" role="status">
          {result.text}
        </p>
      )}

      {/* 10分・現地 */}
      <section className="space-y-2" aria-label="10分ミッション（現地）">
        <h2 className="text-lg font-bold">
          10分ミッション <span className="text-sm font-normal text-ink-soft">外に出てやること</span>
        </h2>
        <ul className="space-y-2">{onsite.map(row)}</ul>
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

      {/* 3分・オンライン */}
      <section className="space-y-2" aria-label="3分ミッション（オンライン）">
        <h2 className="text-lg font-bold">
          3分ミッション <span className="text-sm font-normal text-ink-soft">家の中でできること（雪かき完了にはなりません）</span>
        </h2>
        <ul className="space-y-2">{online.map(row)}</ul>
      </section>

      {/* 活動記録 */}
      <section className="space-y-2 rounded-3xl bg-card p-4 shadow-sm ring-1 ring-ink/10" aria-label="今日の活動記録">
        <h2 className="text-lg font-bold">活動記録（7日）</h2>
        {status.recent.length === 0 ? (
          <p className="text-sm text-ink-soft">まだありません。最初の10分をどうぞ。</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {status.recent.map((l) => (
              <li key={l.id} className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate">
                  <span className="text-ink-soft">{l.date.slice(5).replace("-", "/")}</span> {l.label}
                  {l.photoChecked && <span className="ml-1 rounded-full bg-ice-soft px-1.5 text-xs">✓ 写真確認</span>}
                  {l.onsite === false && !l.kind.startsWith("bonus_") && <span className="ml-1 text-xs text-ink-soft">オンライン</span>}
                </span>
                <b className="shrink-0 tabular-nums text-camellia-deep">+{l.feathers}</b>
              </li>
            ))}
          </ul>
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
      <nav className="grid grid-cols-2 gap-3">
        <Link href={`/map${q}`} className="btn btn-white text-lg">
          町の地図
        </Link>
        <Link href={`/cards${q}`} className="btn btn-white text-lg">
          活動カード
        </Link>
      </nav>
    </main>
  );
}
