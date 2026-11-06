// 試し描き（spec v1.23・v1.24、/admin から）: 今日の話題を調べて、架空の1軒ぶんのカードを Claude にゼロから1枚描いてもらう。保存も送信もしない。
// 1回目の絵と、画像を見て直した最終版を並べて見せる（見直しでどれだけ良くなるか）。
// 管理の合言葉でログインした人だけ。毎回ちがう絵になるかを、本番のキーで確かめるための道具。
import { AdminRequiredError, requireAdmin } from "@/lib/admin-auth";
import { cardText } from "@/lib/claude/card";
import { drawPicture, wrapPicture, type ArtInput } from "@/lib/claude/art";
import { FALL_LABEL, PROP_LABEL, SKY_LABEL } from "@/lib/cards/scene";
import { getTeam } from "@/lib/teams";
import { hasClaudeKey } from "@/lib/claude/client";
import { decideRarity } from "@/lib/cards/rarity";
import { renderCardSvg } from "@/lib/cards/svg";
import { jstDate, jstMinutes } from "@/lib/jst";
import { warmDayTopic } from "@/lib/topic/day";
import { TOWN } from "@/lib/town";
import type { TeamId } from "@/lib/types";

export const maxDuration = 300;

/** 1枚ずつ別の画像にする（id が同じ絵どうしで混ざらないように） */
const img = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

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
  let drawn: Awaited<ReturnType<typeof drawPicture>>;
  let drawError = "";
  const input: ArtInput = {
    date,
    completedAtJst: hm,
    sky: SKY_LABEL[text.scene.sky],
    fall: FALL_LABEL[text.scene.fall],
    groundCm: [3, 10, 22, 35][text.scene.ground],
    members: teams.map((t) => ({ teamColor: getTeam(t).color, teamName: getTeam(t).name })),
    ...(text.scene.topic ? { topic: { label: text.scene.topic, hint: topic.items.find((x) => x.label === text.scene.topic)?.hint ?? "" } } : {}),
    style: rarity.style,
    mood: text.scene.mood,
    props: text.scene.props.map((p) => PROP_LABEL[p]),
    designName: text.designName,
    seed: `try|${now.toISOString()}|${text.scene.code}`,
  };
  try {
    drawn = await drawPicture(input);
  } catch (e) {
    drawError = e instanceof Error ? e.message : String(e);
  }
  const svg = renderCardSvg({
    ...(drawn ? { picture: drawn.svg } : {}),
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
<p style="margin:0 0 12px">絵: <b>${drawn ? `Claude がゼロから描いた（${drawn.rounds} 回・${drawn.seconds.toFixed(0)} 秒）` : "型の絵（Claude が描けませんでした）"}</b>${hasClaudeKey() ? "" : "（Claude のキーがありません）"}${drawError ? `<br>理由: ${esc(drawError)}` : ""} ・ 話題「${esc(text.scene.topic ?? "なし")}」 ・ 全体 ${((Date.now() - started) / 1000).toFixed(0)} 秒<br>${drawn ? `なぜこの絵か: ${esc(drawn.why)}` : ""}</p>
<div style="max-width:420px"><img style="width:100%" src="${img(svg)}" alt="カード"></div>
${drawn?.draft ? `<h2 style="font-size:18px;margin:16px 0 8px">見直しの前（1回目）と、見直したあと</h2><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;max-width:520px"><figure style="margin:0"><img style="width:100%" src="${img(wrapPicture(drawn.draft))}" alt="1回目"><figcaption>1回目</figcaption></figure><figure style="margin:0"><img style="width:100%" src="${img(wrapPicture(drawn.svg))}" alt="見直したあと"><figcaption>見直したあと</figcaption></figure></div>` : ""}
<p><a href="/api/cards/try">もう1枚描く</a> ・ <a href="/admin">管理画面へ</a></p></body>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
