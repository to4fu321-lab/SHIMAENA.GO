"use client";

// デモの人をえらぶ（spec v1.59）: 1回のタップで、すぐ始まる。
// 前は押してから朝の用意（数秒）が終わるまで画面が変わらず、「枠が付くだけで進まない」ように見えて、もう一度押す人がいた。
// 押した瞬間に「◯◯さんで はじめます…」を大きく出し、ほかの人は押せなくする。
import { unstable_rethrow } from "next/navigation";
import { useState, useTransition } from "react";
import { pickDemoAction } from "@/app/demo/actions";
import type { IconBgId, IconId } from "@/lib/mypage/rules";
import type { TeamId } from "@/lib/types";
import Avatar from "./Avatar";
import Mascot from "./Mascot";

export interface DemoPerson {
  id: string;
  nickname: string;
  icon?: IconId;
  iconBg?: IconBgId;
  teamId?: TeamId;
  teamName?: string;
  teamColor?: string;
}

export default function DemoPicker({ people, next }: { people: DemoPerson[]; next: string }) {
  const [picked, setPicked] = useState<DemoPerson | null>(null);
  const [failed, setFailed] = useState(false);
  const [, start] = useTransition();
  const pick = (p: DemoPerson) => {
    if (picked) return;
    setPicked(p);
    setFailed(false);
    const fd = new FormData();
    fd.set("as", p.id);
    fd.set("next", next);
    // サーバーの返事が来なくても、15 秒でその人として開く（11/15 本人「遅くとも15秒で開始できないと」）
    const path = next.startsWith("/") && !next.startsWith("//") ? next : "/";
    // 画面の切りかえ待ち（transition）が止まっているので、router ではなくページごと開き直す
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    const fallback = setTimeout(() => window.location.assign(`${path}${path.includes("?") ? "&" : "?"}as=${p.id}`), 15000);
    start(async () => {
      try {
        await pickDemoAction(fd); // 用意ができたら、その人のホームへ移る
      } catch (e) {
        unstable_rethrow(e); // 「その人のホームへ移る」の合図は、そのまま通す（失敗ではない）
        clearTimeout(fallback);
        setPicked(null);
        setFailed(true);
      }
    });
  };
  return (
    <>
      <ul className="grid min-h-0 flex-1 grid-cols-2 grid-rows-5 gap-2" aria-label="デモの人（1人を押すと始まります）">
        {people.map((p) => (
          <li key={p.id} className="min-h-0">
            <button
              type="button"
              disabled={Boolean(picked)}
              onClick={() => pick(p)}
              className={`flex h-full w-full items-center gap-2 rounded-2xl bg-card px-2.5 text-left shadow-sm ring-1 ring-ink/10 transition active:scale-[0.97] active:ring-2 active:ring-lamp ${picked && picked.id !== p.id ? "opacity-40" : ""} ${picked?.id === p.id ? "ring-2 ring-lamp" : ""}`}
              data-sound="go"
            >
              <Avatar icon={p.icon} bg={p.iconBg} size={40} team={p.teamId} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-bold leading-tight">{p.nickname}</span>
                {p.teamName && (
                  <span className="block truncate text-xs font-bold text-ink-soft">
                    <span style={{ color: p.teamColor }}>●</span> {p.teamName}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-xl font-bold text-lamp-deep" aria-hidden="true">
                ›
              </span>
            </button>
          </li>
        ))}
      </ul>
      {failed && (
        <p className="shrink-0 rounded-2xl bg-warm px-3 py-2 text-base" role="alert">
          うまく始められませんでした。もう一度押してください。
        </p>
      )}
      {picked && (
        <div className="fixed inset-0 z-[1500] mx-auto grid max-w-md place-items-center bg-ink/85 px-6 text-center text-white" role="status" aria-live="assertive">
          <div className="space-y-3">
            <Mascot size={104} mood="happy" className="captain-idle mx-auto" />
            <p className="text-3xl font-black leading-snug">
              {picked.nickname}さんで
              <br />
              はじめます…
            </p>
            <p className="text-lg font-bold text-white/85">雪の朝を用意しています。数秒お待ちください。</p>
            <span className="loading-spin mx-auto block size-8 rounded-full border-4 border-white/30 border-t-white" aria-hidden="true" />
          </div>
        </div>
      )}
    </>
  );
}
