"use client";

// 設定: 隊長から声をかける（spec v1.18）。しばらく活動がないとき、2週間に1回まで隊長トークに届く。
import { useState, useTransition } from "react";
import { setNudgeAction } from "@/app/settings/actions";

export default function NudgeSwitch({ viewerId, initial }: { viewerId: string; initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <label className="flex items-center justify-between gap-3">
      <span>
        <b>隊長から声をかける</b>
        <span className="block text-sm text-ink-soft">しばらく活動がないとき、2週間に1回まで「雪の便り」が届きます。</span>
      </span>
      <input
        type="checkbox"
        checked={on}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.checked;
          setOn(next);
          start(async () => {
            const r = await setNudgeAction(viewerId, next).catch(() => ({ ok: false, on: !next }));
            setOn(r.on);
          });
        }}
        className="size-7 shrink-0"
        aria-label="隊長から声をかける"
      />
    </label>
  );
}
