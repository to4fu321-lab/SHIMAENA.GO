"use client";

// 「今日はここまで！」のまとめ画面（spec v1.57）。1軒ずつの完了は軽い知らせだけにして、
// その日の自分の点・終えた家・どけた雪・チームのようすを、ここで1回まとめて見せる。基本1画面（ClearFrame）。
import Link from "next/link";
import { useEffect, useState } from "react";
import type { DaySummary } from "@/lib/morning/clear";
import { TEAMS } from "@/lib/teams";
import { CARD_TONIGHT } from "@/lib/cards/tonight";
import { clearMessage } from "@/lib/share-links";
import { snowComparison } from "@/lib/snowkg";
import { play } from "@/lib/sound/engine";
import Mascot, { SnowTown } from "./Mascot";
import QuickShare from "./QuickShare";
import InviteDrafts from "./InviteDrafts";
import ClearFrame, { ConnectPanel, Panel } from "./ClearFrame";
import type { PagerTab } from "./Pager";
import Bgm from "./Bgm";
import NakamaAfter from "./NakamaAfter";

export default function DayClear({ day, onClose, homeHref }: { day: DaySummary; onClose: () => void; homeHref: string }) {
  const [tab, setTab] = useState(0);
  useEffect(() => {
    play("missionClear");
    play("lamp", { delay: 0.9 });
  }, []);
  const team = TEAMS.find((t) => t.id === day.teamId);
  const max = Math.max(1, ...Object.values(day.teamTotals));
  const rank = [...TEAMS].sort((a, b) => day.teamTotals[b.id] - day.teamTotals[a.id]).findIndex((t) => t.id === day.teamId) + 1;
  const tabs: PagerTab[] = [
    { key: "result", label: "きょうの成果" },
    { key: "connect", label: "つなぐ" },
  ];
  const shares = [<QuickShare key="quick" text={clearMessage("house")} image={`/api/share/today.png?v=${day.townDone}`} />];
  const invite = day.invites ? <InviteDrafts drafts={day.invites} /> : undefined;

  return (
    <ClearFrame
      label="今日はここまで"
      decor={<Bgm track="clear" />}
      heroOn={tab === 0}
      hero={
        <div className="relative mb-2 overflow-hidden bg-gradient-to-b from-ice-soft to-paper px-4 pb-7 pt-3 [@media(max-height:700px)]:pb-6 [@media(max-height:700px)]:pt-1.5">
          <p className="eyebrow">今日はここまで！</p>
          <div className="flex items-center gap-2">
            <Mascot size={72} mood="happy" className="lamp-glow shrink-0" />
            <h2 className="text-lg font-bold leading-snug">
              おつかれさまでした！
              <br />
              今日は <span className="text-3xl text-lamp-deep">{day.houses.length}軒</span> を助けました
            </h2>
          </div>
          <SnowTown className="absolute inset-x-0 bottom-0 h-7 w-full [@media(max-height:700px)]:h-5" />
        </div>
      }
      tabs={tabs}
      onTab={setTab}
      footer={
        <div className="grid grid-cols-[1fr_1.4fr] gap-2">
          <button onClick={onClose} className="btn btn-white min-h-14 whitespace-nowrap px-1 text-base">
            地図にもどる
          </button>
          <Link href={homeHref} className="btn btn-ink min-h-14 text-lg">
            ホームへ
          </Link>
        </div>
      }
    >
      <Panel center>
        {/* いちばん大きく: 今日の自分の点 */}
        <div className="rounded-3xl bg-card px-4 py-3 text-center ring-1 ring-ink/10 short:py-1.5" aria-label={`今日のあなたの点 ${day.myPoints}点`}>
          <p className="text-sm font-bold text-ink-soft">今日のあなたの点</p>
          <p className="font-bold leading-none tabular-nums text-lamp-deep">
            <span className="text-6xl short:text-5xl">{day.myPoints}</span>
            <span className="ml-1 text-2xl">点</span>
          </p>
          <ul className="mt-2 flex flex-wrap justify-center gap-1.5 short:mt-1" aria-label="終えた家">
            {day.houses.map((h, i) => (
              <li key={`${h.baseNumber}-${i}`} className="rounded-full bg-paper px-2.5 py-0.5 text-sm font-bold ring-1 ring-ink/15">
                拠点{h.baseNumber} <span className="tabular-nums text-ink-soft">+{h.points}</span>
              </li>
            ))}
          </ul>
          {day.snowKg > 0 && (
            <p className="mt-2 text-base short:mt-1">
              どけた雪 およそ <b className="text-xl tabular-nums">{day.snowKg}</b>kg<span className="short:hidden">（{snowComparison(day.snowKg)}）</span>
            </p>
          )}
        </div>
        {/* チームのようす: 横棒（自分のチームを太く） */}
        <ul className="space-y-1 rounded-2xl bg-card px-3 py-2 ring-1 ring-ink/10" aria-label="チームの得点">
          {TEAMS.map((t) => (
            <li key={t.id} className={`flex items-center gap-2 text-sm leading-tight ${t.id === day.teamId ? "font-bold" : ""}`}>
              <span className="w-[7.5rem] shrink-0 whitespace-nowrap">
                <span className="mr-1 inline-block size-2.5 rounded-full align-middle" style={{ background: t.color }} aria-hidden="true" />
                {t.name}
              </span>
              <span className={`flex-1 overflow-hidden rounded-full bg-ice-soft ${t.id === day.teamId ? "h-3.5" : "h-2.5"}`}>
                <span className="block h-full rounded-full" style={{ width: `${(day.teamTotals[t.id] / max) * 100}%`, background: t.color }} />
              </span>
              <span className="w-12 text-right tabular-nums">{day.teamTotals[t.id]}</span>
            </li>
          ))}
          {team && rank > 0 && (
            <li className="pt-0.5 text-center text-sm text-ink-soft short:hidden">
              {team.name}はいま {rank}位{day.allDone ? " ・ 今朝の家はすべて完了！" : ` ・ 町は ${day.townDone}/${day.townTotal}軒`}
            </li>
          )}
        </ul>
        {day.cardsTonight > 0 && (
          <p className="rounded-2xl bg-warm px-3 py-1.5 text-base ring-1 ring-lamp/50" role="note">
            <b className="mr-1 text-sm">🐦 シマエナ隊長</b>
            {day.firstFlight ? "初出撃おめでとう！ " : ""}
            {CARD_TONIGHT}
          </p>
        )}
      </Panel>
      <Panel>
        <ConnectPanel
          shares={shares}
          invite={invite}
          baton={(view) => <NakamaAfter viewerId={day.viewerId} source="help_house" missionId={day.lastMissionId} photoChecked={day.lastPhotoChecked} view={view} />}
        />
      </Panel>
    </ClearFrame>
  );
}
