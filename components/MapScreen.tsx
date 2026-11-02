"use client";

import dynamic from "next/dynamic";
import type { BaseView, MorningState } from "@/lib/morning";
import { snowHp, teamTotals, viewBases } from "@/lib/morning";
import { TEAMS } from "@/lib/teams";
import { TOWN } from "@/lib/town";

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

export default function MapScreen({ state }: { state: MorningState }) {
  const views = [...viewBases(state).values()];
  const totals = teamTotals(state);
  const max = Math.max(1, ...Object.values(totals));
  const hp = snowHp(state);
  const viewer = TOWN.participants.find((p) => p.id === state.viewerId);
  const viewerTeam = TEAMS.find((t) => t.id === viewer?.teamId);
  const mySortie = state.sorties.find((s) => s.participantId === state.viewerId);
  const myMission = state.missions.find((m) => m.id === mySortie?.missionId);
  const myBase = TOWN.bases.find((b) => b.id === myMission?.baseId);
  const myView = views.find((v) => v.baseId === myMission?.baseId);
  const [, month, day] = state.rollcall.date.split("-").map(Number);

  return (
    <div className="flex h-dvh flex-col bg-paper text-ink">
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
        <div className="flex items-center gap-2 text-sm">
          <span className="w-28 shrink-0 font-bold">今朝の雪HP</span>
          <span className="h-3 flex-1 overflow-hidden rounded-full bg-ink/10">
            <span className="block h-full rounded-full bg-snow" style={{ width: `${(hp.current / hp.max) * 100}%` }} />
          </span>
          <span className="w-10 text-right tabular-nums">{hp.current}</span>
        </div>
      </header>

      {/* 真ん中: 地図 */}
      <main className="relative min-h-0 flex-1">
        <TownMap views={views} />
      </main>

      {/* 下: 自分の割り当てとボタン */}
      <section className="space-y-3 rounded-t-3xl bg-white px-4 pb-5 pt-4 shadow-[0_-4px_16px_rgba(59,42,120,0.12)]">
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
          </div>
        ) : (
          <p className="text-lg font-bold">今朝の割り当てはまだありません</p>
        )}
        <div className="grid grid-cols-3 gap-2">
          <button className="rounded-2xl bg-ink py-4 text-lg font-bold text-white">行く</button>
          <button className="rounded-2xl bg-neon py-4 text-lg font-bold text-white">終わりました</button>
          <button className="rounded-2xl border-2 border-alert py-4 text-base font-bold leading-tight text-alert">
            人手が
            <br />
            足りない
          </button>
        </div>
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
