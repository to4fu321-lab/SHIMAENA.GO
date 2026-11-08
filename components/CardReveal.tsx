"use client";
// カード発行の演出（spec v1.8）: 下から上がる → 裏から表へめくれる → 光が走る → 消印のスタンプが「ドン」と押される → 番号が出る。
// 動きを減らす設定の人には動かさず、消印つきの表をそのまま出す。押した後は「もう一度」で何度でも見られる。
import { useEffect, useState } from "react";
import { STAMP_COLOR, type RevealCard } from "@/lib/cards/reveal";
import { play, vibrate } from "@/lib/sound/engine";

/** 鳴らしたカード演出（カードの id#回 → 時刻） */
const recentlyPlayed = new Map<string, number>();

function Stamp({ card }: { card: RevealCard }) {
  const { ink, paper } = STAMP_COLOR[card.style];
  const serial = `No.${String(card.serial).padStart(3, "0")}/${card.issuedCount}`;
  return (
    <svg viewBox="0 0 600 840" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
      <g transform="translate(494 96) rotate(-12)">
        <g className="card-stamp">
          <circle r="60" fill={paper} opacity="0.85" />
          <circle r="60" fill="none" stroke={ink} strokeWidth="4" />
          <circle r="44" fill="none" stroke={ink} strokeWidth="2" />
          <path id={`aT-${card.id}`} d="M-50 0 A50 50 0 0 1 50 0" fill="none" />
          <path id={`aB-${card.id}`} d="M-50 0 A50 50 0 0 0 50 0" fill="none" />
          <text fontSize="12" fontWeight="700" fill={ink} letterSpacing="2">
            <textPath href={`#aT-${card.id}`} startOffset="50%" textAnchor="middle">
              {card.townName}
            </textPath>
          </text>
          <text fontSize="11" fontWeight="700" fill={ink} letterSpacing="2">
            <textPath href={`#aB-${card.id}`} startOffset="50%" textAnchor="middle">
              {card.date.replace(/-/g, ".")}
            </textPath>
          </text>
          <text y="2" fontSize="24" fontWeight="700" fill={ink} textAnchor="middle">
            {card.stampText}
          </text>
          <text y="24" fontSize="13" fontWeight="700" fill={ink} textAnchor="middle" letterSpacing="1">
            {serial}
          </text>
          <g stroke={ink} strokeWidth="3" fill="none" strokeLinecap="round">
            <path d="M-136 -22 q12 -6 24 0 t24 0 t24 0" />
            <path d="M-136 -7 q12 -6 24 0 t24 0 t24 0" />
            <path d="M-136 8 q12 -6 24 0 t24 0 t24 0" />
            <path d="M-136 23 q12 -6 24 0 t24 0 t24 0" />
          </g>
        </g>
        <circle className="card-stamp-ring" r="60" fill="none" stroke={ink} strokeWidth="6" />
      </g>
    </svg>
  );
}

export default function CardReveal({ card, label = "カードを発行しました" }: { card: RevealCard; label?: string }) {
  // 完了の操作のあとに画面で出るものなので、最初から画面の設定を読んでよい
  const [still] = useState(() => {
    try {
      return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      return false;
    }
  });
  const [round, setRound] = useState(0);
  // v1.24: Claude が絵を描いている間は 6 秒ごとに確かめ、描き上がったら絵を読み直して、もう一度めくる
  const [drawing, setDrawing] = useState(Boolean(card.pending));
  const [ver, setVer] = useState(0);
  useEffect(() => {
    if (!drawing) return;
    let stop = false;
    const tick = async () => {
      try {
        const r = await fetch(`/api/cards/${card.id}/state`, { cache: "no-store" });
        const j = (await r.json()) as { pending?: boolean };
        if (!stop && j.pending === false) {
          setDrawing(false);
          setVer((v) => v + 1);
          setRound((x) => x + 1);
          return;
        }
      } catch {
        // つながらないときは次で
      }
      if (!stop) timer = window.setTimeout(tick, 6000);
    };
    let timer = window.setTimeout(tick, 6000);
    return () => {
      stop = true;
      window.clearTimeout(timer);
    };
  }, [drawing, card.id]);
  const v = ver > 0 ? `v=${ver}` : "";
  // 音（spec v1.19）: globals.css の card-* の時刻に合わせて予約。静止表示のときは「ピン」だけ
  // タブを開くときに部品が2回置かれることがあるので、同じカードの同じ回は3秒のあいだ鳴らし直さない
  useEffect(() => {
    const key = `${card.id}#${round}`;
    const now = Date.now();
    if (now - (recentlyPlayed.get(key) ?? 0) < 3000) return;
    recentlyPlayed.set(key, now);
    if (still) {
      play("cardChime");
      return;
    }
    play("cardRise");
    play("cardFlip", { delay: 0.35 });
    play("cardSparkle", { delay: 1.4 });
    play("cardStamp", { delay: 1.9 });
    play("cardChime", { delay: 2.3 });
    if (card.style !== "kawaii") play("cardHolo", { delay: 2.4 }); // レアはホログラム風
    const t = window.setTimeout(() => vibrate(30), 1900); // 消印の「ドン」で振動
    return () => window.clearTimeout(t);
  }, [round, still, card.id, card.style]);
  const serial = `No.${String(card.serial).padStart(3, "0")} / ${card.issuedCount}枚`;
  if (still) {
    return (
      <figure className="mx-auto w-full max-w-[18rem]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/cards/${card.id}/front.png?size=preview${v ? `&${v}` : ""}`} alt={`カード「${card.designName}」`} className="aspect-[600/840] w-full rounded-2xl shadow-md" />
        <figcaption className="mt-2 text-center text-base font-bold">
          {label}: {card.designName}（{serial}）
          {drawing && <span className="block text-sm text-ink-soft">Claude が絵を描いています（1〜3分）</span>}
        </figcaption>
      </figure>
    );
  }
  return (
    <figure className="mx-auto w-full max-w-[18rem]" key={round}>
      <div className="card-rise [perspective:1200px]">
        <div className="card-flip relative aspect-[600/840] w-full [transform-style:preserve-3d]">
          {/* 裏 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/cards/${card.id}/back.png?size=preview${v ? `&${v}` : ""}`}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full rounded-2xl shadow-md [backface-visibility:hidden] [transform:rotateY(180deg)]"
          />
          {/* 表（消印なし）＋ 光 ＋ 動くスタンプ */}
          <div className="card-shake absolute inset-0 overflow-hidden rounded-2xl shadow-lg [backface-visibility:hidden]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/cards/${card.id}/front.png?stamp=0${v ? `&${v}` : ""}`} alt={`カード「${card.designName}」`} className="h-full w-full" />
            <span className="card-shine pointer-events-none absolute inset-y-0 -left-1/2 w-1/2" aria-hidden="true" />
            <Stamp card={card} />
          </div>
        </div>
      </div>
      <figcaption className="card-caption mt-2 text-center">
        <span className="block text-base font-bold">{label}</span>
        <span className="block text-lg font-bold">「{card.designName}」</span>
        {drawing && <span className="block text-sm font-bold text-ink-soft">Claude がこの1枚の絵をゼロから描いています（1〜3分）</span>}
        <span className="block text-sm text-ink-soft">
          {serial}
          {card.code ? ` ・ この時だけの設計図 #${card.code}` : ""}
        </span>
        <button type="button" onClick={() => setRound((r) => r + 1)} className="mt-1 min-h-10 rounded-full bg-card px-4 text-base font-bold text-ink ring-1 ring-ink/20">
          もう一度見る
        </button>
      </figcaption>
    </figure>
  );
}
