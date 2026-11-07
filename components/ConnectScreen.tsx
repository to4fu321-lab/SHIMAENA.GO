"use client";

// つなぐ（11/6 本人の指示「共有・拡散が弱い。つなぐをいつでも開けて、使われる機能に」「UI を分かりやすくキレイに」）: 1画面・4つのタブを横スワイプ。
// 広める = SNS に投稿（画像つき・自動では投稿しない）／誘う = 友だちを誘う・応援を呼ぶ／バトン = 地域の雪かきバトン（見る・渡す）／
// なかま = 今日のスタイルと合流（くわしくは /nakama）。下のタブ「つなぐ」から、いつでも開ける。
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { todayModeAction } from "@/app/nakama/actions";
import { lineJoinUrl } from "@/lib/line/join";
import type { NakamaView } from "@/lib/nakama/ops";
import { CHILD_NOTE, TODAY_MODES, type TodayMode } from "@/lib/nakama/rules";
import { cheerRequestMessage, inviteMessage, lineShareUrl } from "@/lib/share-links";
import { play } from "@/lib/sound/engine";
import BatonFeed from "./BatonFeed";
import HelpButton from "./HelpPopup";
import Mascot from "./Mascot";
import Pager from "./Pager";
import SnsShare, { type ShareOption } from "./SnsShare";

const MODE_ICON: Record<TodayMode, string> = { solo: "🐦", together: "👥", reunion: "🤝", new: "👋" };

/** 登録していない人に、バトン・なかまの代わりに出す */
function NeedLogin({ what }: { what: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-3xl bg-card p-5 text-center shadow-sm ring-1 ring-ink/10">
      <Mascot size={88} />
      <p className="text-lg leading-snug">{what}は、登録した人の画面です。</p>
      <a href={`/api/auth/line/start?next=${encodeURIComponent("/connect")}`} className="btn btn-big w-full bg-[#06C755] text-white">
        LINE でログイン（30秒）
      </a>
    </div>
  );
}

/** 誘う: 大きな3つの行動（LINE で誘う／応援を呼ぶ／ほかのアプリ）。自動では送らない */
function InvitePanel({ inviteLine }: { inviteLine?: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  const open = (url: string) => {
    play("share");
    window.open(url, "_blank", "noopener,noreferrer");
  };
  const invite = () => {
    const m = inviteMessage(window.location.origin, lineJoinUrl());
    open(lineShareUrl(m.text, m.url));
  };
  const cheer = () => {
    const m = cheerRequestMessage(window.location.origin);
    open(lineShareUrl(m.text, m.url));
  };
  const other = async () => {
    const m = inviteMessage(window.location.origin, lineJoinUrl());
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ text: m.text, url: m.url });
        play("share");
        return;
      }
      await navigator.clipboard.writeText(`${m.text}\n${m.url}`);
      setMsg("誘う文をコピーしました");
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) setMsg("うまくいきませんでした");
    }
  };
  const row = "flex min-h-[72px] w-full items-center gap-3 rounded-3xl px-4 text-left shadow-md";
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center gap-3" aria-label="友だちを誘う・応援を呼ぶ">
      <div className="flex items-center gap-3 px-1">
        <Mascot size={64} mood="happy" className="shrink-0" />
        <p className="text-lg font-bold leading-snug">
          群れが大きいほど、
          <br />
          雪の朝はらくになる。
        </p>
      </div>
      <button type="button" onClick={invite} className={`${row} bg-[#06C755] text-white`}>
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-sm font-black text-[#06C755]">LINE</span>
        <span className="min-w-0 leading-tight">
          <span className="block text-lg font-bold">友だちを誘う</span>
          <span className="block text-sm text-white/90">LINE の「送る」画面が開きます</span>
        </span>
        <span className="ml-auto text-2xl" aria-hidden="true">›</span>
      </button>
      <button type="button" onClick={cheer} className={`${row} bg-card text-ink ring-1 ring-ink/15`}>
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-camellia-soft text-2xl" aria-hidden="true">📣</span>
        <span className="min-w-0 leading-tight">
          <span className="block text-lg font-bold">応援を呼ぶ</span>
          <span className="block text-sm text-ink-soft">「町を応援」を押してもらう</span>
        </span>
        <span className="ml-auto text-2xl" aria-hidden="true">›</span>
      </button>
      <button type="button" onClick={other} className={`${row} bg-card text-ink ring-1 ring-ink/15`}>
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-ice-soft text-2xl" aria-hidden="true">📤</span>
        <span className="min-w-0 leading-tight">
          <span className="block text-lg font-bold">ほかのアプリで誘う</span>
          <span className="block text-sm text-ink-soft">メール・メッセージ・コピー</span>
        </span>
        <span className="ml-auto text-2xl" aria-hidden="true">›</span>
      </button>
      {(msg || inviteLine) && (
        <p className="rounded-2xl bg-camellia-soft px-3 py-2 text-center text-base font-bold ring-1 ring-camellia" role="status">
          🐦 {msg ?? inviteLine}
        </p>
      )}
      <p className="text-center text-base text-ink-soft">自分で相手を選んで送ります。自動では送りません。応援や招待の数で得点はつきません。</p>
    </div>
  );
}

export default function ConnectScreen({
  viewerId,
  q = "",
  shareOptions,
  nakama,
  inviteLine,
  initialTab = 0,
}: {
  /** 登録した本人（なければ広める・誘うだけ） */
  viewerId?: string;
  q?: string;
  shareOptions: ShareOption[];
  nakama?: NakamaView;
  /** 誘った結果（「3人が見てくれて…」）。なければ出さない */
  inviteLine?: string;
  initialTab?: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  const pickMode = (m: TodayMode) =>
    start(async () => {
      if (!viewerId) return;
      try {
        const r = await todayModeAction(viewerId, m);
        setNote(r.text);
      } catch {
        setNote("うまくいきませんでした。もう一度押してください。");
      }
      router.refresh();
    });
  const incoming = nakama?.incoming.length ?? 0;
  const matched = nakama?.matched.length ?? 0;
  const qa = q ? `&${q.slice(1)}` : "";

  return (
    <Pager
      tabs={[
        { key: "post", label: "広める" },
        { key: "invite", label: "誘う" },
        { key: "baton", label: "バトン", badge: nakama?.area.batons.length },
        { key: "nakama", label: "なかま", badge: incoming + matched },
      ]}
      initial={initialTab}
    >
      {/* 広める: 画像つきで SNS に投稿（自動では投稿しない） */}
      <SnsShare key="post" options={shareOptions} fill />

      {/* 誘う */}
      <InvitePanel key="invite" inviteLine={inviteLine} />

      {/* バトン: この地域の雪かきバトンを見る・渡す */}
      {viewerId && nakama ? <BatonFeed key="baton" viewerId={viewerId} area={nakama.area} q={q} /> : <NeedLogin key="baton" what="雪かきバトン" />}

      {/* なかま: 実績 → 今日のスタイル → 合流（くわしくは /nakama） */}
      {viewerId && nakama ? (
        <div key="nakama" className="flex min-h-0 flex-1 flex-col justify-center gap-2">
          <div className="grid shrink-0 grid-cols-3 gap-2 text-center">
            {(
              [
                ["仲間", nakama.companions, "人"],
                ["合流", nakama.meets, "回"],
                ["ありがとう", nakama.thanksForMe, ""],
              ] as const
            ).map(([label, n, unit]) => (
              <div key={label} className="rounded-2xl bg-card px-2 py-1.5 shadow-sm ring-1 ring-ink/10">
                <p className="text-xs font-bold text-ink-soft">{label}</p>
                <p className="text-xl font-bold leading-tight tabular-nums">
                  {n}
                  <span className="text-sm">{unit}</span>
                </p>
              </div>
            ))}
          </div>
          {incoming + matched > 0 && (
            <Link href={`/nakama?tab=1${qa}`} className="btn btn-lamp w-full shrink-0 text-lg shadow-md">
              {incoming > 0 ? `📩 届いた誘いが ${incoming}件 ›` : `🎉 決まった合流が ${matched}件 ›`}
            </Link>
          )}
          <div className="flex shrink-0 items-center justify-between pt-1">
            <h2 className="text-lg font-bold">今日はどうする？</h2>
            {/* 「なかまとは？」の説明（ポップアップ。11/7） */}
            <HelpButton topic="nakama" label="なかまとは" />
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-2">
            {TODAY_MODES.map((m) => {
              const on = nakama.mode === m.id && (nakama.active || m.id === "solo");
              const off = Boolean(nakama.blocked && m.id !== "solo");
              return (
                <button
                  key={m.id}
                  disabled={pending || off}
                  aria-pressed={on}
                  onClick={() => pickMode(m.id)}
                  className={`flex min-h-[68px] items-center gap-2 rounded-2xl px-2.5 text-left ring-2 disabled:opacity-40 ${on ? "bg-lamp text-white ring-lamp shadow-md" : "bg-card ring-ink/15"}`}
                >
                  <span className="text-xl" aria-hidden="true">{MODE_ICON[m.id]}</span>
                  <span className="min-w-0 leading-tight">
                    <span className="block whitespace-nowrap text-[15px] font-bold">{m.label}</span>
                    <span className={`block text-xs ${on ? "text-white/90" : "text-ink-soft"}`}>{m.sub}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className={`shrink-0 rounded-2xl px-3 py-2 text-sm leading-snug ${note ? "bg-ice-soft" : nakama.blocked ? "bg-warm" : nakama.wishLine ? "bg-camellia-soft font-bold" : "text-ink-soft"}`} role="status">
            {note ?? (nakama.blocked ? "🌙 夜は合流をお休み。自分の家の雪かきはいつでもどうぞ。" : nakama.wishLine ? `🐦 ${nakama.wishLine}` : `どれでも自由に。断っても何も減りません。${CHILD_NOTE}`)}
          </p>
          <div className="grid shrink-0 grid-cols-2 gap-2">
            <Link href={`/nakama${q}`} className="btn btn-ink text-lg">
              👥 合流の候補 ›
            </Link>
            <Link href={`/me?tab=1${qa}`} className="btn btn-white text-lg">
              📒 なかま帳 ›
            </Link>
          </div>
        </div>
      ) : (
        <NeedLogin key="nakama" what="なかま（合流）" />
      )}
    </Pager>
  );
}
