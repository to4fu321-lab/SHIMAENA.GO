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
  // ---- 点呼（spec 2） ----
  rollcallRequester: () =>
    ask("おはようございます。エナガ点呼です。\n今朝、玄関は出られそうですか？", [
      { label: "はい", data: "rc:ans=yes" },
      { label: "いいえ", data: "rc:ans=no" },
      { label: "一緒なら", data: "rc:ans=together" },
    ]),
  rollcallHelper: () =>
    ask("おはようございます。エナガ点呼です。\n今朝、何分動けますか？", [
      { label: "0分", data: "rc:ans=0" },
      { label: "15分", data: "rc:ans=15" },
      { label: "30分", data: "rc:ans=30" },
      { label: "60分", data: "rc:ans=60" },
    ]),
  rollcallThanks: (answer: string) =>
    text(
      answer === "yes"
        ? "よかったです。今朝はゆっくりどうぞ。"
        : answer === "no"
          ? "承知しました。6:40 に作戦をお届けします。"
          : answer === "together"
            ? "ありがとうございます。一緒にやりましょう。6:40 に作戦をお届けします。"
            : answer === "0"
              ? "了解です。今朝は休んでください。"
              : "ありがとうございます！6:40 に作戦をお届けします。",
    ),
  rollcallClosed: () => text("いまは点呼の時間ではありません。雪の朝 6:30 に届きます。"),
  notRegistered: () => text("登録がまだです。「登録」と送ってください。"),
  planForRequester: (startTime: string, names: string[]) =>
    text(
      names.length > 0
        ? `${startTime} に ${names.map((n) => `${n}さん`).join("、")}が向かいます。玄関の鍵を開けておいてください。`
        : "人手を集めています。決まり次第お知らせします。",
    ),
  // ---- 朝の一本道（spec 2: 行く → 写真 → 完了） ----
  planForHelper: (body: string) =>
    ask(body, [
      { label: "行く", data: "go:yes" },
      { label: "今朝は行けない", data: "go:no" },
    ]),
  goConfirmed: (baseNumber: number | string) =>
    text(`了解です！拠点${baseNumber}へ。7:00 開始です。\n終わったら、玄関前から道路側を写した写真を1枚送ってください。`),
  goDeclined: () => text("承知しました。無理しないでください。ほかの人に声をかけます。"),
  noSortie: () => text("今朝の割り当てはありません。「いまからやる」は後日の機能です。"),
  photoNotCleared: (comment: string) => text(`${comment}\nもう少しお願いできますか。終わったらまた写真を送ってください。`),
  doneThanks: (baseNumber: number | string, teamName: string, points: number, comment: string) =>
    text(`${comment}\n拠点${baseNumber} 完了！ ${teamName}に +${points} 点。ありがとうカードは後ほど届きます。`),
  doneByOther: (baseNumber: number | string, byName: string, teamName: string, points: number) =>
    text(`拠点${baseNumber}は ${byName}さんの写真で完了になりました。${teamName}に +${points} 点。お疲れさまでした！`),
  requesterDoneNotice: (names: string[]) =>
    text(
      names.length > 0
        ? `今朝の雪かきが終わりました。${names.map((n) => `${n}さん`).join("、")}が来てくれました。足元に気をつけてお出かけください。`
        : "今朝の雪かきが終わりました。足元に気をつけてお出かけください。",
    ),
  shortReported: (baseNumber: number | string) => text(`拠点${baseNumber}の人手不足を町内に知らせます。5分だけ来てくれる人を探します。`),
  // ---- ヘルプ通知と見守り（spec 4・8） ----
  helpRequest: (missionId: string, baseNumber: number | string, missing: number, tasks: string[]) =>
    ask(
      `拠点${baseNumber}で人手が足りません（あと${missing}人）。\n5分でもOK: ${tasks.slice(0, 2).join("／")}\n行けますか？`,
      [
        { label: "行く（5分でも）", data: `help:go=${missionId}` },
        { label: "今は無理", data: "help:no" },
      ],
    ),
  helpJoined: (baseNumber: number | string) =>
    text(`ありがとうございます！拠点${baseNumber}へお願いします。終わったら写真を1枚送ってください。`),
  helpDeclined: () => text("承知しました。また次の機会に。"),
  helpAlreadyEnough: (baseNumber: number | string) => text(`拠点${baseNumber}は人がそろいました。ありがとうございます。`),
  supporterRequest: (baseNumber: number | string, missing: number) =>
    text(`【サポーターへ】拠点${baseNumber}に人が集まりません（あと${missing}人）。1km まで声をかけましたが足りません。お願いできますか。`),
  knockRequest: (missionId: string, baseNumber: number | string) =>
    ask(
      `拠点${baseNumber}は、今朝の点呼に返事がありません。通りがかりに玄関で声をかけてもらえますか？（体調のことは判断しなくて大丈夫です。返事があったかだけ教えてください）`,
      [
        { label: "声をかけに行く", data: `knock:${missionId}` },
        { label: "今は無理", data: "help:no" },
      ],
    ),
  knockThanks: () => text("ありがとうございます。声をかけたら、返事があったかどうかをここに送ってください。"),
  familyNoAnswer: () => text("今朝の点呼に、ご家族から返事がありません。お電話などで様子を聞いてみてください。近所の方にも玄関で声をかけてもらうようお願いしています。"),
  familyDone: (names: string[]) =>
    text(
      names.length > 0
        ? `今朝、ご家族の家の雪かきが終わりました。来てくれたのは ${names.map((n) => `${n}さん`).join("、")}です。`
        : "今朝、ご家族の家の雪かきが終わりました。",
    ),
  lateRequesterFine: () => text("よかったです。今朝は取り下げました。ゆっくりどうぞ。"),
  lateRequesterShort: () => text("承知しました。近くの人に声をかけて、人を集めます。"),
  lateHelperThanks: () => text("ありがとうございます。人手が足りない家があればお知らせします。"),
  // ---- 週末と「いまからやる」（spec 2・5・10） ----
  nowAsk: () =>
    ask("いまから何分くらい動けますか？近くの小さな仕事を1つ探します。", [
      { label: "5分", data: "now:5" },
      { label: "15分", data: "now:15" },
      { label: "30分", data: "now:30" },
    ]),
  nowOffer: (missionId: string, baseNumber: number | string, label: string, minutes: number, distanceM: number) =>
    ask(`拠点${baseNumber}（約${Math.round(distanceM / 10) * 10}m）で「${label}（${minutes}分）」をお願いできますか？`, [
      { label: "行く", data: `help:go=${missionId}` },
      { label: "やめておく", data: "help:no" },
    ]),
  nowNothing: () => text("いま近くで手伝える仕事はありません。雪の朝にまたお願いします。"),
  weeklyToAll: (commentary: string, nextWeek: string) => text(`${commentary}\n\n${nextWeek}`),
  weeklyTitle: (title: string, rareCard: boolean) =>
    text(`今週の称号「${title}」をおくります。${rareCard ? "次のカードはレア確定です。" : "来週もよろしくお願いします。"}`),
  weeklyNewTeam: (teamName: string, colorName: string) => text(`来週のあなたのチームは「${teamName}」（${colorName}）です。`),
  weeklyFamily: (count: number) => text(`今週は、ご家族の家の雪かきを ${count} 回手伝ってもらいました。`),
  linkedSelf: () => text("紐づけました。雪の朝 6:30 に「今朝、玄関は出られそうですか？」と1回だけ聞きます。"),
  linkedFamily: () => text("家族として紐づけました。雪かきが終わったときや、点呼に返事がないときにお知らせします。"),
} satisfies Record<string, (...args: never[]) => LineMessage>;
