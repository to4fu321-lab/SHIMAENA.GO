"use client";

// なかま（spec v1.13）: 1画面（11/5 本人の指示）。タブ「今日」「合流」「バトン」を横スワイプで。
// どれも任意。何も選ばなくても、今までどおりひとりで自由に参加できる（ソロ出動はワンタップのまま）。
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { joinAction } from "@/app/map/actions";
import { answerAction, proposeAction, reactAction, todayModeAction, type NakamaResult } from "@/app/nakama/actions";
import type { NakamaView } from "@/lib/nakama/ops";
import { CHILD_NOTE, REACTION_LABEL, TODAY_MODES, type TodayMode } from "@/lib/nakama/rules";
import Pager, { PagedList, Screen } from "./Pager";
import TabBar from "./TabBar";

const card = "rounded-3xl bg-card p-4 shadow-sm ring-1 ring-ink/10";

export default function NakamaScreen({ viewerId, view, q, initialTab }: { viewerId: string; view: NakamaView; q: string; initialTab?: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState<NakamaResult | { ok: boolean; text: string } | null>(null);
  const [tab, setTab] = useState(initialTab ?? (view.incoming.length > 0 || view.matched.length > 0 ? 1 : 0));
  const run = (f: () => Promise<NakamaResult | { ok: boolean; text: string }>, then?: (r: { ok: boolean }) => void) =>
    start(async () => {
      try {
        const r = await f();
        setNote(r);
        then?.(r);
      } catch {
        setNote({ ok: false, text: "うまくいきませんでした。もう一度押してください。" });
      }
      router.refresh();
    });
  const pickMode = (m: TodayMode) => run(() => todayModeAction(viewerId, m), (r) => r.ok && m !== "solo" && setTab(1));

  const header = (
    <div className="flex items-center gap-3 px-4 pb-2 pt-3">
      <Link href={`/solo${q}`} aria-label="雪かきGO！へ戻る" className="grid size-11 shrink-0 place-items-center rounded-full bg-card text-2xl font-bold shadow-md">
        ‹
      </Link>
      <div className="min-w-0">
        <h1 className="text-2xl font-bold leading-tight">👥 なかま</h1>
        <p className="truncate text-sm text-ink-soft">
          仲間 {view.companions}人・合流 {view.meets}回・ありがとう {view.thanksForMe}
        </p>
      </div>
    </div>
  );

  return (
    <Screen header={header} footer={<TabBar active="home" q={q} />}>
      {note && (
        <p className={`mx-4 mb-2 shrink-0 rounded-2xl px-3 py-2 text-base leading-snug ${note.ok ? "bg-ice-soft" : "bg-warm"}`} role="status">
          {note.text}
        </p>
      )}
      <Pager
        tabs={[
          { key: "today", label: "今日" },
          { key: "meet", label: "合流", badge: view.incoming.length },
          { key: "baton", label: "バトン" },
        ]}
        initial={tab}
        index={tab}
        onChange={setTab}
      >
        {/* 今日のスタイル（選ばなくてもよい） */}
        <>
          <h2 className="text-xl font-bold">今日はどうしますか？</h2>
          <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-2">
            {TODAY_MODES.map((m) => {
              const on = view.mode === m.id && (view.active || m.id === "solo");
              return (
                <button
                  key={m.id}
                  disabled={pending}
                  aria-pressed={on}
                  onClick={() => pickMode(m.id)}
                  className={`rounded-3xl px-3 text-left ring-2 ${on ? "bg-lamp text-white ring-lamp" : "bg-card ring-ink/15"}`}
                >
                  <span className="block text-xl font-bold leading-tight">{m.label}</span>
                  <span className={`block text-base ${on ? "text-white/90" : "text-ink-soft"}`}>{m.sub}</span>
                </button>
              );
            })}
          </div>
          {view.blocked ? (
            <p className="shrink-0 rounded-2xl bg-warm px-3 py-2 text-base leading-snug">🌙 {view.blocked}</p>
          ) : view.wishLine ? (
            <p className="shrink-0 rounded-2xl bg-camellia-soft px-3 py-2 text-base font-bold leading-snug">🐦 {view.wishLine}</p>
          ) : (
            <p className="shrink-0 text-base leading-snug text-ink-soft">どれでも自由に参加できます。断っても何も減りません。{CHILD_NOTE}</p>
          )}
          <Link href={`/solo${q}`} className="btn btn-white shrink-0 text-lg">
            ひとりで雪かきGO！
          </Link>
        </>

        {/* 合流: 届いた誘い → 決まった合流 → 候補 の順に、1つずつ */}
        <>
          {view.incoming.length > 0 ? (
            <PagedList
              label="届いた誘い"
              items={view.incoming}
              render={(m) => (
                <div key={m.id} className={`${card} flex flex-1 flex-col gap-2 ring-2 ring-lamp`}>
                  <p className="text-sm font-bold text-lamp-deep">📩 届いた誘い</p>
                  <p className="text-lg font-bold leading-snug">
                    {m.fromName}さんから（{m.windowLabel}）
                  </p>
                  <p className="text-lg leading-snug">{m.message}</p>
                  <p className="text-sm text-ink-soft">{CHILD_NOTE}</p>
                  <div className="mt-auto grid grid-cols-2 gap-2">
                    <button disabled={pending} onClick={() => run(() => answerAction(viewerId, m.id, true))} className="btn btn-lamp text-lg">
                      一緒にやる
                    </button>
                    <button disabled={pending} onClick={() => run(() => answerAction(viewerId, m.id, false))} className="btn btn-white text-lg">
                      今回は
                      <br />
                      やめておく
                    </button>
                  </div>
                  <p className="text-center text-sm text-ink-soft">やめても理由は相手に伝わりません。</p>
                </div>
              )}
            />
          ) : view.matched.length > 0 ? (
            <PagedList
              label="決まった合流"
              items={view.matched}
              render={(m) => (
                <div key={m.id} className="flex flex-1 flex-col gap-2 rounded-3xl bg-ice-soft p-4 ring-2 ring-ice">
                  <p className="text-xl font-bold leading-snug">🎉 {m.otherName}さんと合流（{m.windowLabel}）</p>
                  {m.baseNumber && m.missionId ? (
                    <>
                      <p className="text-lg leading-snug">地図の{m.baseNumber}番の家で、10分だけ一緒に。行き先は押した人の LINE にだけ届きます。</p>
                      <p className="text-sm text-ink-soft">{CHILD_NOTE}</p>
                      <button disabled={pending} onClick={() => run(() => joinAction(viewerId, m.missionId!))} className="btn btn-lamp btn-big mt-auto w-full">
                        {m.baseNumber}番の家へ行く
                      </button>
                    </>
                  ) : (
                    <p className="text-lg leading-snug">それぞれの家の前で、同じ10分を。終わったら「次の人へバトン」で報告しあいましょう。</p>
                  )}
                </div>
              )}
            />
          ) : !view.active ? (
            <div className={`${card} flex flex-1 flex-col justify-center gap-3 text-center`}>
              <p className="text-5xl" aria-hidden="true">👥</p>
              <p className="text-lg leading-snug">「今日」で「誰かと一緒に」などを選ぶと、近くの同じ気持ちの人をさがします。</p>
              <button onClick={() => setTab(0)} className="btn btn-white text-lg">
                今日のスタイルを選ぶ
              </button>
            </div>
          ) : view.blocked ? (
            <p className={`${card} text-lg`}>🌙 {view.blocked}</p>
          ) : (
            <PagedList
              label="合流の候補"
              items={view.candidates}
              empty={<p className={`${card} text-lg leading-snug`}>いまは見つかりません。いつもどおり参加して、バトンでつながりましょう。あとで開くと見つかることもあります。</p>}
              render={(c) => (
                <div key={c.participantId} className={`${card} flex flex-1 flex-col gap-3`}>
                  <p className="text-sm font-bold text-ink-soft">近くの、同じ気持ちの人</p>
                  <p className="text-2xl font-bold leading-snug">
                    {c.kind === "reunion" ? "🤝" : c.kind === "welcome" ? "🌱" : c.kind === "senior" ? "🧭" : "👋"} {c.name ? `${c.name}さん` : c.label}
                  </p>
                  {c.name && <p className="text-base text-ink-soft">{c.label}</p>}
                  {view.nudge && <p className="text-base leading-snug">💡 {view.nudge}</p>}
                  <div className="mt-auto grid grid-cols-2 gap-2">
                    <button disabled={pending} onClick={() => run(() => proposeAction(viewerId, c.participantId, "now10"))} className="btn btn-lamp text-lg">
                      今から10分
                    </button>
                    <button disabled={pending} onClick={() => run(() => proposeAction(viewerId, c.participantId, "today"))} className="btn btn-white text-lg">
                      今日のどこかで
                    </button>
                  </div>
                </div>
              )}
            />
          )}
          {(view.waiting.length > 0 || view.notMatched > 0) && (
            <p className="shrink-0 text-base text-ink-soft">
              {view.waiting.length > 0 ? `返事待ち: ${view.waiting.map((w) => w.label).join("・")}。` : ""}
              {view.notMatched > 0 ? `今日 ${view.notMatched}件は都合が合いませんでした。` : ""}
            </p>
          )}
        </>

        {/* この地域の雪かきバトン（1つずつ） */}
        <>
          <p className="shrink-0 text-lg leading-snug">
            🎽 この地域の雪かきに、今日 <b className="text-2xl tabular-nums">{view.area.people}</b> 人が参加しました。
          </p>
          {view.area.story && <p className="shrink-0 rounded-2xl bg-ice-soft px-3 py-2 text-base leading-snug">{view.area.story}</p>}
          <PagedList
            label="バトン"
            items={view.area.batons}
            empty={<p className={`${card} text-lg leading-snug`}>今日のバトンはまだありません。活動を終えたら、完了の画面から次の人へバトンを渡せます。</p>}
            render={(b) => (
              <div key={b.id} className={`${card} flex flex-1 flex-col gap-2`}>
                <p className="text-base font-bold text-ink-soft">
                  {b.band}の活動者・{b.where}・{b.done ? "終わった" : "途中まで"}
                </p>
                <p className="text-xl leading-snug">「{b.message}」</p>
                {b.photoChecked && <p className="text-base">📷 写真で確認済み</p>}
                {b.own ? (
                  <p className="mt-auto text-base text-ink-soft">あなたのバトン: ありがとう {b.thanks}・続きをやります {b.cont}</p>
                ) : (
                  <div className="mt-auto grid grid-cols-2 gap-2">
                    {(["thanks", "continue"] as const).map((r) => (
                      <button
                        key={r}
                        disabled={pending}
                        aria-pressed={b.mine === r}
                        onClick={() => run(() => reactAction(viewerId, b.id, r))}
                        className={`min-h-14 rounded-2xl px-2 text-base font-bold leading-tight ring-2 ${b.mine === r ? "bg-lamp text-white ring-lamp" : "bg-paper ring-ink/15"}`}
                      >
                        {r === "thanks" ? "🙏" : "💪"} {REACTION_LABEL[r]} {r === "thanks" ? b.thanks : b.cont}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          />
          <p className="shrink-0 text-sm text-ink-soft">名前と家の場所は出しません。地域は約250m四方です。</p>
        </>
      </Pager>
    </Screen>
  );
}
