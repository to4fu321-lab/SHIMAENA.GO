"use client";
// いつでも隊長トーク（spec v1.43・v1.44）: 下のタブのある画面の端から、シマエナガが半分だけ顔を出している。
// 11/8 本人の指摘「少し邪魔」→ 本人の案「端から少し顔を出して、スワイプで起動」:
// - 画面の内側へスワイプ（引っぱり出す）すると隊長トーク。タップでも開く（スワイプが苦手な人のため）
// - 上下に引っぱると場所を変えられる。反対の端まで持っていけば、そちらの端に移る。場所はこの端末に覚える
// - 隊長トークの画面では出さない
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import Mascot from "./Mascot";
import { useClientValue } from "./useClientValue";

const POS_KEY = "shimaena-chat-fab";
/** 丸の大きさ（px） */
export const FAB_SIZE = 60;
/** 画面の外に隠す長さ（px）。残りが顔を出す */
export const FAB_HIDDEN = 26;
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

export default function ChatFab({ q = "", label = "隊長に話す" }: { q?: string; label?: string }) {
  const router = useRouter();
  const href = `/chat${q}`;
  const saved = useClientValue(DEFAULT_FAB_POS, readPos);
  const [movedPos, setPos] = useState<FabPos | null>(null);
  const pos = movedPos ?? saved;
  /** 動かしている途中: pull = 内側へ引っぱっている長さ、move = 指の場所（丸の左上） */
  const [live, setLive] = useState<{ mode: Mode; pull: number; x: number; y: number }>({ mode: "none", pull: 0, x: 0, y: 0 });
  const start = useRef<{ px: number; py: number; x: number; y: number; mode: Mode } | null>(null);
  const used = useRef(false);

  const onDown = (e: React.PointerEvent<HTMLAnchorElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    start.current = { px: e.clientX, py: e.clientY, x: r.left, y: r.top, mode: "none" };
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
      // 最初の動きで決める: 内側へ横に動かしたら「引っぱり出す」、それ以外は「場所を動かす」
      s.mode = Math.abs(dx) > Math.abs(dy) && inwardPx(pos.side, dx) > 0 ? "pull" : "move";
      used.current = true;
    }
    if (s.mode === "pull") {
      setLive({ mode: "pull", pull: Math.min(FAB_SIZE, Math.max(0, inwardPx(pos.side, dx))), x: 0, y: 0 });
    } else {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setLive({ mode: "move", pull: 0, x: Math.min(w - FAB_SIZE, Math.max(0, s.x + dx)), y: Math.min(h - FAB_SIZE, Math.max(0, s.y + dy)) });
    }
  };
  const onUp = () => {
    const s = start.current;
    start.current = null;
    if (s?.mode === "pull" && live.pull >= SWIPE_OPEN_PX) {
      router.push(href);
    } else if (s?.mode === "move" && live.mode === "move") {
      const next = snapFab(live.x, live.y, window.innerWidth, window.innerHeight);
      setPos(next);
      try {
        localStorage.setItem(POS_KEY, JSON.stringify(next));
      } catch {
        /* 覚えられなくても動かせる */
      }
    }
    setLive({ mode: "none", pull: 0, x: 0, y: 0 });
  };

  const edge = -FAB_HIDDEN + (live.mode === "pull" ? live.pull : 0);
  const style: React.CSSProperties =
    live.mode === "move"
      ? { left: live.x, top: live.y, transition: "none" }
      : {
          top: `calc(${pos.y * 100}% - ${FAB_SIZE / 2}px)`,
          ...(pos.side === "left" ? { left: edge } : { right: edge }),
          ...(live.mode === "pull" ? { transition: "none" } : {}),
        };

  return (
    <Link
      href={href}
      aria-label={`${label}（内側へスワイプするか、押すと開きます。上下に動かすと場所を変えられます）`}
      data-sound="tap"
      draggable={false}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onClick={(e) => {
        if (used.current) {
          e.preventDefault(); // 動かした・引っぱったときは、離したときの処理に任せる
          used.current = false;
        }
      }}
      onContextMenu={(e) => e.preventDefault()}
      style={{ ...style, width: FAB_SIZE, height: FAB_SIZE, touchAction: "none" }}
      className={`fixed z-40 grid select-none place-items-center rounded-full bg-card/95 shadow-md ring-2 ring-lamp transition-[top,left,right] duration-200 [-webkit-touch-callout:none] ${live.mode === "move" ? "scale-105 opacity-90" : ""}`}
    >
      {/* 顔は見えている側に寄せる（のぞいている感じ） */}
      <span className={pos.side === "right" ? "-translate-x-2.5" : "translate-x-2.5"}>
        <Mascot size={40} />
      </span>
      <span
        className={`absolute -top-1.5 grid size-6 place-items-center rounded-full bg-lamp text-sm shadow ${pos.side === "right" ? "left-0" : "right-0"}`}
        aria-hidden="true"
      >
        💬
      </span>
    </Link>
  );
}
