"use client";

// 「あと1人で救える家」と「5分だけ参加」（spec v1.1）。地図の下に出す。
import { useState, useTransition } from "react";
import { fiveMinutesAction, joinAction, type ActionResult } from "@/app/map/actions";
import type { ShortHouse } from "@/lib/morning/watch";

const SHOW = 2;

export default function RescueList({
  viewerId,
  items,
  goingTo,
  isHelper,
  hasAssignment,
}: {
  viewerId: string;
  items: ShortHouse[];
  /** 自分がいま向かっているミッション */
  goingTo: string[];
  isHelper: boolean;
  /** 自分の割り当て（向かっている最中）があるか */
  hasAssignment: boolean;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      try {
        setResult(await fn());
      } catch (e) {
        setResult({ ok: false, text: e instanceof Error ? e.message : "うまくいきませんでした" });
      }
    });

  if (!isHelper) return null;
  const shown = items.slice(0, SHOW);

  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <div className="rounded-2xl bg-[#fff0f3] px-3 py-2 ring-1 ring-alert/40" aria-label="人手が足りない家">
          <p className="font-bold text-alert">{items[0].missing === 1 ? "あと1人で救える家" : "人手が足りない家"}</p>
          <ul className="mt-1 space-y-2">
            {shown.map((h) => (
              <li key={h.missionId} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-base font-bold">
                    拠点{h.baseNumber}{" "}
                    <span className="font-normal text-ink/70">
                      あと{h.missing}人（{h.going}/{h.required}）
                    </span>
                  </p>
                  <p className="truncate text-sm text-ink/70">5分でOK: {h.tasks.join("／")}</p>
                </div>
                {goingTo.includes(h.missionId) ? (
                  <span className="shrink-0 rounded-2xl bg-ink/10 px-3 py-2 text-sm font-bold">向かっています</span>
                ) : (
                  <button
                    disabled={pending}
                    onClick={() => run(() => joinAction(viewerId, h.missionId))}
                    className="shrink-0 rounded-2xl bg-alert px-3 py-2 text-base font-bold leading-tight text-white disabled:opacity-40"
                  >
                    5分だけ
                    <br />
                    助けに行く
                  </button>
                )}
              </li>
            ))}
          </ul>
          {items.length > SHOW && <p className="mt-1 text-xs text-ink/60">ほか {items.length - SHOW} 軒</p>}
        </div>
      )}
      {items.length === 0 && !hasAssignment && (
        <button
          disabled={pending}
          onClick={() => run(() => fiveMinutesAction(viewerId))}
          className="w-full rounded-2xl bg-neon py-4 text-lg font-bold text-white disabled:opacity-40"
        >
          {pending ? "さがしています…" : "5分だけ参加（偵察・補給）"}
        </button>
      )}
      {result && (
        <p className={`rounded-2xl px-3 py-2 text-base ${result.ok ? "bg-[#e9fbe7]" : "bg-[#fff4d6]"}`} role="status">
          {result.text}
        </p>
      )}
    </div>
  );
}
