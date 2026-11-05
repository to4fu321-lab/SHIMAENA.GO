"use client";

// 完了画面の「次の人へバトン」と「次は？」（spec v1.13）。どちらも任意で、押さなくても閉じてよい。
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
}: {
  viewerId: string;
  source: "own_house" | "help_house" | "road";
  missionId?: string;
  photoChecked?: boolean;
  q?: string;
}) {
  const [pending, start] = useTransition();
  const [preset, setPreset] = useState<string>(BATON_PRESETS[0]);
  const [status, setStatus] = useState<"done" | "partial">("done");
  const [text, setText] = useState("");
  const [batonNote, setBatonNote] = useState<{ ok: boolean; text: string; story?: string } | null>(null);
  const [wish, setWish] = useState<NextWish | null>(null);
  const [wishNote, setWishNote] = useState<string | null>(null);

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
    <div className="mt-3 space-y-3 text-left">
      <section className="space-y-2 rounded-2xl bg-card p-3 ring-1 ring-ink/10" aria-label="次の人へバトン">
        <h3 className="text-lg font-bold">🎽 次の人へバトン（任意）</h3>
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
              {(["done", "partial"] as const).map((s) => (
                <button key={s} aria-pressed={status === s} onClick={() => setStatus(s)} className={`min-h-11 rounded-2xl text-base font-bold ring-2 ${status === s ? "bg-ink text-white ring-ink" : "bg-paper ring-ink/15"}`}>
                  {s === "done" ? "終わった" : "途中まで"}
                </button>
              ))}
            </div>
            <input
              value={text}
              maxLength={BATON_TEXT_MAX}
              onChange={(e) => setText(e.target.value)}
              placeholder="ひとこと（なくてもOK。名前・場所は書かない）"
              aria-label="バトンのひとこと"
              className="min-h-12 w-full rounded-2xl bg-paper px-3 text-base ring-1 ring-ink/20"
            />
            {batonNote && !batonNote.ok && <p className="rounded-2xl bg-warm px-3 py-2 text-base">{batonNote.text}</p>}
            <button disabled={pending} onClick={sendBaton} className="btn btn-lamp w-full text-lg">
              バトンを渡す
            </button>
          </>
        )}
      </section>

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
    </div>
  );
}
