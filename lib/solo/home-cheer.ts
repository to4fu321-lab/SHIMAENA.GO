// 自宅の雪かきへの「応援」と「おつかれさま」（11/4 本人の指示）。純粋な関数だけ（保存は ops）。
// - ホームのボタンで、いま自宅を雪かき中の人みんなに「応援」、今日 自宅を終えた人みんなに「おつかれさま」を送る（名前は出さない）
// - 同じ人から同じ人へは、1日に応援1回・おつかれさま1回まで。自分には送れない
// - 受け取った人は、次にホームを開いたとき隊長から聞く。1人 0.1点（10人分で チーム +1点、1日 2点まで）

export type CheerKind = "cheer" | "thanks";

export interface CheerBox {
  /** 送ってくれた人の ID（重ねない） */
  cheer: string[];
  thanks: string[];
  /** 本人がもう聞いた数 */
  seenCheer: number;
  seenThanks: number;
  /** チームの点にもう変えた数（10人分で +1点） */
  scored: number;
}

export interface HomeCheers {
  date: string;
  byTarget: Record<string, CheerBox>;
}

/** 1人が1日に受け取れるチームの点の上限 */
export const CHEER_DAILY_POINTS = 2;

type Rec = { homeCheers?: HomeCheers };

function today(rec: Rec, date: string): HomeCheers {
  if (rec.homeCheers?.date !== date) rec.homeCheers = { date, byTarget: {} };
  return rec.homeCheers;
}

function box(h: HomeCheers, id: string): CheerBox {
  return (h.byTarget[id] ??= { cheer: [], thanks: [], seenCheer: 0, seenThanks: 0, scored: 0 });
}

/**
 * from から targets みんなへ送る。新しく届いた人数と、チームの点が増えた人（+1点ずつ）を返す。
 */
export function sendCheers(rec: Rec, date: string, from: string, kind: CheerKind, targets: string[]): { sent: number; pointTo: string[] } {
  const h = today(rec, date);
  let sent = 0;
  const pointTo: string[] = [];
  for (const t of new Set(targets)) {
    if (t === from) continue;
    const b = box(h, t);
    if (b[kind].includes(from)) continue;
    b[kind].push(from);
    sent++;
    const total = b.cheer.length + b.thanks.length;
    if (Math.floor(total / 10) > b.scored && b.scored < CHEER_DAILY_POINTS) {
      b.scored++;
      pointTo.push(t);
    }
  }
  return { sent, pointTo };
}

/** from がまだ送っていない人（ボタンを出すかどうか） */
export function notYetSent(rec: Rec, date: string, from: string, kind: CheerKind, targets: string[]): string[] {
  const h = rec.homeCheers?.date === date ? rec.homeCheers : undefined;
  return [...new Set(targets)].filter((t) => t !== from && !h?.byTarget[t]?.[kind].includes(from));
}

export interface CheerNews {
  newCheer: number;
  newThanks: number;
  /** 今日受け取った合計（0.1点ずつ） */
  total: number;
}

/** 本人がまだ聞いていない分（なければ undefined） */
export function cheerNews(rec: Rec, date: string, id: string): CheerNews | undefined {
  const b = rec.homeCheers?.date === date ? rec.homeCheers.byTarget[id] : undefined;
  if (!b) return undefined;
  const newCheer = b.cheer.length - b.seenCheer;
  const newThanks = b.thanks.length - b.seenThanks;
  if (newCheer <= 0 && newThanks <= 0) return undefined;
  return { newCheer, newThanks, total: b.cheer.length + b.thanks.length };
}

export function markSeen(rec: Rec, date: string, id: string): boolean {
  const b = rec.homeCheers?.date === date ? rec.homeCheers.byTarget[id] : undefined;
  if (!b || (b.seenCheer === b.cheer.length && b.seenThanks === b.thanks.length)) return false;
  b.seenCheer = b.cheer.length;
  b.seenThanks = b.thanks.length;
  return true;
}

/** 0.1点ずつの表示（12人 → "1.2"）。小数の足し算をしない */
export function tenths(n: number): string {
  return `${Math.floor(n / 10)}.${n % 10}`;
}

/** 隊長が飛んできて話す文 */
export function arrivalLines(n: CheerNews): string[] {
  const lines: string[] = [];
  if (n.newCheer > 0) lines.push(`${n.newCheer}人が、あなたを応援してるえな〜！📣`);
  if (n.newThanks > 0) lines.push(`${n.newThanks}人から、おつかれさまの差入れしま〜！🍵`);
  lines.push(`今日の応援ポイント +${tenths(n.total)}（1人 0.1）えな〜！`);
  return lines;
}
