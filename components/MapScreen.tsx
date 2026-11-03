"use client";

import dynamic from "next/dynamic";
import type { CellView } from "@/lib/cells";
import type { BaseView, MorningState } from "@/lib/morning/view";
import { progress, snowHp, teamTotals, viewBases } from "@/lib/morning/view";
import { TEAMS } from "@/lib/teams";
import type { Base, Role, TeamId } from "@/lib/types";
import type { ClearSummary } from "@/lib/morning/clear";
import type { ShortHouse } from "@/lib/morning/watch";
import ClearWatcher from "./ClearWatcher";
import MorningButtons from "./MorningButtons";
import RescueList from "./RescueList";
import ShareButton from "./ShareButton";

const TownMap = dynamic(() => import("./TownMap"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-ink/60">地図を読み込み中…</div>,
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
}: {
  state: MorningState;
  cells: CellView[];
  bases: Base[];
  viewer?: { teamId?: TeamId; role?: Role };
  /** いちばん最近の完了（他の人の完了に気づくため） */
  clear?: ClearSummary | null;
  /** 人手が足りない家（あと少しで救える順） */
  rescue?: ShortHouse[];
  /** 今朝の実況（討伐のあと） */
  recap?: string;
  /** 自分が行った家の、お願いした人からのひとこと（ありがとう点呼） */
  thanks?: { label: string; sentence: string };
  /** 絵文字グリッド（共有用の文字） */
  shareText?: string;
}) {
  const views = [...viewBases(state).values()];
  const totals = teamTotals(state);
  const max = Math.max(1, ...Object.values(totals));
  const hp = snowHp(state);
  const prog = progress(state);
  const hpPct = hp.max > 0 ? (hp.current / hp.max) * 100 : 100;
  const viewerTeam = TEAMS.find((t) => t.id === viewer?.teamId);
  const mySortie = state.sorties.find((s) => s.participantId === state.viewerId);
  const myMission = state.missions.find((m) => m.id === mySortie?.missionId);
  const goingTo = state.sorties.filter((s) => s.participantId === state.viewerId && s.status === "going").map((s) => s.missionId);
  const myBase = bases.find((b) => b.id === myMission?.baseId);
  const myView = views.find((v) => v.baseId === myMission?.baseId);
  const [, month, day] = state.rollcall.date.split("-").map(Number);

  return (
    <div className="flex h-dvh flex-col bg-paper text-ink">
      <ClearWatcher clear={clear} />
      {/* 上: 日付・得点バー・雪HP */}
      <header className="space-y-2 px-4 pb-3 pt-3 shadow-sm">
        <div className="flex items-baseline justify-between">
          <h1 className="text-xl font-bold tracking-wide">
            シマエナ<span className="text-neon">GO</span>
          </h1>
          <p className="text-sm text-ink/70">
            {month}月{day}日の朝 ・ 予報 {state.rollcall.forecastCm}cm
          </p>
        </div>
        <ul className="space-y-1" aria-label="チームの得点">
          {TEAMS.map((t) => (
            <li key={t.id} className="flex items-center gap-2 text-sm">
              <span className="w-28 shrink-0 font-bold" style={{ color: t.color }}>
                {t.name}
              </span>
              <span className="h-3 flex-1 overflow-hidden rounded-full bg-ink/10">
                <span className="block h-full rounded-full" style={{ width: `${(totals[t.id] / max) * 100}%`, background: t.color }} />
              </span>
              <span className="w-10 text-right tabular-nums">{totals[t.id]}</span>
            </li>
          ))}
        </ul>
        {/* 雪ボス: 今朝の雪の名前と HP。全軒完了で討伐 */}
        <div className={`rounded-2xl px-3 py-2 ring-1 ${prog.allDone ? "bg-[#fff0f6] ring-neon/40" : "bg-white/70 ring-ink/10"}`} aria-label="今朝の雪HP">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate font-bold">
              今朝の相手{state.rollcall.snowName ? <>『{state.rollcall.snowName}』</> : null}
            </span>
            <span className="shrink-0 tabular-nums">
              HP {hp.current} / {hp.max}
            </span>
          </div>
          <span className="mt-1 block h-3 overflow-hidden rounded-full bg-ink/10">
            <span className="block h-full rounded-full bg-snow transition-[width] duration-700" style={{ width: `${hpPct}%` }} />
          </span>
          <p className="mt-1 text-sm text-ink/70">
            {prog.total === 0 ? (
              "作戦はまだです"
            ) : prog.allDone ? (
              <b className="text-neon">討伐{prog.defeatedAt ? ` ${prog.defeatedAt}` : ""}！ {prog.total}軒すべて完了</b>
            ) : (
              <>
                {prog.done} / {prog.total} 軒 ・ あと {prog.left} 軒
              </>
            )}
          </p>
        </div>
      </header>

      {/* 真ん中: 地図（討伐したら背景が明るくなる） */}
      <main className={`relative min-h-[34dvh] flex-1 ${prog.allDone ? "defeated" : ""}`}>
        <TownMap cells={cells} />
      </main>

      {/* 下: 自分の割り当てとボタン（長くなったら中でスクロール。地図は 34% 以上残す） */}
      <section className="max-h-[58dvh] space-y-3 overflow-y-auto rounded-t-3xl bg-white px-4 pb-5 pt-4 shadow-[0_-4px_16px_rgba(59,42,120,0.12)]">
        {prog.allDone && recap && (
          <div className="rounded-2xl bg-[#fff0f6] px-3 py-2 ring-1 ring-neon/40">
            <p className="text-xs font-bold tracking-widest text-neon">今朝の実況</p>
            <p className="text-base">{recap}</p>
          </div>
        )}
        {myBase && myView ? (
          <div>
            <p className="text-sm text-ink/70">
              あなたは <b style={{ color: viewerTeam?.color }}>{viewerTeam?.name}</b>
            </p>
            <p className="text-lg font-bold">
              拠点 {myBase.number}　<span className={myView.status === "short" ? "text-alert" : ""}>{STATUS_TEXT[myView.status]}</span>
            </p>
            <p className="text-sm text-ink/70">
              {myView.goingPeople}人 / 必要 {myView.requiredPeople}人 ・ 7:00 開始
            </p>
            {myMission?.reason && (
              <p className="mt-1 text-sm text-ink/80">
                <span className="font-bold text-neon">司令官</span> {myMission.reason}
              </p>
            )}
            {thanks && (
              <p className="mt-1 rounded-2xl bg-[#fff0f6] px-3 py-2 text-base">
                お願いした人から「<b>{thanks.label}</b>」 — {thanks.sentence}
              </p>
            )}
          </div>
        ) : (
          <p className="text-lg font-bold">今朝の割り当てはまだありません</p>
        )}
        <MorningButtons viewerId={state.viewerId} canAct={Boolean(mySortie && mySortie.status === "going")} going={Boolean(mySortie?.confirmedAt)} />
        <RescueList
          viewerId={state.viewerId}
          items={rescue}
          goingTo={goingTo}
          isHelper={viewer?.role === "helper"}
          hasAssignment={goingTo.length > 0}
        />
        {shareText && prog.total > 0 && <ShareButton text={shareText} />}
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink/70" aria-label="色の見方">
          <li><span className="legend bg-white ring-2 ring-ink" />未対応</li>
          <li><span className="legend bg-white ring-2 ring-alert" />人手不足</li>
          <li><span className="legend bg-white ring-2 ring-ink/60" />向かっている</li>
          <li><span className="legend bg-ink/70" />完了（チーム色）</li>
          <li><span className="legend bg-[#9AA0AE]" />返事なし</li>
          <li className="w-full">マスは 50m 四方。どの家かは、割り当てられた人の LINE にだけ届きます。</li>
        </ul>
      </section>
    </div>
  );
}
