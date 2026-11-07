"use client";

// チャット形式の登録（11/7 本人の指摘「プロフィールの設定などをチャット形で登録の流れで」）。
// 中身は spec v1.17 の「画面で30秒の登録」と同じ（役割 → 家の場所 → 質問）。隊長が1つずつ聞き、大きなボタンで答える。
// 役割は「手伝う」「手伝ってほしい」を絵のカードで両方えらべる（spec v1.33）。両方なら 手伝う側2問 → お願いする側2問。
// お願いする側の2問は「雪かきをお願いする」と同じ絵（StyleArt・AreaArt）。答えは吹き出しになって残る。
// 送る・保存するのは親（StartScreen）の registerAction／linkCodeAction。
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { StartForm } from "@/app/start/actions";
import type { ClearArea, HelpStyle, LatLng } from "@/lib/types";
import { play } from "@/lib/sound/engine";
import { AreaArt, RoleArt, StyleArt } from "./AskArt";
import Mascot from "./Mascot";

const PinAdjust = dynamic(() => import("./PinAdjust"), { ssr: false });

export type ChatForm = StartForm;
type ChatRole = StartForm["role"];
type Ask = "h1" | "h2" | "style" | "area";
type Step = "role" | "place" | Ask | "confirm" | "saving" | "code";
type Msg = { id: number; from: "bot" | "me"; text: string };

const ROLE_LABEL: Record<ChatRole, string> = { helper: "🧤 手伝う", requester: "🏠 手伝ってほしい", both: "🤝 手伝うし、うちも頼みたい", family: "👪 家族の代わりに登録" };
const H1: [string, string, string][] = [["15", "⏱", "15分"], ["30", "⏱", "30分"], ["60", "⏱", "60分"]];
const H2: [string, string, string][] = [["yes", "🧹", "ある"], ["no", "🙌", "ない"]];
// spec v1.20: 頼み方を登録で分ける（おまかせ／一緒にやる）。毎朝の質問はしない
const STYLE: [HelpStyle, string, string][] = [
  ["omakase", "おまかせしたい", "家の人は雪かきできない"],
  ["together", "一緒にやる", "家の人も一緒に雪かき"],
];
const AREA: [ClearArea, string][] = [
  ["entrance", "玄関前まで"],
  ["garage", "車庫前まで"],
  ["road", "道路まで"],
];
/** 役割ごとの質問の順番 */
const ASKS: Record<ChatRole, Ask[]> = { helper: ["h1", "h2"], requester: ["style", "area"], family: ["style", "area"], both: ["h1", "h2", "style", "area"] };

export default function RegisterChat({
  name,
  center,
  redo = false,
  onRegister,
  onLink,
}: {
  name: string;
  center: LatLng;
  /** 登録のやり直し */
  redo?: boolean;
  /** 登録する。うまくいかなければ理由の文を返す */
  onRegister: (f: ChatForm) => Promise<string | undefined>;
  /** 連携コードで紐づく。うまくいかなければ理由の文を返す */
  onLink: (code: string, whoAmI: "self" | "family") => Promise<string | undefined>;
}) {
  const [step, setStep] = useState<Step>("role");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [role, setRole] = useState<ChatRole>();
  const [wantHelp, setWantHelp] = useState(false);
  const [wantAsk, setWantAsk] = useState(false);
  const [place, setPlace] = useState<LatLng>();
  const [picking, setPicking] = useState<LatLng>();
  const [ans, setAns] = useState<Partial<Record<Ask, string>>>({});
  const [locating, setLocating] = useState(false);
  const [code, setCode] = useState("");
  const seq = useRef(0);
  const list = useRef<HTMLDivElement>(null);
  const fam = role === "family";

  const title = (k: Ask): string =>
    k === "h1" ? "雪の朝、何分くらい動けますか？" : k === "h2" ? "スコップなどの道具はありますか？" : k === "style" ? (fam ? "ご本人も一緒に雪かきしますか？" : "家の人も一緒に雪かきしますか？") : "どこまで雪かきが要りますか？";

  const push = (from: Msg["from"], text: string) => setMsgs((m) => [...m, { id: ++seq.current, from, text }]);
  /** 隊長の吹き出し: 少し「間」をおいて出す */
  const bot = (text: string, delay = 500) => {
    setTyping(true);
    window.setTimeout(() => {
      push("bot", text);
      setTyping(false);
      play("chirp");
    }, delay);
  };
  const me = (text: string) => {
    push("me", text);
    play("send");
  };
  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [msgs.length, typing, step]);

  // 最初のあいさつ → 1問目
  useEffect(() => {
    const t1 = window.setTimeout(() => {
      push("bot", redo ? `${name ? `${name}さん、` : ""}登録をやり直しますね。いくつか聞くだけです。` : `${name ? `${name}さん、` : ""}ようこそ！ シマエナ隊長です。いくつか聞くだけで登録できます（30秒）。`);
      play("chirp");
    }, 300);
    const t2 = window.setTimeout(() => {
      push("bot", "まず、あなたはどちらですか？ 両方えらべます。");
      play("chirp");
    }, 1200);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chooseRole = (r: ChatRole) => {
    setRole(r);
    me(ROLE_LABEL[r]);
    setStep("place");
    bot(
      r === "family"
        ? "ありがとうございます。ご家族の家の場所を教えてください。地図には 50m のマスでしか出ず、名前や住所は出ません。"
        : `${r === "both" ? "お互いさま、いいですね！ " : "ありがとうございます。"}つぎに、家の場所を教えてください。近くの雪かきを知らせるために使います。地図には 50m のマスでしか出ず、名前や住所は出ません。`,
    );
  };
  const pickRole = () => chooseRole(wantHelp && wantAsk ? "both" : wantHelp ? "helper" : "requester");
  const here = () => {
    if (!navigator.geolocation) return setPicking(center);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setPicking([pos.coords.latitude, pos.coords.longitude]); // 地図で家の上に合わせてから決める
      },
      () => {
        setLocating(false);
        bot("いまの場所が取れませんでした。地図で家の場所を選んでください。");
        setPicking(center);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };
  const placed = (at: LatLng) => {
    if (!role) return;
    setPlace(at);
    setPicking(undefined);
    me("🏠 家の場所を決めました");
    const first = ASKS[role][0];
    setStep(first);
    const n = ASKS[role].length;
    bot(`ありがとうございます。あと${n}つ。${role === "both" ? "まず手伝うときのこと。" : ""}${title(first)}`);
  };
  const answer = (k: Ask, v: string, label: string) => {
    if (!role) return;
    setAns((a) => ({ ...a, [k]: v }));
    me(label);
    const order = ASKS[role];
    const next = order[order.indexOf(k) + 1];
    if (next) {
      setStep(next);
      const lastOne = order.indexOf(next) === order.length - 1;
      bot(`${role === "both" && next === "style" ? "つぎは、うちを頼むときのこと。" : lastOne ? "最後の1つ。" : ""}${title(next)}`);
      return;
    }
    setStep("confirm");
    bot(fam ? "これでご家族の登録ができます。終わると、あなたにも知らせが届きます。" : redo ? "これで登録し直せます！ 終わると、設定の画面に戻ります。" : "これで登録できます！ 登録したら、そのままソロ出動（自分の家の雪かき）へ案内します。");
  };
  const save = async () => {
    if (!role || !place) return;
    const f: ChatForm =
      role === "both"
        ? { role, location: place, q1: ans.h1 ?? "", q2: ans.h2 ?? "", q3: ans.style, q4: ans.area }
        : role === "helper"
          ? { role, location: place, q1: ans.h1 ?? "", q2: ans.h2 ?? "" }
          : { role, location: place, q1: ans.style ?? "", q2: ans.area ?? "" };
    setStep("saving");
    me(fam ? "登録する" : "はじめる！");
    const err = await onRegister(f);
    if (err) {
      bot(`${err} もう一度「はじめる！」を押してください。`);
      setStep("confirm");
    }
  };
  const restart = () => {
    setRole(undefined);
    setWantHelp(false);
    setWantAsk(false);
    setPlace(undefined);
    setAns({});
    setStep("role");
    me("最初からやり直す");
    bot("わかりました。あなたはどちらですか？ 両方えらべます。");
  };
  const toCode = () => {
    setStep("code");
    me("連携コードを持っています");
    bot("ご家族が登録したときに出た6桁の番号を入れて、あなたはどちらか教えてください。");
  };
  const link = async (whoAmI: "self" | "family") => {
    me(whoAmI === "self" ? "お願いする本人です" : "家族です");
    const err = await onLink(code, whoAmI);
    if (err) bot(err);
  };

  const order = role ? ASKS[role] : [];
  const stepNo = step === "role" ? 0 : step === "place" ? 1 : 2;
  const busy = typing || locating;
  const choice = "chat-pop rounded-2xl ring-2 disabled:opacity-60";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {picking && <PinAdjust start={picking} emoji="🏠" onDone={placed} onCancel={() => setPicking(undefined)} />}
      {step !== "code" && (
        <ol className="flex shrink-0 gap-1.5" aria-label="すすみぐあい">
          {(["役割", "家の場所", "質問"] as const).map((label, k) => (
            <li key={label} className={`h-2 flex-1 rounded-full ${stepNo >= k ? "bg-lamp" : "bg-ink/15"}`} aria-label={label} />
          ))}
        </ol>
      )}
      {/* トーク */}
      <div ref={list} className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-3xl bg-[#e3ebf3] px-3 py-3" aria-live="polite" aria-label="隊長とのやりとり">
        {msgs.map((m) =>
          m.from === "bot" ? (
            <div key={m.id} className="chat-pop flex items-end gap-1.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-card">
                <Mascot size={28} />
              </span>
              <p className="max-w-[84%] whitespace-pre-line rounded-2xl rounded-bl-md bg-card px-3 py-2 text-base leading-snug shadow-sm">{m.text}</p>
            </div>
          ) : (
            <div key={m.id} className="chat-pop flex justify-end">
              <p className="max-w-[80%] rounded-2xl rounded-br-md bg-[#b8e994] px-3 py-1.5 text-base font-bold leading-snug text-ink shadow-sm">{m.text}</p>
            </div>
          ),
        )}
        {(typing || step === "saving") && (
          <div className="chat-pop flex items-end gap-1.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-card">
              <Mascot size={28} />
            </span>
            <p className="rounded-2xl rounded-bl-md bg-card px-3 py-2 text-base text-ink-soft shadow-sm">{step === "saving" ? "登録しています…" : "…"}</p>
          </div>
        )}
      </div>

      {/* 答えのボタン（大きく、少なく） */}
      <div className="shrink-0 space-y-2">
        {step === "role" && (
          <>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["helper", "手伝う", "近所の雪かきを10分から", wantHelp, setWantHelp],
                  ["requester", "手伝ってほしい", "10cm 積もった朝、応援が届く", wantAsk, setWantAsk],
                ] as const
              ).map(([k, label, sub, on, set], i) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={on}
                  disabled={busy}
                  onClick={() => set(!on)}
                  className={`${choice} relative flex flex-col px-2 pb-1.5 pt-1 text-center ${on ? "bg-lamp text-white ring-lamp" : "bg-card ring-ink/15"}`}
                  style={{ animationDelay: `${i * 0.08}s` }}
                >
                  <span className={`absolute right-2 top-2 grid size-7 place-items-center rounded-full text-base font-black ring-2 ${on ? "bg-white text-lamp ring-white" : "bg-card text-transparent ring-ink/20"}`} aria-hidden="true">
                    ✓
                  </span>
                  <span className="[&_svg]:h-16 short:[&_svg]:h-11">
                    <RoleArt role={k} active={on} />
                  </span>
                  <span className="block whitespace-nowrap text-lg font-bold leading-tight">{label}</span>
                  <span className={`block text-xs leading-snug ${on ? "text-white/90" : "text-ink-soft"}`}>{sub}</span>
                </button>
              ))}
            </div>
            <button disabled={busy || (!wantHelp && !wantAsk)} onClick={pickRole} className="btn btn-lamp min-h-14 w-full text-lg disabled:opacity-40">
              {wantHelp && wantAsk ? "🤝 お互いさまで つぎへ" : wantHelp || wantAsk ? "つぎへ（もう一方も選べます）" : "どちらかを押してください"}
            </button>
            <button type="button" disabled={busy} onClick={() => chooseRole("family")} className={`${choice} flex min-h-12 w-full items-center gap-2 bg-card px-3 text-left ring-ink/15`}>
              <span className="text-2xl" aria-hidden="true">👪</span>
              <span className="min-w-0 text-base font-bold leading-tight">
                家族の代わりに登録
                <span className="block text-xs font-normal text-ink-soft">離れて住む親の家を。終わると知らせが届きます</span>
              </span>
            </button>
          </>
        )}

        {step === "place" && (
          <div className="grid gap-2">
            {!fam && (
              <button type="button" disabled={busy} onClick={here} className={`${choice} min-h-14 bg-lamp px-3 text-lg font-bold text-white ring-lamp`}>
                {locating ? "いまの場所を調べています…" : "📍 いま家にいる（いまの場所）"}
              </button>
            )}
            <button type="button" disabled={busy} onClick={() => setPicking(center)} className={`${choice} min-h-14 px-3 text-lg font-bold ${fam ? "bg-lamp text-white ring-lamp" : "bg-card ring-ink/15"}`}>
              🗺 地図で選ぶ
            </button>
          </div>
        )}

        {(step === "h1" || step === "h2") && (
          <div className={`grid gap-2 ${step === "h1" ? "grid-cols-3" : "grid-cols-2"}`}>
            {(step === "h1" ? H1 : H2).map(([v, emoji, label], k) => (
              <button
                key={v}
                type="button"
                disabled={busy}
                onClick={() => answer(step, v, `${emoji} ${label}`)}
                className={`${choice} flex min-h-20 flex-col items-center justify-center bg-card px-1 text-lg font-bold leading-tight ring-ink/15`}
                style={{ animationDelay: `${k * 0.08}s` }}
              >
                <span className="text-3xl" aria-hidden="true">{emoji}</span>
                {label}
              </button>
            ))}
          </div>
        )}

        {step === "style" && (
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="頼み方">
            {STYLE.map(([v, label, sub], k) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={false}
                disabled={busy}
                onClick={() => answer("style", v, label)}
                className={`${choice} bg-card px-2 pb-1.5 pt-1 text-left ring-ink/15`}
                style={{ animationDelay: `${k * 0.08}s` }}
              >
                <StyleArt style={v} active={false} />
                <span className="block text-lg font-bold leading-tight">{label}</span>
                <span className="block text-xs font-bold text-ink-soft">{fam ? sub.replace("家の人", "ご本人") : sub}</span>
              </button>
            ))}
          </div>
        )}

        {step === "area" && (
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="どこまで">
            {AREA.map(([v, label], k) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={false}
                disabled={busy}
                onClick={() => answer("area", v, label)}
                className={`${choice} bg-card px-1.5 pb-1.5 pt-1 ring-ink/15`}
                style={{ animationDelay: `${k * 0.08}s` }}
              >
                <AreaArt area={v} active={false} />
                <span className="block text-base font-bold leading-tight">{label}</span>
              </button>
            ))}
          </div>
        )}

        {step === "confirm" && (
          <button type="button" disabled={busy} onClick={save} className="btn btn-lamp btn-big chat-pop w-full">
            {fam ? "登録する" : "はじめる！"}
          </button>
        )}

        {step === "code" && (
          <>
            <input
              inputMode="numeric"
              pattern="\d*"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              className="min-h-14 w-full rounded-2xl bg-card text-center text-3xl font-bold tracking-widest ring-2 ring-ink/15 focus:outline-none focus:ring-lamp"
              aria-label="連携コード（6桁）"
            />
            <div className="grid grid-cols-2 gap-2">
              <button disabled={code.length !== 6} onClick={() => link("self")} className="btn btn-lamp min-h-14 text-base disabled:opacity-40">
                お願いする本人です
              </button>
              <button disabled={code.length !== 6} onClick={() => link("family")} className="btn btn-white min-h-14 text-base disabled:opacity-40">
                家族です
              </button>
            </div>
          </>
        )}

        <div className="flex items-center justify-between gap-2 whitespace-nowrap text-xs">
          {step === "role" && !redo ? (
            <button onClick={toCode} className="min-h-10 underline">
              連携コード（6桁）をお持ちの方
            </button>
          ) : step !== "role" && step !== "saving" ? (
            <button onClick={restart} className="min-h-10 underline">
              ‹ 最初からやり直す
            </button>
          ) : (
            <span />
          )}
          {order.length > 0 && step !== "code" && (step === "h1" || step === "h2" || step === "style" || step === "area") ? (
            <span className="text-ink-soft">質問 {order.indexOf(step) + 1}/{order.length}</span>
          ) : (
            <span className="truncate text-ink-soft">LINE は本人の確認だけに使います</span>
          )}
        </div>
      </div>
    </div>
  );
}
