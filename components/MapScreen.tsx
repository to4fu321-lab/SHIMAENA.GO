"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import type { CellView, SoloCell } from "@/lib/cells";
import type { BaseView, MorningState } from "@/lib/morning/view";
import { progress, snowHp, snowTotal, teamTotals, viewBases } from "@/lib/morning/view";
import { TEAMS } from "@/lib/teams";
import type { Base, LatLng, Role, TeamId } from "@/lib/types";
import type { Destination } from "@/lib/nav";
import type { ClearSummary } from "@/lib/morning/clear";
import type { ShortHouse } from "@/lib/morning/watch";
import ClearWatcher from "./ClearWatcher";
import MorningButtons from "./MorningButtons";
import RescueList from "./RescueList";
import ShareButton from "./ShareButton";

const TownMap = dynamic(() => import("./TownMap"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-ink-soft">地図を読み込み中…</div>,
});

const STATUS_TEXT: Record<BaseView["status"], string> = {
  open: "人を待っています",
  short: "人手が足りません",
  assigned: "そろいました",
  in_progress: "作業中",
  done: "完了",
  no_answer: "返事がありません",
  none: "",
};

export default function MapScreen({
  state,
  cells,
  bases,
  viewer,
  clear = null,
  rescue = [],
  recap,
  thanks,
  shareText,
  cheers = [],
  home,
  destinations = [],
  solo = [],
}: {
  state: MorningState;
  /** ソロ出動の足あと（今日） */
  solo?: SoloCell[];
  cells: CellView[];
  bases: Base[];
  viewer?: { teamId?: TeamId; role?: Role };
  /** いちばん最近の完了（他の人の完了に気づくため） */
  clear?: ClearSummary | null;
  /** 人手が足りない家（あと少しで救える順） */
  rescue?: ShortHouse[];
  /** 今朝の実況（全軒完了のあと） */
  recap?: string;
  /** 自分が行った家の、お願いした人からのひとこと（ありがとう点呼） */
  thanks?: { label: string; sentence: string };
  /** 絵文字グリッド（共有用の文字） */
  shareText?: string;
  /** 自分が行った家の、ご家族からの応援スタンプ */
  cheers?: string[];
  /** 自分の家（登録した位置）。地図に「あなた」の印を出す */
  home?: LatLng;
  /** 自分が向かっている家（正確な場所と道順）。本人にだけ渡る */
  destinations?: Destination[];
}) {
  const views = [...viewBases(state).values()];
  const totals = teamTotals(state);
  const max = Math.max(1, ...Object.values(totals));
  const hp = snowHp(state);
  const prog = progress(state);
  const snow = snowTotal(state);
  const hpPct = hp.max > 0 ? (hp.current / hp.max) * 100 : 100;
  const viewerTeam = TEAMS.find((t) => t.id === viewer?.teamId);
  const mySortie = state.sorties.find((s) => s.participantId === state.viewerId);
  const myMission = state.missions.find((m) => m.id === mySortie?.missionId);
  const goingTo = state.sorties.filter((s) => s.participantId === state.viewerId && s.status === "going").map((s) => s.missionId);
  const myBase = bases.find((b) => b.id === myMission?.baseId);
  const myView = views.find((v) => v.baseId === myMission?.baseId);
  const [, month, day] = state.rollcall.date.split("-").map(Number);
  const q = /^h\d+$/.test(state.viewerId) ? `?as=${state.viewerId}` : "";

  return (
    <div className="flex h-dvh flex-col bg-paper text-ink">
      <ClearWatcher clear={clear} />
      {/* 上: 戻る・題名（濃い冬の青） */}
      <header className="grid shrink-0 grid-cols-[auto_1fr_auto] items-center bg-ink px-2 pb-2 pt-2 text-white">
        <Link href={`/${q}`} className="btn min-h-12 px-2 text-base text-white">
          ‹ ホーム
        </Link>
        <h1 className="text-center text-xl font-bold leading-tight">
          町の地図
          <span className="block text-xs font-normal">
            {month}月{day}日の朝
          </span>
        </h1>
        <span className="w-[76px]" aria-hidden="true" />
      </header>

      {/* 真ん中: 地図（全軒完了で背景が明るくなる）。上に今朝の雪と救助待ちの札を浮かべる */}
      <main className={`relative min-h-[22dvh] flex-1 ${prog.allDone ? "defeated" : ""}`}>
        <TownMap cells={cells} home={home} destinations={destinations} solo={solo} />
        <div className="pointer-events-none absolute inset-x-3 top-3 z-[500] flex gap-2">
          <p className="flex items-center gap-2 rounded-2xl bg-card/95 px-3 py-1.5 shadow-md">
            <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" fill="none" stroke="#29445c" strokeWidth="2" strokeLinecap="round">
              <path d="M12 2 V22 M3.3 7 L20.7 17 M3.3 17 L20.7 7 M9 3.5 L12 6 L15 3.5 M9 20.5 L12 18 L15 20.5" />
            </svg>
            <span className="leading-tight">
              <span className="block text-xs font-bold">今朝の雪</span>
              <b className="text-xl tabular-nums">{state.rollcall.forecastCm}</b>
              <span className="text-sm font-bold">cm</span>
            </span>
          </p>
          <p className="flex items-center gap-2 rounded-2xl bg-card/95 px-3 py-1.5 shadow-md">
            <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
              <path d="M12 2 C7.6 2 5 5.3 5 8.8 C5 14 12 22 12 22 S19 14 19 8.8 C19 5.3 16.4 2 12 2 Z" fill="var(--lamp)" />
              <circle cx="12" cy="9" r="3" fill="#fff" />
            </svg>
            <span className="leading-tight">
              <span className="block text-xs font-bold">救助待ち</span>
              <b className="text-xl tabular-nums">{rescue.length}</b>
              <span className="text-sm font-bold">軒</span>
            </span>
          </p>
        </div>
      </main>

      {/* 下: 自分の割り当てなど（長くなったら中でスクロール。地図は 34% 以上残す）。操作ボタンはさらに下に固定 */}
      <section className="relative z-[600] -mt-4 max-h-[40dvh] shrink-0 space-y-3 overflow-y-auto rounded-t-3xl bg-card px-4 pb-3 pt-3 shadow-[0_-4px_16px_rgba(41,68,92,0.12)]">
        {/* 今朝の進み具合（1行） */}
        <div aria-label="今朝の雪のこり">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate font-bold">今朝の雪{state.rollcall.snowName ? <>『{state.rollcall.snowName}』</> : null}</span>
            <span className="shrink-0 tabular-nums">
              {prog.total === 0 ? (
                "作戦はまだ"
              ) : prog.allDone ? (
                <b>{prog.defeatedAt ? `${prog.defeatedAt} ` : ""}すべて完了！</b>
              ) : (
                <>
                  <b className="text-base">{prog.done}</b> / {prog.total} 軒 完了 ・ あと <b className="text-base">{prog.left}</b> 軒
                </>
              )}
            </span>
          </div>
          <span className="mt-1 block h-2.5 overflow-hidden rounded-full bg-ice-soft">
            <span className="block h-full rounded-full bg-ice transition-[width] duration-700" style={{ width: `${hpPct}%` }} />
          </span>
        </div>
        {prog.allDone && recap && (
          <div className="rounded-2xl bg-warm px-3 py-2">
            <p className="eyebrow">今朝の実況（エナガ隊長）</p>
            <p className="text-base">{recap}</p>
          </div>
        )}
        {myBase && myView ? (
          <div className="space-y-1">
            <p className="eyebrow">あなたの担当</p>
            <p className="text-2xl font-bold leading-tight">
              拠点 {myBase.number}
              <span className={`ml-2 text-base font-bold ${myView.status === "short" ? "text-alert" : "text-ink-soft"}`}>
                {myView.status === "short" ? "！ " : myView.status === "done" ? "✓ " : ""}
                {STATUS_TEXT[myView.status]}
              </span>
            </p>
            <p className="text-base">
              {viewerTeam && (
                <>
                  <span className="mr-1 inline-block size-3 rounded-full align-middle" style={{ background: viewerTeam.color }} aria-hidden="true" />
                  <b>{viewerTeam.name}</b>チーム ・{" "}
                </>
              )}
              いま {myView.goingPeople}人 / 必要 {myView.requiredPeople}人 ・ 7:00 開始
            </p>
            {destinations.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {destinations.map((d) => (
                  <a key={d.missionId} href={d.mapsUrl} target="_blank" rel="noopener noreferrer" className="btn btn-white text-base">
                    拠点{d.baseNumber}への道順を開く
                  </a>
                ))}
              </div>
            )}
            {myMission?.reason && (
              <p className="rounded-2xl bg-warm px-3 py-2 text-base">
                <span className="eyebrow block">エナガ隊長から</span>
                {myMission.reason}
              </p>
            )}
            {thanks && (
              <p className="rounded-2xl bg-camellia-soft px-3 py-2 text-base ring-1 ring-camellia">
                お願いした人から「<b>{thanks.label}</b>」 — {thanks.sentence}
              </p>
            )}
            {cheers.length > 0 && (
              <p className="rounded-2xl bg-ice-soft px-3 py-2 text-base">
                ご家族から応援 {cheers.map((c, i) => <b key={i}>「{c}」</b>)}
              </p>
            )}
          </div>
        ) : (
          <p className="text-base">
            <span className="font-bold">あなたの担当:</span> 今朝の割り当てはまだありません
          </p>
        )}
        <RescueList
          viewerId={state.viewerId}
          items={rescue}
          goingTo={goingTo}
          isHelper={viewer?.role === "helper"}
          hasAssignment={goingTo.length > 0}
        />
        <details className="rounded-2xl bg-paper px-3 py-2 ring-1 ring-ink/10">
          <summary className="flex min-h-11 cursor-pointer items-center text-base font-bold">▼ くわしく（チームの得点・色の見方・共有）</summary>
          <div className="space-y-3 pb-1 pt-2">
            <ul className="space-y-1" aria-label="チームの得点">
              {TEAMS.map((t) => (
                <li key={t.id} className="flex items-center gap-2 text-sm leading-tight">
                  <span className="w-32 shrink-0 font-bold">
                    <span className="mr-1 inline-block size-2.5 rounded-full align-middle" style={{ background: t.color }} aria-hidden="true" />
                    {t.name}
                  </span>
                  <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-ice-soft">
                    <span className="block h-full rounded-full" style={{ width: `${(totals[t.id] / max) * 100}%`, background: t.color }} />
                  </span>
                  <span className="w-12 text-right font-bold tabular-nums">{totals[t.id]}点</span>
                </li>
              ))}
            </ul>
            {snow.kg > 0 && (
              <p className="text-sm">
                どけた雪 {snow.label}（{snow.comparison}）
              </p>
            )}
            <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs" aria-label="地図の色の見方">
              <li>
                <span className="legend bg-white ring-2 ring-ink" />
                白のわく: まだ人がいない
              </li>
              <li>
                <span className="legend bg-white ring-2 ring-alert" />
                赤のわく（点滅）: 人手不足
              </li>
              <li>
                <span className="legend bg-white ring-2 ring-[#2F6FE4]" />
                チーム色のわく: 向かっている
              </li>
              <li>
                <span className="legend bg-[#2F6FE4]" />
                チーム色ぬり: 完了
              </li>
              <li>
                <span className="legend bg-grey" />
                灰色（点滅）: 返事なし
              </li>
              <li>
                <span className="legend bg-ice" />
                🪶 ソロ出動の足あと
              </li>
              <li className="col-span-2 text-ink-soft">マスは 50m 四方。どの家かは、割り当てられた人の LINE にだけ届きます。</li>
            </ul>
            {shareText && prog.total > 0 && <ShareButton text={shareText} />}
            <Link href={`/today${q}#share`} className="btn btn-white w-full text-base">
              画像つきで SNS に投稿する（X・Instagram）
            </Link>
          </div>
        </details>
      </section>

      {/* いちばん下に固定: 手袋でも片手で押せる大きなボタン（spec v1.2） */}
      <footer className="border-t border-ink/10 bg-card px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-2">
        <MorningButtons
          viewerId={state.viewerId}
          canAct={Boolean(mySortie && mySortie.status === "going")}
          going={Boolean(mySortie?.confirmedAt)}
          note={mySortie?.status === "done" ? "✓ 今朝の雪かきは完了しました。おつかれさまでした。" : mySortie ? undefined : "今朝の割り当てが届くと、ここのボタンが押せるようになります。"}
        />
      </footer>
    </div>
  );
}
