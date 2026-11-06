// 試し描き（spec v1.23、/admin から）: 今日の話題を調べて、架空の1軒ぶんのカードを Claude に1枚描いてもらう。保存も送信もしない。
// 管理の合言葉でログインした人だけ。毎回ちがう絵になるかを、本番のキーで確かめるための道具。
import { AdminRequiredError, requireAdmin } from "@/lib/admin-auth";
import { cardText } from "@/lib/claude/card";
import { hasClaudeKey } from "@/lib/claude/client";
import { decideRarity } from "@/lib/cards/rarity";
import { renderCardSvg } from "@/lib/cards/svg";
import { jstDate, jstMinutes } from "@/lib/jst";
import { warmDayTopic } from "@/lib/topic/day";
import { TOWN } from "@/lib/town";
import type { TeamId } from "@/lib/types";

export const maxDuration = 120;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export async function GET(): Promise<Response> {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof AdminRequiredError) return new Response("管理の合言葉でログインしてください（/admin）", { status: 401 });
    throw e;
  }
  const now = new Date();
  const date = jstDate(now);
  const topic = await warmDayTopic(date);
  const m = jstMinutes(now);
  const hm = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const teams: TeamId[] = Math.random() < 0.5 ? ["salvia", "marigold"] : ["lupinus", "lupinus"];
  const rarity = decideRarity({ completedAt: now.toISOString(), forecastCm: 12, teamIds: teams, streakDays: 1 });
  const started = Date.now();
  const text = await cardText({
    date,
    completedAtJst: hm,
    forecastCm: 12,
    level: 2,
    clearArea: "entrance",
    memberCount: 2,
    teamNames: [...new Set(teams)].map((t) => ({ salvia: "サルビア", marigold: "マリーゴールド", lupinus: "ルピナス" })[t]),
    style: rarity.style,
    rarityLabel: rarity.label,
    mixed: new Set(teams).size >= 2,
    seed: `try|${now.toISOString()}`,
    topics: topic.items,
  });
  const svg = renderCardSvg({
    style: rarity.style,
    designName: text.designName,
    designNameEn: text.designNameEn,
    rarityLabel: rarity.label,
    stars: rarity.stars,
    members: teams.map((t, i) => ({ name: i === 0 ? "ためし1" : "ためし2", teamId: t })),
    date,
    townName: TOWN.name.replace(/（.*）$/, ""),
    snowKg: text.snowKg,
    snowKgComparison: text.snowKgComparison,
    scene: text.scene,
    serial: 1,
    issuedCount: 2,
    flavor: text.flavor,
  });
  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>カードの試し描き</title>
<body style="margin:0;padding:16px;font-family:sans-serif;font-size:17px;line-height:1.6;background:#f3f6fa;color:#172235">
<h1 style="font-size:20px;margin:0 0 8px">カードの試し描き（保存しません）</h1>
<p style="margin:0 0 8px">今日の話題（${topic.by === "web" ? "Claude が Web で調べた" : "暦"}）: ${topic.items.map((t) => `<b>${esc(t.label)}</b>`).join("・")}</p>
<p style="margin:0 0 12px">挿絵: <b>${text.scene.motif?.by === "claude" ? "Claude が描いた" : "プログラムの絵"}</b>${hasClaudeKey() ? "" : "（Claude のキーがありません）"} ・ 話題「${esc(text.scene.topic ?? "なし")}」 ・ ${((Date.now() - started) / 1000).toFixed(1)} 秒</p>
<div style="max-width:420px">${svg.replace("<svg ", '<svg style="width:100%;height:auto" ')}</div>
<p><a href="/api/cards/try">もう1枚描く</a> ・ <a href="/admin">管理画面へ</a></p></body>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
