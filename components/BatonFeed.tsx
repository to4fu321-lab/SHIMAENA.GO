"use client";

// この地域の雪かきバトン（spec v1.13 B）。なかまの画面と「つなぐ」の両方で使う。
// 11/6 本人の指摘「バトンが面白くなりそうなのに埋もれている」: 完了画面だけでなく、ここからいつでも渡せる（🎽 バトンを渡す）。
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { reactAction } from "@/app/nakama/actions";
import type { AreaView } from "@/lib/nakama/ops";
import { REACTION_LABEL, SOURCE_LABEL, type BatonSource } from "@/lib/nakama/rules";
import HelpButton from "./HelpPopup";
import NakamaAfter from "./NakamaAfter";
import { PagedList } from "./Pager";

const card = "rounded-3xl bg-card p-4 shadow-sm ring-1 ring-ink/10";
const SOURCES: BatonSource[] = ["own_house", "road"];

export default function BatonFeed({ viewerId, area, q = "" }: { viewerId: string; area: AreaView; q?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  const [writing, setWriting] = useState(false);
  const [source, setSource] = useState<BatonSource>("own_house");

  const react = (batonId: string, r: "thanks" | "continue") =>
    start(async () => {
      try {
        const res = await reactAction(viewerId, batonId, r);
        setNote(res.text);
      } catch {
        setNote("うまくいきませんでした。もう一度押してください。");
      }
      router.refresh();
    });

  if (writing) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <div className="flex shrink-0 items-center gap-2">
          <button onClick={() => setWriting(false)} className="btn btn-white min-h-11 px-3 text-base">
            ‹ 一覧
          </button>
          <p className="text-base font-bold">🎽 次の人へバトン</p>
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-2" role="radiogroup" aria-label="どこの雪かき">
          {SOURCES.map((s) => (
            <button key={s} role="radio" aria-checked={source === s} onClick={() => setSource(s)} className={`min-h-11 rounded-2xl text-base font-bold ring-2 ${source === s ? "bg-ink text-white ring-ink" : "bg-card ring-ink/15"}`}>
              {SOURCE_LABEL[s]}
            </button>
          ))}
        </div>
        <NakamaAfter
          key={source}
          viewerId={viewerId}
          source={source}
          q={q}
          view="baton"
          onDone={() => {
            setWriting(false);
            router.refresh();
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {/* 地域のいま: 今日の参加人数を主役に */}
      <div className="relative flex shrink-0 items-center gap-3 rounded-3xl bg-ink px-4 py-2.5 text-white shadow-md">
        <span className="text-3xl" aria-hidden="true">🎽</span>
        <p className="min-w-0 flex-1 leading-tight">
          <span className="block whitespace-nowrap text-sm font-bold text-white/85">この地域（約250m四方）の雪かき</span>
          <span className="block text-base font-bold">
            今日 <b className="text-3xl tabular-nums text-camellia">{area.people}</b> 人が参加
          </span>
        </p>
        {/* 「バトンとは？」の説明（ポップアップ。11/7）。右下の角に小さく置いて、文の幅は変えない */}
        <HelpButton topic="baton" light compact className="absolute bottom-2 right-3" />
      </div>
      {area.story && <p className="shrink-0 rounded-2xl bg-ice-soft px-3 py-2 text-base leading-snug">{area.story}</p>}
      {note && (
        <p className="shrink-0 rounded-2xl bg-warm px-3 py-1.5 text-base" role="status">
          {note}
        </p>
      )}
      <PagedList
        label="バトン"
        items={area.batons}
        empty={
          <div className="my-auto flex flex-col items-center gap-2 rounded-3xl border-2 border-dashed border-ink/15 px-4 py-8 text-center">
            <p className="text-lg font-bold">今日のバトンは、まだありません</p>
            <p className="text-base leading-snug text-ink-soft">雪かきをしたら「次の人へバトン」。同じ地域の次の人に、名前なしで届きます。</p>
          </div>
        }
        render={(b) => (
          <div key={b.id} className={`${card} flex flex-1 flex-col gap-2`}>
            <div className="flex flex-wrap items-center gap-1.5 text-sm font-bold">
              <span className="rounded-full bg-ice-soft px-2.5 py-0.5">{b.band}の活動者</span>
              <span className="rounded-full bg-paper px-2.5 py-0.5 ring-1 ring-ink/10">{b.where}</span>
              <span className={`rounded-full px-2.5 py-0.5 ${b.done ? "bg-camellia-soft" : "bg-warm"}`}>{b.done ? "終わった" : "途中まで"}</span>
              {b.photoChecked && <span className="rounded-full bg-paper px-2.5 py-0.5 ring-1 ring-ink/10">📷 確認済み</span>}
            </div>
            <p className="my-auto text-xl font-bold leading-snug">「{b.message}」</p>
            {b.own ? (
              <p className="mt-auto text-base text-ink-soft">あなたのバトン: ありがとう {b.thanks}・続きをやります {b.cont}</p>
            ) : (
              <div className="mt-auto grid grid-cols-2 gap-2">
                {(["thanks", "continue"] as const).map((r) => (
                  <button
                    key={r}
                    disabled={pending}
                    aria-pressed={b.mine === r}
                    onClick={() => react(b.id, r)}
                    className={`min-h-14 rounded-2xl px-2 text-base font-bold leading-tight ring-2 ${b.mine === r ? "bg-lamp text-white ring-lamp" : "bg-paper ring-ink/15"}`}
                  >
                    {r === "thanks" ? "🙏" : "💪"} {REACTION_LABEL[r]} {r === "thanks" ? b.thanks : b.cont}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      />
      <button onClick={() => setWriting(true)} className="btn btn-lamp btn-big w-full shrink-0 shadow-md">
        🎽 次の人へバトンを渡す
      </button>
      <p className="shrink-0 text-center text-xs text-ink-soft">名前と家の場所は出しません。</p>
    </div>
  );
}
