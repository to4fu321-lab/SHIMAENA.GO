"use client";

// カード図鑑の「カード」パネル: 1枚ずつ ‹ › で見る（縦に並べず、1画面に収める）
import { PagedList } from "./Pager";
import type { Card } from "@/lib/types";

export default function CardBookCards({ cards }: { cards: Card[] }) {
  return (
    <PagedList
      label="もらったカード"
      items={cards}
      empty={
        <p className="rounded-2xl bg-card p-4 text-base shadow-sm ring-1 ring-ink/10">
          雪の朝に動くと、その時だけのカードがここに増えていきます。二度と同じカードは発行されません。
        </p>
      }
      render={(c) => (
        <div key={c.id} className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl bg-card shadow-sm ring-1 ring-ink/10">
          {/* 表面（SVG。レアはホログラムが動く）。SVG なので next/image は使わない */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/cards/${c.id}/front.svg`} alt={`${c.designName} のカード`} className="min-h-0 w-full flex-1 object-contain pt-2" />
          <div className="shrink-0 space-y-1 px-3 pb-3 pt-2">
            <p className="truncate text-lg font-bold">
              {c.designName} <span className="text-sm font-normal text-ink-soft">{c.designNameEn}</span>
            </p>
            <p className="truncate text-sm text-ink-soft">
              {c.rarityLabel} {"★".repeat(c.stars)} ・ No.{String(c.serial).padStart(3, "0")}/{c.issuedCount} ・ 排雪 {c.snowKg}kg（{c.snowKgComparison}）
            </p>
            <div className="grid grid-cols-3 gap-2 pt-1">
              <a className="btn btn-ink min-h-11 px-1 text-sm" href={`/api/cards/${c.id}/back.png`}>
                裏面
              </a>
              <a className="btn btn-white min-h-11 px-1 text-sm" href={`/api/cards/${c.id}/front.png?format=square`}>
                正方形で保存
              </a>
              <a className="btn btn-white min-h-11 px-1 text-sm" href={`/api/cards/${c.id}/front.png?format=portrait`}>
                4:5 で保存
              </a>
            </div>
          </div>
        </div>
      )}
    />
  );
}
