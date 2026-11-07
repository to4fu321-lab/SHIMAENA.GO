"use client";

// チームで時間をそろえる（spec v1.39）: 朝／お昼／夕方から選ぶ → そろう時間（プログラムが決める）と隊長のひとこと → 📅 予定に入れる。
// 選ばなくても、6〜19時のいつでも出動できる（押しつけない）。
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { chooseTimeAction } from "@/app/team/actions";
import Avatar from "@/components/Avatar";
import Mascot from "@/components/Mascot";
import type { TeamTimeView } from "@/lib/calendar/team-time";
import type { IconBgId, IconId } from "@/lib/mypage/rules";
import type { HelperWhen } from "@/lib/types";

const MAX_FACES = 3;

export default function TeamTime({
  viewerId,
  view,
  theme,
  faces,
  calendar,
}: {
  viewerId: string;
  view: TeamTimeView;
  theme: { color: string; deep: string; onColor: string; soft: string };
  faces: Record<string, { icon?: IconId; iconBg?: IconBgId; isMe: boolean }>;
  /** 帯ごとの「予定に入れる」の行き先（.ics と Google カレンダー） */
  calendar: Record<HelperWhen, { ics: string; google: string }>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string>();
  const [picked, setPicked] = useState<HelperWhen | undefined>(view.mine);
  const mine = pending ? picked : (view.mine ?? picked);
  const best = view.best;
  const bestSlot = view.slots.find((s) => s.id === best);

  const choose = (id: HelperWhen) => {
    setPicked(id);
    setNote(undefined);
    start(async () => {
      const r = await chooseTimeAction(viewerId, id).catch(() => ({ ok: false, text: "うまく送れませんでした。もう一度押してください。" }));
      if (!r.ok) {
        setNote(r.text);
        setPicked(view.mine);
      }
      router.refresh();
    });
  };

  if (!view.active) {
    return (
      <section className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-3xl bg-card px-4 text-center shadow-sm ring-1 ring-ink/10" aria-label="そろう時間">
        <Mascot team={view.teamId} size={96} />
        <h2 className="mt-2 text-xl font-bold">雪の日に、時間をそろえます</h2>
        <p className="mt-2 text-base">雪の予告（前の夜 9時）が出たら、ここで朝・お昼・夕方から選べます。チームでいちばん集まる時間を、隊長が知らせます。</p>
      </section>
    );
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-2" aria-label="そろう時間">
      {/* 隊長のひとこと: そろう時間（プログラムが決めた帯と人数）を、Claude の一文で */}
      <div className="flex shrink-0 items-center gap-2">
        <Mascot team={view.teamId} size={56} className="shrink-0" />
        <p className="flex-1 rounded-2xl bg-card px-3 py-2 text-base font-bold leading-snug shadow-sm ring-1 ring-ink/10">
          {view.line ?? `${view.dayLabel}の雪かき、いつ行けそう？ 選ぶと、${view.teamName}でそろう時間が分かります。`}
        </p>
      </div>

      <ul className="flex min-h-0 flex-col gap-2" aria-label="時間を選ぶ">
        {view.slots.map((s) => {
          const isMine = mine === s.id;
          const isBest = best === s.id;
          const shown = s.ids.slice(0, MAX_FACES);
          return (
            <li key={s.id}>
              <button
                type="button"
                data-sound="tap"
                disabled={!s.open || pending}
                onClick={() => choose(s.id)}
                aria-pressed={isMine}
                className={`relative flex w-full items-center gap-3 rounded-2xl px-4 py-2.5 text-left shadow-sm disabled:opacity-45 ${isMine ? "ring-4" : "ring-1 ring-ink/15"}`}
                style={{ background: isMine ? theme.soft : "var(--color-card, #fff)", ["--tw-ring-color" as string]: isMine ? theme.color : undefined }}
              >
                {isBest && (
                  <span className="absolute -top-2.5 right-3 whitespace-nowrap rounded-full px-2 text-sm font-bold" style={{ background: theme.color, color: theme.onColor }}>
                    そろう時間
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-2xl font-bold leading-tight" style={{ color: theme.deep }}>
                    {s.label}
                    {isMine && <span className="ml-2 text-base">✓ あなた</span>}
                  </span>
                  <span className="block text-sm">
                    {s.range}・{Number(s.meet.slice(0, 2))}:{s.meet.slice(3)} 集合{!s.open && "（終わりました）"}
                  </span>
                </span>
                <span className="flex shrink-0 items-center -space-x-2" aria-hidden="true">
                  {shown.map((id) => (
                    <Avatar key={id} icon={faces[id]?.icon} bg={faces[id]?.iconBg} size={32} team={view.teamId} />
                  ))}
                </span>
                <span className="w-10 shrink-0 text-right text-lg font-bold tabular-nums">{s.count}人</span>
              </button>
            </li>
          );
        })}
      </ul>

      {note && <p className="shrink-0 text-center text-base font-bold" role="status">{note}</p>}

      <div className="mt-auto shrink-0 space-y-1.5">
        {mine && bestSlot && best !== mine && bestSlot.open && (
          <button
            type="button"
            data-sound="tap"
            disabled={pending}
            onClick={() => choose(bestSlot.id)}
            className="w-full rounded-2xl px-4 py-3 text-lg font-bold ring-2"
            style={{ color: theme.deep, ["--tw-ring-color" as string]: theme.color }}
          >
            みんなの{bestSlot.label}に合わせる
          </button>
        )}
        {mine ? (
          <>
            <a
              href={calendar[mine].ics}
              data-sound="confirm"
              className="block w-full rounded-2xl px-4 py-3 text-center text-lg font-bold shadow-sm"
              style={{ background: theme.color, color: theme.onColor }}
            >
              📅 {view.dayLabel}の{view.slots.find((s) => s.id === mine)?.label}を予定に入れる
            </a>
            <a href={calendar[mine].google} target="_blank" rel="noopener noreferrer" className="block text-center text-sm font-bold underline">
              Google カレンダーで入れる
            </a>
          </>
        ) : (
          <p className="text-center text-sm text-ink-soft">選ばなくても、いつでも出動できます。</p>
        )}
      </div>
    </section>
  );
}
