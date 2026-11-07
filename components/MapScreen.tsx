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
import { requestLabel } from "@/lib/request-note";
import type { ShortHouse } from "@/lib/morning/watch";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { reportRoadAction } from "@/app/solo/actions";
import GoBriefing from "./GoBriefing";
import HazardIcon from "./HazardIcon";
import CheerCall from "./CheerCall";
import MapSheet from "./MapSheet";
import ClearWatcher from "./ClearWatcher";
import MorningButtons from "./MorningButtons";
import RescueList from "./RescueList";
import RoadReportRun from "./RoadReportRun";
import ShareButton from "./ShareButton";
import Bgm from "./Bgm";

import type { RoadPin } from "./TownMap";
import { play } from "@/lib/sound/engine";
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
  teacher,
  shareText,
  cheers = [],
  home,
  destinations = [],
  solo = [],
  road = [],
  focusRoad,
  view,
}: {
  /** road: 道の報告（滑る所・細い道・除雪まだ）を見る地図（隊長トークの「道の報告の地図を見る」から。11/6 本人の指摘） */
  view?: "road";
  state: MorningState;
  /** ソロ出動の足あと（今日） */
  solo?: SoloCell[];
  /** 道の危険の報告（24時間以内） */
  road?: RoadPin[];
  /** 通知から開いたときに、その報告を開く */
  focusRoad?: string;
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
  /** 今朝の先生のコツ（spec v1.6） */
  teacher?: string;
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
  // 音（spec v1.19）: 人手不足（赤点滅）の家が増えたら「ピッピッ」を1回、全軒完了に変わったら勝利のファンファーレ
  const shortCount = views.filter((v) => v.status === "short").length;
  const prevShort = useRef<number | null>(null);
  const prevDone = useRef<boolean | null>(null);
  useEffect(() => {
    if (prevShort.current !== null && shortCount > prevShort.current) play("helpAlert");
    prevShort.current = shortCount;
  }, [shortCount]);
  useEffect(() => {
    const done = prog.allDone && prog.total > 0;
    if (prevDone.current === false && done) play("bossDown");
    prevDone.current = done;
  }, [prog.allDone, prog.total]);
  const snow = snowTotal(state);
  const hpPct = hp.max > 0 ? (hp.current / hp.max) * 100 : 100;
  const viewerTeam = TEAMS.find((t) => t.id === viewer?.teamId);
  const mySortie = state.sorties.find((s) => s.participantId === state.viewerId);
  const myMission = state.missions.find((m) => m.id === mySortie?.missionId);
  const goingTo = state.sorties.filter((s) => s.participantId === state.viewerId && s.status === "going").map((s) => s.missionId);
  const myBase = bases.find((b) => b.id === myMission?.baseId);
  const myView = views.find((v) => v.baseId === myMission?.baseId);
  const [, month, day] = state.rollcall.date.split("-").map(Number);
  const activeCount = new Set(state.sorties.filter((s) => s.status === "going").map((s) => s.participantId)).size;
  const q = /^[hr]\d+$/.test(state.viewerId) ? `?as=${state.viewerId}` : "";
  // 雪かきGO（出発前）: 割り当てがあって、まだ「行く」を押していないとき。「あとで」で閉じられる
  const [later, setLater] = useState(false);
  const briefing = Boolean(myBase && myView && mySortie?.status === "going" && !mySortie.confirmedAt && !later && !prog.allDone);
  // 道の報告の地図: 札を押すとその報告に寄って写真が開く
  const roadView = view === "road";
  const [focus, setFocus] = useState<string | undefined>(focusRoad);
  // 道の危険を知らせる（11/7 本人の指示「地図画面から」）: ソロと同じ報告の画面を地図の上に重ねる。送ると新しいピンに寄る
  const router = useRouter();
  const [reporting, setReporting] = useState(false);
  const [roadPending, startRoad] = useTransition();
  const [roadResult, setRoadResult] = useState<{ ok: boolean; text: string } | null>(null);
  const submitRoad = (fd: FormData) => {
    fd.set("viewerId", state.viewerId);
    startRoad(async () => {
      try {
        const r = await reportRoadAction(fd);
        setRoadResult({ ok: r.ok, text: r.text });
        if (!r.ok) {
          play("error");
          return;
        }
        play("missionClear");
        setReporting(false);
        if (r.road) setFocus(r.road.id);
        router.refresh(); // 新しいピンを地図に出す
      } catch (e) {
        console.error(e);
        play("error");
        setRoadResult({ ok: false, text: "うまくいきませんでした。電波のよい所で、もう一度押してください。" });
      }
    });
  };
  const openReport = () => {
    setRoadResult(null);
    setReporting(true);
  };
  // 知らせは数秒で消す（地図を隠さない）
  useEffect(() => {
    if (!roadResult || reporting) return;
    const t = setTimeout(() => setRoadResult(null), 6000);
    return () => clearTimeout(t);
  }, [roadResult, reporting]);

  // 畳んでも見える1行: 雪の名前は切らずに見せ、右は「3/7軒 あと4」と短く（11/7 UI 点検: 名前が「もっち…」と切れていた）
  const peekNode = (
    <div aria-label="今朝の雪のこり">
      <p className="truncate text-base font-bold leading-tight">
        今朝の雪{state.rollcall.snowName ? <span className="text-lamp-deep">『{state.rollcall.snowName}』</span> : null}
      </p>
      <div className="mt-1 flex items-center gap-2">
        <span className="block h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-ice-soft">
          <span className="block h-full rounded-full bg-ice transition-[width] duration-700" style={{ width: `${hpPct}%` }} />
        </span>
        <span className="shrink-0 whitespace-nowrap text-sm leading-tight tabular-nums">
          {prog.total === 0 ? (
            "お願いはまだ 0軒"
          ) : prog.allDone ? (
            <b>{prog.defeatedAt ? `${prog.defeatedAt} ` : ""}すべて完了！</b>
          ) : (
            <>
              <b className="text-base">{prog.done}</b>/{prog.total}軒 ・ あと<b className="text-base">{prog.left}</b>軒
            </>
          )}
        </span>
      </div>
    </div>
  );

  // BGM（spec v1.19）: 出発前は「しらかばの朝」、「行く」のあとは「出撃！」、全軒完了のあとは「灯りがともる」
  const bgm = prog.allDone && prog.total > 0 ? "clear" : mySortie?.status === "going" && mySortie.confirmedAt ? "mission" : "morning";

  return (
    <div className="flex h-dvh flex-col bg-paper text-ink">
      <Bgm track={bgm} />
      <ClearWatcher clear={clear} />
      {/* 上: 戻る・題名（濃い冬の青） */}
      <header className="grid shrink-0 grid-cols-[auto_1fr_auto] items-center bg-ink px-2 pb-2 pt-2 text-white">
        <Link href={`/${q}`} className="btn min-h-12 px-2 text-base text-white">
          ‹ ホーム
        </Link>
        <h1 className="text-center text-xl font-bold leading-tight">
          {roadView ? "道の報告の地図" : briefing ? "雪かきGO" : "町の地図"}
          <span className="block text-xs font-normal">{roadView ? "滑る・細い・除雪まだ（24時間）" : `${month}月${day}日の朝`}</span>
        </h1>
        <span className="w-[76px]" aria-hidden="true" />
      </header>

      {/* 真ん中: 地図（全軒完了で背景が明るくなる）。上に今朝の雪と雪かき待ちの札を浮かべる */}
      <main className={`relative min-h-0 flex-1 ${prog.allDone ? "defeated" : ""}`}>
        <div className="absolute inset-0 isolate">
          <TownMap cells={cells} home={home} destinations={destinations} solo={solo} road={road} focusRoad={focus} fitRoad={roadView} />
        </div>
        {roadView && (
          <div className="absolute inset-x-2 top-2 z-[500] space-y-1.5" aria-label="道の報告の一覧">
            {road.length === 0 ? (
              <p className="rounded-2xl bg-card/95 px-3 py-2 text-base font-bold shadow-md">いま、道の報告はありません。見つけたら写真で知らせてください。</p>
            ) : (
              <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {road.map((rp) => (
                  <button
                    key={rp.id}
                    type="button"
                    onClick={() => setFocus(rp.id)}
                    aria-pressed={focus === rp.id}
                    className={`flex min-h-12 shrink-0 items-center gap-1.5 rounded-2xl px-2.5 py-1 text-left shadow-md ring-2 ${focus === rp.id ? "bg-ink text-white ring-ink" : "bg-card/95 ring-transparent"}`}
                  >
                    <HazardIcon id={rp.hazard} size={28} />
                    <span className="leading-tight">
                      <span className="block text-sm font-bold">{rp.label}</span>
                      <span className={`block text-xs ${focus === rp.id ? "text-white/80" : "text-ink-soft"}`}>{rp.ago}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
            <button type="button" onClick={openReport} className="btn btn-lamp min-h-12 w-full text-base shadow-md">
              📷 道の危険を知らせる（10分・写真1枚）
            </button>
          </div>
        )}
        {/* ふつうの地図: 札の下に「道の危険を知らせる」。出発前の案内（雪かきGO）が出ているときは出さない */}
        {!roadView && !briefing && !reporting && (
          <button type="button" onClick={openReport} className="btn btn-lamp absolute left-2 top-[72px] z-[500] min-h-12 px-3 text-base shadow-md" aria-label="道の危険を知らせる（写真1枚）">
            📷 道の危険を知らせる
          </button>
        )}
        {roadResult && !reporting && (
          <p className={`absolute inset-x-2 top-[118px] z-[500] rounded-2xl px-3 py-2 text-base font-bold shadow-md ${roadResult.ok ? "bg-ice-soft ring-2 ring-ice" : "bg-warm ring-2 ring-lamp"}`} role="status">
            {roadResult.text}
          </p>
        )}
        {reporting && (
          <div className="absolute inset-0 z-[700] overflow-y-auto bg-paper/95 p-2" role="dialog" aria-label="道の危険を報告する">
            {roadResult && !roadResult.ok && (
              <p className="mb-2 rounded-2xl bg-warm px-3 py-2 text-base" role="alert">
                {roadResult.text}
              </p>
            )}
            <RoadReportRun viewerId={state.viewerId} pending={roadPending} onSend={submitRoad} onQuit={() => setReporting(false)} />
          </div>
        )}
        {!roadView && <div className="pointer-events-none absolute inset-x-2 top-2 z-[500] flex gap-1.5">
          <p className="flex items-center gap-1.5 rounded-2xl bg-card/95 px-2.5 py-1 shadow-md">
            <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" fill="none" stroke="#29445c" strokeWidth="2" strokeLinecap="round">
              <path d="M12 2 V22 M3.3 7 L20.7 17 M3.3 17 L20.7 7 M9 3.5 L12 6 L15 3.5 M9 20.5 L12 18 L15 20.5" />
            </svg>
            <span className="leading-tight">
              <span className="block text-xs font-bold">今朝の雪</span>
              <b className="text-xl tabular-nums">{state.rollcall.forecastCm}</b>
              <span className="text-sm font-bold">cm</span>
            </span>
          </p>
          <p className="flex items-center gap-1.5 rounded-2xl bg-card/95 px-2.5 py-1 shadow-md">
            <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
              <path d="M12 2 C7.6 2 5 5.3 5 8.8 C5 14 12 22 12 22 S19 14 19 8.8 C19 5.3 16.4 2 12 2 Z" fill="var(--lamp)" />
              <circle cx="12" cy="9" r="3" fill="#fff" />
            </svg>
            <span className="leading-tight">
              <span className="block text-xs font-bold">雪かき待ち</span>
              <b className="text-xl tabular-nums">{rescue.length}</b>
              <span className="text-sm font-bold">軒</span>
            </span>
          </p>
          <p className="flex items-center gap-1.5 rounded-2xl bg-card/95 px-2.5 py-1 shadow-md">
            <svg viewBox="0 0 40 40" width="24" height="24" aria-hidden="true">
              <circle cx="14" cy="13" r="6" fill="#29445c" />
              <circle cx="27" cy="14" r="5" fill="#3b6584" />
              <path d="M3 33 C3 24 25 24 25 33 Z" fill="#29445c" />
              <path d="M20 32 C21 25 37 24 37 32 Z" fill="#3b6584" />
            </svg>
            <span className="leading-tight">
              <span className="block text-xs font-bold">活動中</span>
              <b className="text-xl tabular-nums">{activeCount}</b>
              <span className="text-sm font-bold">人</span>
            </span>
          </p>
        </div>}

      {briefing && myBase && myView && (
        <GoBriefing
          viewerId={state.viewerId}
          baseNumber={myBase.number}
          team={viewerTeam}
          goingPeople={myView.goingPeople}
          requiredPeople={myView.requiredPeople}
          request={myMission?.request ? [requestLabel(myMission.request), myMission.request.note].filter(Boolean).join("・") : undefined}
          destination={destinations.find((d) => d.missionId === myMission?.id)}
          onLater={() => setLater(true)}
        />
      )}
      {/* 下のシート: つまみをスライドで畳める（畳むと地図が大きくなる） */}
      {!briefing && !reporting && <MapSheet
        startClosed={Boolean(focusRoad) || roadView}
        peek={peekNode}
        footer={
          prog.total === 0 && !mySortie ? (
            // 近所のお願いがない: 理由と、やれること2つへ（11/7 本人の指示）
            <div className="space-y-2" aria-label="いまできること">
              <p className="text-center text-sm font-bold">近所のお願いは いまありません。頼む家のお願いが出ると、地図に家が出ます。</p>
              <div className="grid grid-cols-2 gap-2">
                <Link href={`/solo?pick=10&focus=own_house&go=1${q ? `&as=${state.viewerId}` : ""}`} className="btn btn-lamp min-h-14 text-base">
                  🏠 自宅の雪かき
                </Link>
                <button type="button" onClick={openReport} className="btn btn-white min-h-14 whitespace-nowrap px-2 text-base max-[380px]:text-sm">
                  ⚠️ 道の危険を知らせる
                </button>
              </div>
            </div>
          ) : (
          <MorningButtons
            viewerId={state.viewerId}
            canAct={Boolean(mySortie && mySortie.status === "going")}
            going={Boolean(mySortie?.confirmedAt)}
            done={mySortie?.status === "done"}
            note={mySortie?.status === "done" ? "✓ 今朝の雪かきは完了しました。おつかれさまでした。" : mySortie ? undefined : "今朝の割り当てが届くと、ここのボタンが押せるようになります。"}
          />
          )
        }
      >
                {prog.allDone && recap && (
          <div className="rounded-2xl bg-warm px-3 py-2">
            <p className="eyebrow">今朝の実況（シマエナ隊長）</p>
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
              いま {myView.goingPeople}人 / 必要 {myView.requiredPeople}人 ・ 6〜19時のあいだに
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
            {/* ゲーム中にも応援を呼べる（11/6 本人の指示）。まだ終わっていない担当があるとき */}
            {myView.status !== "done" && <CheerCall mission={`拠点${myBase.number}の雪かき`} compact />}
            {myMission?.request && (
              <p className="rounded-2xl bg-warm px-3 py-2 text-base ring-2 ring-lamp">
                <span className="eyebrow block">お願いした人から</span>
                {[requestLabel(myMission.request), myMission.request.note].filter(Boolean).join("・")}
              </p>
            )}
            {myMission && teacher && (
              <p className="rounded-2xl bg-warm px-3 py-2 text-base">
                <span className="eyebrow block">🎓 今朝の先生のコツ</span>「{teacher}」
              </p>
            )}
            {myMission?.reason && (
              <p className="rounded-2xl bg-warm px-3 py-2 text-base">
                <span className="eyebrow block">シマエナ隊長から</span>
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
        ) : prog.total > 0 ? (
          <p className="text-base">
            <span className="font-bold">あなたの担当:</span> 今朝の割り当てはまだありません
          </p>
        ) : null}
        {/* お願いが 0 軒のときは「10分だけ参加」は出さない（下の「自宅の雪かき」「道の危険」へ） */}
        {prog.total > 0 && (
          <RescueList
            viewerId={state.viewerId}
            items={rescue}
            goingTo={goingTo}
            isHelper={viewer?.role === "helper" || Boolean(viewer?.teamId)}
            hasAssignment={goingTo.length > 0}
          />
        )}
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
              <li className="col-span-2 flex items-center gap-1.5">
                <HazardIcon id="ice" size={20} />
                オレンジのピン: 道の危険（24時間。押すと写真）
              </li>
              <li className="col-span-2 text-ink-soft">マスは 50m 四方。どの家かは、割り当てられた人の隊長トークにだけ届きます。</li>
            </ul>
            {shareText && prog.total > 0 && <ShareButton text={shareText} />}
            <Link href={`/connect${q}`} className="btn btn-white w-full text-base">
              画像つきで SNS に投稿する（X・Instagram）
            </Link>
          </div>
        </details>
      </MapSheet>}
      </main>
    </div>
  );
}
