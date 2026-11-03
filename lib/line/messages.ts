// LINE に送る文面と大きなボタン（クイックリプライ）。文面はここにまとめて、あとで直しやすくする。
// 方針（v1.4）: 1つの吹き出しに1つの話題。短く、やさしい日本語で。次にすることはボタンで出す（最後の吹き出しに付く）。
// うまくいかなかったときも「失敗」と感じさせない言い方にする。どれも吹き出しの配列を返す。
// v1.6: エナガ隊長の口調（語尾「〜しま〜」「〜えな〜」）は、手伝う側への文と隊長カードだけ。
//       付けるのは3文に1つくらい（あいさつ・了解・完了など気持ちが動くところ）。質問・お願い・注意は普通の言い方。
//       お願いする側・家族・見守り・体調にふれる文は、いつもの丁寧な言い方のまま。
// v1.5: 質問への答えは吹き出しの中の大きなボタン（choiceCard）、「どこに・何時」は大きな画像の行き先カード（placeCard）。
import { MENU } from "../brand";
import { teamAnnounceText, teamImageMessage } from "../team-announce";
import type { TeamTerm } from "../team-theme";
import type { TeamId } from "../types";
import { liffUrl } from "../url";
import { captainCard, choiceCard, placeCard, type CardAction, type Choice, type Tone } from "./flex";
import type { FlexMessage, LineMessage, QuickReplyAction, TextMessage } from "./types";

type Button = QuickReplyAction;

export function text(body: string): TextMessage {
  return { type: "text", text: body };
}

/** 文面＋ボタン。label は 20 文字まで */
function withButtons(body: string, buttons: Button[]): TextMessage {
  return { type: "text", text: body, quickReply: { items: buttons.map((action) => ({ type: "action", action })) } };
}

/** postback のボタン（押した文字がトークに出る） */
const pb = (label: string, data: string): Button => ({ type: "postback", label, data, displayText: label });
/** Web の画面を開くボタン（LIFF があれば LINE の中で開く） */
const open = (label: string, path: string): Button => ({ type: "uri", label, uri: liffUrl(path) });
/** 文字を送るボタン（「出動する」「登録」など） */
const say = (label: string, t = label): Button => ({ type: "message", label, text: t });

const B = {
  go: say(MENU.go.label),
  map: open(`${MENU.map.label}を開く`, "/map"),
  card: open(`${MENU.card.label}を見る`, "/cards"),
  guide: open(MENU.guide.label, "/rules"),
  solo: open("ひとりで5分を見る", "/solo"),
  camera: { type: "camera", label: "写真を撮る" } as Button,
  roll: { type: "cameraRoll", label: "写真を選ぶ" } as Button,
  register: say("登録する", "登録"),
};

/** チーム発表: 画像1枚と文（「チームを見る」ボタン付き） */
function teamAnnounce(teamId: TeamId, term: TeamTerm, kind: "first" | "weekly"): LineMessage[] {
  return [teamImageMessage(teamId, term, kind), withButtons(teamAnnounceText(teamId, term, kind), [open("チームを見る", "/team")])];
}

/** 質問と大きな答えボタン（postback）。押した文字がトークに出る。tone: soft は「休む・やめる」側 */
export function ask(body: string, choices: { label: string; data: string; tone?: Tone }[]): FlexMessage {
  return choiceCard(
    body,
    choices.map((c) => ({ label: c.label, action: pb(c.label, c.data) as CardAction, tone: c.tone })),
  );
}

/** 質問と大きなボタン（postback と Web の画面を混ぜられる） */
const card = (body: string, choices: Choice[]) => choiceCard(body, choices);
const mapChoice: Choice = { label: "🗺 町の地図を開く", action: { type: "uri", label: "町の地図を開く", uri: liffUrl("/map") }, tone: "line" };
const choose = (label: string, data: string, tone?: Tone): Choice => ({ label, action: pb(label, data) as CardAction, tone });
const photoAsk = (body: string) => withButtons(body, [B.camera, B.roll]);

/** 「位置情報を送る」ボタン付きの文面 */
export function askLocation(body: string): TextMessage {
  return withButtons(body, [{ type: "location", label: "位置情報を送る" }]);
}

/** 文字は吹き出し1つずつに。最後の吹き出しにボタンを付ける */
function bubbles(lines: (string | false | undefined)[], buttons?: Button[]): TextMessage[] {
  const ls = lines.filter((l): l is string => Boolean(l));
  return ls.map((l, i) => (i === ls.length - 1 && buttons?.length ? withButtons(l, buttons) : text(l)));
}

/** 文ごとに分ける（最大 max 個。残りは最後にまとめる）。「しま〜！」「えな〜！！」の終わりでも分ける */
export function sentences(body: string, max = 3): string[] {
  const parts = body
    .split(/(?<=[。！？!?])(?![！？!?〜])\s*/)
    .map((x) => x.trim())
    .filter(Boolean);
  if (parts.length <= max) return parts;
  return [...parts.slice(0, max - 1), parts.slice(max - 1).join("")];
}

/** 長い文（Claude の予告など）を、文ごとの吹き出しに分ける（最大 max 個。残りは最後にまとめる） */
export function splitSentences(body: string, max = 3): TextMessage[] {
  return sentences(body, max).map(text);
}

/**
 * LINE は1回に5つまで。超えたら、ボタンのない吹き出しどうしを前からつなげて5つに収める。
 * それでも多いときは、最初の4つと最後（ボタンが付いている）を残す。
 */
export function fitFive(messages: LineMessage[]): LineMessage[] {
  const out = [...messages];
  while (out.length > 5) {
    const i = out.findIndex((m, k) => k < out.length - 1 && m.type === "text" && !m.quickReply && out[k + 1].type === "text");
    if (i < 0) return [...out.slice(0, 4), out[out.length - 1]];
    const a = out[i] as TextMessage;
    const b = out[i + 1] as TextMessage;
    out.splice(i, 2, { ...b, text: `${a.text}\n${b.text}` });
  }
  return out;
}

/** 朝のあいさつ: エナガ隊長のカード（積雪ゲージの画像）。雪の量がわからないときは文だけ */
const hello = (forecastCm?: number, snowName?: string): LineMessage[] =>
  forecastCm === undefined
    ? [text("おはようだしま〜！☃️")]
    : [
        captainCard({
          cm: forecastCm,
          snowName,
          when: "morning",
          lines: ["おはようだしま〜！☃️", snowName ? `今朝は雪${forecastCm}cm、相手は『${snowName}』です。` : `今朝は雪${forecastCm}cmです。`],
        }),
      ];

const names = (ns: string[]) => ns.map((n) => `${n}さん`).join("、");

export const MSG = {
  // ---- 登録（spec 1） ----
  welcome: () =>
    [
      ...bubbles(["シマエナGO へようこそ！☃️", "雪の朝に、町内で少しずつ雪かきを助け合うアプリです。"]),
      ask("あなたはどちらですか？", [
        { label: "雪かきをお願いしたい", data: "reg:role=requester" },
        { label: "雪かきを手伝う", data: "reg:role=helper" },
        { label: "家族の代わりに登録", data: "reg:role=family", tone: "soft" },
      ]),
    ],
  locationSelf: () => [
    text("ありがとうございます。"),
    askLocation("家の場所を教えてください。\n下の「位置情報を送る」を押して、地図で家を選びます。\n（地図に名前や住所は出ません）"),
  ],
  locationProxy: () => [
    text("ありがとうございます。"),
    askLocation("雪かきをお願いする方の家の場所を、下の「位置情報を送る」を押して、地図で選んでください。\n（地図に名前や住所は出ません）"),
  ],
  requesterQ1: () => [
    ask("ひとりで雪かきをすると、いつも何分くらいかかりますか？", [
      { label: "15分くらい", data: "reg:q1=15" },
      { label: "30分くらい", data: "reg:q1=30" },
      { label: "60分以上", data: "reg:q1=60" },
      { label: "わからない", data: "reg:q1=unknown", tone: "soft" },
    ]),
  ],
  requesterQ2: () => [
    ask("どこまで雪かきが必要ですか？", [
      { label: "玄関前まで", data: "reg:q2=entrance" },
      { label: "車庫前まで", data: "reg:q2=garage" },
      { label: "道路まで", data: "reg:q2=road" },
    ]),
  ],
  helperQ1: () => [
    ask("雪の朝、何分くらい動けますか？", [
      { label: "15分", data: "reg:q1=15" },
      { label: "30分", data: "reg:q1=30" },
      { label: "60分", data: "reg:q1=60" },
    ]),
  ],
  helperQ2: () => [
    ask("スコップなどの道具はありますか？", [
      { label: "ある", data: "reg:q2=yes" },
      { label: "ない", data: "reg:q2=no", tone: "soft" },
    ]),
  ],
  linkWho: () => [
    ask("この番号を送ったのは、どなたですか？", [
      { label: "お願いする本人", data: "link:who=self" },
      { label: "家族（知らせを受け取る）", data: "link:who=family" },
    ]),
  ],
  codeNotFound: () => bubbles(["その番号は見つかりませんでした。", "6桁の数字をもう一度確かめて、送ってください。\nわからないときは、番号を教えてくれたご家族に聞いてみてください。"]),
  help: () =>
    bubbles(["下のボタンか、画面の下のメニューから選んでください。"], [B.go, B.map, B.card, B.guide, say("登録をやり直す", "登録")]),
  /** 登録できた → チーム発表（画像＋文）→ 雪の朝の案内 */
  helperDone: (teamId: TeamId, term: TeamTerm): LineMessage[] => [
    text("登録できました！🎉"),
    ...teamAnnounce(teamId, term, "first"),
    text("雪の朝 6:30 に、ここへ1問だけ届きます。ボタンを1回押すだけです。"),
  ],
  /** 登録のすぐあと: 雪の朝を待たずに、まずはひとりで5分（spec v1.3） */
  soloInvite: (_url: string, role: "helper" | "requester") =>
    role === "helper"
      ? bubbles(["雪の朝を待たずに、ひとりで5分の出動（ソロ出動）もできます。見回りや雪の報告で、最初のカードがもらえます。"], [B.solo, B.guide])
      : bubbles(["ご自分の家の雪かきも、ソロ出動で5分やったら記録できます。無理はしないでくださいね。"], [B.solo, B.guide]),
  requesterDone: (message: string, level: number, requiredPeople: number) => bubbles([message, `家のレベル: ${level}（必要な人数: ${requiredPeople}人）`]),
  proxyDone: (code: string) =>
    bubbles([
      "ご家族の登録ができました。",
      `連携コード: ${code}`,
      "ご本人の LINE でこのアカウントを友だち追加して、この6桁を送ると、ご本人にも点呼が届きます。ほかのご家族も、同じ番号でお知らせを受け取れます。",
    ]),

  // ---- 前夜の予告・朝のあいさつ ----
  /** 前夜の予告（Claude の文）を、隊長カード1枚に */
  announce: (body: string, forecastCm: number, snowName?: string) => [captainCard({ cm: forecastCm, snowName, when: "eve", lines: sentences(body, 5) })],
  morningHello: (forecastCm?: number, snowName?: string) => hello(forecastCm, snowName),
  /** 作戦のあと、手伝う側へ: 家の数と「5分だけでも」。割り当てがない人には「出動する」ボタン */
  housesToday: (houses: number, withGoButton: boolean) =>
    houses > 0
      ? bubbles([`助けてほしい家が${houses}軒あります。`, "5分だけでも大歓迎えな〜！"], withGoButton ? [B.go, B.map] : undefined)
      : bubbles(["今朝は、助けてほしい家はありません。ありがとうえな〜！"]),

  // ---- 点呼（spec 2） ----
  rollcallRequester: (forecastCm?: number, snowName?: string) => [
    ...hello(forecastCm, snowName),
    ask("今朝、玄関から外に出られそうですか？", [
      { label: "はい", data: "rc:ans=yes" },
      { label: "いいえ", data: "rc:ans=no", tone: "soft" },
      { label: "誰かと一緒なら", data: "rc:ans=together" },
    ]),
  ],
  rollcallHelper: (forecastCm?: number, snowName?: string) => [
    ...hello(forecastCm, snowName),
    ask("今朝、何分動けますか？", [
      { label: "5分", data: "rc:ans=5" },
      { label: "15分", data: "rc:ans=15" },
      { label: "30分", data: "rc:ans=30" },
      { label: "60分", data: "rc:ans=60" },
      { label: "今朝は休む", data: "rc:ans=0", tone: "soft" },
    ]),
  ],
  rollcallThanks: (answer: string) =>
    answer === "yes"
      ? bubbles(["よかったです。", "今朝はゆっくりどうぞ。"])
      : answer === "no"
        ? bubbles(["わかりました。", "6:40 に、来てくれる人をお知らせします。"])
        : answer === "together"
          ? bubbles(["ありがとうございます。一緒にやりましょう。", "6:40 に、来てくれる人をお知らせします。"])
          : answer === "0"
            ? bubbles(["わかりました。今朝はゆっくり休んでください。", "またの朝に、よろしくしま〜！"])
            : bubbles(["ありがとうしま〜！", "6:40 に、行き先をお知らせします。"]),
  rollcallClosed: () => bubbles(["いまは点呼の時間ではありません。", "雪の朝 6:30 に、ここへ届きます。"], [B.go, B.map]),
  notRegistered: () => bubbles(["登録がまだです。1分で終わります。"], [B.register, B.guide]),
  planForRequester: (startTime: string, ns: string[]) =>
    ns.length > 0
      ? bubbles([`${startTime} に ${names(ns)}が来てくれます。`, "玄関の鍵を開けておいてください。"])
      : bubbles(["いま、来てくれる人を集めています。", "決まったら、すぐにお知らせします。"]),

  // ---- 朝の一本道（spec 2: 行く → 写真 → 完了） ----
  planForHelper: (body: string) => [card(body, [choose("👟 行く", "go:yes"), choose("今朝は行けない", "go:no", "soft"), mapChoice])],
  /** 「行く」のあと: 了解 → 行き先カード（大きな画像・地図・ルート）→ 終わったら写真 */
  goConfirmed: (baseNumber: number | string, routeUrl?: string) => [
    text("了解だしま〜！🙌"),
    placeCard({ time: "7:00", baseNumber, note: "5分でも助かります。足元に気をつけて。", mapUrl: liffUrl("/map"), routeUrl }),
    photoAsk("終わったら、玄関の前から道路の方を写した写真を1枚送ってください。"),
  ],
  goDeclined: () => bubbles(["わかりました。無理しないでくださいね。", "ほかの人に声をかけるしま〜！"]),
  noSortie: () => bubbles(["今朝の割り当てはありません。", "近くの手伝いを探すときは、下の「出動する」を押してください。"], [B.go, B.map]),
  /** 写真では「まだ」。もう一度送るか、「それでも完了にする」（本人の報告）か */
  photoNotCleared: (comment: string) =>
    bubbles(
      [comment, "終わったら、もう一度写真を送ってください。", "写真がうまく撮れないときは「それでも完了にする」を押してください。本人の報告として受け付けます。"],
      [pb("それでも完了にする", "done:manual"), B.camera, B.roll],
    ),
  /** 写真や報告で完了したときの返事（最大5つの吹き出し）。ボタンは最後に付く */
  doneReport: (r: { baseNumber: number | string; comment: string; notes?: string[]; team?: { name: string; points: number }; allDoneLine?: string; grid?: string }) =>
    bubbles(
      [
        `拠点${r.baseNumber} 完了だしま〜！🎉\nあなたの5分で、1軒が助かりました。`,
        r.comment,
        r.notes && r.notes.length > 0 && r.notes.join("\n"),
        [r.allDoneLine, r.team && `${r.team.name}に +${r.team.points} 点。ありがとうカードは後で届きます。`].filter(Boolean).join("\n"),
        r.grid && `結果をそのまま LINE や SNS に貼れます。\n${r.grid}`,
      ],
      [B.card, B.map],
    ),
  doneByOther: (baseNumber: number | string, byName: string, teamName: string, points: number) =>
    bubbles([`拠点${baseNumber}は、${byName}さんの写真で完了になりました。`, `${teamName}に +${points} 点。おつかれさまでした！`], [B.card]),
  /** 完了をお願いした人へ。missionId があれば「ありがとう点呼」の3ボタン付き（spec v1.1） */
  requesterDoneNotice: (ns: string[], missionId?: string) => {
    const lines = ["今朝の雪かきが終わりました。☃️", ns.length > 0 && `${names(ns)}が来てくれました。`, "足元に気をつけて、お出かけください。"];
    if (!missionId) return bubbles(lines);
    return [
      ...bubbles(lines),
      ask("ひとこと返しませんか？（1回押すだけで届きます）", [
        { label: "ありがとう", data: `thanks:${missionId}=1` },
        { label: "助かりました", data: `thanks:${missionId}=2` },
        { label: "お茶どうぞ", data: `thanks:${missionId}=3` },
      ]),
    ];
  },
  thanksToHelper: (fromName: string, label: string, baseNumber: number | string, sentence: string) =>
    bubbles([`${fromName}さん（拠点${baseNumber}）から「${label}」が届きました。💌`, sentence, "カードの裏にも入りました。"], [B.card]),
  thanksSent: (label: string, count: number) =>
    bubbles([count > 0 ? `「${label}」を、来てくれた${count}人に伝えました。` : `「${label}」を受け取りました。カードの裏に入ります。`]),
  thanksNotFound: () => bubbles(["今朝の雪かきの記録が見つかりませんでした。", "少し時間をおいて、もう一度押してみてください。"]),
  /** 初出撃の歓迎（最初のカードと同じプッシュで） */
  firstFlight: (townName: string) => bubbles(["初出撃おめでとう！🎉", `今日からあなたも、${townName}の群れの一員です。最初のありがとうカードをどうぞ。`]),
  shortReported: (baseNumber: number | string) => bubbles([`拠点${baseNumber}の人手不足を、近くの人に知らせました。`, "5分だけ来てくれる人を探しています。"]),

  // ---- ヘルプ通知と見守り（spec 4・8） ----
  helpRequest: (missionId: string, baseNumber: number | string, missing: number, tasks: string[]) => [
    ...bubbles(["助けてほしい家があります。🙏", `拠点${baseNumber}、あと${missing}人です。`]),
    card(`5分でもOK: ${tasks.slice(0, 2).join("／")}\n行けますか？`, [choose("👟 行く（5分でも）", `help:go=${missionId}`), choose("今は無理", "help:no", "soft"), mapChoice]),
  ],
  helpJoined: (baseNumber: number | string, routeUrl?: string) => [
    text("ありがとうしま〜！🙌"),
    placeCard({ time: "now", baseNumber, note: "5分でも助かります。足元に気をつけて。", mapUrl: liffUrl("/map"), routeUrl }),
    photoAsk("終わったら、写真を1枚送ってください。"),
  ],
  helpDeclined: () => bubbles(["わかりました。気にしないでくださいね。", "また次の機会に、よろしくしま〜！"]),
  helpAlreadyEnough: (baseNumber: number | string) => bubbles([`拠点${baseNumber}は人がそろいました。`, "ありがとうございます！"], [B.go]),
  supporterRequest: (baseNumber: number | string, missing: number) =>
    bubbles(["【サポーターの方へ】", `拠点${baseNumber}に人が集まりません（あと${missing}人）。`, "1km まで声をかけましたが、足りません。お願いできますか。"], [B.map]),
  knockRequest: (missionId: string, baseNumber: number | string) => [
    ...bubbles([`拠点${baseNumber}は、今朝の点呼に返事がありません。`, "体調のことは判断しなくて大丈夫です。返事があったかだけ教えてください。"]),
    ask("通りがかりに、玄関で声をかけてもらえますか？", [
      { label: "声をかけに行く", data: `knock:${missionId}` },
      { label: "今は無理", data: "help:no", tone: "soft" },
    ]),
  ],
  knockThanks: () => bubbles(["ありがとうございます。🙏", "声をかけたら、返事があったかどうかを、ここに送ってください。"]),
  familyNoAnswer: () =>
    bubbles([
      "今朝の点呼に、ご家族から返事がありません。",
      "お電話などで、様子を聞いてみてください。",
      "近所の方にも、玄関で声をかけてもらうようお願いしています。",
    ]),
  /** 家族への完了通知。missionId があれば「応援スタンプ」の3ボタン付き（spec v1.2） */
  familyDone: (ns: string[], missionId?: string) => {
    const lines = ["今朝、ご家族の家の雪かきが終わりました。☃️", ns.length > 0 && `来てくれたのは ${names(ns)}です。`];
    if (!missionId) return bubbles(lines);
    return [
      ...bubbles(lines),
      ask("来てくれた人に、遠くから応援を送れます（1回押すだけ）。", [
        { label: "お疲れさま", data: `cheer:${missionId}=1` },
        { label: "あったかくして", data: `cheer:${missionId}=2` },
        { label: "遠くから拍手", data: `cheer:${missionId}=3` },
      ]),
    ];
  },
  cheerToHelper: (requesterName: string, label: string, baseNumber: number | string) =>
    bubbles([`拠点${baseNumber}（${requesterName}さん）のご家族から、応援「${label}」が届きました。📣`, "遠くからも見ていてくれています。"]),
  cheerSent: (label: string, count: number) => bubbles([count > 0 ? `「${label}」を、来てくれた${count}人に伝えました。` : `「${label}」を受け取りました。`]),
  cheerNotFound: () => bubbles(["今朝の雪かきの記録が見つかりませんでした。", "少し時間をおいて、もう一度押してみてください。"]),
  lateRequesterFine: () => bubbles(["よかったです。今朝の依頼は取り下げました。", "ゆっくりどうぞ。"]),
  lateRequesterShort: () => bubbles(["わかりました。近くの人に声をかけて、人を集めます。", "決まったら、お知らせします。"]),
  lateHelperThanks: () => bubbles(["ありがとうございます！", "人手が足りない家があれば、お知らせします。"]),

  // ---- 「出動する」（リッチメニュー）と週末（spec 2・5・10） ----
  nowAsk: () => [text("近くの手伝いを探すしま〜！☃️"), ask("いまから何分動けますか？", [
    { label: "5分", data: "now:5" },
    { label: "15分", data: "now:15" },
    { label: "30分", data: "now:30" },
    { label: "60分", data: "now:60" },
  ])],
  nowOffer: (missionId: string, baseNumber: number | string, label: string, minutes: number, distanceM: number) => [
    text(`拠点${baseNumber}（ここから約${Math.round(distanceM / 10) * 10}m）に、手伝いがあります。`),
    card(`「${label}」${minutes}分。\nお願いできますか？`, [choose("👟 行く", `help:go=${missionId}`), choose("やめておく", "help:no", "soft"), mapChoice]),
  ],
  /** 近くに仕事がないとき。無駄足や失敗と感じないように */
  nowNothing: () =>
    bubbles(["今近くに仕事はありません。", "ありがとうえな〜！次の雪の朝に、またお知らせします。", "ひとりでできる5分（見回りなど）もあります。"], [B.solo, B.map]),
  /** お願いする側の人が「出動する」を押したとき */
  nowForRequester: () =>
    bubbles(
      ["「出動する」は、雪かきを手伝う方のメニューです。", "雪かきのお願いは、雪の朝 6:30 の点呼に答えるだけで大丈夫です。", "ご自分の家の雪かきを5分やったら、記録もできます。"],
      [B.solo, B.guide],
    ),
  weeklyToAll: (commentary: string, nextWeek: string) => bubbles([commentary, nextWeek]),
  weeklyTitle: (title: string, rareCard: boolean) =>
    bubbles([`今週の称号「${title}」をおくります。🏅${rareCard ? "\n次のカードはレア確定です。" : ""}`], [B.card]),
  /** 日曜の夜の組み直し: 派手めのチーム発表（画像＋文＋チームの画面を開くボタン） */
  weeklyNewTeam: (teamId: TeamId, term: TeamTerm): LineMessage[] => teamAnnounce(teamId, term, "weekly"),
  weeklyFamily: (count: number) => bubbles([`今週は、ご家族の家の雪かきを ${count} 回手伝ってもらいました。`]),
  linkedSelf: () => bubbles(["紐づけができました。", "雪の朝 6:30 に「今朝、玄関から外に出られそうですか？」と1回だけ聞きます。"]),
  linkedFamily: () => bubbles(["家族として紐づけました。", "雪かきが終わったときや、点呼に返事がないときにお知らせします。"]),
} satisfies Record<string, (...args: never[]) => LineMessage[]>;
