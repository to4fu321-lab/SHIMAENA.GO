"use client";

// 雪かきを頼む（spec v1.20）の中身。頼み方（おまかせ／一緒にやる）は、登録でも、今日頼むときでも分けられる。
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { askTodayAction, registerHouseAction, updateHouseAction } from "@/app/ask/actions";
import type { ClearArea, HelpStyle } from "@/lib/types";
import { play } from "@/lib/sound/engine";

const STYLE_OPTIONS: [HelpStyle, string, string][] = [
  ["omakase", "おまかせ", "家の人は雪かきできない"],
  ["together", "一緒にやる", "家の人も一緒に雪かき"],
];
const AREA_OPTIONS: [ClearArea, string][] = [
  ["entrance", "玄関前"],
  ["garage", "車庫前"],
  ["road", "道路まで"],
];

function Choice<T extends string>({ options, value, onChange, cols }: { options: [T, string, string?][]; value?: T; onChange: (v: T) => void; cols: string }) {
  return (
    <div className={`grid gap-2 ${cols}`}>
      {options.map(([v, label, sub]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={`min-h-14 rounded-2xl px-2 py-1 text-lg font-bold leading-tight ring-2 ${value === v ? "bg-lamp text-white ring-lamp" : "bg-card ring-ink/15"}`}
        >
          {label}
          {sub && <span className={`block text-xs font-bold ${value === v ? "text-white/90" : "text-ink-soft"}`}>{sub}</span>}
        </button>
      ))}
    </div>
  );
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
  const [pending, start] = useTransition();

  const run = (f: () => Promise<{ ok: boolean; text: string }>, sound: "confirm" | "welcome") =>
    start(async () => {
      const r = await f().catch(() => ({ ok: false, text: "うまくいきませんでした。電波のよい所で、もう一度押してください。" }));
      play(r.ok ? sound : "error");
      setMsg(r.text);
      router.refresh();
    });

  // まだ頼む家として登録していない人（手伝う側）: 登録すると、手伝うことも頼むこともできる
  if (!registered) {
    return (
      <>
        <p className="text-lg font-bold leading-snug">自分の家も「雪かき応援を頼める家」にできます。手伝う側のまま、両方できます。</p>
        <p className="text-base leading-snug text-ink-soft">10cm 以上積もった朝 6:30 に、近所の人へ自動でお知らせが届きます。</p>
        <section className="space-y-2">
          <h2 className="text-lg font-bold">家の人も一緒に雪かきしますか？</h2>
          <Choice options={STYLE_OPTIONS} value={style} onChange={setStyle} cols="grid-cols-2" />
        </section>
        <section className="space-y-2">
          <h2 className="text-lg font-bold">どこまで雪かきが要りますか？</h2>
          <Choice options={AREA_OPTIONS} value={area} onChange={setArea} cols="grid-cols-3" />
        </section>
        {msg && <p className="rounded-2xl bg-card px-3 py-2 text-base font-bold ring-1 ring-ink/10">{msg}</p>}
        <button
          disabled={!style || !area || pending}
          onClick={() => run(() => registerHouseAction(viewerId, style!, area!), "welcome")}
          className="btn btn-lamp btn-big mt-auto w-full disabled:opacity-40"
        >
          {pending ? "登録しています…" : "頼める家として登録する"}
        </button>
      </>
    );
  }

  const changed = style !== initialStyle || area !== initialArea;
  return (
    <>
      <p className="rounded-2xl bg-ice-soft px-3 py-2 text-base font-bold leading-snug">
        拠点{baseNumber}として登録ずみ。10cm 以上積もった朝 6:30 に、近所へ自動でお知らせします。
      </p>
      <section className="space-y-2">
        <h2 className="text-lg font-bold">頼み方</h2>
        <Choice options={STYLE_OPTIONS} value={style} onChange={setStyle} cols="grid-cols-2" />
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-bold">どこまで</h2>
        <Choice options={AREA_OPTIONS} value={area} onChange={setArea} cols="grid-cols-3" />
      </section>
      {changed && (
        <button disabled={pending} onClick={() => run(() => updateHouseAction(viewerId, style!, area!), "confirm")} className="btn btn-white w-full text-lg">
          この頼み方で登録しなおす
        </button>
      )}
      {msg && <p className="whitespace-pre-line rounded-2xl bg-card px-3 py-2 text-base font-bold leading-snug ring-1 ring-ink/10">{msg}</p>}
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
