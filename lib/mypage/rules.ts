// マイページ（spec v1.32: アイコン・プロフィール・好きなこと・興味あること、なかま帳の「また一緒に」）の規則。
// 保存や AI に関係ない純粋な関数だけ。大事なこと: ゆるく。書かなくてもよい・いつでも変えられる・見えるのは一緒に活動した仲間だけ。
// 名前・住所・電話・体のことはプロフィールに入れない（文の点検は聞き書きの scrub と同じ）。
import { scrub } from "../kikigaki/core";

// ---- アイコン（画像ファイルなし。絵文字＋うすい背景色。「🐦」はシマエナガの絵） ----

export const ICONS = [
  { id: "bird", emoji: "🐦", label: "シマエナガ" },
  { id: "snow", emoji: "❄️", label: "雪" },
  { id: "snowman", emoji: "⛄", label: "雪だるま" },
  { id: "mitten", emoji: "🧤", label: "手ぶくろ" },
  { id: "scarf", emoji: "🧣", label: "マフラー" },
  { id: "tea", emoji: "🍵", label: "お茶" },
  { id: "coffee", emoji: "☕", label: "コーヒー" },
  { id: "rice", emoji: "🍙", label: "おにぎり" },
  { id: "bread", emoji: "🍞", label: "パン" },
  { id: "dog", emoji: "🐕", label: "犬" },
  { id: "cat", emoji: "🐈", label: "ねこ" },
  { id: "flower", emoji: "🌷", label: "花" },
  { id: "tree", emoji: "🌲", label: "木" },
  { id: "book", emoji: "📚", label: "本" },
  { id: "music", emoji: "🎵", label: "音楽" },
  { id: "camera", emoji: "📷", label: "写真" },
  { id: "ski", emoji: "🎿", label: "スキー" },
  { id: "ball", emoji: "⚾", label: "野球" },
  { id: "soccer", emoji: "⚽", label: "サッカー" },
  { id: "walk", emoji: "🚶", label: "散歩" },
  { id: "bike", emoji: "🚲", label: "自転車" },
  { id: "car", emoji: "🚗", label: "車" },
  { id: "fish", emoji: "🎣", label: "釣り" },
  { id: "onsen", emoji: "♨️", label: "温泉" },
  { id: "yarn", emoji: "🧶", label: "編み物" },
  { id: "game", emoji: "🎮", label: "ゲーム" },
  { id: "shogi", emoji: "♟️", label: "将棋" },
  { id: "pan", emoji: "🍳", label: "料理" },
  { id: "star", emoji: "⭐", label: "星" },
  { id: "sun", emoji: "🌞", label: "おひさま" },
] as const;
export type IconId = (typeof ICONS)[number]["id"];
export const DEFAULT_ICON: IconId = "bird";

/** アイコンの背景色（うすい色。赤・緑は地図の状態色なので使わない） */
export const ICON_BGS = [
  { id: "ice", color: "#e3eef3", label: "氷" },
  { id: "camellia", color: "#f3e9ee", label: "雪椿" },
  { id: "warm", color: "#f5eee5", label: "生成り" },
  { id: "sky", color: "#e4edfc", label: "空" },
  { id: "peach", color: "#ffebdd", label: "もも" },
  { id: "lavender", color: "#f0e7fb", label: "ラベンダー" },
  { id: "lemon", color: "#fbf3d5", label: "レモン" },
  { id: "snow", color: "#ffffff", label: "雪" },
] as const;
export type IconBgId = (typeof ICON_BGS)[number]["id"];
export const DEFAULT_BG: IconBgId = "ice";

export function isIconId(v: unknown): v is IconId {
  return ICONS.some((i) => i.id === v);
}
export function isIconBgId(v: unknown): v is IconBgId {
  return ICON_BGS.some((i) => i.id === v);
}
/** アイコンの写真（11/7 本人の指示「自分の画像を基本で選べるように」）。画面で 160px 四方の JPEG に縮めた data URL だけ受け付ける */
export const PHOTO_MAX_CHARS = 60_000;
export function cleanPhoto(v: unknown): string | undefined {
  if (typeof v !== "string" || v.length > PHOTO_MAX_CHARS) return undefined;
  return /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v) ? v : undefined;
}

/**
 * まだ選んでいない人のアイコン（11/7 本人の指示「デフォルトアイコンはランダムに」）。
 * 参加者 ID から決めるので、毎回同じ・人ごとにばらばら（開くたびに変わらない）
 */
export function defaultLook(participantId: string): { icon: IconId; iconBg: IconBgId } {
  let h = 2166136261;
  for (let i = 0; i < participantId.length; i++) h = Math.imul(h ^ participantId.charCodeAt(i), 16777619);
  const n = h >>> 0;
  return { icon: ICONS[n % ICONS.length].id, iconBg: ICON_BGS[Math.floor(n / ICONS.length) % (ICON_BGS.length - 1)].id };
}

export const iconEmoji = (id: IconId | undefined) => (ICONS.find((i) => i.id === id) ?? ICONS[0]).emoji;
export const iconBgColor = (id: IconBgId | undefined) => (ICON_BGS.find((i) => i.id === id) ?? ICON_BGS[0]).color;

// ---- プロフィール ----

export const INTRO_MAX = 40;
export const TAG_MAX = 10;
export const TAGS_MAX = 5;
export const TALK_MAX = 30;

export interface MyProfile {
  participantId: string;
  icon: IconId;
  iconBg: IconBgId;
  /** 自分の写真（data URL）。あれば絵文字より先に出す */
  photo?: string;
  /** ひとこと（40字） */
  intro: string;
  /** 好きなこと（10字×5つまで） */
  likes: string[];
  /** 興味あること（10字×5つまで） */
  interests: string[];
  /** 話しかけてほしいこと（30字） */
  talk: string;
  updatedAt: string; // ISO
}

/** 書かれているものがあるか（空のプロフィールは「まだ」と出す） */
export function hasContent(p: Pick<MyProfile, "intro" | "likes" | "interests" | "talk"> | undefined): boolean {
  return Boolean(p && (p.intro || p.likes.length > 0 || p.interests.length > 0 || p.talk));
}

/** ひとことの点検: 名前・住所・電話・体の話を落とし、長さをそろえる */
export function cleanIntro(s: string, max = INTRO_MAX): string {
  return scrub(s ?? "", max).replace(/[。]+$/, "");
}

/**
 * 好きなこと・興味の札。「、」「・」「,」「/」「と」で分けて、短くし、名前や住所の言い方・体の話は落とす。重複は1つに
 */
export function cleanTags(xs: unknown, max = TAGS_MAX): string[] {
  const raw = Array.isArray(xs) ? xs.map((x) => String(x ?? "")) : typeof xs === "string" ? [xs] : [];
  const out: string[] = [];
  for (const chunk of raw) {
    for (const part of chunk.split(/[、,，・／/\n]|(?:\s+と\s+)|\s{2,}/)) {
      const t = scrub(part, 40)
        .replace(/[。！？!?]+$/, "")
        .replace(/^(好き|すき)な?(こと|もの)は?/, "")
        .replace(/(が|は)?(好き|すき|大好き)(です)?$/, "")
        .replace(/(です|ます|かな|ね)$/, "")
        .replace(/(と|や|とか|など)$/, "")
        .trim();
      if (!t || t.length > TAG_MAX || /[0-9０-９]{3,}|http|@|＠|丁目|番地|号室|番$|号$|さん$|様$|ちゃん$|くん$/.test(t)) continue;
      if (!out.includes(t)) out.push(t);
      if (out.length >= max) return out;
    }
  }
  return out;
}

// ---- 隊長のインタビュー（5問・どれもとばせる） ----

export interface ProfileTurn {
  q: string;
  a: string;
}

export const PROFILE_MAX_TURNS = 5;
export const PROFILE_MIN_ANSWERS = 1;
export const PROFILE_ANSWER_MAX = 200;

export const PROFILE_OPENING = "こんにちは、シマエナ隊長です。仲間に見せる、あなたの紹介を一緒に作りましょう。思いついたことを、ひとことで大丈夫です。";

/** 質問は決まった5つ（AI は整えるだけ）。順に: 好きなこと／興味／冬の好き／話したいこと／ひとこと */
export const PROFILE_QUESTIONS: { key: "likes" | "interests" | "winter" | "talk" | "intro"; q: string; hint: string }[] = [
  { key: "likes", q: "ふだん、どんなことをしているときが楽しいですか？", hint: "例: 散歩、料理、ラジオ、庭いじり" },
  { key: "interests", q: "最近、気になっていること・やってみたいことはありますか？", hint: "例: スマホの使い方、パン作り、山歩き" },
  { key: "winter", q: "雪や冬で、好きなところはひとつありますか？", hint: "例: 雪あかりの夜、朝のきゅっと鳴る雪" },
  { key: "talk", q: "雪かきのあと、ご近所の人とどんな話ができたらうれしいですか？", hint: "例: 犬の話、昔の町の話、なんでも" },
  { key: "intro", q: "最後に、仲間へひとこと自己紹介をお願いします。", hint: "例: 朝はゆっくり派。よろしくお願いします" },
];

/** 答えを形にする（キーがないとき・AI の答えが点検に通らないとき） */
export function templateProfile(turns: ProfileTurn[]): Pick<MyProfile, "intro" | "likes" | "interests" | "talk"> & { icon: IconId } {
  const by = (key: (typeof PROFILE_QUESTIONS)[number]["key"]) => {
    const q = PROFILE_QUESTIONS.find((x) => x.key === key)?.q;
    return turns.find((t) => t.q === q)?.a?.trim() ?? "";
  };
  const likes = cleanTags([by("likes"), by("winter")]);
  const interests = cleanTags(by("interests"));
  const talk = cleanIntro(by("talk"), TALK_MAX);
  let intro = cleanIntro(by("intro"));
  if (!intro) {
    const first = likes[0] ? `${likes[0]}が好きです。` : "";
    const second = interests[0] ? `${interests[0]}に興味があります。` : "";
    intro = cleanIntro(`${first}${second}よろしくお願いします。`);
  }
  return { intro, likes, interests, talk, icon: suggestIcon([...likes, ...interests, intro]) };
}

const ICON_WORDS: [RegExp, IconId][] = [
  [/犬|いぬ|わんこ/, "dog"],
  [/猫|ねこ|ネコ/, "cat"],
  [/料理|ごはん|ご飯|食べ|おかず|煮/, "pan"],
  [/パン/, "bread"],
  [/おにぎり|お米|こめ/, "rice"],
  [/コーヒー|珈琲|喫茶/, "coffee"],
  [/お茶|茶|和菓子/, "tea"],
  [/花|園芸|庭|畑|ガーデン/, "flower"],
  [/本|読書|図書/, "book"],
  [/音楽|歌|カラオケ|ピアノ|ギター|ラジオ/, "music"],
  [/写真|カメラ/, "camera"],
  [/スキー|スノボ|スケート/, "ski"],
  [/野球/, "ball"],
  [/サッカー/, "soccer"],
  [/散歩|歩|ウォーキング|山/, "walk"],
  [/自転車/, "bike"],
  [/車|ドライブ/, "car"],
  [/釣り|魚/, "fish"],
  [/温泉|風呂/, "onsen"],
  [/編み|手芸|裁縫/, "yarn"],
  [/ゲーム/, "game"],
  [/将棋|囲碁|麻雀/, "shogi"],
  [/星|空|天体/, "star"],
  [/雪だるま|かまくら/, "snowman"],
  [/雪|冬/, "snow"],
  [/朝|日なた|ひなた/, "sun"],
];

/** ことばからアイコンをすすめる（見つからなければシマエナガ） */
export function suggestIcon(words: string[]): IconId {
  const text = words.join(" ");
  for (const [re, id] of ICON_WORDS) if (re.test(text)) return id;
  return DEFAULT_ICON;
}

/** 画面から来たやりとりを、使ってよい形に（質問は決まった5つのどれか。答えは 200 字まで） */
export function normalizeProfileTurns(raw: unknown): ProfileTurn[] {
  if (!Array.isArray(raw)) return [];
  const qs = new Set(PROFILE_QUESTIONS.map((x) => x.q));
  const out: ProfileTurn[] = [];
  for (const t of raw.slice(0, PROFILE_MAX_TURNS)) {
    const q = String((t as { q?: unknown })?.q ?? "");
    if (!qs.has(q)) continue;
    const a = String((t as { a?: unknown })?.a ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, PROFILE_ANSWER_MAX);
    out.push({ q, a });
  }
  return out;
}

export const answeredCount = (turns: ProfileTurn[]) => turns.filter((t) => t.a.trim()).length;

// ---- なかま帳 ----

/** 「また一緒に」の手ふりが生きている日数（これを過ぎたら、ふり直せる） */
export const WAVE_DAYS = 30;

export interface Wave {
  fromId: string;
  toId: string;
  at: string; // ISO
}

/** 2人のあいだの手ふりの状態 */
export function waveState(meId: string, otherId: string, waves: Wave[], now: Date): { mine: boolean; theirs: boolean; mutual: boolean } {
  const fresh = (w: Wave) => now.getTime() - Date.parse(w.at) <= WAVE_DAYS * 86400_000;
  const mine = waves.some((w) => w.fromId === meId && w.toId === otherId && fresh(w));
  const theirs = waves.some((w) => w.fromId === otherId && w.toId === meId && fresh(w));
  return { mine, theirs, mutual: mine && theirs };
}

/** 日付を「11/5」の形に（JST） */
export function shortDate(iso: string): string {
  const d = new Date(Date.parse(iso) + 9 * 3600_000);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}
