"use client";

// 隊長トークの未読の数（spec v1.17）。11/7 から、ホームの吹き出し「隊長に相談する」に出す。開いたときに1回だけ数を取る（タブは画面の部品なので、画面の読み込みを待たせない）。
import { useEffect, useState } from "react";
import { chatUnreadAction } from "@/app/chat/badge-actions";

export default function ChatBadge({ as, className = "absolute right-[18%] top-1" }: { as?: string; className?: string }) {
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
    <span className={`${className} grid min-w-5 place-items-center rounded-full bg-lamp px-1 text-xs font-bold text-white`} aria-label={`未読 ${n} 件`}>
      {n > 99 ? "99+" : n}
    </span>
  );
}
