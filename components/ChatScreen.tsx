"use client";

// 隊長トークの画面（spec v1.17）。流れ（吹き出し・カード・画像・大きなボタン）と、下の入力欄（文・写真）。
// 押したボタン・送った文はすぐ自分の吹き出しとして出し、返事が入ったら流れを読み直す。数秒ごとに新しい文面（点呼など）も取りに行く。
// ことば（spec v1.36）: 🌐 で選ぶ。決まった文字は辞書（lib/i18n/ui.ts）、隊長の吹き出しはサーバーで訳したものが届く。
// 読み上げは隊長のかわいい声（日本語は VOICEVOX、ほかはブラウザのそのことばの声）。
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { chatPhotoAction, chatPollAction, chatPostbackAction, chatTextAction, type ChatResult } from "@/app/chat/actions";
import { setLangAction } from "@/app/chat/lang-actions";
import { LANG_INFO, type Lang } from "@/lib/i18n/langs";
import { t } from "@/lib/i18n/ui";
import type { ChatBubble, ChatButton } from "@/lib/inbox/view";
import type { TeamId } from "@/lib/types";
import ChatTools, { primeCaptainVoice, readSpeak, readTextSize, speakCaptain, TEXT_SIZE_PX, type TextSize } from "./ChatTools";
import FeedbackButton from "./FeedbackSheet";
import LangPicker from "./LangPicker";
import Mascot from "./Mascot";
import MicButton from "./MicButton";
import { shrink } from "./shrink";
import { play } from "@/lib/sound/engine";
import { freshCaptainText } from "@/lib/chat/speak";
import type { ReactNode } from "react";

const POLL_SECONDS = 6;

/** 時刻の札: 前の吹き出しから 20分以上あいたら出す（日が変わったら日付も）。JST */
function stamp(at: string, prev?: string): string | null {
  const t = Date.parse(at);
  if (Number.isNaN(t)) return null;
  const p = prev ? Date.parse(prev) : NaN;
  if (!Number.isNaN(p) && t - p < 20 * 60_000) return null;
  const d = new Date(t + 9 * 3600_000);
  const sameDay = !Number.isNaN(p) && new Date(p + 9 * 3600_000).toISOString().slice(0, 10) === d.toISOString().slice(0, 10);
  const hm = `${d.getUTCHours()}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
  return sameDay ? hm : `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${hm}`;
}

/** まだ何も届いていないときの、相談のきっかけ（押すとその文を送る。text は日本語のまま＝今までの処理が動く） */
const starters = (lang: Lang): ChatButton[] => [
  { kind: "say", label: t(lang, "starterGo"), text: "雪かきに出たい", tone: "soft" },
  { kind: "say", label: t(lang, "starterMeet"), text: "近所の人と知り合いたい", tone: "soft" },
  { kind: "say", label: t(lang, "starterHowto"), text: "使い方を教えて", tone: "soft" },
];

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
 * lang: 選んだことば（cookie）。canTranslate: 隊長の文を訳せるか（Claude の鍵があるか）。voiceName: 日本語の声の名前（クレジット）
 */
export default function ChatScreen({
  viewerId,
  initial,
  teamId,
  readOnly = false,
  headerBg,
  extra,
  lang: initialLang = "ja",
  canTranslate = false,
  voiceName,
}: {
  viewerId: string;
  initial: ChatBubble[];
  teamId?: TeamId;
  readOnly?: boolean;
  headerBg?: string;
  extra?: ReactNode;
  lang?: Lang;
  canTranslate?: boolean;
  voiceName?: string;
}) {
  const router = useRouter();
  const [lang, setLang] = useState<Lang>(initialLang);
  const [bubbles, setBubbles] = useState<ChatBubble[]>(initial);
  const [draft, setDraft] = useState("");
  const [size, setSize] = useState<TextSize>("m");
  const [speakOn, setSpeakOn] = useState(false);
  const [listening, setListening] = useState(false);
  /** すでに見た隊長の吹き出しの id（新しく届いた分だけを読むため。lib/chat/speak.ts） */
  const seenCaptain = useRef<Set<string> | undefined>(undefined);
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
  // 読み上げがオンのまま開き直したとき: 画面のどこかを最初にタップした中で、声を鳴らせる状態にする（iPhone 対策）
  useEffect(() => {
    if (!speakOn) return;
    const onTap = () => primeCaptainVoice();
    document.addEventListener("click", onTap, { capture: true, passive: true });
    document.addEventListener("touchend", onTap, { capture: true, passive: true });
    return () => {
      document.removeEventListener("click", onTap, { capture: true });
      document.removeEventListener("touchend", onTap, { capture: true });
    };
  }, [speakOn]);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const list = useRef<HTMLDivElement>(null);
  const fileCamera = useRef<HTMLInputElement>(null);
  const fileRoll = useRef<HTMLInputElement>(null);
  const lastId = bubbles.at(-1)?.id;

  // 「考え中」の吹き出しが出たら、それが見えるところまで下げる
  useEffect(() => {
    if (pending) list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [pending]);

  // いちばん下についていくか（自分で上へ戻したら、ついていかない）
  const stick = useRef(true);
  const lastTop = useRef(0);
  const onListScroll = () => {
    const el = list.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 80) stick.current = true;
    else if (el.scrollTop < lastTop.current - 4) stick.current = false; // 指で上へ戻した
    lastTop.current = el.scrollTop;
  };
  // 吹き出しの画像（カードなど）があとから読み込まれて伸びたときも、いちばん下へ（11/8 本人「下に自動スクロールしないのがある」）
  useEffect(() => {
    const el = list.current;
    if (!el) return;
    const follow = () => {
      if (stick.current) el.scrollTop = el.scrollHeight;
    };
    el.addEventListener("load", follow, true); // img の load は泡立たないので、捕まえる側で
    const ro = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(follow);
    for (const c of Array.from(el.children)) ro?.observe(c);
    return () => {
      el.removeEventListener("load", follow, true);
      ro?.disconnect();
    };
  }, [lastId]);

  // 新しい吹き出しが増えたら、いちばん下へ。読み上げがオンなら、隊長の新しい吹き出しを読む（開いたときの分は読まない）
  useEffect(() => {
    const el = list.current;
    stick.current = true;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    const r = freshCaptainText(bubbles, seenCaptain.current);
    seenCaptain.current = r.seen;
    if (speakOn && r.text) speakCaptain(r.text, lang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastId]);

  /** 送った回数と、返事を待っている数（数秒ごとの取りに行きが、送ったばかりの吹き出しを古い流れで上書きしないように） */
  const sendSeq = useRef(0);
  const sending = useRef(0);
  // 数秒ごとに、届いた文面（点呼・作戦・なかまの誘い…）を取りに行く
  useEffect(() => {
    if (readOnly) return;
    const t = setInterval(async () => {
      if (pending || sending.current > 0) return;
      const seq = sendSeq.current;
      const r = await chatPollAction(viewerId).catch(() => undefined);
      // 取りに行っている間に文を送っていたら、この結果は古い（自分の吹き出しが消えてしまう。11/7 本人の指摘「しばらく表示されない」）
      if (seq !== sendSeq.current || sending.current > 0) return;
      if (r?.ok && r.bubbles)
        setBubbles((cur) => {
          if (cur.some((x) => x.id.startsWith("tmp-"))) return cur; // まだ届いていない自分の吹き出しがあるあいだは上書きしない
          const changed = r.bubbles!.length !== cur.length || r.bubbles!.at(-1)?.id !== cur.at(-1)?.id;
          if (changed && r.bubbles!.at(-1)?.from === "captain" && cur.length > 0) play("message"); // 隊長から新しい文「ポロン」
          return changed ? r.bubbles! : cur;
        });
    }, POLL_SECONDS * 1000);
    return () => clearInterval(t);
  }, [viewerId, pending, readOnly]);

  /** ことばを選ぶ: すぐ画面の文字を変え、cookie に覚えて、訳した流れで開き直す（page が key={lang} で描き直す） */
  const pickLang = (l: Lang) => {
    if (l === lang) return;
    setLang(l);
    start(async () => {
      await setLangAction(l).catch(() => undefined);
      router.refresh();
    });
  };

  /** 送って返事を待つ（待っている間は、取りに行きの結果で上書きしない） */
  const waitFor = async (job: () => Promise<ChatResult>) => {
    sendSeq.current++;
    sending.current++;
    try {
      apply(await job().catch(() => ({ ok: false })));
    } finally {
      sending.current--;
    }
  };

  const apply = (r: ChatResult) => {
    if (!r.ok) {
      setError(r.text ?? t(lang, "failed"));
      play("error");
      setBubbles((cur) => cur.filter((x) => !x.id.startsWith("tmp-"))); // 届かなかった仮の吹き出しは消す（残ると数秒ごとの更新が止まる）
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
    start(() => waitFor(() => chatTextAction(viewerId, text)));
  };
  const press = (b: ChatButton) => {
    if (pending) return;
    setError(undefined);
    // ありがとう点呼・応援のボタンは「ぽわん」、ほかは「シュッ」
    if (b.kind !== "photo") play(/ありがとう|助かりました|お茶どうぞ|おつかれさま|あったかく|拍手/.test(b.label) ? "thanks" : "send");
    if (b.kind === "say") {
      // 日本語なら今までどおり文そのもの。ほかのことばでは押した文字（訳）を自分の吹き出しに（送る中身は日本語のまま）
      const shown = lang === "ja" ? b.text : b.label;
      optimistic(shown);
      start(() => waitFor(() => chatTextAction(viewerId, b.text, { shown })));
    } else if (b.kind === "postback") {
      optimistic(b.label);
      start(() => waitFor(() => chatPostbackAction(viewerId, b.data, b.label)));
    } else if (b.kind === "photo") {
      (b.capture ? fileCamera : fileRoll).current?.click();
    }
  };
  const onPhoto = async (file: File | undefined) => {
    if (!file || pending) return;
    setError(undefined);
    play("shutter");
    setBubbles((cur) => [...cur, { id: `tmp-${Date.now()}`, from: "me", at: new Date().toISOString(), photo: true, buttons: [], quick: [] }]);
    start(() =>
      waitFor(async () => {
        try {
          const blob = await shrink(file);
          const fd = new FormData();
          fd.set("viewerId", viewerId);
          fd.set("photo", new File([blob], "done.jpg", { type: "image/jpeg" }));
          return await chatPhotoAction(fd);
        } catch (e) {
          return { ok: false, text: e instanceof Error ? e.message : t(lang, "photoFailed") };
        }
      }),
    );
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
    <div className="flex min-h-0 flex-1 flex-col" style={{ fontSize: TEXT_SIZE_PX[size] }} lang={LANG_INFO[lang].speech}>
      {/* 上段は1行: 隊長・題名・（通知オン）・文字の大きさ・読み上げ・🌐。流れをできるだけ大きく */}
      <header className="flex shrink-0 items-center gap-1 bg-ice-soft py-1 pl-2 pr-1.5" style={headerBg ? { background: headerBg } : undefined}>
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-card shadow-sm">
          <Mascot size={30} team={teamId} />
        </span>
        <h1 className="min-w-0 flex-1 truncate text-[17px] font-bold leading-tight" title={t(lang, "subtitle")}>
          {t(lang, "title")}
        </h1>
        {extra}
        {/* 報告箱（spec v1.33）: 不具合・要望を隊長に伝える。返事はすぐ流れに入る */}
        {!readOnly && viewerId && <FeedbackButton viewerId={viewerId} page="/chat" variant="icon" inChat onSent={(r) => r.bubbles && setBubbles(r.bubbles)} />}
        {!readOnly && <ChatTools size={size} onSize={setSize} speakOn={speakOn} onSpeak={setSpeakOn} lang={lang} />}
        <LangPicker lang={lang} onPick={pickLang} canTranslate={canTranslate} voiceName={voiceName} />
      </header>
      {/* 流れ（この中だけがスクロールする） */}
      <div ref={list} onScroll={onListScroll} className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-[#e3ebf3] px-3 py-3" aria-live="polite" aria-label={t(lang, "thread")}>
        {bubbles.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-2 text-center">
            <Mascot size={96} team={teamId} className="captain-idle drop-shadow-md" />
            <p className="text-lg font-bold leading-snug">
              {t(lang, "hello")}
              <span className="block text-base font-normal text-ink-soft">{t(lang, "helloSub")}</span>
            </p>
            {!readOnly && (
              <div className="flex w-full max-w-xs flex-col gap-2" aria-label={t(lang, "starters")}>
                {starters(lang).map((b) => (
                  <button key={b.label} type="button" onClick={() => press(b)} disabled={pending} className="min-h-12 rounded-full bg-card px-4 text-base font-bold shadow-sm ring-1 ring-ink/15 active:scale-95">
                    {b.label}
                  </button>
                ))}
                <p className="pt-1 text-sm text-ink-soft">要望やバグ報告は、上の封筒のボタンから送れます。</p>
              </div>
            )}
          </div>
        )}
        {bubbles.map((b, i) => {
          const label = stamp(b.at, bubbles[i - 1]?.at);
          // 続けて届いた隊長の吹き出しは、まとまりの最後にだけ顔を出す（LINE と同じ。見た目がすっきりする）
          const nextSame = bubbles[i + 1]?.from === "captain" && !stamp(bubbles[i + 1].at, b.at);
          const time = label && (
            <p key={`${b.id}-t`} className="pt-1 text-center text-xs font-bold text-ink-soft" aria-label={`${t(lang, "time")} ${label}`}>
              {label}
            </p>
          );
          return [time,
          b.from === "me" ? (
            <div key={b.id} className="flex justify-end">
              {b.photo ? (
                <p className="rounded-2xl rounded-br-md bg-[#b8e994] px-3 py-1.5 text-base font-bold shadow-sm">{t(lang, "photoSent")}</p>
              ) : (
                <p className="max-w-[80%] whitespace-pre-line rounded-2xl rounded-br-md bg-[#b8e994] px-3 py-1.5 text-[1em] font-bold leading-snug text-ink shadow-sm">{b.text}</p>
              )}
            </div>
          ) : (
            <div key={b.id} className="flex items-end gap-1.5">
              {nextSame ? <span className="size-8 shrink-0" aria-hidden="true" /> : <Avatar team={teamId} />}
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
                      {b.lines?.map((l, i) =>
                        // 「隊長が調べた」札は出さない（11/7 本人の指摘「表示不要では？」）
                        l.steps ? null : (
                        <p key={i} className={`whitespace-pre-line leading-snug ${l.strong ? "text-[1.1em] font-bold" : l.accent ? "text-[0.85em] text-lamp-deep" : "text-[1em]"}`}>
                          {l.text}
                        </p>
                        ),
                      )}
                      {b.buttons.map((x, i) => (
                        <Button key={i} b={x} big />
                      ))}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          )];
        })}
        {pending && last?.from === "me" && <Thinking lang={lang} avatar={<Avatar team={teamId} />} />}
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
        <p className="shrink-0 border-t border-ink/10 bg-card px-4 py-3 text-center text-sm text-ink-soft">{t(lang, "familyNote")}</p>
      ) : (
      <form
        className="flex shrink-0 items-center gap-2 border-t border-ink/10 bg-card px-2 py-2 pb-[max(8px,env(safe-area-inset-bottom))]"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <button type="button" aria-label={t(lang, "takePhoto")} onClick={() => fileCamera.current?.click()} disabled={pending} className="grid size-12 shrink-0 place-items-center rounded-full bg-ice-soft text-2xl">
          📷
        </button>
        <MicButton
          disabled={pending}
          lang={lang}
          onText={(text, final) => {
            setDraft(text);
            setListening(!final);
          }}
        />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={listening ? t(lang, "listening") : t(lang, "placeholder")}
          maxLength={300}
          enterKeyHint="send"
          className="min-h-12 min-w-0 flex-1 rounded-full bg-paper px-4 text-base ring-1 ring-ink/15 focus:outline-none focus:ring-2 focus:ring-lamp"
        />
        <button type="submit" disabled={pending || !draft.trim()} className="btn btn-lamp min-h-12 shrink-0 px-4 text-base">
          {t(lang, "send")}
        </button>
        <input ref={fileCamera} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void onPhoto(e.target.files?.[0])} />
        <input ref={fileRoll} type="file" accept="image/*" className="hidden" onChange={(e) => void onPhoto(e.target.files?.[0])} />
      </form>
      )}
    </div>
  );
}

/**
 * 隊長が返事を考えている間の吹き出し（spec v1.42。11/8 本人の指示「返答を考えてるのが分かるように」）:
 * 3つの点が跳ねて、いま何をしているか（町の様子 → 天気と道 → 返事を書く）を順に出す
 */
function Thinking({ lang, avatar }: { lang: Lang; avatar: ReactNode }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setStep((s) => Math.min(s + 1, 2)), 1200);
    return () => window.clearInterval(id);
  }, []);
  const label = t(lang, (["thinking1", "thinking2", "thinking3"] as const)[step]);
  return (
    <div className="flex items-end gap-1.5" role="status" aria-live="polite">
      {avatar}
      <div className="rounded-2xl rounded-bl-md bg-card px-4 py-2.5 shadow-sm ring-1 ring-lamp/40">
        <span className="flex h-5 items-center gap-1.5" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span key={i} className="size-2.5 animate-bounce rounded-full bg-lamp" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </span>
        <p className="mt-1 text-sm font-bold text-ink-soft">{label}…</p>
      </div>
    </div>
  );
}
