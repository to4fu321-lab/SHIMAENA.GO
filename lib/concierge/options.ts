// AI参加コンシェルジュ: その人に「いま本当に開いている」参加の方法を、普通のプログラムで絞る（spec v1.7）。
// Claude はこの候補の中から選ぶだけ。候補にないこと（他人の家を依頼にする・屋根の雪下ろし など）は提案できない。
import type { Prop } from "../line/you-image";

export type OptionId = "rollcall" | "my_mission" | "join" | "own_house" | "patrol" | "online" | "tip" | "cheer";

export interface ConciergeContext {
  role: "helper" | "requester";
  hasTeam: boolean;
  /** 点呼の状態（雪の朝でなければ none） */
  rollcall: "none" | "announced" | "open" | "planned" | "closed";
  /** 今朝の点呼に答えたか */
  answered: boolean;
  /** 今朝の家に向かっている最中か */
  going: boolean;
  /** 人手が足りない家の数（作戦のあと） */
  shortHouses: number;
  /** 今日もう終えたソロのミッション */
  soloDoneToday: string[];
  /** 大雪・低温・強風の朝（安全の一文が出る朝） */
  safety: boolean;
  /** まだ一度も出動していない */
  firstTime: boolean;
  /** 今朝の先生にコツを教えられるか（お願いする側で、2週間に1回まで） */
  tipOk: boolean;
  /** 夜（18時〜6時）: 自分の家と家の中でできることだけ（spec v1.8 防犯） */
  night?: boolean;
}

export type OptionAction = { kind: "uri"; path: string } | { kind: "postback"; data: string };

export interface ConciergeOption {
  id: OptionId;
  /** ボタンの文字（短く） */
  button: string;
  /** 画像の札とミッションの名前（14字まで） */
  title: string;
  minutes: number;
  /** チームに入る点の目安（なければ 0） */
  points: number;
  /** Claude に渡す説明（どんな人に向くか） */
  about: string;
  prop: Prop;
  action: OptionAction;
}

const O = {
  rollcall: (ctx: ConciergeContext): ConciergeOption => ({
    id: "rollcall",
    button: ctx.role === "requester" ? "今朝の点呼に答える" : "今朝の点呼に答える（何分動ける？）",
    title: "今朝の点呼に答える",
    minutes: 1,
    points: 0,
    about: ctx.role === "requester" ? "雪かきに来てほしいかを1タップで答える。来てほしければ人が向かう" : "今朝何分動けるかを1タップで答える。司令官が近くの家を割り当てる",
    prop: "megaphone",
    action: { kind: "postback", data: "cc:rollcall" },
  }),
  my_mission: (): ConciergeOption => ({
    id: "my_mission",
    button: "地図で自分の行き先を見る",
    title: "今朝の行き先へ",
    minutes: 10,
    points: 10,
    about: "もう今朝の家に向かっている。地図で行き先と「終わりました」を確認する",
    prop: "map",
    action: { kind: "uri", path: "/map" },
  }),
  join: (ctx: ConciergeContext): ConciergeOption => ({
    id: "join",
    button: "人手が足りない家を見る",
    title: "あと1人の家を救う",
    minutes: 10,
    points: 10,
    about: `人手が足りない家が${ctx.shortHouses}軒ある。地図から10分だけ加われる（別のチームの家でもよい）`,
    prop: "map",
    action: { kind: "uri", path: "/map" },
  }),
  own_house: (ctx: ConciergeContext): ConciergeOption => ({
    id: "own_house",
    button: "自分の家の前を10分",
    title: "自分の家の雪かき",
    minutes: 10,
    points: ctx.hasTeam ? 5 : 0,
    about: "いちばん始めやすい。自分の家の玄関前を10分。写真を付けると確認済みに",
    prop: "shovel",
    action: { kind: "uri", path: "/solo?pick=10&focus=own_house" },
  }),
  patrol: (ctx: ConciergeContext): ConciergeOption => ({
    id: "patrol",
    button: "家のまわりを10分見回る",
    title: "雪の状況を見回る",
    minutes: 10,
    points: ctx.hasTeam ? 3 : 0,
    about: "スコップがなくてもできる。家のまわりを10分歩いて雪の様子を見る",
    prop: "map",
    action: { kind: "uri", path: "/solo?pick=10&focus=patrol" },
  }),
  online: (ctx: ConciergeContext): ConciergeOption => ({
    id: "online",
    button: "アプリで町の様子を見る（3分）",
    title: "町の雪を確認する",
    minutes: 3,
    points: ctx.hasTeam ? 1 : 0,
    about: "外に出られない・時間がない人向け。家の中で3分、今朝の地図と雪解けを見る",
    prop: "phone",
    action: { kind: "uri", path: "/solo?focus=check_area" },
  }),
  tip: (): ConciergeOption => ({
    id: "tip",
    button: "雪かきのコツを教える",
    title: "今朝の先生になる",
    minutes: 1,
    points: 0,
    about: "雪かきの経験がある人向け。コツを一言教えると、名前は出さずに手伝う人のカードに載る",
    prop: "pencil",
    action: { kind: "postback", data: "tip:ask" },
  }),
  cheer: (): ConciergeOption => ({
    id: "cheer",
    button: "町を応援する",
    title: "町を応援する",
    minutes: 1,
    points: 0,
    about: "体を動かせない日でもできる。1日1回、町の応援ゲージに1つ足す",
    prop: "tea",
    action: { kind: "uri", path: "/public/town#cheer" },
  }),
};

/**
 * その人に開いている方法を、すすめたい順に並べる（最大5つ）。
 * 安全注意の朝は、外の活動を後ろに回す。お願いする側には、体を使う活動を前に出さない。
 */
export function buildOptions(ctx: ConciergeContext): ConciergeOption[] {
  const list: ConciergeOption[] = [];
  const open = (id: string) => !ctx.soloDoneToday.includes(id);
  const rollcallOpen = ctx.rollcall === "open" || (ctx.rollcall === "planned" && ctx.role === "requester");
  if (rollcallOpen && !ctx.answered) list.push(O.rollcall(ctx));
  if (ctx.role === "helper") {
    if (ctx.going) list.push(O.my_mission());
    else if (ctx.rollcall === "planned" && ctx.shortHouses > 0) list.push(O.join(ctx));
    const outside = [open("own_house") && O.own_house(ctx), open("patrol") && O.patrol(ctx)].filter((x): x is ConciergeOption => Boolean(x));
    const inside = [open("check_area") && O.online(ctx)].filter((x): x is ConciergeOption => Boolean(x));
    list.push(...(ctx.safety ? [...inside, ...outside] : [...outside, ...inside]));
    list.push(O.cheer());
  } else {
    if (ctx.tipOk) list.push(O.tip());
    if (open("check_area")) list.push(O.online(ctx));
    list.push(O.cheer());
    if (!ctx.safety && open("own_house")) list.push(O.own_house(ctx));
  }
  // 夜は、よその家・道の見回り・人手不足の家には誘わない（自分の家と家の中だけ）
  const nightOk: OptionId[] = ["rollcall", "own_house", "online", "tip", "cheer"];
  return (ctx.night ? list.filter((o) => nightOk.includes(o.id)) : list).slice(0, 5);
}

/** 言葉の中の、体・病気のことば（体調は判断しない。記録にも残さない） */
export const BODY_WORDS = /病院|病気|通院|入院|薬|腰|膝|ひざ|足が|体調|具合|痛|熱|手術|リハビリ|血圧|心臓|しんどい|息切れ/;
/** 危ない作業のことば（提案しない。安全の一文で返す） */
export const DANGER_WORDS = /屋根|雪下ろし|脚立|はしご|梯子|除雪機/;
