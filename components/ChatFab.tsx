"use client";
// いつでも隊長トーク（spec v1.43・v1.44・v1.45）: 下のタブのある画面の端から、シマエナガがのぞいている。
// 11/8 本人の指摘「少し邪魔」→「端から顔を出してスワイプで」→「半分埋まって見える。もっとのぞいている絵に。引っぱると体が少し伸びてチャットへ。体は全部出てこない」:
// - 端からのぞく専用の絵（PeekBird）。内側へ引っぱると体が指についてゴムのように伸び（縦は少し細く）、画面の 1/3 まで引っぱるか、タップで、ぐーんと伸びて隊長トークへ
// - 1/3 に足りなければ、ばねで少し行きすぎて縮み、ぽよよんと戻る（11/8 本人の指示「伸縮するように。弾力性ある感じで戻る」）
// - 上下に動かすと場所を変えられ、反対の端まで持っていけばそちらの端へ。場所はこの端末に覚える
// - 隊長トークの画面では出さない
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useClientValue } from "./useClientValue";

const POS_KEY = "shimaena-chat-fab";
/** 動かすときの目安の大きさ（px） */
export const FAB_SIZE = 60;
/** これより動いたら「動かした」とみなす（タップと分ける。px） */
const DRAG_PX = 8;
/** 画面の幅のこの割合まで引っぱったら隊長トークを開く（11/8 本人の指示「画面の4分の1」→「3分の1」） */
export const OPEN_RATIO = 1 / 3;
/** 開くまでの長さ（px）。画面の幅の 1/3 */
export function openPx(width: number): number {
  return Math.round(width * OPEN_RATIO);
}

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
/**
 * 指で引っぱった長さ（px）を、体の伸び（px）に。開く長さ（open）までは指にぴったりついてきて、
 * その先はゴムのように重くなる。マイナス（戻るときの行きすぎ）は縮み
 */
export function bodyPull(pull: number, open: number): number {
  if (pull <= open) return pull;
  return open + (pull - open) * 0.3;
}

/** 体が伸びると縦は少し細く、縮むと少し太く（ゴムの体の感じ）。1 = そのまま */
export function squashOf(pull: number): number {
  return pull >= 0 ? 1 / Math.sqrt(1 + pull / 160) : 1 + Math.min(-pull, 30) / 50;
}

/**
 * 端からのぞくシマエナガ（右の端から。左の端は左右を反転して使う）。右の端（x = 幅）が画面の端で、体の残りは画面の外。
 * 引っぱると、まんまるの頭が指について前へ出て、首がきゅっとくびれた「おもち」の形にのびる（11/8 本人「もっと可愛い形で」）。
 * 引っぱっている間は目が「><」になり、小さな羽をぱたぱたさせ、ほっぺが赤くなる。縮むときは頭がつぶれる。体は全部は出てこない
 */
function PeekBird({ pull }: { pull: number }) {
  const p = Math.max(pull, -18);
  const w = PEEK_W + Math.max(p, 0);
  const sq = squashOf(p);
  const headR = 24;
  const hx = w - 24 - p; // 頭の真ん中（引っぱった分だけ前へ。縮むときは端へ寄る）
  const hy = 38;
  const stretched = p > 18;
  const headSq = p < 0 ? sq : 1; // 縮むときだけ頭もつぶれる
  // 頭とおしりをなめらかにつなぐ「おもち」の輪郭。のびるほど、まんなかが少しくびれる（細い棒にはしない）
  const bx = w + 4;
  const by = hy + 4;
  const bR = 26 * (p < 0 ? sq : 1);
  const len = bx - hx;
  const pinch = Math.min(13, Math.max(p, 0) / 7);
  const body =
    `M${hx} ${hy - headR} ` +
    `C${hx + len * 0.3} ${hy - headR + pinch * 1.6} ${bx - len * 0.45} ${by - bR + pinch * 1.4} ${bx} ${by - bR} ` +
    `L${bx} ${by + bR} ` +
    `C${bx - len * 0.45} ${by + bR - pinch * 1.4} ${hx + len * 0.3} ${hy + headR - pinch * 1.6} ${hx} ${hy + headR} Z`;
  const tilt = -12 * Math.max(0, 1 - Math.max(p, 0) / 60); // 引っぱるほど首がまっすぐに
  const flap = stretched ? Math.sin(p / 6) * 22 : 0; // 羽のぱたぱた（引っぱる長さで動く）
  const line = "#c9d6e2";
  const shapes = (stroke: boolean) => {
    const st = stroke ? { stroke: line, strokeWidth: 3 } : { stroke: "none" };
    return (
      <>
        {/* 端のおしり（ふわふわの体の残り） */}
        <ellipse cx={bx} cy={by} rx={26} ry={bR} fill="#ffffff" {...st} />
        {/* のびるおもちの体 */}
        {p > 2 && <path d={body} fill="#ffffff" {...st} />}
        {/* まんまるの頭 */}
        <ellipse cx={hx} cy={hy} rx={headR / headSq ** 0.5} ry={headR * headSq} fill="#ffffff" {...st} />
      </>
    );
  };
  return (
    <svg viewBox={`0 0 ${w} 68`} width={w} height={PEEK_H} aria-hidden="true" className="overflow-visible drop-shadow-[0_2px_4px_rgba(31,42,55,0.28)]">
      <g transform={`rotate(${tilt} ${w} 40)`}>
        {/* 小さな羽（頭のうしろ。のびているとぱたぱた） */}
        <ellipse cx={hx + 16} cy={hy + 14} rx={9} ry={5.5} fill="#ffffff" stroke={line} strokeWidth="1.4" transform={`rotate(${-25 + flap} ${hx + 10} ${hy + 14})`} />
        {/* ふちどり → 白でぬる（頭と首とおしりが1つにつながって見える） */}
        {shapes(true)}
        {shapes(false)}
        {/* マフラー（首に巻く。のびると細く） */}
        <path
          d={`M${hx - 13} ${hy + 18} Q${hx + 4} ${hy + 25} ${hx + 20} ${hy + 20} L${hx + 22} ${hy + 25.5} Q${hx + 4} ${hy + 31} ${hx - 15} ${hy + 23} Z`}
          fill="var(--lamp)"
        />
        <path d={`M${hx + 14} ${hy + 22} l5 10 l5 -2 l-3 -9 Z`} fill="var(--lamp)" />
        {/* 顔（頭についていく） */}
        <g transform={`translate(${hx - 24} ${hy - 38})`}>
          <path d="M18 15 q4 -6 9 -2 q3 -5 8 -1" fill="none" stroke={line} strokeWidth="1.6" strokeLinecap="round" />
          {stretched ? (
            // ぎゅっとつぶった目「><」
            <path d="M10.5 30.5 L16 34 L10.5 37.5" fill="none" stroke="#24313f" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          ) : (
            <>
              <circle cx="14" cy="34" r="4.2" fill="#24313f" />
              <circle cx="15.4" cy="32.6" r="1.4" fill="#ffffff" />
            </>
          )}
          <path d="M-1.5 39 L4.5 36.2 L4.5 41.6 Z" fill="#24313f" />
          <ellipse cx="17" cy="44.5" rx={stretched ? 5.6 : 4.6} ry={stretched ? 3.2 : 2.6} fill="#f4a3b4" opacity={stretched ? 1 : 0.85} />
        </g>
      </g>
    </svg>
  );
}

/** ばねで戻す: 位置 x（px）を 0 へ。少し行きすぎて縮み、ぽよよんと止まる。毎フレーム onFrame(x)。止めるときは返り値を呼ぶ */
export function springBack(from: number, onFrame: (x: number) => void, opts: { stiffness?: number; damping?: number } = {}): () => void {
  const k = opts.stiffness ?? 420;
  const c = opts.damping ?? 13;
  let x = from;
  let v = 0;
  let last = performance.now();
  let raf = 0;
  const step = (now: number) => {
    const dt = Math.min(0.032, (now - last) / 1000);
    last = now;
    v += (-k * x - c * v) * dt;
    x += v * dt;
    if (Math.abs(x) < 0.4 && Math.abs(v) < 8) {
      onFrame(0);
      return;
    }
    onFrame(x);
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}

export default function ChatFab({ q = "", label = "隊長に話す" }: { q?: string; label?: string }) {
  const router = useRouter();
  const href = `/chat${q}`;
  const saved = useClientValue(DEFAULT_FAB_POS, readPos);
  const [movedPos, setPos] = useState<FabPos | null>(null);
  const pos = movedPos ?? saved;
  /** 場所を動かしている途中（side と高さ）。動かしていなければ null */
  const [moving, setMoving] = useState<FabPos | null>(null);
  /** 体の伸び（px）。引っぱり中は指について、離すとばねで戻る */
  const [pull, setPull] = useState(0);
  const start = useRef<{ px: number; py: number; mode: Mode } | null>(null);
  const used = useRef(false);
  const stopSpring = useRef<(() => void) | null>(null);
  const opening = useRef(false);

  useEffect(() => () => stopSpring.current?.(), []);

  /** ぐーんと伸びてから隊長トークへ */
  const open = (from: number) => {
    if (opening.current) return;
    opening.current = true;
    stopSpring.current?.();
    const target = openPx(window.innerWidth) * 1.15;
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 140);
      setPull(from + (target - from) * (1 - (1 - k) ** 3));
      if (k < 1) requestAnimationFrame(step);
      else {
        router.push(href);
        // 画面が変わったあと（戻ってきたとき）は、のぞく姿に戻す
        window.setTimeout(() => {
          opening.current = false;
          stopSpring.current = springBack(target, setPull);
        }, 400);
      }
    };
    requestAnimationFrame(step);
  };

  const onDown = (e: React.PointerEvent<HTMLAnchorElement>) => {
    stopSpring.current?.();
    start.current = { px: e.clientX, py: e.clientY, mode: "none" };
    used.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent<HTMLAnchorElement>) => {
    const s = start.current;
    if (!s || opening.current) return;
    const dx = e.clientX - s.px;
    const dy = e.clientY - s.py;
    if (s.mode === "none") {
      if (Math.hypot(dx, dy) < DRAG_PX) return;
      // 最初の動きで決める: 内側へ横に動かしたら「引っぱる」、それ以外は「場所を動かす」
      s.mode = Math.abs(dx) > Math.abs(dy) && inwardPx(pos.side, dx) > 0 ? "pull" : "move";
      used.current = true;
    }
    if (s.mode === "pull") {
      setPull(bodyPull(Math.max(0, inwardPx(pos.side, dx)), openPx(window.innerWidth)));
    } else {
      const y = Math.min(0.82, Math.max(0.08, e.clientY / window.innerHeight));
      setMoving({ side: e.clientX < window.innerWidth / 2 ? "left" : "right", y });
    }
  };
  const onUp = () => {
    const s = start.current;
    start.current = null;
    if (s?.mode === "pull") {
      // 画面の 1/3 まで引っぱっていれば開く。足りなければ、ばねでぽよよんと戻る
      if (pull >= openPx(window.innerWidth) - 0.5) open(pull);
      else stopSpring.current = springBack(pull, setPull);
      return;
    }
    if (s?.mode === "move" && moving) {
      setPos(moving);
      try {
        localStorage.setItem(POS_KEY, JSON.stringify(moving));
      } catch {
        /* 覚えられなくても動かせる */
      }
    }
    setMoving(null);
  };

  const side = moving?.side ?? pos.side;
  const y = moving?.y ?? pos.y;
  const width = PEEK_W + Math.max(pull, 0);

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
        open(0); // タップでも、ぐーんと伸びて開く
      }}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        top: `calc(${y * 100}% - ${PEEK_H / 2}px)`,
        width,
        height: PEEK_H,
        touchAction: "none",
        ...(side === "left" ? { left: 0, transform: "scaleX(-1)" } : { right: 0 }),
        transition: moving ? "none" : "top 0.2s",
      }}
      className={`fixed z-40 block select-none [-webkit-touch-callout:none] ${moving ? "opacity-90" : ""}`}
    >
      <PeekBird pull={pull} />
      {/* 吹き出し（体の前についていく。左の端では反転を戻す） */}
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
