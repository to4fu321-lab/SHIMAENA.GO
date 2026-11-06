"use client";

// 雪かきをお願いする（spec v1.20）の中身。頼み方（おまかせ／一緒にやる）と どこまで（玄関前／車庫前／道路まで）を、絵つきの大きなボタンで。
// 11/6 本人の指示: 分かりやすい UI（絵・アイコン）、雪かきが必要なエリアを写真で撮るとハンドフリーで指定できる（Claude が写真から「どこまで」を読む。写真は保存しない）。
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { askTodayAction, readAreaPhotoAction, registerHouseAction, updateHouseAction } from "@/app/ask/actions";
import type { ClearArea, HelpStyle } from "@/lib/types";
import { play } from "@/lib/sound/engine";
import { AreaArt, StyleArt } from "./AskArt";
import { shrink } from "./shrink";

const STYLE_OPTIONS: [HelpStyle, string, string][] = [
  ["omakase", "おまかせ", "家の人は雪かきできない"],
  ["together", "一緒にやる", "家の人も一緒に雪かき"],
];
const AREA_OPTIONS: [ClearArea, string][] = [
  ["entrance", "玄関前"],
  ["garage", "車庫前"],
  ["road", "道路まで"],
];

function Num({ n }: { n: number }) {
  return <span className="mr-1.5 inline-grid size-7 place-items-center rounded-full bg-ink text-base text-white">{n}</span>;
}

export default function AskScreen({
  viewerId,
  registered,
  baseNumber,
  style: initialStyle,
  area: initialArea,
  waiting,
  night,
}: {
  viewerId: string;
  registered: boolean;
  baseNumber?: number;
  style?: HelpStyle;
  area?: ClearArea;
  waiting: boolean;
  night: boolean;
}) {
  const router = useRouter();
  const [style, setStyle] = useState<HelpStyle | undefined>(initialStyle);
  const [area, setArea] = useState<ClearArea | undefined>(initialArea);
  const [msg, setMsg] = useState<string>();
  const [photoNote, setPhotoNote] = useState<string>();
  const [reading, setReading] = useState(false);
  const [pending, start] = useTransition();
  const camera = useRef<HTMLInputElement>(null);

  const run = (f: () => Promise<{ ok: boolean; text: string }>, sound: "confirm" | "welcome") =>
    start(async () => {
      const r = await f().catch(() => ({ ok: false, text: "うまくいきませんでした。電波のよい所で、もう一度押してください。" }));
      play(r.ok ? sound : "error");
      setMsg(r.text);
      router.refresh();
    });

  // 写真でどこまでを指定（ハンドフリー）: 撮る → 縮める → Claude が読む → ボタンが選ばれた状態に
  const onPhoto = async (file: File | undefined) => {
    if (!file || reading) return;
    play("shutter");
    setReading(true);
    setPhotoNote(undefined);
    try {
      const blob = await shrink(file, 1024);
      const fd = new FormData();
      fd.set("viewerId", viewerId);
      fd.set("photo", new File([blob], "area.jpg", { type: "image/jpeg" }));
      const r = await readAreaPhotoAction(fd);
      if (r.ok && r.area) {
        setArea(r.area);
        play("confirm");
        setPhotoNote(`📷 写真から「${AREA_OPTIONS.find(([k]) => k === r.area)?.[1]}」と読みました（${r.text}）。ちがえば押して直せます。`);
      } else {
        play("error");
        setPhotoNote(`📷 ${r.text}`);
      }
    } catch {
      play("error");
      setPhotoNote("📷 写真を送れませんでした。ボタンで選んでください。");
    } finally {
      setReading(false);
      if (camera.current) camera.current.value = "";
    }
  };

  const styleButtons = (
    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="家の人も一緒に雪かきしますか">
      {STYLE_OPTIONS.map(([v, label, sub]) => {
        const on = style === v;
        return (
          <button key={v} type="button" role="radio" aria-checked={on} onClick={() => setStyle(v)} className={`rounded-2xl px-2 pb-1.5 pt-1 text-left ring-2 ${on ? "bg-lamp text-white ring-lamp" : "bg-card ring-ink/15"}`}>
            <StyleArt style={v} active={on} />
            <span className="block text-lg font-bold leading-tight">{label}</span>
            <span className={`block text-xs font-bold ${on ? "text-white/90" : "text-ink-soft"}`}>{sub}</span>
          </button>
        );
      })}
    </div>
  );
  const areaButtons = (
    <>
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="どこまで雪かきが要りますか">
        {AREA_OPTIONS.map(([v, label]) => {
          const on = area === v;
          return (
            <button key={v} type="button" role="radio" aria-checked={on} onClick={() => setArea(v)} className={`rounded-2xl px-1.5 pb-1.5 pt-1 ring-2 ${on ? "bg-lamp text-white ring-lamp" : "bg-card ring-ink/15"}`}>
              <AreaArt area={v} active={on} />
              <span className="block text-base font-bold leading-tight">{label}</span>
            </button>
          );
        })}
      </div>
      <button type="button" onClick={() => camera.current?.click()} disabled={reading || pending} className="btn btn-white min-h-11 w-full gap-2 text-base short:min-h-10">
        <span aria-hidden="true">📷</span>
        {reading ? "写真を読んでいます…" : "写真を撮って自動で決める（保存しない）"}
      </button>
      <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void onPhoto(e.target.files?.[0])} />
      {photoNote && <p className="rounded-2xl bg-warm px-3 py-1.5 text-sm font-bold leading-snug">{photoNote}</p>}
    </>
  );
  const message = msg && <p className="whitespace-pre-line rounded-2xl bg-card px-3 py-2 text-base font-bold leading-snug ring-1 ring-ink/10">{msg}</p>;

  // まだ頼む家として登録していない人（手伝う側）: 登録すると、手伝うことも頼むこともできる
  if (!registered) {
    return (
      <>
        <p className="text-base leading-snug">
          <b>自分の家も、雪かき応援を頼める家にできます。</b>
          <span className="block text-sm text-ink-soft">手伝う側のままで大丈夫。10cm 積もった朝 6:30 に近所へ自動でお知らせ。</span>
        </p>
        <section className="space-y-1.5">
          <h2 className="flex items-center text-base font-bold">
            <Num n={1} />
            家の人も一緒に雪かきしますか？
          </h2>
          {styleButtons}
        </section>
        <section className="space-y-1.5">
          <h2 className="flex items-center text-base font-bold">
            <Num n={2} />
            どこまで雪かきが要りますか？
          </h2>
          {areaButtons}
        </section>
        {message}
        <button
          disabled={!style || !area || pending}
          onClick={() => run(() => registerHouseAction(viewerId, style!, area!), "welcome")}
          className="btn btn-lamp btn-big mt-auto w-full disabled:opacity-40"
        >
          {pending ? "登録しています…" : !style || !area ? "1と2を選ぶと登録できます" : "頼める家として登録する"}
        </button>
      </>
    );
  }

  const changed = style !== initialStyle || area !== initialArea;
  return (
    <>
      <p className="rounded-2xl bg-ice-soft px-3 py-1.5 text-sm font-bold leading-snug">
        🏠 拠点{baseNumber}として登録ずみ。10cm 以上積もった朝 6:30 に、近所へ自動でお知らせします。
      </p>
      <section className="space-y-1.5">
        <h2 className="flex items-center text-base font-bold">
          <Num n={1} />
          頼み方
        </h2>
        {styleButtons}
      </section>
      <section className="space-y-1.5">
        <h2 className="flex items-center text-base font-bold">
          <Num n={2} />
          どこまで
        </h2>
        {areaButtons}
      </section>
      {changed && (
        <button disabled={pending} onClick={() => run(() => updateHouseAction(viewerId, style!, area!), "confirm")} className="btn btn-white min-h-11 w-full text-base">
          この頼み方で登録しなおす
        </button>
      )}
      {message}
      {waiting ? (
        <p className="btn btn-big mt-auto w-full bg-ink/10 text-ink/70">いま雪かき待ちです（地図に出ています）</p>
      ) : night ? (
        <p className="btn btn-big mt-auto w-full bg-ink/10 text-ink/60">🌙 今日の分は 明日6時から頼めます</p>
      ) : (
        <button disabled={pending} onClick={() => run(() => askTodayAction(viewerId, style ?? "omakase"), "confirm")} className="btn btn-lamp btn-big mt-auto w-full">
          {pending ? "頼んでいます…" : `今日、${style === "together" ? "一緒に" : "おまかせで"}頼む`}
        </button>
      )}
    </>
  );
}
