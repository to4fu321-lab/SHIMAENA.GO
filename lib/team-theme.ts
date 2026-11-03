// 1週間のチームの「見た目」と「期間」。画面・LINE の画像・シマエナガのマフラーで同じ色を使う。
// チームは毎週日曜の夜（21:00 の cron）に組み直すので、期間は「月曜〜日曜」。日曜はその週の最後の日。
import { addDays } from "./jst";
import { getTeam } from "./teams";
import type { Team, TeamId } from "./types";

export interface TeamTheme {
  team: Team;
  /** 白地に置く文字の色（白地で 4.5:1 以上） */
  deep: string;
  /** うすい囲み・背景 */
  soft: string;
  /** チーム色の上に置く文字の色 */
  onColor: string;
  /** マフラーの影の色 */
  shade: string;
  /** マフラーの明るい線 */
  light: string;
  /** LINE の文に使う印 */
  emoji: string;
}

const THEMES: Record<TeamId, Omit<TeamTheme, "team">> = {
  salvia: { deep: "#1F52B8", soft: "#E4EDFC", onColor: "#FFFFFF", shade: "#1F52B8", light: "#7FA6F0", emoji: "💙" },
  marigold: { deep: "#A9501A", soft: "#FFEBDD", onColor: "#29445C", shade: "#D96A22", light: "#FFB98A", emoji: "🧡" },
  lupinus: { deep: "#6B35B5", soft: "#F0E7FB", onColor: "#FFFFFF", shade: "#7A3EC8", light: "#C3A2F0", emoji: "💜" },
};

export function teamTheme(id: TeamId): TeamTheme {
  return { team: getTeam(id), ...THEMES[id] };
}

/** チームが決まっていない人のシマエナガのマフラー（いつもの灯りオレンジ） */
export const DEFAULT_SCARF = { color: "#e8834f", shade: "#d06d3b", light: "#f6a57a" } as const;

export function scarfOf(id: TeamId | undefined): { color: string; shade: string; light: string } {
  if (!id) return DEFAULT_SCARF;
  const t = teamTheme(id);
  return { color: t.team.color, shade: t.shade, light: t.light };
}

const WEEKDAY = ["日", "月", "火", "水", "木", "金", "土"];

function md(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}（${WEEKDAY[d.getUTCDay()]}）`;
}

export interface TeamTerm {
  /** 月曜 YYYY-MM-DD */
  from: string;
  /** 日曜 YYYY-MM-DD（この夜に組み直す） */
  to: string;
  /** 例: 11/9（月）〜11/15（日） */
  label: string;
  /** 例: 11/15（日）の夜まで */
  until: string;
}

/** その日が入っているチームの期間（月曜〜日曜）。日曜は「その週の最後の日」 */
export function teamTerm(ymd: string): TeamTerm {
  const day = new Date(`${ymd}T00:00:00Z`).getUTCDay();
  const to = addDays(ymd, day === 0 ? 0 : 7 - day);
  const from = addDays(to, -6);
  return { from, to, label: `${md(from)}〜${md(to)}`, until: `${md(to)}の夜まで` };
}

/** 日曜の夜に組み直したチームの期間（翌日の月曜から） */
export function nextTeamTerm(ymd: string): TeamTerm {
  return teamTerm(addDays(ymd, 1));
}
