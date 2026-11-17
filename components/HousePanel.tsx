"use client";

// 家の場所（spec v1.72）: 正確な住所・地図のピン・ほかに雪かきが要る所・目印。
// 住所と目印は、その家に「行く」を押して向かっている人だけに見える（地図は今までどおり 50m のマス）。
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { geocodeAction, saveHouseDetailAction } from "@/app/ask/actions";
import { ADDRESS_MAX, CLEAR_PARTS, NOTE_MAX } from "@/lib/house";
import { play } from "@/lib/sound/engine";
import type { ClearPart, LatLng } from "@/lib/types";
import PinAdjust from "./PinAdjust";

export default function HousePanel({
  viewerId,
  demo,
  address: initialAddress = "",
  location: initialLocation,
  parts: initialParts = [],
  note: initialNote = "",
}: {
  viewerId: string;
  /** デモの架空の人（住所・目印は入れられない） */
  demo: boolean;
  address?: string;
  location: LatLng;
  parts?: ClearPart[];
  note?: string;
}) {
  const router = useRouter();
  const [address, setAddress] = useState(initialAddress);
  const [location, setLocation] = useState<LatLng>(initialLocation);
  const [moved, setMoved] = useState(false);
  const [parts, setParts] = useState<ClearPart[]>(initialParts);
  const [note, setNote] = useState(initialNote);
  const [picking, setPicking] = useState<LatLng>();
  const [msg, setMsg] = useState<string>();
  const [pending, start] = useTransition();
  const [finding, setFinding] = useState(false);

  const toggle = (id: ClearPart) => setParts((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]));

  // 住所から地図を合わせる → 見つかったあたりで、ピンを家の上に合わせてもらう
  const find = async () => {
    setFinding(true);
    const r = await geocodeAction(viewerId, address).catch(() => ({ ok: false, text: "住所を探せませんでした。地図で合わせてください。", location: undefined }));
    setFinding(false);
    play(r.ok ? "confirm" : "error");
    setMsg(r.text);
    setPicking(r.location ?? location);
  };

  const changed =
    address !== initialAddress || note !== initialNote || moved || parts.length !== initialParts.length || parts.some((p) => !initialParts.includes(p));

  const save = () =>
    start(async () => {
      const r = await saveHouseDetailAction(viewerId, { address, note, parts, ...(moved ? { location } : {}) }).catch(() => ({
        ok: false,
        text: "うまくいきませんでした。電波のよい所で、もう一度押してください。",
      }));
      play(r.ok ? "confirm" : "error");
      setMsg(r.text);
      if (r.ok) setMoved(false);
      router.refresh();
    });

  return (
    <>
      {picking && (
        <PinAdjust
          start={picking}
          emoji="🏠"
          onDone={(at) => {
            setLocation(at);
            setMoved(true);
            setPicking(undefined);
            setMsg("ピンを家の上に合わせました。下の「登録する」で決まります。");
          }}
          onCancel={() => setPicking(undefined)}
        />
      )}
      <p className="text-sm font-bold leading-snug text-ink-soft">🔒 住所と目印は、<span className="short:hidden">雪かきに</span>向かう人だけに見えます<span className="short:hidden">。地図には 50m のマスでしか出ません</span>。</p>

      <section className="space-y-1 short:space-y-0.5">
        <label htmlFor="house-address" className="block text-base font-bold">
          📮 住所（部屋番号まで）
        </label>
        {demo ? (
          <p className="rounded-2xl bg-ink/5 px-3 py-1.5 text-sm leading-snug">
            {initialAddress && <b className="block text-base">見本: {initialAddress}</b>}
            デモの人の住所は変えられません<span className="short:hidden">（みんなで使う見本のため）。本番では、ここに住所を入れます</span>。
          </p>
        ) : (
          <div className="flex gap-2">
            <input
              id="house-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              maxLength={ADDRESS_MAX}
              autoComplete="street-address"
              placeholder="例: 札幌市中央区南1条西2丁目3-4 202"
              className="min-h-12 min-w-0 flex-1 rounded-2xl bg-card px-3 text-lg ring-2 short:min-h-11 ring-ink/15 focus:outline-none focus:ring-lamp"
            />
            <button type="button" onClick={() => void find()} disabled={finding || !address.trim()} className="btn btn-white min-h-12 shrink-0 px-3 text-base disabled:opacity-40">
              {finding ? "探し中…" : "地図へ"}
            </button>
          </div>
        )}
        <button type="button" onClick={() => setPicking(location)} className="btn btn-white min-h-11 w-full gap-2 text-base short:min-h-10">
          <span aria-hidden="true">📍</span>
          {moved ? "ピンを合わせました（もう一度合わせる）" : "地図で家の上にピンを合わせる"}
        </button>
      </section>

      <section className="space-y-1 short:space-y-0.5">
        <h2 className="text-base font-bold">❄ ほかに雪かきが要る所<span className="short:hidden">（いくつでも）</span></h2>
        <div className="flex flex-wrap gap-1.5 short:gap-1" role="group" aria-label="ほかに雪かきが要る所">
          {CLEAR_PARTS.map((p) => {
            const on = parts.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(p.id)}
                className={`min-h-11 rounded-full px-3 text-base font-bold ring-2 short:min-h-9 short:px-2.5 short:text-sm ${on ? "bg-lamp text-white ring-lamp" : "bg-card ring-ink/15"}`}
              >
                <span aria-hidden="true">{on ? "✓" : p.icon}</span> {p.label}
              </button>
            );
          })}
        </div>
      </section>

      {!demo && (
        <section className="space-y-1 short:space-y-0.5">
          <label htmlFor="house-note" className="block text-base font-bold">
            🪧 目印・気をつけること
          </label>
          <input
            id="house-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={NOTE_MAX}
            placeholder="例: 青い屋根・犬がいます・スコップは物置"
            className="min-h-12 w-full rounded-2xl bg-card px-3 text-lg ring-2 short:min-h-11 ring-ink/15 focus:outline-none focus:ring-lamp"
          />
        </section>
      )}

      {msg && <p className="rounded-2xl bg-card px-3 py-1.5 text-base font-bold leading-snug ring-1 ring-ink/10">{msg}</p>}
      <button disabled={!changed || pending} onClick={save} className="btn btn-lamp btn-big mt-auto w-full shrink-0 disabled:opacity-40 short:min-h-12">
        {pending ? "登録しています…" : changed ? "この内容で登録する" : "登録ずみ"}
      </button>
    </>
  );
}
