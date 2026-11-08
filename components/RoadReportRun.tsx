"use client";

// 道の危険を知らせる（11/4 本人の指示）: どんな危険か → 写真 → いまいる場所 → 地図に報告。
// 場所は写真を撮ったその場（道なので家とちがい丸めない）。報告した人の名前は地図にも通知にも出さない。
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { HAZARDS, type HazardId } from "@/lib/road/hazards";
import { TOWN } from "@/lib/town";
import { shrink } from "./shrink";
import { blurNote, blurPrivate } from "./blur";
import HazardIcon from "./HazardIcon";
import { play } from "@/lib/sound/engine";

// 地図（Leaflet）はブラウザでだけ読む
const PinAdjust = dynamic(() => import("./PinAdjust"), { ssr: false });

type Loc = { state: "wait" } | { state: "ok"; lat: number; lng: number; acc: number; adjusted?: boolean } | { state: "ng"; why: string };

export default function RoadReportRun({
  viewerId,
  pending,
  onSend,
  onQuit,
}: {
  viewerId: string;
  pending: boolean;
  onSend: (fd: FormData) => void;
  onQuit: () => void;
}) {
  const [hz, setHz] = useState<HazardId | null>(null);
  const [file, setFile] = useState<File | undefined>();
  const [preview, setPreview] = useState<string | null>(null);
  // 地図と隊長トークに出す小さい写真は、AI でナンバー・表札・顔・家をぼかしてから（spec v1.11）
  const [blurred, setBlurred] = useState<{ blob: Blob; note: string } | "wait" | null>(null);
  const [note, setNote] = useState("");
  const [loc, setLoc] = useState<Loc>({ state: "wait" });
  const [busy, setBusy] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const locate = () => {
    if (!navigator.geolocation) {
      setLoc({ state: "ng", why: "この端末では位置がわかりません" });
      return;
    }
    setLoc({ state: "wait" });
    navigator.geolocation.getCurrentPosition(
      (p) => setLoc({ state: "ok", lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy) }),
      () => setLoc({ state: "ng", why: "位置情報をオンにしてください" }),
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 30_000 },
    );
  };
  useEffect(() => {
    const t = setTimeout(locate, 0);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const pickId = useRef(0);
  const pickPhoto = (f: File) => {
    const my = ++pickId.current; // 撮り直したら、前の写真のぼかしの結果は使わない
    play("shutter");
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setBlurred("wait");
    shrink(f, 640)
      .then((small) => blurPrivate(small, viewerId))
      .then(({ blob, result }) => {
        if (my !== pickId.current) return;
        setBlurred({ blob, note: blurNote(result) });
        setPreview(URL.createObjectURL(blob));
      })
      .catch(() => my === pickId.current && setBlurred(null));
  };

  const ready = Boolean(hz && file && loc.state === "ok" && blurred && blurred !== "wait");
  const send = async () => {
    if (!hz || !file || loc.state !== "ok" || !blurred || blurred === "wait") return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("hazard", hz);
      fd.set("lat", String(loc.lat));
      fd.set("lng", String(loc.lng));
      if (note.trim()) fd.set("note", note.trim());
      fd.set("photo", new File([await shrink(file)], "road.jpg", { type: "image/jpeg" }));
      fd.set("thumb", new File([blurred.blob], "road-s.jpg", { type: "image/jpeg" }));
      onSend(fd);
    } finally {
      setBusy(false);
    }
  };

  // 押せないときは、何が足りないかをボタンの上に1行で
  const missing = !hz ? "危険の種類をえらんでください" : !file ? "写真を1枚撮ってください" : blurred === "wait" ? "AI がぼかしを入れています…" : !blurred ? "写真を撮り直してください" : loc.state !== "ok" ? "場所を調べています…" : "";
  const chosen = HAZARDS.find((h) => h.id === hz);

  return (
    <section className="run-in flex min-h-full flex-col gap-2 rounded-3xl bg-card p-3.5 shadow-md ring-2 ring-[#F5A524]" aria-label="道の危険を報告する">
      {/* 見出し: メガホン・題名・閉じる */}
      <div className="flex items-center gap-2">
        <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" className="shrink-0">
          <path d="M3 10 V14 H6 L14 19 V5 L6 10 Z" fill="#29445c" />
          <path d="M17 9 C18.5 10.5 18.5 13.5 17 15 M19.5 7 C22 9.5 22 14.5 19.5 17" fill="none" stroke="#E8792F" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <h2 className="min-w-0 flex-1 whitespace-nowrap text-lg font-bold leading-tight">道の危険を報告する</h2>
        <button onClick={onQuit} disabled={pending} aria-label="やめる" className="grid size-10 shrink-0 place-items-center rounded-full text-2xl text-ink-soft">
          ×
        </button>
      </div>

      {/* ① 種類: 警告標識のアイコンの大きなタイル */}
      <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="危険の種類">
        {HAZARDS.map((h) => {
          const on = hz === h.id;
          return (
            <button
              key={h.id}
              role="radio"
              aria-checked={on}
              aria-label={h.label}
              onClick={() => setHz(h.id)}
              className={`flex min-h-[78px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-2xl px-0.5 py-1 text-xs font-bold leading-tight transition-colors ${
                on ? "bg-[#FFF1D6] ring-[3px] ring-[#F5A524]" : "bg-paper ring-1 ring-ink/10"
              }`}
            >
              <HazardIcon id={h.id} size={42} />
              <span className="text-balance">{h.short}</span>
            </button>
          );
        })}
      </div>
      <p className="min-h-5 text-center text-sm font-bold" aria-live="polite">
        {chosen ? `⚠ ${chosen.label}` : "どんな危険？ えらんでください"}
      </p>

      {/* ② 写真（必須）と場所 */}
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => fileRef.current?.click()}
          aria-label={preview ? "写真を撮り直す" : "写真を撮る"}
          className={`relative grid size-[72px] shrink-0 place-items-center overflow-hidden rounded-2xl ring-2 ${preview ? "ring-ink/15" : hz ? "ready-pulse bg-[#FFF1D6] ring-[#F5A524]" : "bg-ice-soft ring-ice"}`}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="報告する写真" className="size-full object-cover" />
          ) : (
            <svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true" fill="none" stroke="#29445c" strokeWidth="2" strokeLinejoin="round">
              <path d="M4 8 H8 L10 5 H14 L16 8 H20 V19 H4 Z" />
              <circle cx="12" cy="13" r="3.5" />
            </svg>
          )}
        </button>
        <div className="min-w-0 flex-1 space-y-0.5 text-sm leading-snug" role="status">
          <button type="button" disabled={pending} onClick={() => fileRef.current?.click()} className="block font-bold underline">
            {preview ? "写真を撮り直す" : "写真を撮る（必須）"}
          </button>
          {loc.state === "wait" && <span className="block">📍 場所を調べています…</span>}
          {loc.state === "ok" && (
            <span className="flex flex-wrap items-center gap-x-2">
              <span>📍 {loc.adjusted ? "場所OK（地図で合わせた）" : `場所OK（±${loc.acc}m）`}</span>
              <button onClick={() => setAdjusting(true)} disabled={pending} className="font-bold text-lamp-deep underline">
                地図で直す
              </button>
            </span>
          )}
          {loc.state === "ng" && (
            <span className="block">
              📍 {loc.why}{" "}
              <button onClick={locate} className="font-bold underline">
                もう一度
              </button>{" "}
              <button onClick={() => setAdjusting(true)} disabled={pending} className="font-bold text-lamp-deep underline">
                地図で場所をえらぶ
              </button>
            </span>
          )}
          <span className="block text-xs text-ink-soft">
            {blurred === "wait" ? "🔍 AI がナンバー・表札・顔・家をぼかしています…" : blurred ? `🫥 ${blurred.note}` : file ? "ぼかしを入れられませんでした。撮り直してください" : "ナンバー・表札・顔・家は AI がぼかします"}
          </span>
        </div>
      </div>

      {/* ③ ひとこと（任意） */}
      <input
        value={note}
        onChange={(e) => setNote(e.target.value.slice(0, 60))}
        placeholder="補足があれば（任意）例: 交差点の角"
        aria-label="補足（任意）"
        className="min-h-12 w-full rounded-2xl bg-paper px-3 text-base ring-1 ring-ink/15"
      />

      {/* 報告する */}
      <div className="mt-auto space-y-1">
        {missing && <p className="text-center text-sm font-bold text-ink-soft">{missing}</p>}
        <button
          disabled={pending || busy || !ready}
          onClick={send}
          className={`btn btn-ink btn-big w-full gap-2 rounded-full ${ready && !pending ? "ready-pulse" : "opacity-45"}`}
        >
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
            <path d="M3 11 L21 3 L14 21 L11 13 Z" fill="currentColor" />
          </svg>
          {pending || busy ? "報告しています…" : "報告する"}
        </button>
      </div>

      {adjusting && loc.state !== "wait" && (
        <PinAdjust
          start={loc.state === "ok" ? [loc.lat, loc.lng] : TOWN.center}
          emoji={HAZARDS.find((h) => h.id === hz)?.emoji}
          onCancel={() => setAdjusting(false)}
          onDone={([lat, lng]) => {
            setLoc({ state: "ok", lat, lng, acc: loc.state === "ok" ? loc.acc : 0, adjusted: true });
            setAdjusting(false);
          }}
        />
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) pickPhoto(f);
          e.target.value = "";
        }}
      />
    </section>
  );
}
