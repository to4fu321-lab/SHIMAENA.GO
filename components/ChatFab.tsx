"use client";
// いつでも隊長トーク（spec v1.43〜v1.48）: 下のタブのある画面の端から、シマエナガがのぞいている。
// 11/8 本人の案「💬を常に画面に。邪魔な時は動かせるように」→「端から顔を出してスワイプで」→ 本人の絵コンテ（v1.48）:
// ① 端から内側へ引っぱる ② もちもち伸びる（吹き出しは「チャットへ ←」に変わる） ③ 目が「><」で羽をパタパタ
// ④ 画面の 1/4 まで引っぱると、全身がぴょんと飛び出してチャットへ ⑤ 足りなければ、ぽよんと元の姿に戻ってハート
// - 黒いふちどりの、まんまるでふわふわのシマエナガ（両目・小さなくちばし・ほっぺ・オレンジの足・羽・しっぽ）
// - タップでも飛び出して開く。上下に動かすと場所を変えられ、反対の端まで持っていけばそちらの端へ。場所はこの端末に覚える
// - 効果音（v1.49）: 引っぱり始め「みょーん」、半分を越えると羽「パタパタ」、飛び出し「ぴょーん＋ピヨッ」、戻る「ぽよよん」→ ♥「ピヨッ」
// - 隊長トークの画面では出さない
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { play } from "@/lib/sound/engine";
import { useClientValue } from "./useClientValue";

const POS_KEY = "shimaena-chat-fab";
/** 動かすときの目安の大きさ（px） */
export const FAB_SIZE = 60;
/** これより動いたら「動かした」とみなす（タップと分ける。px） */
const DRAG_PX = 8;
/** 画面の幅のこの割合まで引っぱったら、飛び出してチャットへ（11/8 本人の絵コンテ「4分の1行ったら出てきてチャットへ」） */
export const OPEN_RATIO = 1 / 4;
/** 開くまでの長さ（px）。画面の幅の 1/4 */
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

/** 見えている部分の幅・高さ（px）。押せる広さもこれ */
export const PEEK_W = 54;
export const PEEK_H = 74;

/** 体が伸びると縦は少し細く、縮むと少し太く（もちもちの体）。1 = そのまま */
export function squashOf(pull: number): number {
  return pull >= 0 ? 1 / Math.sqrt(1 + pull / 160) : 1 + Math.min(-pull, 30) / 50;
}

/** ばねで戻す: 位置 x（px）を 0 へ。少し行きすぎて縮み、ぽよよんと止まる。毎フレーム onFrame(x)、止まったら onDone。止めるときは返り値を呼ぶ */
export function springBack(from: number, onFrame: (x: number) => void, onDone?: () => void, opts: { stiffness?: number; damping?: number } = {}): () => void {
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
      onDone?.();
      return;
    }
    onFrame(x);
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}

// ---- 絵（どれも右の端から左を向く。左の端では外側で左右を反転する） ----
const INK = "#3a3f4e"; // ふちどり
const FOOT = "#e8894f";
const CHEEK = "#f6a9b9";

/** 顔（両目・くちばし・ほっぺ）。(cx, cy) は頭の真ん中。squint で「><」 */
function Face({ cx, cy, squint }: { cx: number; cy: number; squint: boolean }) {
  return (
    <g>
      {squint ? (
        <>
          <path d={`M${cx - 17} ${cy - 5} l5 3 l-5 3`} fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d={`M${cx - 1} ${cy - 5} l-5 3 l5 3`} fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <>
          <circle cx={cx - 14} cy={cy - 2} r="3" fill={INK} />
          <circle cx={cx - 13} cy={cy - 3} r="0.9" fill="#fff" />
          <circle cx={cx - 2} cy={cy - 2} r="3" fill={INK} />
          <circle cx={cx - 1} cy={cy - 3} r="0.9" fill="#fff" />
        </>
      )}
      <path d={`M${cx - 10} ${cy + 2} l2.5 3.2 l2.5 -3.2 Z`} fill={INK} />
      <ellipse cx={cx - 21} cy={cy + 6} rx="4.6" ry="3" fill={CHEEK} opacity={squint ? 1 : 0.85} />
      <ellipse cx={cx + 5} cy={cy + 6} rx="4.6" ry="3" fill={CHEEK} opacity={squint ? 1 : 0.85} />
    </g>
  );
}

/** 小さな羽（体の背中）。flap は角度 */
function Wing({ x, y, flap }: { x: number; y: number; flap: number }) {
  return <path d={`M${x} ${y} q12 -7 22 1 q-8 9 -22 -1 Z`} fill="#fff" stroke={INK} strokeWidth="2" strokeLinejoin="round" transform={`rotate(${flap} ${x} ${y})`} />;
}

/** オレンジの足（2本） */
function Feet({ x, y }: { x: number; y: number }) {
  return (
    <g fill={FOOT} stroke={INK} strokeWidth="1.2">
      <ellipse cx={x} cy={y} rx="3.6" ry="2.4" />
      <ellipse cx={x + 9} cy={y} rx="3.6" ry="2.4" />
    </g>
  );
}

/**
 * 端からのぞくシマエナガ。右の端（x = 幅）が画面の端で、体の残りは画面の外。
 * 引っぱると、まんまるの頭が指について前へ出て、体がもちもち伸びる（足と羽は体の下と背中に）。
 * 引っぱっている間は「><」で羽をパタパタ。縮むときは頭がつぶれる
 */
function PeekBird({ pull }: { pull: number }) {
  const p = Math.max(pull, -18);
  const w = PEEK_W + Math.max(p, 0);
  const sq = squashOf(p);
  const R = 26; // 頭（まんまるの体）の半径
  const hx = w - 26 - p; // 頭の真ん中（引っぱった分だけ前へ。縮むときは端へ寄る）
  const hy = 40;
  const pulling = p > 10;
  const headSq = p < 0 ? sq : 1;
  // 頭と端の向こうのおしりを、まんなかが少しくびれた輪郭でつなぐ
  const bx = w + 14;
  const by = hy + 3;
  const bR = 25 * (p < 0 ? sq : 1);
  const len = bx - hx;
  const pinch = Math.min(10, Math.max(p, 0) / 8);
  const body =
    `M${hx} ${hy - R} ` +
    `C${hx + len * 0.3} ${hy - R + pinch * 1.5} ${bx - len * 0.45} ${by - bR + pinch * 1.3} ${bx} ${by - bR} ` +
    `L${bx} ${by + bR} ` +
    `C${bx - len * 0.45} ${by + bR - pinch * 1.3} ${hx + len * 0.3} ${hy + R - pinch * 1.5} ${hx} ${hy + R} Z`;
  const flap = pulling ? Math.sin(p / 5) * 28 - 10 : -6;
  const shapes = (stroke: boolean) => {
    const st = stroke ? { stroke: INK, strokeWidth: 4.6, strokeLinejoin: "round" as const } : { stroke: "none" };
    return (
      <>
        <ellipse cx={bx} cy={by} rx={28} ry={bR} fill="#fff" {...st} />
        {p > 2 && <path d={body} fill="#fff" {...st} />}
        <ellipse cx={hx} cy={hy} rx={R / headSq ** 0.5} ry={R * headSq} fill="#fff" {...st} />
      </>
    );
  };
  // 足: 休みは頭の下、のびると体のまんなかの下（うしろへ引きずられる）
  const feetX = p > 2 ? hx + Math.min(len * 0.45, 40) : hx - 6;
  const feetY = p > 2 ? hy + R - pinch * 1.2 + 1 : hy + R * headSq + 1;
  return (
    <svg viewBox={`0 0 ${w} ${PEEK_H}`} width={w} height={PEEK_H} aria-hidden="true" className="overflow-visible drop-shadow-[0_3px_4px_rgba(58,63,78,0.22)]">
      {shapes(true)}
      {shapes(false)}
      {/* 足は体の下からちょこんと出す（体の上に描く） */}
      <Feet x={feetX} y={feetY} />
      {/* おなかの影（ふわふわ感） */}
      <ellipse cx={hx + 4} cy={hy + R * headSq - 7} rx={R * 0.7} ry="4" fill="#e6edf6" />
      {p > 2 && <Wing x={Math.min(hx + 22, w - 6)} y={hy - 4} flap={flap} />}
      <Face cx={hx} cy={hy} squint={pulling} />
      {/* 動きの線（のびているとき） */}
      {pulling && (
        <g stroke="#8fb3d9" strokeWidth="2" strokeLinecap="round" opacity="0.8">
          <path d={`M${hx - 2} ${hy - R - 8} l3 -6`} />
          <path d={`M${hx + 8} ${hy - R - 6} l1 -7`} />
          <path d={`M${hx + 18} ${hy - R - 3} l-1 -6`} />
        </g>
      )}
    </svg>
  );
}

/** 全身（④ 飛び出したとき）: まんまるの体・しっぽ・羽・足、うしろに動きの線 */
function FullBird() {
  return (
    <svg viewBox="0 0 120 80" width={120} height={80} aria-hidden="true" className="overflow-visible drop-shadow-[0_3px_5px_rgba(58,63,78,0.25)]">
      <g stroke="#8fb3d9" strokeWidth="3" strokeLinecap="round" opacity="0.7">
        <path d="M86 30 h30" />
        <path d="M90 42 h26" />
        <path d="M84 54 h22" />
      </g>
      {/* しっぽ */}
      <path d="M68 44 q22 -6 30 2 q-10 2 -12 8 q-8 -6 -18 -2 Z" fill="#fff" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
      <ellipse cx="42" cy="42" rx="31" ry="28" fill="#fff" stroke={INK} strokeWidth="2.4" />
      <ellipse cx="44" cy="62" rx="20" ry="4" fill="#e6edf6" />
      <Feet x={34} y={70} />
      <Wing x={52} y={40} flap={-18} />
      <Face cx={38} cy={40} squint={false} />
      {/* きらっ */}
      <g stroke="#f2c14e" strokeWidth="3" strokeLinecap="round">
        <path d="M8 18 l-6 -5" />
        <path d="M14 11 l-2 -7" />
        <path d="M22 9 l2 -7" />
      </g>
    </svg>
  );
}

type Mode = "none" | "pull" | "move";

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
  /** ④ 飛び出し中: 0 → 1 */
  const [launch, setLaunch] = useState<number | null>(null);
  /** ⑤ 戻ったときのハート */
  const [heart, setHeart] = useState(false);
  const start = useRef<{ px: number; py: number; mode: Mode } | null>(null);
  const used = useRef(false);
  const stopSpring = useRef<(() => void) | null>(null);
  const opening = useRef(false);
  /** この引っぱりで鳴らした音（同じ音を何度も鳴らさない） */
  const sounded = useRef({ stretch: false, flap: false });

  useEffect(() => () => stopSpring.current?.(), []);

  /** ④ 全身がぴょんと飛び出して、チャットへ */
  const open = () => {
    if (opening.current) return;
    opening.current = true;
    stopSpring.current?.();
    start.current = null;
    play("peekPop"); // ぴょーん＋ピヨッ
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 320);
      setLaunch(k);
      if (k < 1) requestAnimationFrame(step);
      else {
        router.push(href);
        // 戻ってきたときは、のぞく姿に戻す
        window.setTimeout(() => {
          opening.current = false;
          setLaunch(null);
          setPull(0);
        }, 500);
      }
    };
    requestAnimationFrame(step);
  };

  /** ⑤ ぽよんと戻って、ハート */
  const bounceBack = (from: number) => {
    if (from > 12) play("peekBoing"); // ぽよよん
    stopSpring.current = springBack(from, setPull, () => {
      if (from > 12) {
        play("chirp", { gain: 0.8 }); // ♥ と「ピヨッ」
        setHeart(true);
        window.setTimeout(() => setHeart(false), 900);
      }
    });
  };

  const onDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (opening.current) return;
    stopSpring.current?.();
    start.current = { px: e.clientX, py: e.clientY, mode: "none" };
    used.current = false;
    sounded.current = { stretch: false, flap: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent<HTMLButtonElement>) => {
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
      const d = Math.max(0, inwardPx(pos.side, dx));
      setPull(d);
      if (!sounded.current.stretch && d > 10) {
        sounded.current.stretch = true;
        play("peekStretch"); // みょーん
      }
      if (!sounded.current.flap && d > openPx(window.innerWidth) * 0.55) {
        sounded.current.flap = true;
        play("flap", { gain: 1.6 }); // 羽パタパタ
      }
      if (d >= openPx(window.innerWidth)) open(); // 1/4 に届いたら、その場で飛び出す
    } else {
      const y = Math.min(0.82, Math.max(0.08, e.clientY / window.innerHeight));
      setMoving({ side: e.clientX < window.innerWidth / 2 ? "left" : "right", y });
    }
  };
  const onUp = () => {
    const s = start.current;
    start.current = null;
    if (opening.current) return;
    if (s?.mode === "pull") return bounceBack(pull);
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
  const flip = side === "left";
  const width = PEEK_W + Math.max(pull, 0);
  const pulling = pull > 10 && launch === null;
  const top = `calc(${y * 100}% - ${PEEK_H / 2}px)`;
  const arrow = flip ? "→" : "←";

  // ④ 飛び出し中: 全身が端から画面の内側へ、ぴょんと跳ねながら進む
  if (launch !== null) {
    const travel = 40 + launch * 110;
    const hop = Math.sin(launch * Math.PI) * 18;
    return (
      <div
        aria-hidden="true"
        className="pointer-events-none fixed z-40"
        style={{ top: `calc(${y * 100}% - 40px - ${hop}px)`, ...(flip ? { left: travel - 60, transform: "scaleX(-1)" } : { right: travel - 60 }), width: 120, height: 80 }}
      >
        <FullBird />
      </div>
    );
  }

  return (
    <button
      type="button"
      aria-label={`${label}（内側へ引っぱるか、押すと開きます。上下に動かすと場所を変えられます）`}
      data-sound="none"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onClick={() => {
        if (used.current) {
          used.current = false; // 動かした・引っぱったときは、離したときの処理に任せる
          return;
        }
        open(); // タップでも飛び出して開く
      }}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        top,
        width,
        height: PEEK_H,
        touchAction: "none",
        ...(flip ? { left: 0, transform: "scaleX(-1)" } : { right: 0 }),
        transition: moving ? "none" : "top 0.2s",
      }}
      className={`fixed z-40 block select-none bg-transparent p-0 [-webkit-touch-callout:none] ${moving ? "opacity-90" : ""}`}
    >
      <PeekBird pull={pull} />
      {/* 吹き出し: いつもは 💬、引っぱっている間は「チャットへ ←」（左の端では反転を戻す） */}
      <span
        className={`absolute grid place-items-center whitespace-nowrap rounded-full bg-lamp font-bold text-white shadow ${pulling ? "-top-7 right-2 h-7 px-2.5 text-sm" : "-top-2 left-0 size-6 text-sm"}`}
        style={flip ? { transform: "scaleX(-1)" } : undefined}
        aria-hidden="true"
      >
        {pulling ? (flip ? `チャットへ ${arrow}` : `${arrow} チャットへ`) : "💬"}
      </span>
      {heart && (
        <span className="pointer-events-none absolute -top-8 left-2 animate-bounce text-xl text-[#f27a96]" aria-hidden="true">
          ♥
        </span>
      )}
    </button>
  );
}
