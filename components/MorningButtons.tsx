"use client";

// 地図の下の3つのボタン: 行く／終わりました（写真）／人手が足りない。手袋でも片手で押せる大きさ。
import { useRef, useState, useTransition } from "react";
import { finishAction, goAction, manualFinishAction, shortAction, type ActionResult } from "@/app/map/actions";
import { openClear } from "./ClearWatcher";
import { shrink } from "./shrink";
import { play } from "@/lib/sound/engine";

// done: 自分の雪かきが終わったら、3つのボタンは畳んで「完了しました」の帯だけにする（11/6 本人の了承）
export default function MorningButtons({ viewerId, canAct, going, done = false, note }: { viewerId: string; canAct: boolean; going: boolean; done?: boolean; note?: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [confirmShort, setConfirmShort] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const run = (fn: () => Promise<ActionResult>, okSound?: "go") =>
    start(async () => {
      try {
        const r = await fn();
        setResult(r);
        if (r.clear) openClear(r.clear); // 雪かき完了の画面（閉じるまで残る）。ファンファーレはその画面で
        else if (!r.ok) play("error");
        else if (okSound) play(okSound);
      } catch (e) {
        setResult({ ok: false, text: e instanceof Error ? e.message : "うまくいきませんでした" });
        play("error");
      }
    });

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    play("shutter");
    run(async () => {
      const blob = await shrink(file);
      const fd = new FormData();
      fd.set("viewerId", viewerId);
      fd.set("photo", new File([blob], "done.jpg", { type: "image/jpeg" }));
      return finishAction(fd);
    });
  };

  const disabled = pending || !canAct;
  if (done) {
    return (
      <p className="rounded-2xl bg-ice-soft px-3 py-2 text-center text-base font-bold ring-1 ring-ice" role="status">
        {note ?? "✓ 今朝の雪かきは完了しました。おつかれさまでした。"}
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {note && <p className="text-center text-sm text-ink-soft">{note}</p>}
      {/* 手袋でも押せるように: 高さ 64px 以上、濃い色に白い文字。いちばん大事な「終わりました」だけ灯りオレンジ */}
      <div className="grid grid-cols-[1fr_1.45fr_1fr] gap-2">
        <button disabled={disabled || going} onClick={() => run(() => goAction(viewerId), "go")} className="btn btn-ink btn-big px-1">
          {going ? "行く ✓" : "行く"}
        </button>
        <button disabled={disabled} onClick={() => fileRef.current?.click()} className="btn btn-lamp btn-big px-1 text-base">
          {pending ? "確認中…" : "終わりました"}
        </button>
        <button
          disabled={disabled}
          onClick={() => setConfirmShort(true)}
          className="btn btn-white btn-big px-1 text-base"
          style={{ boxShadow: "inset 0 0 0 2px var(--alert)", color: "var(--alert)" }}
        >
          人手が
          <br />
          足りない
        </button>
      </div>
      {confirmShort && (
        <div className="rounded-2xl bg-alert-soft px-3 py-3 ring-1 ring-alert/40" role="alertdialog" aria-label="人手が足りない知らせを送りますか">
          <p className="text-base">近くの人に「人手が足りない」の知らせを送ります。よいですか？</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button onClick={() => setConfirmShort(false)} className="btn btn-white text-base">
              やめる
            </button>
            <button
              disabled={pending}
              onClick={() => {
                setConfirmShort(false);
                run(() => shortAction(viewerId));
              }}
              className="btn btn-alert text-base"
            >
              知らせを送る
            </button>
          </div>
        </div>
      )}
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
        <p className={`rounded-2xl px-3 py-2 text-base ring-1 ${result.ok ? "bg-ice-soft ring-ice" : "bg-warm ring-lamp/50"}`} role="status">
          {result.ok ? "✓ " : "！ "}
          {result.text}
        </p>
      )}
      {result && !result.ok && result.canManual && (
        <button disabled={pending} onClick={() => run(() => manualFinishAction(viewerId))} className="btn btn-white w-full text-base">
          それでも完了にする（写真なし・本人の報告）
        </button>
      )}
    </div>
  );
}
