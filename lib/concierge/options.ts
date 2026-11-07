// AI参加コンシェルジュ: その人に「いま本当に開いている」参加の方法を、普通のプログラムで絞る（spec v1.7）。
// Claude はこの候補の中から選ぶだけ。候補にないこと（他人の家を依頼にする・屋根の雪下ろし など）は提案できない。
import type { Prop } from "../line/you-image";
import type { Motive } from "./profile";

export type OptionId = "rollcall" | "my_mission" | "join" | "own_house" | "patrol" | "online" | "tip" | "cheer" | "nakama" | "baton" | "team" | "cards" | "time";

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
  /** 夜（19時〜6時）: 自分の家と家の中でできることだけ（spec v1.8 防犯） */
  night?: boolean;
  /** その人が求めている方向（spec v1.17: つながり・運動・地域貢献・ゲーム）。合う候補を前に出す */
  motives?: Motive[];
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
  /** この候補が合う方向（spec v1.17） */
  motives: Motive[];
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
    motives: ["community"],
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
    motives: ["community", "connect"],
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
    motives: ["community", "connect", "exercise"],
  }),
  own_house: (ctx: ConciergeContext): ConciergeOption => ({
    id: "own_house",
    button: "自分の家の雪かき",
    title: "自分の家の雪かき",
    minutes: 10,
    points: ctx.hasTeam ? 5 : 0,
    about: "いちばん始めやすい。自分の家の玄関前を終わるまで。始めと終わりの写真で、Before/After を自慢できる",
    prop: "shovel",
    action: { kind: "uri", path: "/solo?pick=10&focus=own_house" },
    motives: ["exercise", "game"],
  }),
  patrol: (ctx: ConciergeContext): ConciergeOption => ({
    id: "patrol",
    button: "道の危険を知らせる",
    title: "道の危険を知らせる",
    minutes: 10,
    points: ctx.hasTeam ? 3 : 0,
    about: "スコップがなくてもできる。除雪がまだ・道が細い・歩道がない・ぐさぐさ・つるつるの所を、写真と場所で近所に知らせる",
    prop: "map",
    action: { kind: "uri", path: "/solo?pick=10&focus=report_snow" },
    motives: ["community", "exercise"],
  }),
  online: (): ConciergeOption => ({
    id: "online",
    button: "道の報告の地図を見る",
    title: "道の報告を見る",
    minutes: 3,
    points: 0,
    about: "外に出られない・時間がない人向け。家の中で、近所の人が知らせた 滑る所・細い道・除雪まだ を地図で見る（11/6 本人の指摘: 道の報告の地図へ）",
    prop: "phone",
    action: { kind: "uri", path: "/map?view=road" },
    motives: ["game"],
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
    motives: ["community", "connect"],
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
    motives: ["community"],
  }),
  // ---- 方向ごとの候補（spec v1.17）。候補の外は提案しない ----
  nakama: (): ConciergeOption => ({
    id: "nakama",
    button: "なかまと10分だけ一緒に",
    title: "なかまと10分",
    minutes: 10,
    points: 0,
    about: "つながりを求める人向け。近くの人を「今から10分」「今日のどこかで」で誘える（相手が「一緒にやる」を押したら成立）。再会もここから",
    prop: "tea",
    action: { kind: "uri", path: "/nakama?tab=1" },
    motives: ["connect"],
  }),
  baton: (): ConciergeOption => ({
    id: "baton",
    button: "雪かきバトンを見る",
    title: "雪かきバトン",
    minutes: 3,
    points: 0,
    about: "つながりを求める人向け。近所（250m）の人が残したバトンに「ありがとう」「続きをやります」。自分の雪かきのあとにバトンを残せる",
    prop: "phone",
    action: { kind: "uri", path: "/nakama?tab=2" },
    motives: ["connect", "community"],
  }),
  team: (): ConciergeOption => ({
    id: "team",
    button: "今週のチームと得点を見る",
    title: "チームの得点を見る",
    minutes: 2,
    points: 0,
    about: "ゲームとして楽しみたい人向け。今週のチーム（月〜日）・3チームの得点・自分の活動がチームの何点になるか",
    prop: "phone",
    action: { kind: "uri", path: "/team" },
    motives: ["game"],
  }),
  /** チームで時間をそろえる（spec v1.41）: 雪の日（予告のあと〜その日）だけ */
  time: (): ConciergeOption => ({
    id: "time",
    button: "チームで時間をそろえる",
    title: "そろう時間を選ぶ",
    minutes: 1,
    points: 0,
    about: "雪の日に、チームのなかまと来る時間をそろえる。朝・お昼・夕方から選ぶと、いちばん集まる時間と「予定に入れる」（カレンダー）が出る",
    prop: "phone",
    action: { kind: "uri", path: "/team?tab=time" },
    motives: ["connect", "game"],
  }),
  cards: (): ConciergeOption => ({
    id: "cards",
    button: "カード図鑑と連続出動を見る",
    title: "カード図鑑を見る",
    minutes: 2,
    points: 0,
    about: "ゲームとして楽しみたい人向け。その時だけのカード・5つのタッチの集まり具合・連続出動の日数・ごほうびまでの枚数",
    prop: "phone",
    action: { kind: "uri", path: "/cards/book" },
    motives: ["game"],
  }),
};

/**
 * その人に開いている方法を、すすめたい順に並べる（最大5つ）。
 * 安全注意の朝は、外の活動を後ろに回す。お願いする側には、体を使う活動を前に出さない。
 */
export function buildOptions(ctx: ConciergeContext): ConciergeOption[] {
  const list: ConciergeOption[] = [];
  const open = (id: string) => !ctx.soloDoneToday.includes(id);
  // spec v1.20: 毎朝の質問（点呼）はやめた。頼む家は登録の頼み方で自動。点呼に答える候補は出さない
  if (ctx.role === "helper") {
    if (ctx.going) list.push(O.my_mission());
    else if (ctx.rollcall === "planned" && ctx.shortHouses > 0) list.push(O.join(ctx));
    const outside = [open("own_house") && O.own_house(ctx), open("report_snow") && O.patrol(ctx)].filter((x): x is ConciergeOption => Boolean(x));
    const inside = [open("check_area") && O.online()].filter((x): x is ConciergeOption => Boolean(x));
    list.push(...(ctx.safety ? [...inside, ...outside] : [...outside, ...inside]));
    list.push(O.cheer());
  } else {
    if (ctx.tipOk) list.push(O.tip());
    if (open("check_area")) list.push(O.online());
    list.push(O.cheer());
    if (!ctx.safety && open("own_house")) list.push(O.own_house(ctx));
    // お互いさま（v1.10）: チームに入っていれば、人手の足りない家にも誘える（体を使うので前には出さない）
    if (!ctx.safety && ctx.hasTeam && ctx.rollcall === "planned" && ctx.shortHouses > 0) list.push(O.join(ctx));
  }
  // 方向ごとの候補（spec v1.17）: チームのある人には なかま・バトン・チーム・図鑑
  // 雪の日（予告のあと〜その日）は、なかまの次に「チームで時間をそろえる」（spec v1.41）
  const snowDay = ctx.rollcall === "announced" || ctx.rollcall === "open" || ctx.rollcall === "planned";
  if (ctx.hasTeam) list.push(O.nakama(), ...(snowDay ? [O.time()] : []), O.baton(), O.team(), O.cards());
  else list.push(O.baton(), O.cards());
  // 夜は、よその家・道の見回り・人手不足の家・合流には誘わない（自分の家と家の中だけ）
  const nightOk: OptionId[] = ["rollcall", "own_house", "online", "tip", "cheer", "baton", "team", "cards"];
  // 時間をそろえるのは、夜なら前夜の予告のあと（明日の分）だけ。雪の日の夜は、その日の帯がもう終わっている
  const open_ = ctx.night ? list.filter((o) => nightOk.includes(o.id) || (o.id === "time" && ctx.rollcall === "announced")) : list;
  return rankByMotives(open_, ctx.motives).slice(0, 6);
}

/**
 * その人の方向に合う候補を前に出す（順は安定）。点呼・自分の行き先はいつも先頭（今やるべきこと）。
 * 方向がなければそのまま
 */
export function rankByMotives(list: ConciergeOption[], motives: Motive[] | undefined): ConciergeOption[] {
  if (!motives || motives.length === 0) return list;
  const first = list.filter((o) => o.id === "rollcall" || o.id === "my_mission");
  const rest = list.filter((o) => !first.includes(o));
  const score = (o: ConciergeOption) => o.motives.filter((m) => motives.includes(m)).length;
  return [...first, ...rest.map((o, i) => ({ o, i })).sort((a, b) => score(b.o) - score(a.o) || a.i - b.i).map((x) => x.o)];
}

/** 言葉の中の、体・病気のことば（体調は判断しない。記録にも残さない） */
export const BODY_WORDS = /病院|病気|通院|入院|薬|腰|膝|ひざ|足が|体調|具合|痛|熱|手術|リハビリ|血圧|心臓|しんどい|息切れ/;
/** 危ない作業のことば（提案しない。安全の一文で返す） */
export const DANGER_WORDS = /屋根|雪下ろし|脚立|はしご|梯子|除雪機/;
