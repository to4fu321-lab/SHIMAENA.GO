"use client";

// 地図の下の3つのボタン: 行く／終わりました（写真）／人手が足りない。手袋でも片手で押せる大きさ。
// spec v1.59: 「終わりました」を押すと、次にすること（写真を1枚）を大きく出す（前は押しても画面が変わらず、写真が要ると分からなかった）。
// 「行く」を押したあとは、押せない灰色のボタンではなく「✓ 向かっています」の札にする。
import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { finishAction, goAction, manualFinishAction, shortAction, type ActionResult } from "@/app/map/actions";
import { primeCaptainVoice } from "./ChatTools";
import { openClear } from "./ClearWatcher";
import Mascot from "./Mascot";
import { shrink } from "./shrink";
import { play } from "@/lib/sound/engine";

/** デモの見本の写真（雪かきのあとの玄関前）。毎回1点だけ変えて、同じ写真として断られないようにする */
async function samplePhoto(): Promise<File> {
  const img = await createImageBitmap(await (await fetch("/demo/entrance.jpg")).blob());
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext("2d")!;
  g.drawImage(img, 0, 0);
  g.fillStyle = `rgb(${Math.floor(Math.random() * 255)},${Math.floor(Math.random() * 255)},${Math.floor(Math.random() * 255)})`;
  g.fillRect(Math.floor(Math.random() * c.width), Math.floor(Math.random() * c.height), 2, 2);
  const blob = await new Promise<Blob>((ok, ng) => c.toBlob((b) => (b ? ok(b) : ng(new Error("見本の写真を用意できませんでした"))), "image/jpeg", 0.9));
  return new File([blob], `entrance-${Date.now()}.jpg`, { type: "image/jpeg" });
}

// done: 自分の雪かきが終わったら、3つのボタンは畳んで「完了しました」の帯だけにする（11/6 本人の了承）
export default function MorningButtons({ viewerId, canAct, going, done = false, note }: { viewerId: string; canAct: boolean; going: boolean; done?: boolean; note?: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [confirmShort, setConfirmShort] = useState(false);
  const [finishing, setFinishing] = useState(false); // 完了の確認中（時間がかかるので、待っていることを文で見せる）
  const [photoOpen, setPhotoOpen] = useState(false); // 「終わりました」のあとの「写真を1枚」の紙
  const [waited, setWaited] = useState(0); // 確かめている秒数
  const cameraRef = useRef<HTMLInputElement>(null);
  const pickRef = useRef<HTMLInputElement>(null);
  // デモの架空の人（?as=h3）: 手元に雪の写真がない人のために、見本の写真でも試せる
  const demo = /^[hr]\d+$/.test(viewerId);

  const checking = pending && finishing;
  useEffect(() => {
    if (!checking) return;
    const t0 = Date.now();
    const t = setInterval(() => setWaited(Math.round((Date.now() - t0) / 1000)), 1000);
    return () => {
      clearInterval(t);
      setWaited(0);
    };
  }, [checking]);

  const run = (fn: () => Promise<ActionResult>, okSound?: "go", finish = false) => {
    // 完了のあとに隊長が声で言う（spec v1.61）: iPhone は「押した」中で一度鳴らしておかないと、あとから声を出せない
    if (finish) primeCaptainVoice();
    setFinishing(finish);
    start(async () => {
      try {
        const r = await fn();
        setResult(r);
        if (r.clear) {
          setPhotoOpen(false);
          openClear(r.clear); // 完了の知らせ。ファンファーレはそこで
        } else if (!r.ok) play("error");
        else if (okSound) play(okSound);
      } catch (e) {
        setResult({ ok: false, text: e instanceof Error ? e.message : "うまくいきませんでした" });
        play("error");
      }
    });
  };

  const onPhoto = async (file: File | undefined | Promise<File>) => {
    if (!file) return;
    play("shutter");
    setResult(null);
    run(async () => {
      const blob = await shrink(await file);
      const fd = new FormData();
      fd.set("viewerId", viewerId);
      fd.set("photo", new File([blob], "done.jpg", { type: "image/jpeg" }));
      return finishAction(fd);
    }, undefined, true);
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
        {going ? (
          // もう「行く」を押した: 押せない灰色のボタンではなく、いまの状態の札にする
          <p className="grid min-h-16 place-items-center rounded-[18px] bg-ice-soft px-1 text-center text-base font-bold leading-tight ring-2 ring-ice" role="status" aria-label="向かっています">
            <span className="max-[380px]:text-sm">
              <span className="whitespace-nowrap">✓ 向かって</span>
              <br />
              います
            </span>
          </p>
        ) : (
          <button disabled={disabled} onClick={() => run(() => goAction(viewerId), "go")} className="btn btn-ink btn-big px-1">
            行く
          </button>
        )}
        <button
          disabled={disabled}
          onClick={() => {
            play("tap");
            primeCaptainVoice(); // 完了の声のために（上の run と同じ）
            setResult(null);
            setPhotoOpen(true);
          }}
          aria-haspopup="dialog"
          className="btn btn-lamp btn-big px-1 text-base"
        >
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
      {/* カメラ（capture つき）と、写真をえらぶ（アルバム・パソコンのファイル）。紙が閉じていても置いておく（撮影ステージが使う） */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          void onPhoto(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={pickRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void onPhoto(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {/* 紙を開かずに写真が来たとき（撮影ステージ）の待ちと結果 */}
      {!photoOpen && checking && (
        <p className="rounded-2xl bg-ice-soft px-3 py-2 text-base ring-1 ring-ice" role="status">
          確かめています。1分ほどかかることがあります。このままお待ちください。
        </p>
      )}
      {!photoOpen && !checking && result && (
        <p className={`rounded-2xl px-3 py-2 text-base ring-1 ${result.ok ? "bg-ice-soft ring-ice" : "bg-warm ring-lamp/50"}`} role="status">
          {result.ok ? "✓ " : "！ "}
          {result.text}
        </p>
      )}
      {!photoOpen && !checking && result && !result.ok && result.canManual && (
        <button disabled={pending} onClick={() => run(() => manualFinishAction(viewerId), undefined, true)} className="btn btn-white w-full text-base">
          それでも完了にする（写真なし・本人の報告）
        </button>
      )}

      {photoOpen && createPortal(
        // 「終わりました」のあと: 次にすることを1つ、大きく（下から出る紙）。地図の下のシートの外（body）に出す
        <div className="fixed inset-0 z-[1300] flex items-end justify-center bg-ink/55 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="終わりの写真を1枚">
          <div className="w-full max-w-md space-y-3 rounded-t-3xl bg-paper px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-4 text-ink shadow-2xl" style={{ animation: "photo-rise 0.22s ease-out both" }}>
            {checking ? (
              <div className="space-y-3 py-2 text-center" role="status">
                <Mascot size={88} className="captain-idle mx-auto" />
                <p className="text-2xl font-bold leading-snug">写真を確かめています…</p>
                <p className="text-base leading-snug">隊長（Claude）が、通れるようになったかを見ています。30〜60秒かかります。このままお待ちください。</p>
                <p className="mx-auto h-2.5 w-full overflow-hidden rounded-full bg-ice-soft" aria-hidden="true">
                  <span className="block h-full rounded-full bg-ice transition-[width] duration-1000" style={{ width: `${Math.min(96, 6 + waited * 1.5)}%` }} />
                </p>
                <p className="text-base font-bold tabular-nums text-ink-soft">{waited}秒</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-lamp text-3xl" aria-hidden="true">
                    📷
                  </span>
                  <div className="min-w-0 leading-tight">
                    <h2 className="whitespace-nowrap text-2xl font-bold max-[380px]:text-xl">さいごに、写真を1枚</h2>
                    <p className="mt-0.5 text-base">玄関前から道路のほうを撮ってください。</p>
                  </div>
                </div>
                {result && !result.ok && (
                  <p className="rounded-2xl bg-warm px-3 py-2 text-base ring-1 ring-lamp/50" role="alert">
                    ！ {result.text}
                  </p>
                )}
                <button type="button" disabled={pending} onClick={() => cameraRef.current?.click()} className="btn btn-lamp btn-big w-full text-xl">
                  📷 カメラで撮る
                </button>
                <div className={`grid gap-2 ${demo ? "grid-cols-2" : ""}`}>
                  <button type="button" disabled={pending} onClick={() => pickRef.current?.click()} className="btn btn-white min-h-14 px-2 text-base leading-tight">
                    写真をえらぶ
                  </button>
                  {demo && (
                    <button type="button" disabled={pending} onClick={() => void onPhoto(samplePhoto())} className="btn btn-white min-h-14 px-2 text-base leading-tight">
                      <span>
                        見本の写真で試す
                        <span className="block text-xs font-normal text-ink-soft">デモ用</span>
                      </span>
                    </button>
                  )}
                </div>
                {result && !result.ok && result.canManual && (
                  <button type="button" disabled={pending} onClick={() => run(() => manualFinishAction(viewerId), undefined, true)} className="btn btn-white w-full text-base">
                    それでも完了にする（写真なし・本人の報告）
                  </button>
                )}
                <button type="button" disabled={pending} onClick={() => setPhotoOpen(false)} className="min-h-12 w-full text-base font-bold text-ink-soft" data-sound="back">
                  もどる（まだ終わっていない）
                </button>
              </>
            )}
          </div>
          <style>{`@keyframes photo-rise { from { transform: translateY(24px); opacity: 0 } to { transform: none; opacity: 1 } }`}</style>
        </div>,
        document.body,
      )}
    </div>
  );
}
