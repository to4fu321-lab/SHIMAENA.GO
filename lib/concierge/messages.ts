// コンシェルジュの LINE の吹き出し。
// 選んだとき: その人用の画像（Claude が場面を選んだ「あなたへ」）＋隊長の返事＋大きなボタン1つ（アプリの活動へ）。
// 聞き返すとき: 返事と質問1つ＋候補のボタン2つ（文字で答えてもよい）。
import { COLORS } from "../brand";
import { bigButton, choiceCard, type CardAction, type Choice } from "../line/flex";
import type { FlexMessage, LineMessage } from "../line/types";
import { liffUrl } from "../url";
import type { ConciergeOption } from "./options";

export function optionAction(o: ConciergeOption): CardAction {
  return o.action.kind === "uri"
    ? { type: "uri", label: o.button.slice(0, 20), uri: liffUrl(o.action.path) }
    : { type: "postback", label: o.button.slice(0, 20), data: o.action.data, displayText: o.button };
}

export function conciergePick(reply: string, o: ConciergeOption, imageUrl: string, safety?: string): LineMessage[] {
  const tap = optionAction(o);
  const card: FlexMessage = {
    type: "flex",
    altText: `${reply} ${o.button}`.slice(0, 400),
    contents: {
      type: "bubble",
      size: "giga",
      hero: { type: "image", url: imageUrl, size: "full", aspectRatio: "20:13", aspectMode: "cover", action: tap },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        paddingAll: "20px",
        contents: [
          { type: "text", text: reply, size: "lg", weight: "bold", color: COLORS.ink, wrap: true },
          ...(safety ? [{ type: "text", text: safety, size: "sm", color: COLORS.lamp, wrap: true }] : []),
          bigButton(o.button, tap, "main"),
        ],
      },
    },
  };
  return [card];
}

export function conciergeAsk(reply: string, question: string, options: ConciergeOption[]): LineMessage[] {
  const choices: Choice[] = options.slice(0, 2).map((o) => ({ label: o.button, action: optionAction(o), tone: "line" }));
  return [choiceCard(`${reply}\n${question}`, choices)];
}
