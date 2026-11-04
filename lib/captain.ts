// 隊長のひとこと（状態別、spec v1.6）。状態は計算で決める（AI は使わない）。
// 文は朝に Claude が状態ごとに1回だけ書いて朝の記録に保存し、みんなで使い回す（人数が増えても呼び出しは増えない）。
// キーがないとき・書いた文がおかしいときは、ここの定型を使う。

export const CAPTAIN_STATES = ["safety", "requester", "almost_goal", "first_done", "first", "away", "streak", "normal"] as const;
export type CaptainState = (typeof CAPTAIN_STATES)[number];

export interface CaptainFacts {
  /** 安全の一文が要る朝か（lib/safety.ts） */
  safety: boolean;
  role?: "helper" | "requester" | "family";
  /** 作戦中で、終わっていない家が1軒だけ */
  almostGoal: boolean;
  /** 持っているカードの枚数・今日やったこと・連続の日数・最後に動いた日からの日数 */
  cards: number;
  todayActs: number;
  streak: number;
  daysSinceLast?: number;
}

/** 上から順に、最初に当てはまる状態（安全がいちばん先） */
export function captainState(f: CaptainFacts): CaptainState {
  if (f.safety) return "safety";
  if (f.role === "requester" || f.role === "family") return "requester";
  if (f.almostGoal) return "almost_goal";
  if (f.cards === 1 && f.todayActs > 0) return "first_done";
  if (f.cards === 0 && f.todayActs === 0) return "first";
  if (f.daysSinceLast !== undefined && f.daysSinceLast >= 3) return "away";
  if (f.streak >= 3) return "streak";
  return "normal";
}

/** 定型（キーがないとき・Claude の文がおかしいとき）。語尾「しま〜・えな〜」は3文に1つまで、お願いする側と安全は丁寧語 */
export const CAPTAIN_TEMPLATES: Record<CaptainState, string> = {
  safety: "ひとりでやらず、15分ごとに休みましょう。",
  requester: "おはようございます。雪は任せてくださいね。",
  almost_goal: "あと1軒で今朝の目標だしま〜！",
  first_done: "はじめての出撃、おつかれさま！",
  first: "ようこそ！まずは10分の見回りからえな〜。",
  away: "おかえりなさい。応援1つからどうですか。",
  streak: "続けてありがとう！今朝も10分いくしま〜。",
  normal: "今朝も10分だけ、町を軽くしにいくえな〜！",
};

/** ホームの吹き出しに収まる長さ */
export const CAPTAIN_MAX = 24;

/** 使ってよい一文か: CAPTAIN_MAX 字まで・お願いする側と安全は語尾なし・安全は「ひとり」か「休」を含む・数字は許したものだけ */
export function captainLineOk(state: CaptainState, line: string, allowedNumbers: number[]): boolean {
  const t = line.trim();
  if (t.length === 0 || [...t].length > CAPTAIN_MAX) return false;
  if ((state === "requester" || state === "safety") && /しま〜|えな〜/.test(t)) return false;
  if (state === "safety" && !/ひとり|休/.test(t)) return false;
  const nums = (t.match(/\d+/g) ?? []).map(Number);
  return nums.every((n) => allowedNumbers.includes(n));
}

/** 保存した文があればそれを、なければ定型を */
export function captainLine(state: CaptainState, saved?: Partial<Record<CaptainState, string>>): string {
  return saved?.[state] ?? CAPTAIN_TEMPLATES[state];
}

// ---- ホームの吹き出しで順番に話す（11/4 本人の指示「隊長の言葉がずっと同じ」） ----
// 1つめは状態別のひとこと（上の captainLine）。そのあとに、いまの様子から計算した文を足す（AI は使わない）。

export interface CaptainScene {
  /** 状態別のひとこと（captainLine の結果） */
  main: string;
  /** 安全の一文が要る朝か（あれば2つおきに挟む） */
  safety?: string;
  snowCm?: number;
  snowName?: string;
  /** いま雪かき中の人数・待っている家の数 */
  active: number;
  left: number;
  night: boolean;
  morningBonus: boolean;
  dokayuki: boolean;
  teamName?: string;
}

/** 前の版で書いた文に残った「5分」を、いまの最小単位（10分）に直す */
function tenMinutes(line: string): string {
  return line.replace(/(^|[^0-9])5分/g, "$110分");
}

/** 吹き出しで順番に話す文（1つめは状態別のひとこと） */
export function captainRotation(s: CaptainScene): string[] {
  const lines = [tenMinutes(s.main)];
  if (s.night) lines.push("夜は自分の家の雪かきだけにしようね。");
  if (s.snowCm && s.snowCm > 0) lines.push(`今日の雪は${s.snowCm}cm${s.snowName ? `、${s.snowName}` : ""}だしま〜！`);
  if (!s.night && s.active > 0) lines.push(`いま${s.active}人が雪かき中えな〜！`);
  if (!s.night && s.left > 0) lines.push(`待っている家が、あと${s.left}軒あるしま〜。`);
  if (!s.night && s.morningBonus) lines.push("朝9時までに終えると、+5点えな〜！");
  if (!s.night && s.dokayuki) lines.push("ドカ雪の日は、+5点のごほうびしま〜！");
  if (s.teamName) lines.push(`今週は${s.teamName}チーム。いっしょにがんばるえな〜！`);
  lines.push("ぼくをタップすると、飛ぶしま〜！");
  if (!s.safety) return lines;
  // 安全の一文は、2つおきに必ず挟む
  return lines.flatMap((l, i) => (i % 2 === 0 ? [s.safety!, l] : [l]));
}
