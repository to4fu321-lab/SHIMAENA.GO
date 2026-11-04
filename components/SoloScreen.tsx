"use client";

// ソロ出動の画面（spec v1.3）。ミッションを左右スワイプで選ぶ → 出撃！（開始の演出）→ 実施中（タイマー）
// → 写真やひとことで報告 → クリア！の演出 → 羽とポイント → SNS 投稿。
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { fiveMinutesAction } from "@/app/map/actions";
import { completeSoloAction, reportRoadAction, setRoadAlertAction, startHomeAction, stopHomeAction, type SoloActionResult } from "@/app/solo/actions";
import { soloTeamPoints, type SoloMission } from "@/lib/solo/missions";
import { allowedAtNight, NIGHT_TEXT } from "@/lib/night";
import type { SoloClearSummary, SoloStatus } from "@/lib/solo/ops";
import type { Role } from "@/lib/types";
import { shrink } from "./shrink";
import QuickShare from "./QuickShare";
import SnsShare, { type ShareOption } from "./SnsShare";
import { clearMessage } from "@/lib/share-links";
import SoloClear from "./SoloClear";
import MissionFlash from "./MissionFlash";
import MissionRun from "./MissionRun";
import RoadReportRun from "./RoadReportRun";
import BragShare from "./BragShare";
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
  night = false,
  q,
  shareOptions = [],
  roadAlerts,
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
  /** 夜（19時〜6時）: 自分の家と家の中でできることだけ（spec v1.8 防犯） */
  night?: boolean;
  q: string;
  /** SNS に投稿する下書き（わたしの活動・仲間を募集） */
  shareOptions?: ShareOption[];
  /** 近くの道の報告を LINE で受け取るか（未回答は undefined） */
  roadAlerts?: boolean;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<SoloActionResult | null>(null);
  const [clear, setClear] = useState<SoloClearSummary | null>(null);
  const [doneToday, setDoneToday] = useState<string[]>(status.doneToday);
  const [helpText, setHelpText] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ kind: "start" | "clear"; label: string } | null>(null);
  // 実施中のミッション（画面を開き直しても続きから。この端末だけに残す）
  const runKey = `solo-run-${viewerId}`;
  const [running, setRunningState] = useState<{ kind: string; startedAt: number } | null>(null);
  const beforeKey = `solo-before-${viewerId}`;
  const [before, setBeforeState] = useState<string | undefined>();
  const setBefore = (d: string | undefined) => {
    setBeforeState(d);
    try {
      if (d) localStorage.setItem(beforeKey, d);
      else localStorage.removeItem(beforeKey);
    } catch {}
  };
  // クリア後の自慢画像（自分の家の雪かき: Before / After と、かかった分）
  const [brag, setBrag] = useState<{ before: string; after: string; minutes: number; snow?: { kg: number; comparison: string }; cardId?: string } | null>(null);
  const setRunning = (r: { kind: string; startedAt: number } | null) => {
    setRunningState(r);
    if (!r) setBefore(undefined);
    try {
      if (r) localStorage.setItem(runKey, JSON.stringify(r));
      else localStorage.removeItem(runKey);
    } catch {}
  };
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const v = JSON.parse(localStorage.getItem(runKey) ?? "null");
        if (v && typeof v.kind === "string" && typeof v.startedAt === "number" && !status.doneToday.includes(v.kind)) {
          setRunningState(v);
          setBeforeState(localStorage.getItem(beforeKey) ?? undefined);
        }
      } catch {}
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 自分の家の雪かき: 出撃でホームの「いま自宅を雪かき中」に入り、やめたら抜ける（クリアでも抜ける）
  const homeSignal = (kind: string, on: boolean) => {
    if (kind !== "own_house") return;
    const fd = new FormData();
    fd.set("viewerId", viewerId);
    void (on ? startHomeAction(fd) : stopHomeAction(fd)).catch(() => {});
  };

  const begin = (m: SoloMission) => {
    homeSignal(m.kind, true);
    setResult(null);
    setFlash({ kind: "start", label: m.label });
    setTimeout(() => {
      setFlash(null);
      setRunning({ kind: m.kind, startedAt: Date.now() });
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 1500);
  };

  const submit = (kind: string, file?: File, note?: string, minutes?: number) => {
    const shot = before;
    start(async () => {
      try {
        const fd = new FormData();
        fd.set("viewerId", viewerId);
        fd.set("kind", kind);
        if (note) fd.set("note", note);
        if (file) fd.set("photo", new File([await shrink(file)], "solo.jpg", { type: "image/jpeg" }));
        const r = await completeSoloAction(fd);
        setResult(r);
        if (r.ok && r.summary) {
          const summary = r.summary;
          setBrag(
            shot && file && minutes
              ? {
                  before: shot,
                  after: URL.createObjectURL(file),
                  minutes,
                  snow: summary.snowKg && summary.snowKgComparison ? { kg: summary.snowKg, comparison: summary.snowKgComparison } : undefined,
                  cardId: summary.card?.id,
                }
              : null,
          );
          setRoadDone(null);
          setRunning(null);
          setFlash({ kind: "clear", label: summary.label });
          setTimeout(() => {
            setFlash(null);
            setClear(summary);
            setTodayFeathers(summary.todayFeathers);
            setDoneToday((d) => [...d, kind]);
          }, 1700);
        }
      } catch (e) {
        console.error(e);
        setResult({ ok: false, text: "うまくいきませんでした。電波のよい所で、もう一度押してください。" });
      }
    });
  };

  // 道の危険を知らせる: 地図にピン → 近くの人へ通知。羽は1日1回（2回目からは報告だけ）
  const [roadDone, setRoadDone] = useState<{ id: string; later: boolean } | null>(null);
  const submitRoad = (fd: FormData) => {
    fd.set("viewerId", viewerId);
    start(async () => {
      try {
        const r = await reportRoadAction(fd);
        setResult(r);
        if (!r.ok) return;
        setRunning(null);
        setRoadDone(r.road ?? null);
        setFlash({ kind: "clear", label: "道の危険を知らせる" });
        const summary = r.summary;
        setTimeout(() => {
          setFlash(null);
          if (summary) {
            setBrag(null);
            setClear(summary);
            setTodayFeathers(summary.todayFeathers);
            setDoneToday((d) => (d.includes("report_snow") ? d : [...d, "report_snow"]));
          }
        }, 1700);
      } catch (e) {
        console.error(e);
        setResult({ ok: false, text: "うまくいきませんでした。電波のよい所で、もう一度押してください。" });
      }
    });
  };
  const [alertsOn, setAlertsOn] = useState<boolean | undefined>(roadAlerts);
  const toggleAlerts = () =>
    start(async () => {
      const v = await setRoadAlertAction(viewerId, !alertsOn).catch(() => undefined);
      if (v !== undefined) setAlertsOn(v);
    });

  const helpHouse = () =>
    start(async () => {
      try {
        const r = await fiveMinutesAction(viewerId);
        setHelpText(r.text);
      } catch (e) {
        setHelpText(e instanceof Error ? e.message : "うまくいきませんでした");
      }
    });

  const list = missions.filter((m) => m.kind !== "help_house");
  /** 今この時間にしてよいか（夜は自分の家と家の中だけ。spec v1.8 防犯） */
  const okNow = (m: SoloMission) => !night || allowedAtNight(m.kind, m.onsite);
  const house = missions.find((m) => m.kind === "help_house");
  const firstIndex = () => {
    const f = list.findIndex((m) => m.kind === focus);
    if (f >= 0) return f;
    const open = list.findIndex((m) => !status.doneToday.includes(m.kind) && okNow(m));
    return open >= 0 ? open : 0;
  };
  const [active, setActive] = useState(firstIndex);
  const trackRef = useRef<HTMLDivElement>(null);
  const doneCount = list.filter((m) => doneToday.includes(m.kind)).length;
  const [todayFeathers, setTodayFeathers] = useState(status.todayFeathers);

  // 指定のカードへ横スクロール（スワイプと同じ動き）
  const goTo = (i: number, smooth = true) => {
    const el = trackRef.current?.children[i] as HTMLElement | undefined;
    const track = trackRef.current;
    if (!el || !track) return;
    track.scrollTo({ left: el.offsetLeft - (track.clientWidth - el.clientWidth) / 2, behavior: smooth ? "smooth" : "auto" });
  };
  useEffect(() => {
    goTo(active, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // 遂行中のミッションがあれば、そのカードを開いておく（開き直したとき）
  const runningKind = running?.kind;
  useEffect(() => {
    const idx = runningKind ? list.findIndex((m) => m.kind === runningKind) : -1;
    if (idx >= 0) requestAnimationFrame(() => goTo(idx, false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runningKind]);
  // いま真ん中にあるカードを「選んでいるミッション」にする
  const onScroll = () => {
    const track = trackRef.current;
    if (!track) return;
    const center = track.scrollLeft + track.clientWidth / 2;
    let best = 0;
    let dist = Infinity;
    Array.from(track.children).forEach((c, i) => {
      const el = c as HTMLElement;
      const d = Math.abs(el.offsetLeft + el.clientWidth / 2 - center);
      if (d < dist) {
        dist = d;
        best = i;
      }
    });
    if (best !== active) setActive(best);
  };
  const runMission = running ? list.find((m) => m.kind === running.kind) : undefined;
  // スワイプで選ぶカード: 道の危険・自分の家・（あれば）家の手伝い
  const slides = [...list.map((m) => ({ kind: m.kind, label: m.label })), ...(house ? [{ kind: house.kind, label: house.label }] : [])];
  // 遂行中のミッションを始めたまま、別のミッションを始めるときは確かめる
  const beginOrSwitch = (m: SoloMission) => {
    if (running && running.kind !== m.kind && !window.confirm("いまのミッションをやめて、こちらを始めますか？")) return;
    if (running && running.kind !== m.kind) homeSignal(running.kind, false);
    begin(m);
  };

  const missionCard = (m: SoloMission, i: number) => {
    const done = doneToday.includes(m.kind);
    const tp = soloTeamPoints(m);
    return (
      <div className="flex min-h-full flex-col gap-2 rounded-3xl bg-card p-3.5 shadow-md ring-1 ring-ink/15">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-ink px-3 py-0.5 text-sm font-bold text-white">現地ミッション</span>
          {focus === m.kind && (
            <span className="rounded-full bg-camellia-soft px-2 py-0.5 text-sm font-bold text-camellia-deep ring-1 ring-camellia">🐦 隊長のおすすめ</span>
          )}
          <span className="ml-auto text-sm font-bold tabular-nums text-ink-soft">{i + 1}/{slides.length}</span>
        </div>
        <h2 className="text-2xl font-bold leading-tight">{done ? "✓ " : ""}{m.label}</h2>
        <p className="text-[15px] leading-snug">{m.description}</p>
        <div className="grid grid-cols-3 divide-x divide-ink/15 rounded-2xl bg-paper py-1.5 text-center text-xs font-bold">
          <p><span className="block text-xl tabular-nums">{m.timeLabel ?? `${m.minutes}分`}</span>時間</p>
          <p><span className="block text-xl text-lamp">{DIFF[m.difficulty]}</span>むずかしさ</p>
          <p>
            <span className="block text-xl tabular-nums text-camellia-deep">+{m.feathers}羽</span>
            {tp !== null ? `チーム+${tp}点` : "ごほうび"}
          </p>
        </div>
        {m.kind === "report_snow" && (
          // 近くの道の報告を LINE で受け取る（11/4 本人の指示。コンシェルジュが登録のあとにも聞く）
          <div className="flex items-center gap-2 rounded-2xl bg-ice-soft px-3 py-1.5">
            <span className="min-w-0 flex-1 text-sm font-bold leading-snug">
              🔔 近く（300m）の報告を LINE で受け取る
            </span>
            <button
              role="switch"
              aria-checked={Boolean(alertsOn)}
              aria-label="近くの道の報告を LINE で受け取る"
              disabled={pending}
              onClick={toggleAlerts}
              className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${alertsOn ? "bg-lamp" : "bg-ink/25"}`}
            >
              <span className={`absolute top-1 size-6 rounded-full bg-white shadow transition-all ${alertsOn ? "left-7" : "left-1"}`} />
            </button>
          </div>
        )}
        {!done && !okNow(m) ? (
          <p className="mt-auto rounded-2xl bg-warm px-3 py-2 text-base" role="note">
            🌙 {NIGHT_TEXT.short}
            {NIGHT_TEXT.why}
          </p>
        ) : done && m.kind !== "report_snow" ? (
          <button tabIndex={i === active ? 0 : -1} onClick={() => goTo(Math.min(i + 1, slides.length - 1))} className="btn mt-auto rounded-full bg-ice-soft text-lg">
            ✓ クリア済み　次へ ›
          </button>
        ) : (
          <button
            tabIndex={i === active ? 0 : -1}
            disabled={pending || Boolean(flash)}
            onClick={() => beginOrSwitch(m)}
            className="btn btn-lamp mt-auto whitespace-nowrap rounded-full text-xl"
          >
            {done ? "▶ もう1件 知らせる" : "▶ 出撃する！"}
          </button>
        )}
      </div>
    );
  };

  const houseCard = (i: number) =>
    house && (
      <div className="flex min-h-full flex-col gap-2 rounded-3xl bg-card p-3.5 shadow-md ring-1 ring-ink/15">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-ink px-3 py-0.5 text-sm font-bold text-white">チームの作戦</span>
          <span className="ml-auto text-sm font-bold tabular-nums text-ink-soft">{i + 1}/{slides.length}</span>
        </div>
        <h2 className="text-2xl font-bold leading-tight">{house.label}</h2>
        <p className="text-[15px] leading-snug">{house.description}</p>
        <div className="grid grid-cols-3 divide-x divide-ink/15 rounded-2xl bg-paper py-1.5 text-center text-xs font-bold">
          <p><span className="block text-xl tabular-nums">10分〜</span>時間</p>
          <p><span className="block text-xl text-lamp">{DIFF[house.difficulty]}</span>むずかしさ</p>
          <p><span className="block text-xl tabular-nums text-camellia-deep">+{house.feathers}羽</span>写真で完了</p>
        </div>
        {helpText && (
          <p className="rounded-2xl bg-ice-soft px-3 py-2 text-sm" role="status">
            {helpText}
          </p>
        )}
        {canHelpHouse ? (
          <div className="mt-auto grid gap-2">
            <button disabled={pending} onClick={helpHouse} className="btn btn-lamp rounded-full text-lg">
              {shortHouses > 0 ? `10分だけ助けに行く（${shortHouses}軒）` : "10分だけ参加（偵察・補給）"}
            </button>
            <Link href={`/map${q}`} className="btn btn-white rounded-full text-base">
              町の地図で見る
            </Link>
          </div>
        ) : (
          <p className="mt-auto rounded-2xl bg-paper px-3 py-2 text-base text-ink-soft">
            今は家の募集がありません（雪の朝や、近所から頼まれたときに出ます）。{role === "helper" ? "道の危険を知らせるのはどうですか？" : "自分の家の雪かきをどうぞ。"}
          </p>
        )}
      </div>
    );

  return (
    <div className="mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden bg-paper text-ink">
    <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 px-4 pb-2 pt-3">
      {flash && <MissionFlash kind={flash.kind} label={flash.label} />}
      {clear && (
        <SoloClear summary={clear} onClose={() => setClear(null)} q={q} minutesLabel={brag ? `${brag.minutes}分` : roadDone ? "報告" : undefined}>
          {roadDone && (
            <p className="mt-3 rounded-2xl bg-ice-soft px-3 py-2 text-center text-base ring-1 ring-ice">
              📍 地図にピンを立てました。
              <span className="block text-sm">{roadDone.later ? "近くの人には、朝 6:30 にお知らせします。" : "近くで「受け取る」にした人へ LINE でお知らせします。"}</span>
              <Link href={`/map${q ? `${q}&` : "?"}road=${roadDone.id}`} className="mt-1 inline-block font-bold underline">
                地図で見る
              </Link>
            </p>
          )}
          {brag && <BragShare before={brag.before} after={brag.after} minutes={brag.minutes} page={shareOptions[0]?.page} snow={brag.snow} cardId={brag.cardId} />}
          <QuickShare text={roadDone ? "近所の道の危険を、写真と場所で知らせました。⚠️\nみんなで冬の道を安全に。\n#シマエナGO #雪道" : clearMessage("solo", brag?.minutes ?? (clear.onsite ? 10 : 3))} image={shareOptions[0]?.image ?? "/api/share/today.png"} page={shareOptions[0]?.page} />
          {shareOptions.length > 0 && (
            <details className="mt-3 rounded-2xl bg-card ring-1 ring-ink/10">
              <summary className="flex min-h-12 cursor-pointer items-center justify-between px-3 text-base font-bold">
                <span>✏️ 投稿文を直してから投稿する</span>
                <span aria-hidden="true">›</span>
              </summary>
              <div className="px-1 pb-2">
                <SnsShare options={shareOptions} title="SNS に投稿する" />
              </div>
            </details>
          )}
        </SoloClear>
      )}
      <header hidden={Boolean(running)} className="snowfield relative -mx-4 -mt-3 h-20 shrink-0 overflow-hidden px-4 pt-2">
        <SnowTown className="absolute inset-x-0 bottom-0 h-[55%] w-full" />
        <Link href={`/${q}`} aria-label="ホームへ戻る" className="absolute left-3 top-2 z-10 grid size-11 place-items-center rounded-full bg-card text-2xl font-bold shadow-md">
          ‹
        </Link>
        <div className="relative z-10 px-14 text-center">
          <p className="text-sm font-bold">シマエナ<span className="text-lamp-deep">GO</span></p>
          <h1 className="whitespace-nowrap text-[26px] font-bold leading-tight">ソロミッション</h1>
          <p className="sr-only">{nickname}さん</p>
        </div>
        <Mascot size={52} className="absolute bottom-0 right-2 z-10 drop-shadow-md" />
      </header>

      {/* ゲームの HUD: 呼びかけ＋今日の成績 */}
      <div className="shrink-0 rounded-2xl bg-ink px-4 py-2 text-white shadow-md">
        <p className="text-lg font-bold leading-snug">
          {runMission ? "🎯 遂行中！ 報告でクリア" : pickFive ? "⚡ 出動要請！ 町の雪に挑め" : doneCount === 0 ? "⚡ 今日の初出撃をきめよう！" : doneCount >= list.length ? "🏆 全ミッション制覇！" : "🔥 連続クリアをねらえ！"}
        </p>
        <p className="flex items-center justify-between text-sm font-bold text-white/85">
          <span>クリア {doneCount}/{list.length}</span>
          <span>今日 +{todayFeathers}羽</span>
          <span>連続 {status.streak}日</span>
        </p>
      </div>
      {result && (!result.ok || (result.road && !result.summary && !flash)) && (
        <p className={`shrink-0 rounded-2xl px-3 py-2 text-base ${result.ok ? "bg-ice-soft" : "bg-warm"}`} role="status">
          {result.text}
          {result.road && (
            <Link href={`/map${q ? `${q}&` : "?"}road=${result.road.id}`} className="ml-1 font-bold underline">
              地図で見る
            </Link>
          )}
        </p>
      )}

      {/* ミッションのカード（左右スワイプで選ぶ）。遂行中のミッションもカードの中で続ける */}
      <section className="flex min-h-0 flex-1 flex-col" aria-label="ミッションをえらぶ" aria-roledescription="カルーセル">
        <div
          ref={trackRef}
          onScroll={onScroll}
          className="-mx-4 flex min-h-0 flex-1 snap-x snap-mandatory gap-3 overflow-x-auto px-[6%] pb-1 pt-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {slides.map((sl, i) => {
            const m = list.find((x) => x.kind === sl.kind);
            return (
              <article
                key={sl.kind}
                aria-label={`${i + 1}/${slides.length} ${sl.label}`}
                aria-hidden={i !== active}
                className={`h-full w-[88%] shrink-0 snap-center overflow-y-auto rounded-3xl transition-transform [scrollbar-width:none] ${i === active ? "" : "scale-95 opacity-70"}`}
              >
                {m && running?.kind === m.kind && m.kind === "report_snow" ? (
                  <RoadReportRun pending={pending} onSend={submitRoad} onQuit={() => setRunning(null)} />
                ) : m && running?.kind === m.kind ? (
                  <MissionRun
                    mission={m}
                    startedAt={running.startedAt}
                    pending={pending}
                    q={q}
                    before={before}
                    onBefore={setBefore}
                    onReport={(file, note) => submit(m.kind, file, note, Math.max(1, Math.round((Date.now() - running.startedAt) / 60000)))}
                    onQuit={() => {
                      homeSignal(m.kind, false);
                      setRunning(null);
                    }}
                  />
                ) : m ? (
                  missionCard(m, i)
                ) : (
                  houseCard(i)
                )}
              </article>
            );
          })}
        </div>
        <div className="flex shrink-0 items-center justify-center gap-3 pt-1">
          <button aria-label="前のミッション" disabled={active === 0} onClick={() => goTo(active - 1)} className="grid size-9 place-items-center rounded-full bg-card text-xl font-bold shadow-sm ring-1 ring-ink/15 disabled:opacity-30">
            ‹
          </button>
          <div className="flex gap-1.5" role="tablist" aria-label="ミッションの番号">
            {slides.map((sl, i) => (
              <button
                key={sl.kind}
                role="tab"
                aria-selected={i === active}
                aria-label={`${i + 1}. ${sl.label}`}
                onClick={() => goTo(i)}
                className={`h-2.5 rounded-full transition-all ${i === active ? "w-6 bg-ink" : running?.kind === sl.kind ? "w-2.5 bg-lamp" : doneToday.includes(sl.kind) ? "w-2.5 bg-ice" : "w-2.5 bg-ink/25"}`}
              />
            ))}
          </div>
          <button aria-label="次のミッション" disabled={active >= slides.length - 1} onClick={() => goTo(active + 1)} className="grid size-9 place-items-center rounded-full bg-card text-xl font-bold shadow-sm ring-1 ring-ink/15 disabled:opacity-30">
            ›
          </button>
        </div>
      </section>
    </main>
    <div className="shrink-0">
      <TabBar active="home" q={q} />
    </div>
    </div>
  );
}
