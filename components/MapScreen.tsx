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
      {/* 上: 日付・今朝の雪・チームの得点（短く） */}
      <header className="space-y-2 bg-card px-4 pb-3 pt-3 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-bold leading-tight">
            みんなで出動
            <span className="block text-sm font-normal text-ink-soft">
              {month}月{day}日の朝 ・ 予報 {state.rollcall.forecastCm}cm
            </span>
          </h1>
          <Link href={`/${q}`} className="btn btn-white min-h-11 shrink-0 px-3 text-sm">
            ホーム
          </Link>
        </div>
        {/* 今朝の雪: のこりの量。全軒完了で町じゅうに灯り */}
        <div className={`rounded-2xl px-3 py-2 ring-1 ${prog.allDone ? "bg-warm ring-lamp/50" : "bg-ice-soft ring-ice/60"}`} aria-label="今朝の雪のこり">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate font-bold">今朝の雪{state.rollcall.snowName ? <>『{state.rollcall.snowName}』</> : null}</span>
            <span className="shrink-0 tabular-nums">
              {prog.total > 0 ? (
                <>
                  <b className="text-base">{prog.done}</b> / {prog.total} 軒 完了
                </>
              ) : (
                "作戦はまだ"
              )}
            </span>
          </div>
          <span className="mt-1 block h-3 overflow-hidden rounded-full bg-white ring-1 ring-ink/10">
            <span className="block h-full rounded-full bg-ice transition-[width] duration-700" style={{ width: `${hpPct}%` }} />
          </span>
          <p className="mt-1 text-sm">
            {prog.total === 0 ? (
              <span className="text-ink-soft">雪の朝に、ここに町の地図が色づきます。</span>
            ) : prog.allDone ? (
              <b>{prog.defeatedAt ? `${prog.defeatedAt} ` : ""}すべての家の灯りがともりました！</b>
            ) : (
              <>
                あと <b>{prog.left}</b> 軒
                {snow.kg > 0 && (
                  <span className="text-ink-soft">
                    {" "}
                    ・ どけた雪 {snow.label}（{snow.comparison}）
                  </span>
                )}
              </>
            )}
          </p>
        </div>
        <ul className="space-y-0.5" aria-label="チームの得点">
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
      </header>

      {/* 真ん中: 地図（全軒完了で背景が明るくなる） */}
      <main className={`relative min-h-[34dvh] flex-1 ${prog.allDone ? "defeated" : ""}`}>
        <TownMap cells={cells} home={home} destinations={destinations} solo={solo} />
      </main>

      {/* 下: 自分の割り当てなど（長くなったら中でスクロール。地図は 34% 以上残す）。操作ボタンはさらに下に固定 */}
      <section className="max-h-[44dvh] space-y-3 overflow-y-auto rounded-t-3xl bg-card px-4 pb-3 pt-4 shadow-[0_-4px_16px_rgba(41,68,92,0.12)]">
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
          <div>
            <p className="eyebrow">あなたの担当</p>
            <p className="text-lg font-bold">今朝の割り当てはまだありません</p>
          </div>
        )}
        <RescueList
          viewerId={state.viewerId}
          items={rescue}
          goingTo={goingTo}
          isHelper={viewer?.role === "helper"}
          hasAssignment={goingTo.length > 0}
        />
        {shareText && prog.total > 0 && <ShareButton text={shareText} />}
        <Link href={`/${q}#share`} className="btn btn-white w-full text-base">
          画像つきで SNS に投稿する（X・Instagram）
        </Link>
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
