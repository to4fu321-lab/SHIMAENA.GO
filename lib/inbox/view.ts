// 隊長トークの表示用の形（spec v1.17）: 保存してある LINE の形の文面（文・大きなボタンの吹き出し（Flex）・画像）を、
// 画面で描ける「吹き出し」に直す。ボタンの種類: postback（今までの処理）・link（画面を開く）・say（文を送る）・photo（写真を撮る／選ぶ）。
// 位置情報のボタンは画面では出さない（登録は /start の画面で済むため）。純粋な関数なのでテストしやすい。
import { COLORS } from "../brand";
import type { FlexComponent, LineMessage, QuickReplyAction } from "../line/types";
import { baseUrl } from "../url";
import type { InboxItem } from "./store";

export type ChatTone = "main" | "soft" | "line";

export type ChatButton =
  | { kind: "postback"; label: string; data: string; tone: ChatTone }
  | { kind: "link"; label: string; href: string; external: boolean; tone: ChatTone }
  | { kind: "say"; label: string; text: string; tone: ChatTone }
  | { kind: "photo"; label: string; capture: boolean; tone: ChatTone };

export interface ChatLine {
  text: string;
  /** 見出し（太く大きく） */
  strong?: boolean;
  /** 注意の色（安全のひとこと など） */
  accent?: boolean;
}

export interface ChatBubble {
  id: string;
  from: "captain" | "me";
  at: string;
  /** 文の吹き出し */
  text?: string;
  /** カード（Flex）の中の文 */
  lines?: ChatLine[];
  /** 画像（カード・隊長カードの絵・行き先の絵） */
  image?: string;
  /** 画像を押したときの行き先 */
  imageHref?: string;
  /** カードの中の大きなボタン */
  buttons: ChatButton[];
  /** 吹き出しの下の小さなボタン（最後の吹き出しにだけ出す） */
  quick: ChatButton[];
  /** 本人が送った写真の印 */
  photo?: boolean;
}

/** 画面を開く URL を、このアプリの中の道（/map など）に直す。デモの ?as= は引き継ぐ。外のサイト（地図アプリ）はそのまま */
export function toHref(uri: string, as?: string): { href: string; external: boolean } {
  const base = baseUrl();
  let href = uri;
  if (uri.startsWith(base)) href = uri.slice(base.length) || "/";
  const external = /^https?:\/\//.test(href);
  if (!external && as) {
    const u = new URL(href, "http://x");
    u.searchParams.set("as", as);
    href = `${u.pathname}${u.search}${u.hash}`;
  }
  return { href, external };
}

function toneOf(c: FlexComponent): ChatTone {
  const bg = String(c.backgroundColor ?? "").toUpperCase();
  if (bg === COLORS.lamp.toUpperCase()) return "main";
  if (bg === COLORS.snowBlue.toUpperCase()) return "soft";
  return "line";
}

function fromAction(a: QuickReplyAction | undefined, label: string, tone: ChatTone, as?: string): ChatButton | undefined {
  if (!a) return undefined;
  switch (a.type) {
    case "postback":
      return { kind: "postback", label: a.label || label, data: a.data, tone };
    case "uri":
      return { kind: "link", label: a.label || label, ...toHref(a.uri, as), tone };
    case "message":
      return { kind: "say", label: a.label || label, text: a.text, tone };
    case "camera":
      return { kind: "photo", label: a.label || "写真を撮る", capture: true, tone };
    case "cameraRoll":
      return { kind: "photo", label: a.label || "写真を選ぶ", capture: false, tone };
    default:
      return undefined; // 位置情報は画面では出さない
  }
}

/** 1つの文面を吹き出しに */
export function toBubble(item: InboxItem, as?: string): ChatBubble {
  const b: ChatBubble = { id: item.id, from: item.dir === "in" ? "me" : "captain", at: item.at, buttons: [], quick: [] };
  if (item.dir === "in") {
    const body = item.body as { text?: string; photo?: true };
    if (body.photo) b.photo = true;
    else b.text = body.text ?? "";
    return b;
  }
  const m = item.body as LineMessage;
  const quick = ("quickReply" in m && m.quickReply ? m.quickReply.items.map((i) => i.action) : []).map((a) => fromAction(a, "", "line", as)).filter((x): x is ChatButton => Boolean(x));
  b.quick = quick;
  if (m.type === "text") {
    b.text = m.text;
    return b;
  }
  if (m.type === "image") {
    b.image = toHref(m.originalContentUrl, undefined).href;
    return b;
  }
  // Flex: 絵（hero）→ 文（text）→ 大きなボタン（action の付いた box）。入れ物の box は中をたどる
  const hero = m.contents.hero;
  if (hero?.type === "image" && typeof hero.url === "string") {
    b.image = toHref(hero.url).href;
    const act = fromAction(hero.action as QuickReplyAction | undefined, "", "line", as);
    if (act?.kind === "link") b.imageHref = act.href;
  }
  const lines: ChatLine[] = [];
  const buttons: ChatButton[] = [];
  const walk = (c: unknown, depth: number) => {
    if (!c || typeof c !== "object") return;
    const o = c as FlexComponent;
    if (o.type === "text" && typeof o.text === "string") {
      const size = String(o.size ?? "");
      const color = String(o.color ?? "").toUpperCase();
      lines.push({ text: o.text, strong: o.weight === "bold" && (size === "xl" || size === "lg"), accent: color === COLORS.lamp.toUpperCase() });
      return;
    }
    if (o.type === "box" && o.action) {
      const label = Array.isArray(o.contents) ? String((o.contents[0] as FlexComponent | undefined)?.text ?? "") : "";
      const btn = fromAction(o.action as QuickReplyAction, label, toneOf(o), as);
      if (btn) buttons.push({ ...btn, label: label || btn.label });
      return;
    }
    if (Array.isArray(o.contents) && depth < 6) o.contents.forEach((x) => walk(x, depth + 1));
  };
  walk(m.contents.body, 0);
  walk(m.contents.footer, 0);
  if (lines.length === 0 && !b.image) lines.push({ text: m.altText });
  b.lines = lines;
  b.buttons = buttons;
  return b;
}

/** 流れ全体を吹き出しに。小さなボタン（quick）は、いちばん新しい隊長の吹き出しにだけ残す（LINE と同じ） */
export function toBubbles(items: InboxItem[], as?: string): ChatBubble[] {
  const out = items.map((x) => toBubble(x, as));
  const lastCaptain = [...out].reverse().find((x) => x.from === "captain");
  for (const x of out) if (x !== lastCaptain) x.quick = [];
  return out;
}
