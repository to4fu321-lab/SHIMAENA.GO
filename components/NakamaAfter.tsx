"use client";

// 完了画面の「次の人へバトン」と「次は？」（spec v1.13）。どちらも任意で、押さなくても閉じてよい。
// 1画面に収めるため、上の2つのボタンでどちらか1つだけを出す（11/5 本人の指示「基本1画面」）。
import Link from "next/link";
import { useState, useTransition } from "react";
import { batonAction, nextWishAction } from "@/app/nakama/actions";
import { BATON_PRESETS, BATON_TEXT_MAX, NEXT_WISHES, type NextWish } from "@/lib/nakama/rules";

export default function NakamaAfter({
  viewerId,
  source,
  missionId,
  photoChecked,
  q = "",
  view: shown,
}: {
  viewerId: string;
  source: "own_house" | "help_house" | "road";
  missionId?: string;
  photoChecked?: boolean;
  q?: string;
  /** 親が「バトン」「次は？」のどちらを出すか決めるとき（完了画面の「つなぐ」タブ）。ないときは上の2つのボタンで切りかえる */
  view?: "baton" | "wish";
}) {
  const [pending, start] = useTransition();
  const [preset, setPreset] = useState<string>(BATON_PRESETS[0]);
  const [status, setStatus] = useState<"done" | "partial">("done");
  const [text, setText] = useState("");
  const [batonNote, setBatonNote] = useState<{ ok: boolean; text: string; story?: string } | null>(null);
  const [wish, setWish] = useState<NextWish | null>(null);
  const [wishNote, setWishNote] = useState<string | null>(null);
  const [own, setView] = useState<"baton" | "wish">("baton");
  const view = shown ?? own;

  const sendBaton = () =>
    start(async () => {
      const r = await batonAction(viewerId, { source, status, preset, text, photoChecked, missionId }).catch(() => ({ ok: false, text: "うまくいきませんでした。" }));
      setBatonNote(r);
    });
  const pickWish = (w: NextWish) =>
    start(async () => {
      const r = await nextWishAction(viewerId, w).catch(() => ({ ok: false, text: "うまくいきませんでした。" }));
      if (r.ok) setWish(w);
      setWishNote(r.text);
    });

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 text-left">
      {!shown && (
      <div className="grid shrink-0 grid-cols-2 gap-2" role="tablist">
        {(
          [
            ["baton", "🎽 次の人へバトン"],
            ["wish", "次はどうする？"],
          ] as const
        ).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={view === k} onClick={() => setView(k)} className={`min-h-12 rounded-2xl text-base font-bold ring-2 ${view === k ? "bg-ink text-white ring-ink" : "bg-card ring-ink/15"}`}>
            {label}
          </button>
        ))}
      </div>
      )}
      {view === "baton" ? (
        <section className="space-y-2 rounded-2xl bg-card p-3 ring-1 ring-ink/10" aria-label="次の人へバトン">
          <h3 className="text-base font-bold">同じ地域の次の人へ（任意・名前は出ません）</h3>
          {batonNote?.ok ? (
            <p className="rounded-2xl bg-ice-soft px-3 py-2 text-base" role="status">
              {batonNote.text}
              {batonNote.story && <span className="block">{batonNote.story}</span>}
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {BATON_PRESETS.map((p) => (
                  <button key={p} aria-pressed={preset === p} onClick={() => setPreset(p)} className={`min-h-11 rounded-full px-3 text-base font-bold ring-2 ${preset === p ? "bg-lamp text-white ring-lamp" : "bg-paper ring-ink/15"}`}>
                    {p}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(["done", "partial"] as const).map((st) => (
                  <button key={st} aria-pressed={status === st} onClick={() => setStatus(st)} className={`min-h-11 rounded-2xl text-base font-bold ring-2 ${status === st ? "bg-ink text-white ring-ink" : "bg-paper ring-ink/15"}`}>
                    {st === "done" ? "終わった" : "途中まで"}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={text}
                  maxLength={BATON_TEXT_MAX}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="ひとこと（なくてもOK）"
                  aria-label="バトンのひとこと（なくてもOK。名前・場所は書かない）"
                  className="min-h-12 min-w-0 flex-1 rounded-2xl bg-paper px-3 text-base ring-1 ring-ink/20"
                />
                <button disabled={pending} onClick={sendBaton} className="btn btn-lamp shrink-0 px-4 text-lg">
                  渡す
                </button>
              </div>
              <p className="text-sm text-ink-soft">名前・場所は書かないでね。</p>
              {batonNote && !batonNote.ok && <p className="rounded-2xl bg-warm px-3 py-2 text-base">{batonNote.text}</p>}
            </>
          )}
        </section>
      ) : (
        <section className="space-y-2 rounded-2xl bg-card p-3 ring-1 ring-ink/10" aria-label="次はどうしますか">
          <h3 className="text-lg font-bold">次はどうしますか？（任意・いつでも変えられます）</h3>
          <div className="grid grid-cols-2 gap-2">
            {NEXT_WISHES.map((w) => (
              <button key={w.id} disabled={pending} aria-pressed={wish === w.id} onClick={() => pickWish(w.id)} className={`min-h-14 rounded-2xl px-2 text-base font-bold leading-tight ring-2 ${wish === w.id ? "bg-lamp text-white ring-lamp" : "bg-paper ring-ink/15"}`}>
                {w.label}
              </button>
            ))}
          </div>
          {wishNote && <p className="text-base" role="status">{wishNote}</p>}
          <Link href={`/nakama${q}`} className="block text-center text-base font-bold underline">
            👥 なかまの画面を見る
          </Link>
        </section>
      )}
    </div>
  );
}
