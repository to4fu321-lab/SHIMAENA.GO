// LINE に送る文面と大きなボタン（クイックリプライ）。文面はここにまとめて、あとで直しやすくする。
import type { LineMessage, QuickReplyAction, TextMessage } from "./types";

export function text(body: string): TextMessage {
  return { type: "text", text: body };
}

/** 文面＋ボタン（postback）。label は 20 文字まで */
export function ask(body: string, choices: { label: string; data: string }[]): TextMessage {
  return {
    type: "text",
    text: body,
    quickReply: {
      items: choices.map((c) => ({
        type: "action",
        action: { type: "postback", label: c.label, data: c.data, displayText: c.label } satisfies QuickReplyAction,
      })),
    },
  };
}

/** 「位置情報を送る」ボタン付きの文面 */
export function askLocation(body: string): TextMessage {
  return {
    type: "text",
    text: body,
    quickReply: { items: [{ type: "action", action: { type: "location", label: "位置情報を送る" } }] },
  };
}

export const MSG = {
  welcome: () =>
    ask("シマエナGO へようこそ！\n寒い冬は、くっついて乗り切る。\n\nあなたはどちらですか？", [
      { label: "雪かきをお願いしたい", data: "reg:role=requester" },
      { label: "雪かきを手伝う", data: "reg:role=helper" },
      { label: "家族の代わりに登録", data: "reg:role=family" },
    ]),
  locationSelf: () =>
    askLocation("ありがとうございます。\n自宅の場所を教えてください。下の「位置情報を送る」を押して、地図で家を選んでください。"),
  locationProxy: () =>
    askLocation("ご家族（雪かきをお願いする方）の家の場所を、下の「位置情報を送る」を押して地図で選んでください。"),
  requesterQ1: () =>
    ask("一人で雪かきをすると、いつも何分くらいかかりますか？", [
      { label: "15分くらい", data: "reg:q1=15" },
      { label: "30分くらい", data: "reg:q1=30" },
      { label: "60分以上", data: "reg:q1=60" },
      { label: "わからない", data: "reg:q1=unknown" },
    ]),
  requesterQ2: () =>
    ask("どこまで雪かきが必要ですか？", [
      { label: "玄関前まで", data: "reg:q2=entrance" },
      { label: "車庫前まで", data: "reg:q2=garage" },
      { label: "道路まで", data: "reg:q2=road" },
    ]),
  helperQ1: () =>
    ask("雪の朝、何分くらい動けますか？", [
      { label: "15分", data: "reg:q1=15" },
      { label: "30分", data: "reg:q1=30" },
      { label: "60分", data: "reg:q1=60" },
    ]),
  helperQ2: () =>
    ask("スコップなどの道具はありますか？", [
      { label: "ある", data: "reg:q2=yes" },
      { label: "ない", data: "reg:q2=no" },
    ]),
  linkWho: () =>
    ask("この番号を送ったのは、どなたですか？", [
      { label: "雪かきをお願いする本人", data: "link:who=self" },
      { label: "家族（お知らせを受け取る）", data: "link:who=family" },
    ]),
  codeNotFound: () => text("その番号は見つかりませんでした。6桁の連携コードをもう一度確かめて送ってください。"),
  help: () => text("登録や設定をやり直すには「登録」と送ってください。\n家族からもらった6桁の連携コードは、そのまま送ってください。"),
  helperDone: (teamName: string, colorName: string) =>
    text(
      `登録できました！\nあなたのチームは「${teamName}」（${colorName}）です。\n雪の朝 6:30 に「エナガ点呼」が届きます。1タップで答えてください。`,
    ),
  requesterDone: (message: string, level: number, requiredPeople: number) =>
    text(`${message}\n家のレベル: ${level}（必要な人数: ${requiredPeople}人）`),
  proxyDone: (code: string) =>
    text(
      `連携コード: ${code}\n\nご本人の LINE でこのアカウントを友だち追加し、この6桁を送ると、ご本人にも点呼が届きます。\nほかのご家族も、同じ番号を送るとお知らせを受け取れます。`,
    ),
  linkedSelf: () => text("紐づけました。雪の朝 6:30 に「今朝、玄関は出られそうですか？」と1回だけ聞きます。"),
  linkedFamily: () => text("家族として紐づけました。雪かきが終わったときや、点呼に返事がないときにお知らせします。"),
} satisfies Record<string, (...args: never[]) => LineMessage>;
