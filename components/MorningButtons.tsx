"use client";

// 地図の下の3つのボタン: 行く／終わりました（写真）／人手が足りない。
import { useRef, useState, useTransition } from "react";
import { finishAction, goAction, manualFinishAction, shortAction, type ActionResult } from "@/app/map/actions";
import { openClear } from "./ClearWatcher";

/** スマホの写真はそのままだと大きいので、送る前に長辺 1280px の JPEG に縮める */
async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("写真を縮められませんでした"))), "image/jpeg", 0.85),
  );
}

export default function MorningButtons({ viewerId, canAct, going }: { viewerId: string; canAct: boolean; going: boolean }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      try {
        const r = await fn();
        setResult(r);
        if (r.clear) openClear(r.clear); // MISSION CLEAR（閉じるまで残る）
      } catch (e) {
        setResult({ ok: false, text: e instanceof Error ? e.message : "うまくいきませんでした" });
      }
    });

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    run(async () => {
      const blob = await shrink(file);
      const fd = new FormData();
      fd.set("viewerId", viewerId);
      fd.set("photo", new File([blob], "done.jpg", { type: "image/jpeg" }));
      return finishAction(fd);
    });
  };

  const disabled = pending || !canAct;
  return (
    <div className="space-y-2">
      {/* 手袋でも押せるように: 高さ 64px 以上、濃い色に白い文字 */}
      <div className="grid grid-cols-3 gap-2">
        <button
          disabled={disabled || going}
          onClick={() => run(() => goAction(viewerId))}
          className="min-h-16 rounded-2xl bg-ink text-xl font-bold text-white active:scale-95 disabled:opacity-40"
        >
          {going ? "行く ✓" : "行く"}
        </button>
        <button
          disabled={disabled}
          onClick={() => fileRef.current?.click()}
          className="min-h-16 rounded-2xl bg-neon px-0 text-lg font-bold leading-tight text-white active:scale-95 disabled:opacity-40"
        >
          {pending ? "確認中…" : "終わりました"}
        </button>
        <button
          disabled={disabled}
          onClick={() => run(() => shortAction(viewerId))}
          className="min-h-16 rounded-2xl bg-alert text-base font-bold leading-tight text-white active:scale-95 disabled:opacity-40"
        >
          人手が
          <br />
          足りない
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          void onPhoto(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {result && (
        <p className={`rounded-2xl px-3 py-2 text-base ${result.ok ? "bg-[#e9fbe7]" : "bg-[#fff4d6]"}`} role="status">
          {result.text}
        </p>
      )}
      {result && !result.ok && result.canManual && (
        <button
          disabled={pending}
          onClick={() => run(() => manualFinishAction(viewerId))}
          className="w-full rounded-2xl bg-white py-3 text-base font-bold text-ink ring-2 ring-ink/15 disabled:opacity-40"
        >
          それでも完了にする（写真なし・本人の報告）
        </button>
      )}
    </div>
  );
}
