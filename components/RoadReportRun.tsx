"use client";

// 道の危険を知らせる（11/4 本人の指示）: どんな危険か → 写真 → いまいる場所 → 地図に報告。
// 場所は写真を撮ったその場（道なので家とちがい丸めない）。報告した人の名前は地図にも通知にも出さない。
import { useEffect, useRef, useState } from "react";
import { HAZARDS, type HazardId } from "@/lib/road/hazards";
import { shrink } from "./shrink";

type Loc = { state: "wait" } | { state: "ok"; lat: number; lng: number; acc: number } | { state: "ng"; why: string };

export default function RoadReportRun({
  pending,
  onSend,
  onQuit,
}: {
  pending: boolean;
  onSend: (fd: FormData) => void;
  onQuit: () => void;
}) {
  const [hz, setHz] = useState<HazardId | null>(null);
  const [file, setFile] = useState<File | undefined>();
  const [preview, setPreview] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [loc, setLoc] = useState<Loc>({ state: "wait" });
  const [busy, setBusy] = useState(false);
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

  const ready = Boolean(hz && file && loc.state === "ok");
  const send = async () => {
    if (!hz || !file || loc.state !== "ok") return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("hazard", hz);
      fd.set("lat", String(loc.lat));
      fd.set("lng", String(loc.lng));
      if (note.trim()) fd.set("note", note.trim());
      fd.set("photo", new File([await shrink(file)], "road.jpg", { type: "image/jpeg" }));
      fd.set("thumb", new File([await shrink(file, 640)], "road-s.jpg", { type: "image/jpeg" }));
      onSend(fd);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="run-in space-y-2 rounded-3xl bg-card p-4 shadow-md ring-2 ring-lamp" aria-label="道の危険を知らせる">
      <div className="flex items-center gap-2">
        <span className="blink size-3 shrink-0 rounded-full bg-lamp" aria-label="ミッション中" />
        <h2 className="text-xl font-bold leading-tight">道の危険を知らせる</h2>
        <button onClick={onQuit} disabled={pending} className="ml-auto min-h-10 shrink-0 whitespace-nowrap px-2 text-sm text-ink-soft underline">
          やめる
        </button>
      </div>

      <p className="text-sm font-bold">① どんな危険？</p>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="危険の種類">
        {HAZARDS.map((h, i) => (
          <button
            key={h.id}
            role="radio"
            aria-checked={hz === h.id}
            onClick={() => setHz(h.id)}
            className={`flex min-h-11 items-center gap-1.5 rounded-2xl px-2 text-left text-sm font-bold leading-tight ring-2 ${
              hz === h.id ? "bg-ink text-white ring-ink" : "bg-paper ring-ink/10"
            } ${i === HAZARDS.length - 1 ? "col-span-2 justify-center" : ""}`}
          >
            <span className="text-xl" aria-hidden="true">{h.emoji}</span>
            {h.label}
          </button>
        ))}
      </div>

      <p className="text-sm font-bold">② その場で写真と場所</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => fileRef.current?.click()}
          aria-label={preview ? "写真を撮り直す" : "写真を撮る"}
          className={`grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl text-3xl ring-2 ${preview ? "ring-ink/15" : hz ? "ready-pulse bg-lamp/15 ring-lamp" : "bg-ice-soft ring-ice"}`}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="報告する写真" className="size-full object-cover" />
          ) : (
            <span aria-hidden="true">📷</span>
          )}
        </button>
        <div className="min-w-0 flex-1 rounded-2xl bg-paper px-3 py-2 text-sm" role="status">
          {loc.state === "wait" && <span>📍 場所を調べています…</span>}
          {loc.state === "ok" && (
            <span className="font-bold">📍 場所OK（誤差 約{loc.acc}m）</span>
          )}
          {loc.state === "ng" && (
            <span>
              📍 {loc.why}{" "}
              <button onClick={locate} className="font-bold underline">
                もう一度
              </button>
            </span>
          )}
          <span className="block text-xs text-ink-soft">人の顔や車のナンバーが写らないように</span>
        </div>
      </div>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value.slice(0, 60))}
        placeholder="ひとこと（任意）例: 交差点の角がつるつる"
        aria-label="ひとこと"
        className="min-h-12 w-full rounded-2xl bg-paper px-3 text-base ring-1 ring-ink/15"
      />
      <button
        disabled={pending || busy || !ready}
        onClick={send}
        className={`btn btn-lamp w-full rounded-full text-xl ${ready && !pending ? "ready-pulse" : "opacity-50"}`}
      >
        {pending || busy ? "報告中…" : ready ? "地図に報告してクリア！" : !hz ? "危険の種類をえらんでね" : !file ? "写真を撮ってね" : "場所を調べています…"}
      </button>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            setFile(f);
            setPreview(URL.createObjectURL(f));
          }
          e.target.value = "";
        }}
      />
    </section>
  );
}
