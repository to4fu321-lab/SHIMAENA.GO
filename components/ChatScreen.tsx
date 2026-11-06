"use client";

// 隊長トークの画面（spec v1.17）。流れ（吹き出し・カード・画像・大きなボタン）と、下の入力欄（文・写真）。
// 押したボタン・送った文はすぐ自分の吹き出しとして出し、返事が入ったら流れを読み直す。数秒ごとに新しい文面（点呼など）も取りに行く。
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { chatPhotoAction, chatPollAction, chatPostbackAction, chatTextAction, type ChatResult } from "@/app/chat/actions";
import type { ChatBubble, ChatButton } from "@/lib/inbox/view";
import type { TeamId } from "@/lib/types";
import ChatTools, { readSpeak, readTextSize, speak, TEXT_SIZE_PX, type TextSize } from "./ChatTools";
import Mascot from "./Mascot";
import MicButton from "./MicButton";
import { shrink } from "./shrink";
import { play } from "@/lib/sound/engine";
import type { ReactNode } from "react";

const POLL_SECONDS = 6;

const TONE: Record<ChatButton["tone"], string> = {
  main: "bg-lamp text-white",
  soft: "bg-ice-soft text-ink",
  line: "bg-card text-ink ring-2 ring-winter/60",
};

function Avatar({ team }: { team?: TeamId }) {
  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-card shadow-sm">
      <Mascot size={26} team={team} />
    </span>
  );
}

/** readOnly: 家族の代わりに登録した人（参加者ではない）。届いたものを読むだけで、文やボタンは送れない */
/**
 * headerBg: 題名の帯の色（チームの淡い色）。extra: 題名の帯の右に置く小さいもの（🔔 通知オン など）。
 * 上段は1行だけ（11/6 本人の指摘「メインのチャット部分を大きく、最上段をコンパクトに」）。
 */
export default function ChatScreen({
  viewerId,
  initial,
  teamId,
  readOnly = false,
  headerBg,
  extra,
}: {
  viewerId: string;
  initial: ChatBubble[];
  teamId?: TeamId;
  readOnly?: boolean;
  headerBg?: string;
  extra?: ReactNode;
}) {
  const [bubbles, setBubbles] = useState<ChatBubble[]>(initial);
  const [draft, setDraft] = useState("");
  const [size, setSize] = useState<TextSize>("m");
  const [speakOn, setSpeakOn] = useState(false);
  const [listening, setListening] = useState(false);
  const spoken = useRef<string | undefined>(undefined);
  useEffect(() => {
    // 端末に覚えた設定は、画面が出たあとに読む
    let alive = true;
    void Promise.resolve().then(() => {
      if (!alive) return;
      setSize(readTextSize());
      setSpeakOn(readSpeak());
    });
    return () => {
      alive = false;
    };
  }, []);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const list = useRef<HTMLDivElement>(null);
  const fileCamera = useRef<HTMLInputElement>(null);
  const fileRoll = useRef<HTMLInputElement>(null);
  const lastId = bubbles.at(-1)?.id;

  // 新しい吹き出しが増えたら、いちばん下へ。読み上げがオンなら、隊長の新しい吹き出しを読む（開いたときの分は読まない）
  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    const last = bubbles.at(-1);
    if (spoken.current === undefined) {
      spoken.current = last?.id ?? "";
      return;
    }
    if (speakOn && last && last.from === "captain" && last.id !== spoken.current) {
      const fresh = bubbles.slice(bubbles.findIndex((b) => b.id === spoken.current) + 1).filter((b) => b.from === "captain");
      speak(fresh.map((b) => b.text ?? b.lines?.map((l) => l.text).join("。") ?? "").join("。"));
    }
    spoken.current = last?.id ?? "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastId]);

  // 数秒ごとに、届いた文面（点呼・作戦・なかまの誘い…）を取りに行く
  useEffect(() => {
    if (readOnly) return;
    const t = setInterval(async () => {
      if (pending) return;
      const r = await chatPollAction(viewerId).catch(() => undefined);
      if (r?.ok && r.bubbles)
        setBubbles((cur) => {
          const changed = r.bubbles!.length !== cur.length || r.bubbles!.at(-1)?.id !== cur.at(-1)?.id;
          if (changed && r.bubbles!.at(-1)?.from === "captain" && cur.length > 0) play("message"); // 隊長から新しい文「ポロン」
          return changed ? r.bubbles! : cur;
        });
    }, POLL_SECONDS * 1000);
    return () => clearInterval(t);
  }, [viewerId, pending, readOnly]);

  const apply = (r: ChatResult) => {
    if (!r.ok) {
      setError(r.text ?? "うまくいきませんでした。もう一度どうぞ。");
      play("error");
    } else if (r.bubbles) {
      setBubbles(r.bubbles);
      if (r.bubbles.at(-1)?.from === "captain") play("message", { delay: 0.15 });
    }
  };
  const optimistic = (text: string) => setBubbles((cur) => [...cur, { id: `tmp-${Date.now()}`, from: "me", at: new Date().toISOString(), text, buttons: [], quick: [] }]);

  const send = () => {
    const text = draft.trim();
    if (!text || pending) return;
    setError(undefined);
    setDraft("");
    optimistic(text);
    play("send");
    start(async () => apply(await chatTextAction(viewerId, text).catch(() => ({ ok: false }))));
  };
  const press = (b: ChatButton) => {
    if (pending) return;
    setError(undefined);
    // ありがとう点呼・応援のボタンは「ぽわん」、ほかは「シュッ」
    if (b.kind !== "photo") play(/ありがとう|助かりました|お茶どうぞ|おつかれさま|あったかく|拍手/.test(b.label) ? "thanks" : "send");
    if (b.kind === "say") {
      optimistic(b.text);
      start(async () => apply(await chatTextAction(viewerId, b.text).catch(() => ({ ok: false }))));
    } else if (b.kind === "postback") {
      optimistic(b.label);
      start(async () => apply(await chatPostbackAction(viewerId, b.data, b.label).catch(() => ({ ok: false }))));
    } else if (b.kind === "photo") {
      (b.capture ? fileCamera : fileRoll).current?.click();
    }
  };
  const onPhoto = async (file: File | undefined) => {
    if (!file || pending) return;
    setError(undefined);
    play("shutter");
    setBubbles((cur) => [...cur, { id: `tmp-${Date.now()}`, from: "me", at: new Date().toISOString(), photo: true, buttons: [], quick: [] }]);
    start(async () => {
      try {
        const blob = await shrink(file);
        const fd = new FormData();
        fd.set("viewerId", viewerId);
        fd.set("photo", new File([blob], "done.jpg", { type: "image/jpeg" }));
        apply(await chatPhotoAction(fd));
      } catch (e) {
        setError(e instanceof Error ? e.message : "写真を送れませんでした。");
      }
    });
  };

  const Button = ({ b, big }: { b: ChatButton; big: boolean }) => {
    const cls = `${big ? "btn min-h-14 w-full text-[1.05em]" : "flex min-h-11 shrink-0 items-center rounded-full px-4 text-[0.95em] font-bold active:scale-95"} ${TONE[b.tone]}`;
    if (b.kind === "link") {
      return b.external ? (
        <a href={b.href} target="_blank" rel="noopener" className={cls}>
          {b.label}
        </a>
      ) : (
        <Link href={b.href} className={cls}>
          {b.label}
        </Link>
      );
    }
    return (
      <button type="button" onClick={() => press(b)} disabled={pending} className={cls}>
        {b.label}
      </button>
    );
  };

  const last = bubbles.at(-1);
  const quick = [...bubbles].reverse().find((x) => x.quick.length > 0)?.quick ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ fontSize: TEXT_SIZE_PX[size] }}>
      {/* 上段は1行: 隊長・題名・（通知オン）・文字の大きさ・読み上げ。流れをできるだけ大きく */}
      <header className="flex shrink-0 items-center gap-1.5 bg-ice-soft py-1 pl-3 pr-2" style={headerBg ? { background: headerBg } : undefined}>
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-card shadow-sm">
          <Mascot size={30} team={teamId} />
        </span>
        <h1 className="min-w-0 flex-1 truncate text-lg font-bold leading-tight" title="雪の朝のお知らせと、なんでも相談">
          隊長トーク
        </h1>
        {extra}
        {!readOnly && <ChatTools size={size} onSize={setSize} speakOn={speakOn} onSpeak={setSpeakOn} />}
      </header>
      {/* 流れ（この中だけがスクロールする） */}
      <div ref={list} className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-[#e3ebf3] px-3 py-3" aria-live="polite" aria-label="隊長とのやりとり">
        {bubbles.length === 0 && (
          <p className="mx-auto max-w-xs rounded-2xl bg-card/80 px-4 py-3 text-center text-base text-ink-soft">
            まだ何も届いていません。雪の朝のお知らせや作戦はここに届きます。下の欄から、隊長に何でも聞けます。
          </p>
        )}
        {bubbles.map((b) =>
          b.from === "me" ? (
            <div key={b.id} className="flex justify-end">
              {b.photo ? (
                <p className="rounded-2xl rounded-br-md bg-[#b8e994] px-3 py-1.5 text-base font-bold shadow-sm">📷 写真を送りました</p>
              ) : (
                <p className="max-w-[80%] whitespace-pre-line rounded-2xl rounded-br-md bg-[#b8e994] px-3 py-1.5 text-[1em] font-bold leading-snug text-ink shadow-sm">{b.text}</p>
              )}
            </div>
          ) : (
            <div key={b.id} className="flex items-end gap-1.5">
              <Avatar team={teamId} />
              {b.text !== undefined ? (
                <p className="max-w-[82%] whitespace-pre-line rounded-2xl rounded-bl-md bg-card px-3 py-2 text-[1em] leading-snug shadow-sm">{b.text}</p>
              ) : (
                <div className="max-w-[88%] min-w-[60%] overflow-hidden rounded-2xl rounded-bl-md bg-card shadow-sm">
                  {b.image &&
                    (b.imageHref ? (
                      <Link href={b.imageHref}>
                        {/* eslint-disable-next-line @next/next/no-img-element -- その場で作る PNG（カード・隊長カード） */}
                        <img src={b.image} alt="" className="block w-full" />
                      </Link>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element -- その場で作る PNG（カード・隊長カード）
                      <img src={b.image} alt="" className="block w-full" />
                    ))}
                  {(b.lines?.length || b.buttons.length) ? (
                    <div className="space-y-2 p-3">
                      {b.lines?.map((l, i) => (
                        <p key={i} className={`whitespace-pre-line leading-snug ${l.strong ? "text-[1.1em] font-bold" : l.accent ? "text-[0.85em] text-lamp-deep" : "text-[1em]"}`}>
                          {l.text}
                        </p>
                      ))}
                      {b.buttons.map((x, i) => (
                        <Button key={i} b={x} big />
                      ))}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ),
        )}
        {pending && last?.from === "me" && (
          <div className="flex items-end gap-1.5">
            <Avatar team={teamId} />
            <p className="rounded-2xl rounded-bl-md bg-card px-3 py-2 text-base text-ink-soft shadow-sm">…</p>
          </div>
        )}
      </div>
      {/* 小さなボタン（いちばん新しい隊長の吹き出しのもの） */}
      {!readOnly && quick.length > 0 && (
        <div className="flex shrink-0 gap-2 overflow-x-auto border-t border-ink/10 bg-card px-2 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {quick.map((b, i) => (
            <Button key={i} b={b} big={false} />
          ))}
        </div>
      )}
      {error && <p className="shrink-0 bg-alert-soft px-4 py-1 text-center text-sm text-alert">{error}</p>}
      {/* 入力欄 */}
      {readOnly ? (
        <p className="shrink-0 border-t border-ink/10 bg-card px-4 py-3 text-center text-sm text-ink-soft">ご家族の家の知らせが、ここに届きます。</p>
      ) : (
      <form
        className="flex shrink-0 items-center gap-2 border-t border-ink/10 bg-card px-2 py-2 pb-[max(8px,env(safe-area-inset-bottom))]"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <button type="button" aria-label="写真を撮る" onClick={() => fileCamera.current?.click()} disabled={pending} className="grid size-12 shrink-0 place-items-center rounded-full bg-ice-soft text-2xl">
          📷
        </button>
        <MicButton
          disabled={pending}
          onText={(text, final) => {
            setDraft(text);
            setListening(!final);
          }}
        />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={listening ? "聞いています…" : "隊長に話す（例: 何からすればいい？）"}
          maxLength={300}
          enterKeyHint="send"
          className="min-h-12 min-w-0 flex-1 rounded-full bg-paper px-4 text-base ring-1 ring-ink/15 focus:outline-none focus:ring-2 focus:ring-lamp"
        />
        <button type="submit" disabled={pending || !draft.trim()} className="btn btn-lamp min-h-12 shrink-0 px-4 text-base">
          送る
        </button>
        <input ref={fileCamera} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void onPhoto(e.target.files?.[0])} />
        <input ref={fileRoll} type="file" accept="image/*" className="hidden" onChange={(e) => void onPhoto(e.target.files?.[0])} />
      </form>
      )}
    </div>
  );
}
