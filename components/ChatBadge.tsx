"use client";

// 下のタブ「隊長」に出す未読の数（spec v1.17）。開いたときに1回だけ数を取る（タブは画面の部品なので、画面の読み込みを待たせない）。
import { useEffect, useState } from "react";
import { chatUnreadAction } from "@/app/chat/badge-actions";

export default function ChatBadge({ as }: { as?: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    chatUnreadAction(as)
      .then((x) => alive && setN(x))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [as]);
  if (n <= 0) return null;
  return (
    <span className="absolute right-[18%] top-1 grid min-w-5 place-items-center rounded-full bg-lamp px-1 text-xs font-bold text-white" aria-label={`未読 ${n} 件`}>
      {n > 99 ? "99+" : n}
    </span>
  );
}
