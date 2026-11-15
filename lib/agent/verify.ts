// 隊長の返事の点検（spec v1.59）: 「数字は AI に作らせない。答えはプログラムが点検する」を、隊長トークの自由な文にも当てる。
// Claude が書いた返事の中の 拠点の番号・あと何人・距離・軒数・積雪・気温 を、地図やボタンと同じデータ（HouseFact・TownFact）と突き合わせる。
// 1つでも合わなければ、その文は出さず、同じデータからプログラムが組んだ文（safeText）に差しかえる。
// ここは保存も通信もしない純粋な関数（テストしやすいように）。

/** 手伝いが要る家（まだ終わっていない家）。地図の下のシートと同じ数え方 */
export interface HouseFact {
  missionId: string;
  number: number | string;
  /** 見ている人のいまの場所から（50m きざみ。地図の距離の札と同じ） */
  distanceM: number;
  /** あと何人（地図の「あと◯人」と同じ） */
  needMore: number;
  status: string;
}

/** 町の今朝の数（地図・町のページと同じ数え方） */
export interface TownFact {
  /** 今朝の家 */
  houses: number;
  /** 終わった家 */
  done: number;
  /** のこりの家（houses - done） */
  left: number;
  /** 人手が足りない家（地図の「人手不足」・町のページの「あと1人で救える家」） */
  short: number;
  /** いま向かっている人 */
  peopleOut: number;
  snowCm: number;
}

export interface VerifyContext {
  town: TownFact;
  /** まだ終わっていない家（近い順でなくてよい） */
  houses: HouseFact[];
  /** 今朝の家の番号（終わった家も含む）。知らない番号を見つけるため */
  knownNumbers: (number | string)[];
  /** ボタンで行ける家（提案がボタンになったとき） */
  proposal?: HouseFact;
  /** 天気の事実に出てくる数（気温・この先の雪・積雪） */
  weatherNumbers: number[];
}

const KANJI: Record<string, string> = { 一: "1", 二: "2", 三: "3", 四: "4", 五: "5", 六: "6", 七: "7", 八: "8", 九: "9", 十: "10" };

/** 全角の数字と、単位の前の漢数字（三軒・二人）を半角の数字にそろえる */
export function normalizeDigits(text: string): string {
  return text
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/([一二三四五六七八九十])(?=\s*(軒|人|番|cm|センチ|m|メートル|キロ|km|度|℃))/g, (_, k: string) => KANJI[k])
    .replace(/拠点\s*([一二三四五六七八九十])/g, (_, k: string) => `拠点${KANJI[k]}`);
}

/** 「あと◯人」。「あと1人で救える家」「あと1人の家」は家の種類の呼び名なので数えない */
const NEED = /あと\s*(\d+)\s*人(?!で救|の家)/;
const same = (a: number | string, b: number | string) => String(a) === String(b);
/** 距離は 50m きざみで見せているので、言い方のゆれ（250m を「約240m」）は 30m まで許す */
const nearM = (said: number, fact: number) => Math.abs(said - fact) <= 30;

/** いちばん近い家（同じ距離なら足りない人数が多い家） */
export function nearestHouse(houses: HouseFact[]): HouseFact | undefined {
  return [...houses].sort((a, b) => a.distanceM - b.distanceM || b.needMore - a.needMore)[0];
}

/**
 * 返事の文を点検する。合わないところを日本語の短い理由で返す（空なら合格）。
 * 見るもの: 拠点の番号／あと◯人／距離／「いちばん近い」／◯軒／◯cm／◯℃
 */
export function checkAnswerText(raw: string, ctx: VerifyContext): string[] {
  const text = normalizeDigits(raw);
  const problems: string[] = [];
  const houseOf = (n: string) => ctx.houses.find((h) => same(h.number, n));

  // ---- 拠点ごとの話（番号から、次の番号が出るまでを「その家の話」とみる） ----
  const mentions = [...text.matchAll(/拠点\s*(\d+)/g)].map((m) => ({ n: m[1], at: m.index ?? 0, end: (m.index ?? 0) + m[0].length }));
  for (const [i, m] of mentions.entries()) {
    if (!ctx.knownNumbers.some((k) => same(k, m.n))) {
      problems.push(`拠点${m.n}は今朝の家にない`);
      continue;
    }
    const h = houseOf(m.n);
    const scope = text.slice(m.end, mentions[i + 1]?.at ?? text.length);
    const need = scope.match(NEED);
    if (need) {
      if (!h) problems.push(`拠点${m.n}はもう終わっている`);
      else if (Number(need[1]) !== h.needMore) problems.push(`拠点${m.n}は「あと${need[1]}人」ではなく、あと${h.needMore}人`);
    }
    const dist = scope.match(/(\d+(?:\.\d+)?)\s*(km|キロ|m|ｍ|メートル)/);
    if (dist && h) {
      const said = /km|キロ/.test(dist[2]) ? Number(dist[1]) * 1000 : Number(dist[1]);
      if (!nearM(said, h.distanceM)) problems.push(`拠点${m.n}は ${dist[1]}${dist[2]} ではなく、約${h.distanceM}m`);
    }
  }

  // ---- ボタンと本文が同じ家か（ボタンが拠点6なのに本文が拠点7、を止める） ----
  if (ctx.proposal && mentions.length > 0 && !same(mentions[0].n, ctx.proposal.number)) {
    problems.push(`本文は拠点${mentions[0].n}、ボタンは拠点${ctx.proposal.number}`);
  }

  // ---- 番号より前に書いた「あと◯人」「◯m」は、ボタンの家の話とみる ----
  const head = text.slice(0, mentions[0]?.at ?? text.length);
  const headNeed = head.match(NEED);
  if (headNeed) {
    const ok = ctx.proposal ? Number(headNeed[1]) === ctx.proposal.needMore : ctx.houses.some((h) => h.needMore === Number(headNeed[1]));
    if (!ok) problems.push(`「あと${headNeed[1]}人」に合う家がない`);
  }
  const headDist = head.match(/(\d+(?:\.\d+)?)\s*(km|キロ|m|ｍ|メートル)/);
  if (headDist) {
    const said = /km|キロ/.test(headDist[2]) ? Number(headDist[1]) * 1000 : Number(headDist[1]);
    const ok = ctx.proposal ? nearM(said, ctx.proposal.distanceM) : ctx.houses.some((h) => nearM(said, h.distanceM));
    if (!ok) problems.push(`「${headDist[1]}${headDist[2]}」に合う家がない`);
  }

  // ---- 「いちばん近い」 ----
  const nearest = nearestHouse(ctx.houses);
  const superlative = "(?:いちばん|一番|最も|もっとも)近[いく]";
  const nearClaim = text.match(new RegExp(`${superlative}[^。！？!?]{0,14}?拠点\\s*(\\d+)`)) ?? text.match(new RegExp(`拠点\\s*(\\d+)[^。！？!?拠]{0,12}?${superlative}`));
  if (nearClaim && nearest && !same(nearClaim[1], nearest.number) && houseOf(nearClaim[1])?.distanceM !== nearest.distanceM) {
    problems.push(`いちばん近いのは拠点${nearClaim[1]}ではなく拠点${nearest.number}`);
  }

  // ---- ◯軒（前の言葉で、どの数のことかを見分ける） ----
  const t = ctx.town;
  for (const m of text.matchAll(/(\d+)\s*軒/g)) {
    const n = Number(m[1]);
    const at = m.index ?? 0;
    const before = text.slice(Math.max(0, at - 18), at).split(/[。！？!?、,]|\d+\s*軒/).at(-1) ?? "";
    if (/足りな|不足|助けを待|救え/.test(before)) {
      if (n !== t.short) problems.push(`人手が足りない家は ${n}軒ではなく ${t.short}軒`);
    } else if (/終わ|完了|済/.test(before)) {
      if (n !== t.done) problems.push(`終わった家は ${n}軒ではなく ${t.done}軒`);
    } else if (/のこり|残り|まだ/.test(before)) {
      if (n !== t.left && n !== t.short) problems.push(`のこりは ${n}軒ではなく ${t.left}軒`);
    } else if (![t.houses, t.done, t.left, t.short, ctx.houses.length].includes(n)) {
      problems.push(`${n}軒という数は、町のどの数とも合わない`);
    }
  }

  // ---- 向かっている人・積雪・気温 ----
  const out = text.match(/(\d+)\s*人が?(?:向か|出動|出て|活動|動い)/);
  if (out && Number(out[1]) !== t.peopleOut) problems.push(`動いている人は ${out[1]}人ではなく ${t.peopleOut}人`);
  const weather = new Set([t.snowCm, ...ctx.weatherNumbers].map((x) => Math.round(x)));
  for (const m of text.matchAll(/(-?\d+(?:\.\d+)?)\s*(cm|センチ|℃|度)/g)) {
    const n = Number(m[1]);
    // 「もう1度」などは気温ではない: 「度」は気温の話のときだけ見る
    if (m[2] === "度" && !/気温|最低|最高|マイナス|氷点下|-$/.test(text.slice(Math.max(0, (m.index ?? 0) - 10), (m.index ?? 0) + 1))) continue;
    if (!weather.has(Math.round(n)) && !weather.has(Math.round(Math.abs(n)))) problems.push(`${m[1]}${m[2]} は天気の事実にない`);
  }
  return [...new Set(problems)];
}

/** ボタンの家の事実（返事のカードに、プログラムが書く1行） */
export function houseLine(h: HouseFact): string {
  return `📍 拠点${h.number} ・ 約${h.distanceM}m ・ ${h.needMore > 0 ? `あと${h.needMore}人` : "人はそろっています"}`;
}

/** 点検で落ちたときの返事: 同じデータからプログラムが組む（数字はここで入れる。口調は隊長） */
export function safeText(ctx: VerifyContext): string {
  const t = ctx.town;
  if (t.houses === 0) return "今日はまだ、雪かきの呼びかけはありません。自分の家の雪かきや見回りなら、いつでもできるえな〜！";
  if (t.left === 0) return `今朝の家は ${t.houses}軒すべて終わりました。おつかれさまだしま〜！`;
  const town = `今朝の家は ${t.houses}軒、終わった家は ${t.done}軒、人手が足りない家は ${t.short}軒です。`;
  const h = ctx.proposal;
  if (h) return `${town}おすすめは拠点${h.number}。ここから約${h.distanceM}m、${h.needMore > 0 ? `あと${h.needMore}人` : "人はそろっています"}。10分でも助かるしま〜！`;
  return `${town}地図の赤い番号が、助けを待っている家だしま〜！`;
}
