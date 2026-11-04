"use client";

// ミッション実施中の画面: タイマーで進みを見せ、写真やひとことで報告してからクリアにする。
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { SoloMission } from "@/lib/solo/missions";
import { shrink } from "./shrink";

const HINT: Record<string, string> = {
  patrol: "例: 角の道が凍っていた",
  report_snow: "例: 公園前の歩道に吹きだまり",
  check_spot: "例: 公園の雪捨て場はまだ空いている",
  own_house: "例: 玄関前を開けた",
  find_help: "例: 2軒先の玄関が埋まっていた",
  check_area: "例: 北の通りがまだ雪のまま",
  report_online: "例: 家の前は30cmくらい",
  find_online: "例: あと1人の家を1軒見つけた",
};
const MAP_KINDS = ["check_area", "find_online", "find_help"];

export default function MissionRun({
  mission,
  startedAt,
  pending,
  q,
  before,
  onBefore,
  onReport,
  onQuit,
}: {
  mission: SoloMission;
  startedAt: number;
  pending: boolean;
  q: string;
  /** Before 写真（自分の家の雪かき）。data URL */
  before?: string;
  onBefore?: (dataUrl: string) => void;
  onReport: (file: File | undefined, note: string) => void;
  onQuit: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [file, setFile] = useState<File | undefined>();
  const [preview, setPreview] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const shotFor = useRef<"before" | "after">("after");
  const [busyShot, setBusyShot] = useState(false);
  const snap = (which: "before" | "after") => {
    shotFor.current = which;
    fileRef.current?.click();
  };

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const sec = Math.max(0, Math.floor((now - startedAt) / 1000));
  const goal = mission.minutes * 60;
  const pct = Math.min(100, (sec / goal) * 100);
  const reached = sec >= goal;
  const mmss = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
  const canPhoto = mission.photo === "optional";
  const ba = Boolean(mission.beforeAfter);
  const ready = ba ? Boolean(before && file) : Boolean(file) || note.trim().length > 0;

  return (
    <section className="run-in min-h-full space-y-2 rounded-3xl bg-card p-4 shadow-md ring-2 ring-lamp" aria-label="ミッション中">
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 rounded-full bg-lamp px-3 py-0.5 text-sm font-bold text-white">
          <span className="blink size-2 rounded-full bg-white" aria-hidden="true" />
          ミッション中
        </span>
        <button onClick={onQuit} disabled={pending} className="ml-auto min-h-10 px-2 text-sm text-ink-soft underline">
          やめる
        </button>
      </div>
      <h2 className="text-xl font-bold leading-tight">{mission.label}</h2>

      {ba ? (
        <>
      {/* 自分の家の雪かき: 時間は自由。Before → 雪かき → After */}
      <div className="flex items-center gap-3 rounded-2xl bg-paper px-3 py-2">
        <b className="text-3xl tabular-nums" aria-label={`経過 ${mmss}`}>{mmss}</b>
        <span className="text-sm font-bold leading-snug text-ink-soft">時間は自由。<br />終わるまでやろう！</span>
      </div>
      <p className="text-base font-bold">
        {!before ? "① まずは今の雪を撮ろう（積もった姿を記録）" : !file ? "② 終わったら、キレイになった所を撮ろう" : "③ 報告してクリア！"}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {(["before", "after"] as const).map((w) => {
          const src = w === "before" ? before : preview;
          const enabled = w === "before" || Boolean(before);
          const next = w === "before" ? !before : Boolean(before) && !file;
          return (
            <button
              key={w}
              type="button"
              disabled={pending || busyShot || !enabled}
              onClick={() => snap(w)}
              aria-label={`${w === "before" ? "Before" : "After"} の写真を${src ? "撮り直す" : "撮る"}`}
              className={`relative aspect-[4/3] overflow-hidden rounded-2xl ring-2 ${next ? "ready-pulse bg-lamp/15 ring-lamp" : "bg-paper ring-ink/15"} disabled:opacity-40`}
            >
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt="" className="size-full object-cover" />
              ) : (
                <span className="grid size-full place-items-center text-3xl" aria-hidden="true">📷</span>
              )}
              <span className={`absolute left-1.5 top-1.5 rounded-full px-2 text-sm font-bold text-white ${w === "before" ? "bg-ink" : "bg-lamp"}`}>
                {w === "before" ? "BEFORE" : "AFTER"}
              </span>
            </button>
          );
        })}
      </div>
      <button
        disabled={pending || !ready}
        onClick={() => onReport(file, note.trim())}
        className={`btn btn-lamp w-full whitespace-nowrap rounded-full text-lg ${ready && !pending ? "ready-pulse" : "opacity-50"}`}
      >
        {pending ? "報告中…" : ready ? "報告してクリア！" : !before ? "Before を撮ろう" : "終わったら After を撮ろう"}
      </button>

        </>
      ) : (
        <>
      {/* ① やる: タイマー */}
      <div className="rounded-2xl bg-paper px-3 py-2">
        <div className="flex items-center gap-3">
          <b className="text-3xl tabular-nums" aria-label={`経過 ${mmss}`}>{mmss}</b>
          <div className="flex-1">
            <span className="block h-3 overflow-hidden rounded-full bg-white ring-1 ring-ink/10">
              <span className="block h-full rounded-full bg-ice transition-[width] duration-1000" style={{ width: `${Math.max(pct, 2)}%` }} />
            </span>
            <span className="mt-0.5 block text-right text-sm font-bold text-ink-soft">
              {reached ? "⏰ 目標達成！報告しよう" : `目標 ${mission.minutes}分`}
            </span>
          </div>
        </div>
        <p className="text-sm leading-snug">
          ① {mission.description}
          {MAP_KINDS.includes(mission.kind) && (
            <Link href={`/map${q}`} className="ml-1 font-bold underline">
              🗺️ 地図
            </Link>
          )}
        </p>
      </div>

      {/* ② 報告 */}
      <p className="text-sm font-bold">② {canPhoto ? "写真かひとことで報告" : "ひとことで報告"}</p>
      <div className="flex items-center gap-2">
        {canPhoto && (
          <button
            type="button"
            disabled={pending}
            onClick={() => fileRef.current?.click()}
            aria-label={preview ? "写真を撮り直す" : "写真を撮る"}
            className="relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-ice-soft text-3xl ring-1 ring-ice"
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="報告する写真" className="size-full object-cover" />
            ) : (
              <span aria-hidden="true">📷</span>
            )}
          </button>
        )}
        <input
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 60))}
          placeholder={HINT[mission.kind] ?? "ひとこと"}
          aria-label="ひとこと報告"
          className="min-h-14 min-w-0 flex-1 rounded-2xl bg-paper px-3 text-base ring-1 ring-ink/15"
        />
      </div>
      <button
        disabled={pending || !ready}
        onClick={() => onReport(file, note.trim())}
        className={`btn btn-lamp w-full whitespace-nowrap rounded-full text-lg ${ready && !pending ? "ready-pulse" : "opacity-50"}`}
      >
        {pending ? "報告中…" : ready ? "報告してクリア！" : canPhoto ? "写真かひとことを入れてね" : "ひとことを入れてね"}
      </button>

        </>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f && ba && shotFor.current === "before") {
            setBusyShot(true);
            shrink(f)
              .then(
                (blob) =>
                  new Promise<string>((resolve) => {
                    const r = new FileReader();
                    r.onload = () => resolve(String(r.result));
                    r.readAsDataURL(blob);
                  }),
              )
              .then((d) => onBefore?.(d))
              .finally(() => setBusyShot(false));
          } else if (f) {
            setFile(f);
            setPreview(URL.createObjectURL(f));
          }
          e.target.value = "";
        }}
      />
    </section>
  );
}
