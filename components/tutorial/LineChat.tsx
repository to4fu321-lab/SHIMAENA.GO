"use client";

// 使い方の中の「隊長トーク」の練習版。本物と同じ文面・同じボタンで、押すと会話が進む（何も送信しない）。
import { useEffect, useRef } from "react";
import Mascot from "../Mascot";

export type ChatMsg = { id: string; from: "bot" | "me"; text?: string; photo?: boolean };
export type ChatReply = { label: string; onClick: () => void; icon?: "camera" | "image" };

/** 写真の吹き出し（雪をどけた玄関から道路まで） */
function PhotoThumb() {
  return (
    <svg viewBox="0 0 120 84" className="block h-24 w-auto rounded-xl" aria-label="雪をどけた玄関の写真">
      <rect width="120" height="84" fill="#dfe9f1" />
      <path d="M0 40 L30 20 L60 40 V84 H0 Z" fill="#c9d8e4" />
      <path d="M-2 41 L30 18 L62 41" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
      <rect x="24" y="50" width="12" height="16" rx="2" fill="#f3c48a" />
      <path d="M0 84 L0 70 C30 64 90 64 120 70 V84 Z" fill="#fff" />
      <path d="M44 84 L54 62 H66 L80 84 Z" fill="#8fa3b5" />
      <path d="M48 84 L56 64 M76 84 L64 64" stroke="#fff" strokeWidth="2" />
    </svg>
  );
}

function ReplyIcon({ icon }: { icon: "camera" | "image" }) {
  return icon === "camera" ? (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <path d="M4 8 H8 L10 5 H14 L16 8 H20 V19 H4 Z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M4 16 L9 11 L13 15 L16 12 L20 16" />
    </svg>
  );
}

export default function LineChat({ messages, replies = [], className = "" }: { messages: ChatMsg[]; replies?: ChatReply[]; className?: string }) {
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = body.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  return (
    <div className={`flex min-h-0 flex-col overflow-hidden rounded-3xl bg-card shadow-md ring-1 ring-ink/15 ${className}`} role="group" aria-label="隊長トーク（練習）">
      {/* トークの見出し */}
      <div className="flex shrink-0 items-center gap-2 border-b border-ink/10 px-3 py-1.5">
        <span className="grid size-7 place-items-center rounded-full bg-ice-soft">
          <Mascot size={24} />
        </span>
        <b className="flex-1 text-base">隊長トーク</b>
        <span className="rounded-full bg-lamp px-2 py-0.5 text-xs font-bold text-white">練習</span>
      </div>
      {/* トーク */}
      <div ref={body} className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-[#e3ebf3] px-3 py-2" aria-live="polite">
        {messages.map((m) =>
          m.from === "bot" ? (
            <div key={m.id} className="tut-pop flex items-end gap-1.5">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-card">
                <Mascot size={24} />
              </span>
              <p className="max-w-[80%] whitespace-pre-line rounded-2xl rounded-bl-md bg-card px-3 py-1.5 text-base leading-snug shadow-sm">{m.text}</p>
            </div>
          ) : (
            <div key={m.id} className="tut-pop flex justify-end">
              {m.photo ? (
                <PhotoThumb />
              ) : (
                <p className="max-w-[80%] rounded-2xl rounded-br-md bg-[#b8e994] px-3 py-1.5 text-base font-bold leading-snug text-ink shadow-sm">{m.text}</p>
              )}
            </div>
          ),
        )}
      </div>
      {/* 吹き出しの下の小さなボタン */}
      {replies.length > 0 && (
        <div className="flex shrink-0 gap-2 overflow-x-auto border-t border-ink/10 bg-card px-2 py-2">
          {replies.map((r) => (
            <button
              key={r.label}
              type="button"
              onClick={r.onClick}
              className="flex min-h-11 shrink-0 items-center gap-1 rounded-full bg-card px-4 text-base font-bold text-ink ring-2 ring-ink/25 active:scale-95"
            >
              {r.icon && <ReplyIcon icon={r.icon} />}
              {r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
