"use client";

// ソロ出動の画面（spec v1.3）。ミッションを左右スワイプで選ぶ → 出撃！（開始の演出）→ 実施中（タイマー）
// → 写真やひとことで報告 → クリア！の演出 → 羽とポイント → SNS 投稿。
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { fiveMinutesAction } from "@/app/map/actions";
import { completeSoloAction, startHomeAction, stopHomeAction, type SoloActionResult } from "@/app/solo/actions";
import { soloTeamPoints, type SoloMission } from "@/lib/solo/missions";
import { allowedAtNight, NIGHT_TEXT } from "@/lib/night";
import type { SoloClearSummary, SoloStatus } from "@/lib/solo/ops";
import type { Role } from "@/lib/types";
import { shrink } from "./shrink";
import FriendShare from "./FriendShare";
import QuickShare from "./QuickShare";
import SnsShare, { type ShareOption } from "./SnsShare";
import { clearMessage } from "@/lib/share-links";
import SoloClear from "./SoloClear";
import MissionFlash from "./MissionFlash";
import MissionRun from "./MissionRun";
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
  const [brag, setBrag] = useState<{ before: string; after: string; minutes: number } | null>(null);
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
          setBrag(shot && file && minutes ? { before: shot, after: URL.createObjectURL(file), minutes } : null);
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
        setResult({ ok: false, text: e instanceof Error ? e.message : "うまくいきませんでした" });
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
  const current = list[active] ?? list[0];
  const runMission = running ? list.find((m) => m.kind === running.kind) : undefined;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col overflow-x-clip bg-paper text-ink">
    <main className="min-w-0 flex-1 space-y-3 px-4 pb-4 pt-3">
      {flash && <MissionFlash kind={flash.kind} label={flash.label} />}
      {clear && (
        <SoloClear summary={clear} onClose={() => setClear(null)} q={q} minutesLabel={brag ? `${brag.minutes}分` : undefined}>
          {brag && <BragShare before={brag.before} after={brag.after} minutes={brag.minutes} page={shareOptions[0]?.page} />}
          <QuickShare text={clearMessage("solo", brag?.minutes ?? (clear.onsite ? 10 : 3))} image={shareOptions[0]?.image ?? "/api/share/today.png"} page={shareOptions[0]?.page} />
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
      <header className="snowfield relative -mx-4 -mt-3 h-24 overflow-hidden px-4 pt-2">
        <SnowTown className="absolute inset-x-0 bottom-0 h-[55%] w-full" />
        <Link href={`/${q}`} aria-label="ホームへ戻る" className="absolute left-3 top-3 z-10 grid size-12 place-items-center rounded-full bg-card text-2xl font-bold shadow-md">
          ‹
        </Link>
        <div className="relative z-10 px-14 text-center">
          <p className="text-sm font-bold">シマエナ<span className="text-lamp-deep">GO</span></p>
          <h1 className="whitespace-nowrap text-[28px] font-bold leading-tight">ソロミッション</h1>
          <p className="sr-only">{nickname}さん</p>
        </div>
        <Mascot size={56} className="absolute bottom-0 right-2 z-10 drop-shadow-md" />
      </header>

      {/* ゲームの HUD: 呼びかけ＋今日の成績 */}
      <div className="rounded-2xl bg-ink px-4 py-2 text-white shadow-md">
        <p className="text-lg font-bold leading-snug">
          {runMission ? "🎯 遂行中！ 報告でクリア" : pickFive ? "⚡ 出動要請！ 10分で町の雪に挑め" : doneCount === 0 ? "⚡ 今日の初出撃をきめよう！" : doneCount >= list.length ? "🏆 全ミッション制覇！" : "🔥 連続クリアをねらえ！"}
        </p>
        <p className="flex items-center justify-between text-sm font-bold text-white/85">
          <span>クリア {doneCount}/{list.length}</span>
          <span>今日 +{todayFeathers}羽</span>
          <span>連続 {status.streak}日</span>
        </p>
      </div>
      {result && !result.ok && (
        <p className="rounded-2xl bg-warm px-3 py-2 text-base" role="status">
          {result.text}
        </p>
      )}

      {runMission && running && (
        <MissionRun
          mission={runMission}
          startedAt={running.startedAt}
          pending={pending}
          q={q}
          before={before}
          onBefore={setBefore}
          onReport={(file, note) => submit(runMission.kind, file, note, Math.max(1, Math.round((Date.now() - running.startedAt) / 60000)))}
          onQuit={() => {
            homeSignal(runMission.kind, false);
            setRunning(null);
          }}
        />
      )}
      {/* ミッションのカード（左右スワイプで選ぶ） */}
      <section aria-label="ミッションをえらぶ" aria-roledescription="カルーセル" hidden={Boolean(runMission)}>
        <div
          ref={trackRef}
          onScroll={onScroll}
          className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-[7%] pb-2 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {list.map((m, i) => {
            const done = doneToday.includes(m.kind);
            const tp = soloTeamPoints(m);
            return (
              <article
                key={m.kind}
                aria-label={`${i + 1}/${list.length} ${m.label}`}
                aria-hidden={i !== active}
                className={`relative flex w-[86%] shrink-0 snap-center flex-col gap-2 rounded-3xl bg-card p-4 shadow-md ring-1 transition-transform ${i === active ? "ring-ink/20" : "scale-95 opacity-70 ring-ink/10"}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-3 py-0.5 text-sm font-bold ${m.onsite ? "bg-ink text-white" : "bg-ice-soft text-ink ring-1 ring-ice"}`}>
                    {m.onsite ? "現地ミッション" : "おうちミッション"}
                  </span>
                  {focus === m.kind && (
                    <span className="rounded-full bg-camellia-soft px-2 py-0.5 text-sm font-bold text-camellia-deep ring-1 ring-camellia">🐦 隊長のおすすめ</span>
                  )}
                  <span className="ml-auto text-sm font-bold tabular-nums text-ink-soft">{i + 1}/{list.length}</span>
                </div>
                <h2 className="text-2xl font-bold leading-tight">{done ? "✓ " : ""}{m.label}</h2>
                <p className="text-base leading-snug">{m.description}</p>
                <div className="grid grid-cols-3 divide-x divide-ink/15 rounded-2xl bg-paper py-2 text-center text-sm font-bold">
                  <p><span className="block text-2xl tabular-nums">{m.beforeAfter ? "自由" : `${m.minutes}分`}</span>時間</p>
                  <p><span className="block text-2xl text-lamp">{DIFF[m.difficulty]}</span>むずかしさ</p>
                  <p>
                    <span className="block text-2xl tabular-nums text-camellia-deep">+{m.feathers}羽</span>
                    {tp !== null ? `チーム+${tp}点` : "ごほうび"}
                  </p>
                </div>
                {!done && !okNow(m) ? (
                  <p className="mt-auto rounded-2xl bg-warm px-3 py-2 text-base" role="note">
                    🌙 {NIGHT_TEXT.short}
                    {NIGHT_TEXT.why}
                  </p>
                ) : done ? (
                  <button
                    tabIndex={i === active ? 0 : -1}
                    onClick={() => goTo(Math.min(i + 1, list.length - 1))}
                    className="btn mt-auto rounded-full bg-ice-soft text-lg"
                  >
                    ✓ クリア済み　次へ ›
                  </button>
                ) : (
                  <button
                    tabIndex={i === active ? 0 : -1}
                    disabled={pending || Boolean(flash)}
                    onClick={() => begin(m)}
                    className="btn btn-lamp mt-auto whitespace-nowrap rounded-full text-xl"
                  >
                    ▶ 出撃する！
                  </button>
                )}
              </article>
            );
          })}
        </div>
        <div className="flex items-center justify-center gap-3">
          <button aria-label="前のミッション" disabled={active === 0} onClick={() => goTo(active - 1)} className="grid size-10 place-items-center rounded-full bg-card text-xl font-bold shadow-sm ring-1 ring-ink/15 disabled:opacity-30">
            ‹
          </button>
          <div className="flex gap-1.5" role="tablist" aria-label="ミッションの番号">
            {list.map((m, i) => (
              <button
                key={m.kind}
                role="tab"
                aria-selected={i === active}
                aria-label={`${i + 1}. ${m.label}`}
                onClick={() => goTo(i)}
                className={`h-2.5 rounded-full transition-all ${i === active ? "w-6 bg-ink" : doneToday.includes(m.kind) ? "w-2.5 bg-lamp" : "w-2.5 bg-ink/25"}`}
              />
            ))}
          </div>
          <button aria-label="次のミッション" disabled={active >= list.length - 1} onClick={() => goTo(active + 1)} className="grid size-10 place-items-center rounded-full bg-card text-xl font-bold shadow-sm ring-1 ring-ink/15 disabled:opacity-30">
            ›
          </button>
        </div>
        <p className="mt-1 text-center text-sm text-ink-soft">
          {current?.photo === "optional" ? "📷 写真で報告すると「確認済み」の印がつきます" : "← 左右にスワイプしてミッションをえらぶ →"}
        </p>
      </section>

      <details className="rounded-2xl bg-card ring-1 ring-ink/15">
        <summary className="flex min-h-14 cursor-pointer items-center justify-between px-4 text-base font-bold">
          <span>📊 最近の記録（7日）</span>
          <span aria-hidden="true">›</span>
        </summary>
        <div className="px-4 pb-3">
          <div className="grid grid-cols-3 gap-2 text-center text-sm font-bold">
            <p>今日の羽<span className="block text-2xl tabular-nums text-camellia-deep">{todayFeathers}</span></p>
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

      <FriendShare />

    </main>
    <div className="sticky bottom-0 z-20">
      <TabBar active="home" q={q} />
    </div>
    </div>
  );
}
