// LINE の Flex Message（大きな画像・大きなボタンの吹き出し）。
// ・行き先カード: 「どこに・何時」を大きな画像で見せ、地図とルートをタップで開ける。
// ・答えのボタン: 聞かれたことに、吹き出しの中の大きなボタン1つで答えられる。
// 位置情報・カメラのボタンは LINE の決まりで Flex に置けないので、クイックリプライのまま（messages.ts）。
import { COLORS } from "../brand";
import { baseUrl } from "../url";
import { snowHeroPath } from "./hero";
import type { FlexComponent, FlexMessage, LineMessage, QuickReplyAction } from "./types";

/** Flex のボタンに置けるアクション（位置情報・カメラは置けない） */
export type CardAction = Extract<QuickReplyAction, { type: "postback" | "message" | "uri" }>;

/** ボタンの色: main = 灯りオレンジ（進む）、soft = 淡い雪青（休む・やめる）、line = 白に青い枠（地図など） */
export type Tone = "main" | "soft" | "line";

const TONE: Record<Tone, { bg: string; fg: string; border?: string }> = {
  main: { bg: COLORS.lamp, fg: COLORS.white },
  soft: { bg: COLORS.snowBlue, fg: COLORS.ink },
  line: { bg: COLORS.white, fg: COLORS.winter, border: COLORS.winter },
};

/** 押しやすい大きなボタン（文字は xl・太字、角丸、高さ 60px 前後） */
export function bigButton(label: string, action: CardAction, tone: Tone = "main"): FlexComponent {
  const t = TONE[tone];
  return {
    type: "box",
    layout: "vertical",
    action,
    backgroundColor: t.bg,
    cornerRadius: "xl",
    paddingAll: "16px",
    ...(t.border ? { borderWidth: "medium", borderColor: t.border } : {}),
    contents: [{ type: "text", text: label, size: "xl", weight: "bold", color: t.fg, align: "center", wrap: true }],
  };
}

export interface Choice {
  label: string;
  action: CardAction;
  tone?: Tone;
}

/** 質問と大きな答えボタン。altText は通知に出る質問文 */
export function choiceCard(question: string, choices: Choice[]): FlexMessage {
  return {
    type: "flex",
    altText: question.slice(0, 400),
    contents: {
      type: "bubble",
      size: "giga",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        paddingAll: "20px",
        contents: [
          { type: "text", text: question, size: "lg", weight: "bold", color: COLORS.ink, wrap: true },
          { type: "separator", margin: "lg", color: COLORS.snowBlue },
          { type: "box", layout: "vertical", spacing: "md", margin: "lg", contents: choices.map((c) => bigButton(c.label, c.action, c.tone)) },
        ],
      },
      styles: { body: { backgroundColor: COLORS.white } },
    },
  };
}

export interface PlaceCard {
  /** 何時（"7:00"）。いますぐなら "now" */
  time: string;
  /** 拠点の番号 */
  baseNumber: number | string;
  /** 下の小さな説明（1行） */
  note: string;
  /** 町の地図（LIFF） */
  mapUrl: string;
  /** その家までの道順（向かう本人だけ）。なければルートのボタンは出さない */
  routeUrl?: string;
}

/** 行き先の画像（/api/line/hero/go.png）。氏名・住所は入れず、時刻と拠点の番号だけ */
export function heroUrl(time: string, baseNumber: number | string): string {
  const q = new URLSearchParams({ t: time, n: String(baseNumber) });
  return `${baseUrl()}/api/line/hero/go.png?${q.toString()}`;
}

/** 「どこに・何時」の行き先カード。画像を押すと道順（なければ地図）が開く */
export function placeCard(p: PlaceCard): FlexMessage {
  const when = p.time === "now" ? "いますぐ" : `${p.time} に`;
  const title = `拠点${p.baseNumber}へ ${when}集合です！`;
  const tapHero: CardAction = { type: "uri", label: p.routeUrl ? "ルートを表示" : "地図で見る", uri: p.routeUrl ?? p.mapUrl };
  return {
    type: "flex",
    altText: title,
    contents: {
      type: "bubble",
      size: "giga",
      hero: { type: "image", url: heroUrl(p.time, p.baseNumber), size: "full", aspectRatio: "20:13", aspectMode: "cover", action: tapHero },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        paddingAll: "20px",
        contents: [
          { type: "text", text: title, size: "xl", weight: "bold", color: COLORS.ink, wrap: true },
          { type: "text", text: p.note, size: "md", color: COLORS.winter, wrap: true },
          bigButton("🗺 地図で見る", { type: "uri", label: "地図で見る", uri: p.mapUrl }, p.routeUrl ? "line" : "main"),
          ...(p.routeUrl ? [bigButton("📍 ルートを表示", { type: "uri", label: "ルートを表示", uri: p.routeUrl }, "main")] : []),
        ],
      },
    },
  };
}

/** 吹き出しのボタン（クイックリプライ・Flex の両方）を取り出す。テストや見本で使う */
export function actionsOf(m: LineMessage): QuickReplyAction[] {
  const quick = "quickReply" in m && m.quickReply ? m.quickReply.items.map((i) => i.action) : [];
  if (m.type !== "flex") return quick;
  const out: QuickReplyAction[] = [];
  const walk = (c: unknown) => {
    if (!c || typeof c !== "object") return;
    const o = c as { type?: string; action?: QuickReplyAction; contents?: unknown[] };
    if (o.type === "box" && o.action) out.push(o.action);
    if (Array.isArray(o.contents)) o.contents.forEach(walk);
  };
  walk(m.contents.body);
  return [...out, ...quick];
}

/** 吹き出しの文（Flex は通知の文）。テストや記録で使う */
export function textOf(m: LineMessage): string {
  return m.type === "text" ? m.text : m.type === "flex" ? m.altText : "";
}

export interface CaptainCard {
  /** 積雪（cm） */
  cm: number;
  /** 雪の名前（雪ボス） */
  snowName?: string;
  /** eve = 前夜の予告、morning = 朝のあいさつ */
  when: "eve" | "morning";
  /** 隊長のことば（1行ずつ） */
  lines: string[];
}

/** エナガ隊長のカード: 帽子のシマエナガと積雪ゲージの大きな画像＋隊長のことば */
export function captainCard(c: CaptainCard): FlexMessage {
  return {
    type: "flex",
    altText: c.lines.join("").slice(0, 400),
    contents: {
      type: "bubble",
      size: "giga",
      hero: { type: "image", url: `${baseUrl()}${snowHeroPath(c.cm, c.snowName, c.when)}`, size: "full", aspectRatio: "20:13", aspectMode: "cover" },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        paddingAll: "20px",
        contents: c.lines.map((t, i) => ({ type: "text", text: t, size: i === 0 ? "xl" : "lg", weight: "bold", color: i === 0 ? COLORS.lamp : COLORS.ink, wrap: true })),
      },
    },
  };
}
