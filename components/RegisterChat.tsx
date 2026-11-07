"use client";

// チャット形式の登録（11/7 本人の指摘「プロフィールの設定などをチャット形で登録の流れで」）。
// 中身は spec v1.17 の「画面で30秒の登録」と同じ3つ（役割 → 家の場所 → 2問）。隊長が1つずつ聞き、大きなボタンで答える。
// 答えは吹き出しになって残る。送る・保存するのは親（StartScreen）の registerAction／linkCodeAction。
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { LatLng } from "@/lib/types";
import { play } from "@/lib/sound/engine";
import Mascot from "./Mascot";

const PinAdjust = dynamic(() => import("./PinAdjust"), { ssr: false });

export type ChatRole = "helper" | "requester" | "family";
export interface ChatForm {
  role: ChatRole;
  location: LatLng;
  q1: string;
  q2: string;
}

type Step = "role" | "place" | "q1" | "q2" | "confirm" | "saving" | "code";
type Msg = { id: number; from: "bot" | "me"; text: string };
type Reply = { key: string; label: string; sub?: string; primary?: boolean; onClick: () => void };

const ROLE_LABEL: Record<ChatRole, string> = { helper: "🧤 手伝う", requester: "🏠 手伝ってほしい", family: "👪 家族の代わりに登録" };
const Q: Record<"helper" | "requester", { q1: { title: string; options: [string, string][] }; q2: { title: string; options: [string, string][] } }> = {
  helper: {
    q1: { title: "雪の朝、何分くらい動けますか？", options: [["15", "15分"], ["30", "30分"], ["60", "60分"]] },
    q2: { title: "スコップなどの道具はありますか？", options: [["yes", "ある"], ["no", "ない"]] },
  },
  requester: {
    // spec v1.20: 頼み方を登録で分ける（おまかせ／一緒にやる）。毎朝の質問はしない
    q1: { title: "家の人も一緒に雪かきしますか？", options: [["omakase", "おまかせしたい"], ["together", "一緒にやる"]] },
    q2: { title: "どこまで雪かきが要りますか？", options: [["entrance", "玄関前まで"], ["garage", "車庫前まで"], ["road", "道路まで"]] },
  },
};
const STEPS: Step[] = ["role", "place", "q1", "q2", "confirm", "saving"];

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
  const [place, setPlace] = useState<LatLng>();
  const [picking, setPicking] = useState<LatLng>();
  const [q1, setQ1] = useState<string>();
  const [q2, setQ2] = useState<string>();
  const [locating, setLocating] = useState(false);
  const [code, setCode] = useState("");
  const seq = useRef(0);
  const list = useRef<HTMLDivElement>(null);
  const qRole = role === "helper" ? "helper" : "requester";
  const qTitle = (k: "q1" | "q2") => (role === "family" ? Q[qRole][k].title.replace("家の人も", "ご本人も") : Q[qRole][k].title);

  const push = (from: Msg["from"], text: string) => setMsgs((m) => [...m, { id: ++seq.current, from, text }]);
  /** 隊長の吹き出し: 少し「間」をおいて出す（続けて2つ出すときは delay をずらす） */
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
      push("bot", redo ? `${name ? `${name}さん、` : ""}登録をやり直しますね。3つ聞くだけです。` : `${name ? `${name}さん、` : ""}ようこそ！ シマエナ隊長です。3つ聞くだけで登録できます（30秒）。`);
      play("chirp");
    }, 300);
    const t2 = window.setTimeout(() => {
      push("bot", redo ? "もう一度、あなたはどちらですか？" : "まず、あなたはどちらですか？");
      play("chirp");
    }, 1200);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const askPlace = (r: ChatRole) =>
    bot(
      r === "family"
        ? "ありがとうございます。ご家族の家の場所を教えてください。地図には 50m のマスでしか出ず、名前や住所は出ません。"
        : "ありがとうございます。つぎに、家の場所を教えてください。近くの雪かきを知らせるために使います。地図には 50m のマスでしか出ず、名前や住所は出ません。",
    );
  const chooseRole = (r: ChatRole) => {
    setRole(r);
    me(ROLE_LABEL[r]);
    setStep("place");
    askPlace(r);
  };
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
    setPlace(at);
    setPicking(undefined);
    me("🏠 家の場所を決めました");
    setStep("q1");
    bot(`ありがとうございます。あと2つ。${qTitle("q1")}`);
  };
  const answer1 = (v: string, label: string) => {
    setQ1(v);
    me(label);
    setStep("q2");
    bot(`最後の1つ。${qTitle("q2")}`);
  };
  const answer2 = (v: string, label: string) => {
    setQ2(v);
    me(label);
    setStep("confirm");
    bot(role === "family" ? "これでご家族の登録ができます。終わると、あなたにも知らせが届きます。" : "これで登録できます！ 登録したら、そのままソロ出動（自分の家の雪かき）へ案内します。");
  };
  const save = async () => {
    if (!role || !place || !q1 || !q2) return;
    setStep("saving");
    me(role === "family" ? "登録する" : "はじめる！");
    const err = await onRegister({ role, location: place, q1, q2 });
    if (err) {
      bot(`${err} もう一度「はじめる！」を押してください。`);
      setStep("confirm");
    }
  };
  const restart = () => {
    setRole(undefined);
    setPlace(undefined);
    setQ1(undefined);
    setQ2(undefined);
    setStep("role");
    me("最初からやり直す");
    bot("わかりました。あなたはどちらですか？");
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

  const replies: Reply[] =
    step === "role"
      ? [
          { key: "helper", label: ROLE_LABEL.helper, sub: "近所の雪かきを10分から", onClick: () => chooseRole("helper") },
          { key: "requester", label: ROLE_LABEL.requester, sub: "10cm 積もった朝、近所に応援が届く（自分も手伝えます）", onClick: () => chooseRole("requester") },
          { key: "family", label: ROLE_LABEL.family, sub: "離れて住む親の家を登録。終わると知らせが届きます", onClick: () => chooseRole("family") },
        ]
      : step === "place"
        ? [
            ...(role !== "family" ? [{ key: "here", label: locating ? "いまの場所を調べています…" : "📍 いま家にいる（いまの場所）", primary: true, onClick: here }] : []),
            { key: "map", label: "🗺 地図で選ぶ", primary: role === "family", onClick: () => setPicking(center) },
          ]
        : step === "q1" || step === "q2"
          ? Q[qRole][step].options.map(([v, label]) => ({ key: v, label, onClick: () => (step === "q1" ? answer1(v, label) : answer2(v, label)) }))
          : step === "confirm"
            ? [{ key: "go", label: role === "family" ? "登録する" : "はじめる！", primary: true, onClick: save }]
            : [];
  const stepNo = Math.max(0, STEPS.indexOf(step));

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {picking && <PinAdjust start={picking} emoji="🏠" onDone={placed} onCancel={() => setPicking(undefined)} />}
      {step !== "code" && (
        <ol className="flex shrink-0 gap-1.5" aria-label="すすみぐあい">
          {(["役割", "家の場所", "2問"] as const).map((label, k) => (
            <li key={label} className={`h-2 flex-1 rounded-full ${stepNo >= [0, 1, 2][k] ? "bg-lamp" : "bg-ink/15"}`} aria-label={label} />
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
      {step === "code" ? (
        <div className="shrink-0 space-y-2">
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
          <button onClick={restart} className="w-full text-center text-base underline">
            ‹ もどる
          </button>
        </div>
      ) : (
        <div className="shrink-0 space-y-2">
          <div className={`grid gap-2 ${replies.length === 3 && step !== "role" ? "grid-cols-3" : replies.length === 2 && step !== "place" ? "grid-cols-2" : "grid-cols-1"}`}>
            {replies.map((r, k) => (
              <button
                key={r.key}
                type="button"
                disabled={typing || locating}
                onClick={r.onClick}
                className={`chat-pop min-h-14 rounded-2xl px-3 text-lg font-bold leading-tight ring-2 disabled:opacity-60 ${r.primary || step === "q1" || step === "q2" ? (r.primary ? "bg-lamp text-white ring-lamp" : "bg-card ring-ink/15") : "bg-card text-left ring-ink/15"} ${step === "role" ? "py-2 text-left" : ""}`}
                style={{ animationDelay: `${k * 0.08}s` }}
              >
                {r.label}
                {r.sub && <span className="block text-sm font-normal text-ink-soft">{r.sub}</span>}
              </button>
            ))}
          </div>
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
            <span className="truncate text-ink-soft">LINE は本人の確認だけに使います</span>
          </div>
        </div>
      )}
    </div>
  );
}
