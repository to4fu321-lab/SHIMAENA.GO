"use client";
// いつでも隊長トーク（spec v1.43・v1.44・v1.45）: 下のタブのある画面の端から、シマエナガがのぞいている。
// 11/8 本人の指摘「少し邪魔」→「端から顔を出してスワイプで」→「半分埋まって見える。もっとのぞいている絵に。引っぱると体が少し伸びてチャットへ。体は全部出てこない」:
// - 端からのぞく専用の絵（PeekBird）。内側へ引っぱると体が横に伸び、一定まで引っぱるか、タップでも、ぐーんと伸びて隊長トークへ
// - 上下に動かすと場所を変えられ、反対の端まで持っていけばそちらの端へ。場所はこの端末に覚える
// - 隊長トークの画面では出さない
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useClientValue } from "./useClientValue";

const POS_KEY = "shimaena-chat-fab";
/** 動かすときの目安の大きさ（px） */
export const FAB_SIZE = 60;
/** これより動いたら「動かした」とみなす（タップと分ける。px） */
const DRAG_PX = 8;
/** 内側へこれだけ引っぱったら隊長トークを開く（px） */
export const SWIPE_OPEN_PX = 36;

export interface FabPos {
  /** 左右どちらの端から顔を出すか */
  side: "left" | "right";
  /** 画面の高さに対する上からの位置（0〜1） */
  y: number;
}

/** 既定: 右の端の真ん中より少し下（下のボタンに重ならない高さ） */
export const DEFAULT_FAB_POS: FabPos = { side: "right", y: 0.58 };

/** 覚えた場所を読む（壊れていれば既定） */
export function parseFabPos(raw: string | null): FabPos {
  try {
    const v = JSON.parse(raw ?? "") as Partial<FabPos>;
    if ((v.side === "left" || v.side === "right") && typeof v.y === "number" && v.y >= 0 && v.y <= 1) return { side: v.side, y: v.y };
  } catch {
    /* 既定へ */
  }
  return DEFAULT_FAB_POS;
}

/** 指を離した場所から、顔を出す端と高さを決める。上下は画面の中に収める（上 8%〜下 82%: 見出しと下のタブを隠さない） */
export function snapFab(x: number, y: number, w: number, h: number): FabPos {
  const side = x + FAB_SIZE / 2 < w / 2 ? "left" : "right";
  const ratio = h > 0 ? y / h : DEFAULT_FAB_POS.y;
  return { side, y: Math.min(0.82, Math.max(0.08, ratio)) };
}

/** 横の動き（px）を「内側へ引っぱった長さ」に。右の端なら左へ動かすと正 */
export function inwardPx(side: FabPos["side"], dx: number): number {
  return side === "right" ? -dx : dx;
}

function readPos(): FabPos {
  try {
    return parseFabPos(localStorage.getItem(POS_KEY));
  } catch {
    return DEFAULT_FAB_POS; // 覚えられない端末: 既定の場所
  }
}

type Mode = "none" | "pull" | "move";

/** 見えている部分の幅・高さ（px）。押せる広さもこれ */
export const PEEK_W = 50;
export const PEEK_H = 68;
/** 引っぱったときの体の伸び（1 = そのまま）。いちばん伸びても体の半分は画面の外 */
export function stretchOf(pull: number): number {
  return 1 + Math.min(Math.max(pull, 0), 70) / 55;
}

/**
 * 端からのぞくシマエナガ（右の端から。左の端は左右を反転して使う）。x=50 が画面の端で、体の残りは画面の外。
 * 首をかしげて、黒い目とくちばし、ほっぺ、マフラーが見える
 */
function PeekBird({ stretch }: { stretch: number }) {
  return (
    <svg
      viewBox="0 0 50 68"
      width={PEEK_W}
      height={PEEK_H}
      aria-hidden="true"
      className="overflow-visible drop-shadow-[0_2px_4px_rgba(31,42,55,0.28)]"
      style={{ transform: `scaleX(${stretch})`, transformOrigin: "100% 50%", transition: stretch === 1 ? "transform 0.25s cubic-bezier(.3,1.6,.5,1)" : "none" }}
    >
      <g transform="rotate(-14 50 40)">
        {/* 体（ふわふわの白） */}
        <ellipse cx="50" cy="40" rx="42" ry="27" fill="#ffffff" stroke="#c9d6e2" strokeWidth="1.5" />
        {/* 頭の上の毛 */}
        <path d="M30 15 q4 -6 9 -2 q3 -5 8 -1" fill="none" stroke="#c9d6e2" strokeWidth="1.6" strokeLinecap="round" />
        {/* 目（ぱっちり） */}
        <circle cx="24" cy="34" r="4.2" fill="#24313f" />
        <circle cx="25.4" cy="32.6" r="1.4" fill="#ffffff" />
        {/* くちばし */}
        <path d="M8.5 39 L14.5 36.2 L14.5 41.6 Z" fill="#24313f" />
        {/* ほっぺ */}
        <ellipse cx="27" cy="44.5" rx="4.6" ry="2.6" fill="#f4b6c2" opacity="0.85" />
        {/* マフラー */}
        <path d="M14 56 Q32 64 50 61 L50 67.5 Q30 70.5 12 61.5 Z" fill="var(--lamp)" />
      </g>
      {/* 端をつかむ羽 */}
      <path d="M50 58 q-9 1 -11 6 q6 1 11 -1 Z" fill="#ffffff" stroke="#c9d6e2" strokeWidth="1.2" />
    </svg>
  );
}

export default function ChatFab({ q = "", label = "隊長に話す" }: { q?: string; label?: string }) {
  const router = useRouter();
  const href = `/chat${q}`;
  const saved = useClientValue(DEFAULT_FAB_POS, readPos);
  const [movedPos, setPos] = useState<FabPos | null>(null);
  const pos = movedPos ?? saved;
  /** 動かしている途中: pull = 内側へ引っぱっている長さ、move = 指の場所（side と高さ） */
  const [live, setLive] = useState<{ mode: Mode | "open"; pull: number; side: FabPos["side"]; y: number }>({ mode: "none", pull: 0, side: "right", y: 0 });
  const start = useRef<{ px: number; py: number; mode: Mode } | null>(null);
  const used = useRef(false);

  const open = () => {
    setLive((l) => ({ ...l, mode: "open", pull: 90 })); // ぐーんと伸びてから
    window.setTimeout(() => router.push(href), 160);
  };

  const onDown = (e: React.PointerEvent<HTMLAnchorElement>) => {
    start.current = { px: e.clientX, py: e.clientY, mode: "none" };
    used.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent<HTMLAnchorElement>) => {
    const s = start.current;
    if (!s) return;
    const dx = e.clientX - s.px;
    const dy = e.clientY - s.py;
    if (s.mode === "none") {
      if (Math.hypot(dx, dy) < DRAG_PX) return;
      // 最初の動きで決める: 内側へ横に動かしたら「引っぱる」、それ以外は「場所を動かす」
      s.mode = Math.abs(dx) > Math.abs(dy) && inwardPx(pos.side, dx) > 0 ? "pull" : "move";
      used.current = true;
    }
    if (s.mode === "pull") {
      setLive({ mode: "pull", pull: Math.max(0, inwardPx(pos.side, dx)), side: pos.side, y: 0 });
    } else {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const y = Math.min(0.82, Math.max(0.08, e.clientY / h));
      setLive({ mode: "move", pull: 0, side: e.clientX < w / 2 ? "left" : "right", y });
    }
  };
  const onUp = () => {
    const s = start.current;
    start.current = null;
    if (s?.mode === "pull" && live.pull >= SWIPE_OPEN_PX) return open();
    if (s?.mode === "move" && live.mode === "move") {
      const next: FabPos = { side: live.side, y: live.y };
      setPos(next);
      try {
        localStorage.setItem(POS_KEY, JSON.stringify(next));
      } catch {
        /* 覚えられなくても動かせる */
      }
    }
    setLive({ mode: "none", pull: 0, side: pos.side, y: 0 });
  };

  const side = live.mode === "move" ? live.side : pos.side;
  const y = live.mode === "move" ? live.y : pos.y;
  const stretch = live.mode === "pull" || live.mode === "open" ? stretchOf(live.pull) : 1;

  return (
    <Link
      href={href}
      aria-label={`${label}（引っぱるか、押すと開きます。上下に動かすと場所を変えられます）`}
      data-sound="tap"
      draggable={false}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onClick={(e) => {
        e.preventDefault();
        if (used.current) {
          used.current = false; // 動かした・引っぱったときは、離したときの処理に任せる
          return;
        }
        open(); // タップでも、ぐーんと伸びて開く
      }}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        top: `calc(${y * 100}% - ${PEEK_H / 2}px)`,
        width: PEEK_W,
        height: PEEK_H,
        touchAction: "none",
        ...(side === "left" ? { left: 0, transform: "scaleX(-1)" } : { right: 0 }),
        transition: live.mode === "move" ? "none" : "top 0.2s",
      }}
      className={`fixed z-40 block select-none [-webkit-touch-callout:none] ${live.mode === "move" ? "opacity-90" : ""}`}
    >
      <PeekBird stretch={stretch} />
      {/* 吹き出し（左の端では反転を戻す） */}
      <span
        className="absolute -top-2 left-0 grid size-6 place-items-center rounded-full bg-lamp text-sm shadow"
        style={side === "left" ? { transform: "scaleX(-1)" } : undefined}
        aria-hidden="true"
      >
        💬
      </span>
    </Link>
  );
}
