// 通知の中身を、届いた文面の種類から決める（11/6 本人の指示「通知方法を確認して最適化」）。
// 呼ぶ側（朝の運用・カード・なかま・道の報告）は今までどおり文面を渡すだけ。ここでボタンの中身から種類を見分け、
// 題名・本文・押したら開く画面・まとめる印（tag）・急ぎ具合・有効期限を決める。決めるのはプログラムだけ（AI は使わない）。
import { actionsOf, textOf } from "../line/flex";
import type { LineMessage } from "../line/types";
import { jstHourMinute } from "../jst";

export type NoticeKind =
  | "rollcall" // 点呼（6:30）
  | "plan" // 行き先（作戦）
  | "help" // 人手が足りない家
  | "knock" // 返事がない家への声かけ
  | "visit" // 来る人のお知らせ（依頼者・家族）
  | "done" // 雪かきが終わった（依頼者・家族）
  | "nakama" // 合流のお誘い
  | "road" // 近くの道の報告
  | "storm" // 警報のお休み
  | "card" // カード・ありがとう・応援・完了の知らせ
  | "other";

export interface PushPayload {
  title: string;
  body: string;
  /** 押したときに開く道（アプリの中） */
  url: string;
  /** 同じ tag の通知は1つにまとまる（古いものは新しいものに置きかわる） */
  tag?: string;
  /** 音・振動なし（夜の急がない知らせ） */
  silent?: boolean;
  /** v1.31: 通知のボタン（時計や通知の画面から、開かずに答える）。Android は 2 つまで。iPhone はボタンが出ない */
  actions?: PushAction[];
}

export interface PushAction {
  /** `pb:` + ボタンの data（service worker が /api/push/act へ送る） */
  action: string;
  title: string;
}

export interface Notice {
  kind: NoticeKind;
  payload: PushPayload;
  /** 端末の電池節約モードでもすぐ届けるか */
  urgency: "high" | "normal" | "low";
  /** 届けられないときに待つ秒数（過ぎたら捨てる。古いヘルプが朝に届かないように） */
  ttl: number;
}

export const BODY_MAX = 120;
const H = 3600;

/** 種類ごとの題名・急ぎ具合・有効期限・開く画面 */
const KIND: Record<NoticeKind, { title: string; urgency: Notice["urgency"]; ttl: number; url: string; tag?: string }> = {
  rollcall: { title: "☃️ 今朝の点呼", urgency: "high", ttl: 3 * H, url: "/chat", tag: "rollcall" },
  plan: { title: "👟 今朝の行き先が届きました", urgency: "high", ttl: 3 * H, url: "/map", tag: "plan" },
  help: { title: "🙏 人手が足りない家があります", urgency: "high", ttl: 1 * H, url: "/chat", tag: "help" },
  knock: { title: "🚪 声かけのお願い", urgency: "high", ttl: 2 * H, url: "/chat", tag: "knock" },
  visit: { title: "🧤 雪かきの人が向かっています", urgency: "high", ttl: 2 * H, url: "/chat", tag: "visit" },
  done: { title: "☃️ 雪かきが終わりました", urgency: "normal", ttl: 12 * H, url: "/chat", tag: "done" },
  nakama: { title: "👥 合流のお誘い", urgency: "high", ttl: 0.5 * H, url: "/nakama", tag: "nakama" },
  road: { title: "⚠️ 近くの道の報告", urgency: "normal", ttl: 2 * H, url: "/map", tag: "road" },
  storm: { title: "⛔ きょうはお休みです", urgency: "high", ttl: 12 * H, url: "/chat", tag: "storm" },
  card: { title: "🎴 シマエナ隊長から", urgency: "low", ttl: 24 * H, url: "/chat" },
  other: { title: "シマエナ隊長", urgency: "normal", ttl: 12 * H, url: "/chat" },
};

/** ボタンの中身・文から種類を見分ける */
export function noticeKind(messages: LineMessage[]): { kind: NoticeKind; url?: string } {
  const acts = messages.flatMap(actionsOf);
  const data = acts.flatMap((a) => ("data" in a ? [a.data] : []));
  const uris = acts.flatMap((a) => ("uri" in a ? [a.uri.replace(/^https?:\/\/[^/]+/, "")] : []));
  const texts = messages.map(textOf).join("\n");
  const has = (p: string) => data.some((d) => d.startsWith(p));
  if (texts.startsWith("⛔")) return { kind: "storm" };
  if (has("rc:ans=")) return { kind: "rollcall" };
  if (has("go:yes")) return { kind: "plan" };
  if (has("help:go=")) return { kind: "help" };
  if (has("knock:")) return { kind: "knock" };
  if (has("nk:yes=")) return { kind: "nakama" };
  const road = uris.find((u) => u.startsWith("/map?road="));
  if (road) return { kind: "road", url: road };
  if (has("thanks:") || has("cheer:")) return { kind: "done" };
  if (/向かっています/.test(texts)) return { kind: "visit" };
  if (messages.some((m) => m.type === "image") || uris.includes("/cards") || /ありがとう」が届きました|応援「/.test(texts)) return { kind: "card", url: uris.includes("/cards") ? "/cards" : undefined };
  return { kind: "other" };
}

/** あいさつだけの吹き出し（本文には使わない） */
const GREETING = /^(おはよう|こんばんは|こんにちは)[^。\n]*[！!☃️〜\s]*$/;

/** 本文: 答えを求める吹き出し（ボタンつき）の文を先に、あいさつは飛ばして、短くつなぐ */
function bodyOf(messages: LineMessage[]): string {
  const lines = messages
    .map(textOf)
    .flatMap((t) => t.split("\n"))
    .map((l) => l.trim())
    .filter((l) => l && !GREETING.test(l));
  const asking = messages.filter((m) => actionsOf(m).some((a) => "data" in a)).map(textOf).join(" ").replace(/\s+/g, " ").trim();
  const rest = lines.join(" ");
  const body = (asking && !rest.startsWith(asking) ? `${asking} ${rest.replace(asking, "")}` : rest).replace(/\s+/g, " ").trim();
  return body.length > BODY_MAX ? `${body.slice(0, BODY_MAX - 1)}…` : body;
}

/** 夜（22時〜6時）は、急ぎの知らせ以外は音と振動を出さない */
export function quietHours(now = new Date()): boolean {
  const h = Number(jstHourMinute(now).slice(11, 13));
  return h >= 22 || h < 6;
}

/** 通知に付けるボタンの対象（点呼の答え・人手が足りない家への返事）。ほかは開いて答える */
const ACTIONABLE = /^(rc:ans=[a-z0-9]+|help:go=[\w-]+|help:no)$/;
export const ACTIONS_MAX = 2; // Android の Chrome が出せる数
const TITLE_MAX = 12; // 時計の小さな画面に収まる長さ

/**
 * 文面のボタンから、通知のボタンを 2 つまで（v1.31 スマートウォッチ）。
 * 1 つ目は最初のボタン（行く・朝）、2 つ目は「休む／無理」の控えめな答え（なければ 2 番目）。
 * 手首で押せるのは「答え」だけ。地図を開くなどのリンクは付けない。
 */
export function noticeActions(messages: LineMessage[]): PushAction[] {
  const pbs = messages.flatMap(actionsOf).flatMap((a) => (a.type === "postback" && ACTIONABLE.test(a.data) ? [a] : []));
  if (pbs.length === 0) return [];
  const seen = new Set<string>();
  const uniq = pbs.filter((a) => !seen.has(a.data) && seen.add(a.data));
  const soft = uniq.find((a, i) => i > 0 && (/=0$/.test(a.data) || a.data === "help:no"));
  const picked = uniq.length <= ACTIONS_MAX ? uniq : [uniq[0], soft ?? uniq[1]];
  return picked.map((a) => ({ action: `pb:${a.data}`, title: a.label.replace(/^[^\p{L}\p{N}]+\s*/u, "").slice(0, TITLE_MAX) }));
}

/** 文面から通知を作る */
export function buildNotice(messages: LineMessage[], now = new Date()): Notice {
  const { kind, url } = noticeKind(messages);
  const k = KIND[kind];
  const body = bodyOf(messages) || (messages.some((m) => m.type === "image") ? "カードが届きました" : "隊長トークに届いています");
  const payload: PushPayload = { title: k.title, body, url: url ?? k.url };
  if (k.tag) payload.tag = k.tag;
  if (k.urgency !== "high" && quietHours(now)) payload.silent = true;
  const actions = noticeActions(messages);
  if (actions.length > 0) payload.actions = actions;
  return { kind, payload, urgency: k.urgency, ttl: k.ttl };
}
