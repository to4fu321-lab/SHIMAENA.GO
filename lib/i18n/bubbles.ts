// 隊長トークの吹き出しをそのことばに（spec v1.36）。純粋な部分（文字の集め方・はめ方）と、訳す部分（translateTexts）を分ける。
// 訳すのは隊長の吹き出しだけ（文・カードの行・大きなボタンの文字・小さなボタンの文字）。「調べた」札は画面に出さないので訳さない。
// 本人の吹き出しは本人のことばなので触らない。ボタンの中身（postback の data・say の text・href）は日本語のまま（今までの処理がそのまま動く）。
import type { ChatBubble } from "../inbox/view";
import type { Lang } from "./langs";
import { translateTexts } from "./translate";

/** 訳す吹き出しの数（新しいものから）。古いものは日本語のまま */
export const LOCALIZE_LAST = 40;

/** 吹き出しの列から、訳したい文字を集める（重複なし・空なし） */
export function collectStrings(bubbles: ChatBubble[], last = LOCALIZE_LAST): string[] {
  const out = new Set<string>();
  for (const b of bubbles.slice(-last)) {
    if (b.from !== "captain") continue;
    if (b.text) out.add(b.text);
    for (const l of b.lines ?? []) {
      if (l.steps) continue; // 「隊長が調べた」札は画面に出さないので訳さない
      if (l.text) out.add(l.text);
    }
    for (const x of [...b.buttons, ...b.quick]) if (x.label) out.add(x.label);
  }
  return [...out].filter((s) => s.trim());
}

/** 集めた文字の訳（元 → 訳）を吹き出しにはめる。訳のない文字はそのまま */
export function applyStrings(bubbles: ChatBubble[], map: Map<string, string>, last = LOCALIZE_LAST): ChatBubble[] {
  const tr = (s: string) => map.get(s) ?? s;
  const from = Math.max(0, bubbles.length - last);
  return bubbles.map((b, i) => {
    if (i < from || b.from !== "captain") return b;
    return {
      ...b,
      ...(b.text !== undefined ? { text: tr(b.text) } : {}),
      ...(b.lines ? { lines: b.lines.map((l) => (l.steps ? { ...l, steps: l.steps.map(tr) } : { ...l, text: tr(l.text) })) } : {}),
      buttons: b.buttons.map((x) => ({ ...x, label: tr(x.label) })),
      quick: b.quick.map((x) => ({ ...x, label: tr(x.label) })),
    };
  });
}

/** 流れ全体をそのことばに。日本語ならそのまま返す */
export async function localizeBubbles(bubbles: ChatBubble[], lang: Lang, translate: (texts: string[], lang: Lang) => Promise<string[]> = translateTexts): Promise<ChatBubble[]> {
  if (lang === "ja") return bubbles;
  const src = collectStrings(bubbles);
  if (src.length === 0) return bubbles;
  const dst = await translate(src, lang);
  const map = new Map<string, string>();
  src.forEach((s, i) => {
    if (dst[i] && dst[i] !== s) map.set(s, dst[i]);
  });
  return applyStrings(bubbles, map);
}
