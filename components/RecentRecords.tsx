"use client";

// 活動カードの「最近の記録」。行をタップすると、画面は変えずに下から詳細の紙が出る（11/7 本人の指示）。
import { useEffect, useState } from "react";
import Icon from "./Icon";

export interface RecordItem {
  id: string;
  /** 表示用の日時（11/6 19:37） */
  when: string;
  label: string;
  feathers: number;
  hitokoto?: string;
  note?: string;
  photoChecked?: boolean;
  strokes?: number;
  onsite: boolean;
}

export default function RecentRecords({ items }: { items: RecordItem[] }) {
  const [open, setOpen] = useState<RecordItem | null>(null);
  return (
    <>
      {/* 入りきらない行は丸ごと右へ折り返して見えなくする（下の町の絵と文字が重ならないように。11/6 本人の指摘） */}
      <ul className="mt-1 flex min-h-0 flex-1 flex-col flex-wrap content-start gap-2 overflow-hidden">
        {items.map((l) => (
          <li key={l.id} className="w-full">
            <button
              type="button"
              onClick={() => setOpen(l)}
              aria-haspopup="dialog"
              className="flex w-full items-center gap-3 rounded-2xl bg-card px-3 py-1.5 text-left shadow-sm ring-1 ring-ink/10 active:bg-ice-soft"
            >
              <Icon name="house" size={34} accent="var(--lamp)" className="shrink-0 text-ink" />
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block text-xs">{l.when}</span>
                <span className="block truncate text-base font-bold">{l.label}</span>
              </span>
              <b className="shrink-0 text-lg tabular-nums text-lamp-deep">+{l.feathers}羽</b>
              <span className="shrink-0 text-xl text-ink/40" aria-hidden="true">
                ›
              </span>
            </button>
          </li>
        ))}
      </ul>
      {open && <RecordSheet item={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function RecordSheet({ item, onClose }: { item: RecordItem; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const rows: [string, string][] = [
    ["日時", item.when],
    ["もらった羽", `+${item.feathers}羽`],
    ["場所", item.onsite ? "現地で" : "アプリから"],
  ];
  if (item.photoChecked !== undefined) rows.push(["写真", item.photoChecked ? "確認できました" : "確認できませんでした"]);
  if (item.strokes) rows.push(["スコップ", `${item.strokes}回 ザクッ`]);
  if (item.note) rows.push(["メモ", item.note]);

  return (
    <div className="fixed inset-0 z-[1300] flex items-end justify-center bg-ink/50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={item.label} onClick={onClose}>
      <div
        className="w-full max-w-md space-y-3 rounded-t-3xl bg-paper px-4 pt-2 text-ink shadow-2xl"
        style={{ animation: "rec-rise 0.25s ease-out both" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto h-1.5 w-12 rounded-full bg-ink/20" aria-hidden="true" />
        <div className="flex items-center gap-3">
          <Icon name="house" size={48} accent="var(--lamp)" className="shrink-0 text-ink" />
          <h2 className="text-2xl font-bold leading-tight">{item.label}</h2>
        </div>
        {item.hitokoto && <p className="rounded-2xl bg-ice-soft px-3 py-2 text-lg leading-snug">「{item.hitokoto}」</p>}
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-2xl bg-card px-3 py-2 text-lg ring-1 ring-ink/10">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="whitespace-nowrap font-bold text-ink-soft">{k}</dt>
              <dd className="min-w-0 break-words">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="pb-[max(16px,env(safe-area-inset-bottom))]">
          <button type="button" onClick={onClose} className="btn btn-ink min-h-12 w-full text-lg">
            閉じる
          </button>
        </div>
      </div>
      <style>{`@keyframes rec-rise { from { transform: translateY(24px); opacity: 0 } to { transform: none; opacity: 1 } }`}</style>
    </div>
  );
}
