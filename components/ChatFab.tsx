"use client";
// いつでも隊長トーク（spec v1.43。11/8 本人の指示「💬を常に画面に置いておく。邪魔な時は動かせるように」）:
// 下のタブのある画面に、隊長トークへの丸いボタンを浮かべておく。指で押したまま動かすと好きな場所へ移せて、
// 離すと左右の近いほうの端に寄る。場所はこの端末に覚える。隊長トークの画面では出さない。
import Link from "next/link";
import { useRef, useState } from "react";
import Mascot from "./Mascot";
import { useClientValue } from "./useClientValue";

const POS_KEY = "shimaena-chat-fab";
/** ボタンの大きさ（px） */
export const FAB_SIZE = 64;
/** 端からのすき間（px） */
const EDGE = 10;
/** これより動いたら「動かした」とみなす（タップと分ける。px） */
const DRAG_PX = 8;

export interface FabPos {
  /** 左右どちらの端に寄せるか */
  side: "left" | "right";
  /** 画面の高さに対する上からの位置（0〜1） */
  y: number;
}

/** 既定: 右下（下のタブの少し上） */
export const DEFAULT_FAB_POS: FabPos = { side: "right", y: 0.72 };

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

/** 指を離した場所から、寄せる端と高さを決める。上下は画面の中に収める（上 8%〜下 82%: 見出しと下のタブを隠さない） */
export function snapFab(x: number, y: number, w: number, h: number): FabPos {
  const side = x + FAB_SIZE / 2 < w / 2 ? "left" : "right";
  const ratio = h > 0 ? y / h : DEFAULT_FAB_POS.y;
  return { side, y: Math.min(0.82, Math.max(0.08, ratio)) };
}

function readPos(): FabPos {
  try {
    return parseFabPos(localStorage.getItem(POS_KEY));
  } catch {
    return DEFAULT_FAB_POS; // 覚えられない端末: 既定の場所
  }
}

export default function ChatFab({ q = "", label = "隊長に話す" }: { q?: string; label?: string }) {
  // 覚えた場所（画面が出たあとに読む）。動かしたら moved に入れて、こちらを優先する
  const saved = useClientValue(DEFAULT_FAB_POS, readPos);
  const [movedPos, setPos] = useState<FabPos | null>(null);
  const pos = movedPos ?? saved;
  /** 動かしている途中の場所（px）。動かしていなければ null */
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const start = useRef<{ px: number; py: number; x: number; y: number; moved: boolean } | null>(null);
  const moved = useRef(false);


  const onDown = (e: React.PointerEvent<HTMLAnchorElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    start.current = { px: e.clientX, py: e.clientY, x: r.left, y: r.top, moved: false };
    moved.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent<HTMLAnchorElement>) => {
    const s = start.current;
    if (!s) return;
    const dx = e.clientX - s.px;
    const dy = e.clientY - s.py;
    if (!s.moved && Math.hypot(dx, dy) < DRAG_PX) return;
    s.moved = true;
    moved.current = true;
    const w = window.innerWidth;
    const h = window.innerHeight;
    setDrag({ x: Math.min(w - FAB_SIZE, Math.max(0, s.x + dx)), y: Math.min(h - FAB_SIZE, Math.max(0, s.y + dy)) });
  };
  const onUp = () => {
    const s = start.current;
    start.current = null;
    if (!s?.moved || !drag) {
      setDrag(null);
      return;
    }
    const next = snapFab(drag.x, drag.y, window.innerWidth, window.innerHeight);
    setPos(next);
    setDrag(null);
    try {
      localStorage.setItem(POS_KEY, JSON.stringify(next));
    } catch {
      /* 覚えられなくても動かせる */
    }
  };

  const style: React.CSSProperties = drag
    ? { left: drag.x, top: drag.y, transition: "none" }
    : { top: `calc(${pos.y * 100}% - ${FAB_SIZE / 2}px)`, ...(pos.side === "left" ? { left: EDGE } : { right: EDGE }) };

  return (
    <Link
      href={`/chat${q}`}
      aria-label={`${label}（押したまま動かすと場所を変えられます）`}
      data-sound="tap"
      draggable={false}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onClick={(e) => {
        if (moved.current) {
          e.preventDefault(); // 動かしただけのときは開かない
          moved.current = false;
        }
      }}
      onContextMenu={(e) => e.preventDefault()}
      style={{ ...style, width: FAB_SIZE, height: FAB_SIZE, touchAction: "none" }}
      className={`fixed z-40 grid select-none place-items-center rounded-full bg-card shadow-lg ring-2 ring-lamp transition-[top,left,right] duration-200 [-webkit-touch-callout:none] ${drag ? "scale-110 opacity-90" : "active:scale-95"}`}
    >
      <Mascot size={44} />
      <span className="absolute -right-1 -top-1 grid size-7 place-items-center rounded-full bg-lamp text-base shadow" aria-hidden="true">
        💬
      </span>
    </Link>
  );
}
