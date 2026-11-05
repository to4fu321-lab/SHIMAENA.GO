"use client";

// なかま（spec v1.13）: ゆるく合流・届いた誘い・この地域の雪かきバトン。
// どれも任意。何も選ばなくても、今までどおりひとりで自由に参加できる（ソロ出動はワンタップのまま）。
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { joinAction } from "@/app/map/actions";
import { answerAction, proposeAction, reactAction, todayModeAction, type NakamaResult } from "@/app/nakama/actions";
import type { NakamaView } from "@/lib/nakama/ops";
import { REACTION_LABEL, TODAY_MODES, type TodayMode } from "@/lib/nakama/rules";
import TabBar from "./TabBar";

export default function NakamaScreen({ viewerId, view, q }: { viewerId: string; view: NakamaView; q: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState<NakamaResult | null>(null);
  const run = (f: () => Promise<NakamaResult | { ok: boolean; text: string }>) =>
    start(async () => {
      try {
        setNote(await f());
      } catch {
        setNote({ ok: false, text: "うまくいきませんでした。もう一度押してください。" });
      }
      router.refresh();
    });
  const pickMode = (m: TodayMode) => run(() => todayModeAction(viewerId, m));

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-paper text-ink">
      <main className="flex-1 space-y-4 px-4 pb-6 pt-3">
        <header className="flex items-center gap-3">
          <Link href={`/solo${q}`} aria-label="出動するへ戻る" className="grid size-11 shrink-0 place-items-center rounded-full bg-card text-2xl font-bold shadow-md">
            ‹
          </Link>
          <div>
            <h1 className="text-2xl font-bold leading-tight">👥 なかま</h1>
            <p className="text-base text-ink-soft">一緒にやるのも、ひとりも自由です</p>
          </div>
        </header>

        {note && (
          <p className={`rounded-2xl px-3 py-2 text-lg ${note.ok ? "bg-ice-soft" : "bg-warm"}`} role="status">
            {note.text}
            {"story" in note && note.story ? <span className="block text-base">{note.story}</span> : null}
          </p>
        )}

        {/* 今日のスタイル（選ばなくてもよい） */}
        <section className="space-y-2 rounded-3xl bg-card p-4 shadow-sm ring-1 ring-ink/10" aria-label="今日のスタイル">
          <h2 className="text-xl font-bold">今日はどうしますか？</h2>
          <div className="grid grid-cols-2 gap-2">
            {TODAY_MODES.map((m) => {
              const on = view.mode === m.id && (view.active || m.id === "solo");
              return (
                <button
                  key={m.id}
                  disabled={pending}
                  aria-pressed={on}
                  onClick={() => pickMode(m.id)}
                  className={`min-h-16 rounded-2xl px-2 py-2 text-left ring-2 ${on ? "bg-lamp text-white ring-lamp" : "bg-paper ring-ink/15"}`}
                >
                  <span className="block text-lg font-bold leading-tight">{m.label}</span>
                  <span className={`block text-sm ${on ? "text-white/90" : "text-ink-soft"}`}>{m.sub}</span>
                </button>
              );
            })}
          </div>
          <p className="text-base text-ink-soft">どれを選んでも、いつもどおり自由に参加できます。断っても何も減りません。</p>
          {view.blocked && <p className="rounded-2xl bg-warm px-3 py-2 text-base">🌙 {view.blocked}</p>}
          {view.wishLine && <p className="rounded-2xl bg-camellia-soft px-3 py-2 text-base font-bold">🐦 {view.wishLine}</p>}
        </section>

        {/* 届いた誘い */}
        {view.incoming.length > 0 && (
          <section className="space-y-2" aria-label="届いた誘い">
            <h2 className="text-xl font-bold">📩 届いた誘い</h2>
            {view.incoming.map((m) => (
              <div key={m.id} className="space-y-2 rounded-3xl bg-card p-4 shadow-sm ring-2 ring-lamp">
                <p className="text-lg font-bold">{m.fromName}さんから（{m.windowLabel}）</p>
                <p className="text-lg">{m.message}</p>
                <div className="grid grid-cols-2 gap-2">
                  <button disabled={pending} onClick={() => run(() => answerAction(viewerId, m.id, true))} className="btn btn-lamp text-lg">
                    一緒にやる
                  </button>
                  <button disabled={pending} onClick={() => run(() => answerAction(viewerId, m.id, false))} className="btn btn-white text-lg">
                    今回はやめておく
                  </button>
                </div>
                <p className="text-sm text-ink-soft">やめても理由は相手に伝わりません。</p>
              </div>
            ))}
          </section>
        )}

        {/* 決まった合流 */}
        {view.matched.map((m) => (
          <section key={m.id} className="space-y-2 rounded-3xl bg-ice-soft p-4 ring-2 ring-ice" aria-label="決まった合流">
            <p className="text-xl font-bold">🎉 {m.otherName}さんと合流（{m.windowLabel}）</p>
            {m.baseNumber && m.missionId ? (
              <>
                <p className="text-lg">地図の{m.baseNumber}番の家で、10分だけ一緒に。行き先は押した人の LINE にだけ届きます。</p>
                <button disabled={pending} onClick={() => run(() => joinAction(viewerId, m.missionId!))} className="btn btn-lamp btn-big w-full">
                  {m.baseNumber}番の家へ行く
                </button>
              </>
            ) : (
              <p className="text-lg">それぞれの家の前で、同じ10分を。終わったら「次の人へバトン」で報告しあいましょう。</p>
            )}
          </section>
        ))}

        {/* 合流の候補（一緒に系を選んだときだけ） */}
        {view.active && !view.blocked && view.matched.length === 0 && (
          <section className="space-y-2" aria-label="合流の候補">
            <h2 className="text-xl font-bold">近くの、同じ気持ちの人</h2>
            {view.candidates.length === 0 ? (
              <p className="rounded-2xl bg-card px-3 py-3 text-lg ring-1 ring-ink/10">いまは見つかりません。いつもどおり参加して、バトンでつながりましょう。あとで開くと見つかることもあります。</p>
            ) : (
              view.candidates.map((c) => (
                <div key={c.participantId} className="space-y-2 rounded-3xl bg-card p-4 shadow-sm ring-1 ring-ink/10">
                  <p className="text-lg font-bold">
                    {c.kind === "reunion" ? "🤝" : c.kind === "welcome" ? "🌱" : c.kind === "senior" ? "🧭" : "👋"} {c.name ? `${c.name}さん（${c.label}）` : c.label}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button disabled={pending} onClick={() => run(() => proposeAction(viewerId, c.participantId, "now10"))} className="btn btn-lamp text-lg">
                      今から10分
                    </button>
                    <button disabled={pending} onClick={() => run(() => proposeAction(viewerId, c.participantId, "today"))} className="btn btn-white text-lg">
                      今日のどこかで
                    </button>
                  </div>
                </div>
              ))
            )}
            {view.nudge && <p className="rounded-2xl bg-paper px-3 py-2 text-base ring-1 ring-ink/10">💡 {view.nudge}</p>}
            {view.waiting.length > 0 && <p className="text-base text-ink-soft">返事待ち: {view.waiting.map((w) => w.label).join("・")}</p>}
            {view.notMatched > 0 && <p className="text-base text-ink-soft">今日 {view.notMatched}件は都合が合いませんでした。よくあることです。</p>}
          </section>
        )}

        {/* この地域の雪かきバトン */}
        <section className="space-y-2 rounded-3xl bg-card p-4 shadow-sm ring-1 ring-ink/10" aria-label="この地域の雪かきバトン">
          <h2 className="text-xl font-bold">🎽 この地域の雪かきバトン</h2>
          <p className="text-lg">
            この地域の雪かきに、今日 <b className="text-2xl tabular-nums">{view.area.people}</b> 人が参加しました。
          </p>
          {view.area.story && <p className="rounded-2xl bg-ice-soft px-3 py-2 text-base">{view.area.story}</p>}
          {view.area.batons.length === 0 ? (
            <p className="text-base text-ink-soft">今日のバトンはまだありません。活動を終えたら、完了の画面から次の人へバトンを渡せます。</p>
          ) : (
            <ul className="space-y-2">
              {view.area.batons.map((b) => (
                <li key={b.id} className="space-y-1.5 rounded-2xl bg-paper px-3 py-2">
                  <p className="text-sm font-bold text-ink-soft">
                    {b.band}の活動者・{b.where}・{b.done ? "終わった" : "途中まで"}
                    {b.photoChecked ? "・📷 写真で確認済み" : ""}
                  </p>
                  <p className="text-lg">「{b.message}」</p>
                  {b.own ? (
                    <p className="text-sm text-ink-soft">あなたのバトン: ありがとう {b.thanks}・続きをやります {b.cont}</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {(["thanks", "continue"] as const).map((r) => (
                        <button
                          key={r}
                          disabled={pending}
                          aria-pressed={b.mine === r}
                          onClick={() => run(() => reactAction(viewerId, b.id, r))}
                          className={`min-h-12 rounded-full px-4 text-base font-bold ring-2 ${b.mine === r ? "bg-lamp text-white ring-lamp" : "bg-card ring-ink/15"}`}
                        >
                          {r === "thanks" ? "🙏" : "💪"} {REACTION_LABEL[r]} {r === "thanks" ? b.thanks : b.cont}
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="text-sm text-ink-soft">名前と家の場所は出しません。地域は約250m四方です。</p>
        </section>

        <p className="rounded-2xl bg-card px-3 py-2 text-base ring-1 ring-ink/10">
          これまで: 一緒に活動した仲間 <b>{view.companions}</b>人・合流 <b>{view.meets}</b>回・あなたのバトンへのありがとう <b>{view.thanksForMe}</b>
        </p>

        <Link href={`/solo${q}`} className="btn btn-white btn-big w-full">
          ひとりで出動する
        </Link>
      </main>
      <TabBar active="home" q={q} />
    </div>
  );
}
