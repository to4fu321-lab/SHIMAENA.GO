"use client";

// 雪かきをお願いする（spec v1.20）の中身。頼み方（おまかせ／一緒にやる）と どこまで（玄関前／車庫前／道路まで）を、絵つきの大きなボタンで。
// 11/6 本人の指示: 分かりやすい UI（絵・アイコン）、雪かきが必要なエリアを写真で撮るとハンドフリーで指定できる（Claude が写真から「どこまで」を読む。写真は保存しない）。
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { askTodayAction, readAreaPhotoAction, registerHouseAction, updateHouseAction } from "@/app/ask/actions";
import type { ClearArea, HelpStyle } from "@/lib/types";
import { play } from "@/lib/sound/engine";
import { AreaArt, StyleArt } from "./AskArt";
import HousePanel from "./HousePanel";
import Pager from "./Pager";
import type { ClearPart, LatLng } from "@/lib/types";
import { shrink } from "./shrink";

const AREA_OPTIONS: [ClearArea, string][] = [
  ["entrance", "玄関前"],
  ["garage", "車庫前"],
  ["road", "道路まで"],
];

export default function AskScreen({
  viewerId,
  registered,
  baseNumber,
  style: initialStyle,
  area: initialArea,
  waiting,
  night,
  house,
  kikigakiHref,
}: {
  viewerId: string;
  registered: boolean;
  baseNumber?: number;
  style?: HelpStyle;
  area?: ClearArea;
  waiting: boolean;
  night: boolean;
  /** 家の場所のタブ（spec v1.72）。頼む家の人だけ */
  house?: { demo: boolean; address?: string; location: LatLng; parts?: ClearPart[]; note?: string };
  kikigakiHref?: string;
}) {
  const [tab, setTab] = useState(0);
  const router = useRouter();
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

  // spec v1.73（11/17 本人「最初は特に一緒に雪かきを手伝って欲しい人に。シマエナGOの人が来なくても大丈夫な人たちを集めたい」）:
  // 頼み方は「一緒に雪かき」だけ。えらばせずに、どういう頼み方かを絵と一文で伝える
  const togetherCard = (
    <div className="flex items-center gap-2 rounded-2xl bg-card px-2 py-1.5 ring-2 ring-lamp">
      <span className="w-24 shrink-0 short:w-20">
        <StyleArt style="together" active={false} />
      </span>
      <p className="min-w-0 text-sm leading-snug">
        <b className="block text-lg leading-tight">🤝 一緒に雪かき</b>
        近所の人が来られたら、一緒に。<span className="short:hidden">来られる人がいない日は、いつもどおり無理のない範囲で。</span>
      </p>
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
        <span>{reading ? "写真を読んでいます…" : <>写真で<span className="short:hidden">撮って</span>自動で決める（保存しない）</>}</span>
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
          <b>うちの雪かきに、近所の仲間を呼べます。</b>
          <span className="block text-sm text-ink-soft">手伝う側のままで大丈夫。10cm 積もった朝 6:30 に近所へ自動でお知らせ。</span>
        </p>
        {togetherCard}
        <section className="space-y-1.5">
          <h2 className="flex items-center text-base font-bold">どこまで雪かきが要りますか？</h2>
          {areaButtons}
        </section>
        {message}
        <button
          disabled={!area || pending}
          onClick={() => run(() => registerHouseAction(viewerId, "together", area!), "welcome")}
          className="btn btn-lamp btn-big mt-auto w-full disabled:opacity-40"
        >
          {pending ? "登録しています…" : !area ? "どこまでを選ぶと登録できます" : "一緒に雪かきする家として登録"}
        </button>
      </>
    );
  }

  // 前に「おまかせ」で登録した人は、「一緒に雪かき」に変えられる（いまは一緒にだけ）
  const changed = initialStyle !== "together" || area !== initialArea;
  const noAddress = Boolean(house && !house.demo && !house.address);
  const askPanel = (
    <>
      {noAddress ? (
        <button type="button" onClick={() => setTab(1)} className="rounded-2xl bg-warm px-3 py-1.5 text-left text-sm font-bold leading-snug ring-2 ring-lamp">
          📮 住所がまだです<span className="short:hidden">。来てくれる人が迷わないように</span>「家の場所」で入れてください ›
        </button>
      ) : (
        <p className="rounded-2xl bg-ice-soft px-3 py-1.5 text-sm font-bold leading-snug">
          🏠 拠点{baseNumber}として登録ずみ<span className="short:hidden">。10cm 以上積もった朝 6:30 に、近所へ自動でお知らせします</span>。
        </p>
      )}
      {togetherCard}
      <section className="space-y-1.5">
        <h2 className="flex items-center text-base font-bold">どこまで</h2>
        {areaButtons}
      </section>
      {changed && (
        <button disabled={pending} onClick={() => run(() => updateHouseAction(viewerId, "together", area!), "confirm")} className="btn btn-white min-h-11 w-full text-base">
          {area !== initialArea ? "この範囲で登録しなおす" : "「一緒に雪かき」にする"}
        </button>
      )}
      {message}
      {waiting ? (
        <p className="btn btn-big mt-auto w-full bg-ink/10 text-ink/70">いま雪かき待ちです（地図に出ています）</p>
      ) : night ? (
        <p className="btn btn-big mt-auto w-full bg-ink/10 text-ink/60">🌙 今日の分は 明日6時から頼めます</p>
      ) : (
        <button disabled={pending} onClick={() => run(() => askTodayAction(viewerId, "together"), "confirm")} className="btn btn-lamp btn-big mt-auto w-full">
          {pending ? "頼んでいます…" : "今日、一緒に雪かきを頼む"}
        </button>
      )}
    </>
  );
  if (!house) return askPanel;
  return (
    <Pager
      className="-mx-4"
      index={tab}
      onChange={setTab}
      tabs={[
        { key: "ask", label: "頼む" },
        { key: "house", label: "家の場所", badge: noAddress ? 1 : undefined },
        ...(kikigakiHref ? [{ key: "story", label: "思い出" }] : []),
      ]}
    >
      {askPanel}
      <HousePanel viewerId={viewerId} demo={house.demo} address={house.address} location={house.location} parts={house.parts} note={house.note} />
      {kikigakiHref && (
        // 雪の聞き書き（spec v1.26）: 頼む家の人が、隊長に雪の思い出を話す
        <>
          <p className="text-lg leading-snug">
            <b className="block">📖 雪の思い出を、隊長に話しませんか？</b>
            昔の雪の朝のこと、雪かきのコツ。声で答えられます。できたお話と絵は、あなたが「届ける」を選んだときだけ、雪かきに来てくれた人に届きます。
          </p>
          <Link href={kikigakiHref} className="btn btn-lamp btn-big mt-auto w-full">
            隊長に話す（聞き書き）
          </Link>
        </>
      )}
    </Pager>
  );
}
