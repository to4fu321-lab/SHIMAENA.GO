// LINE（リッチメニュー・Bot）と Web で同じ色・アイコン・名前を使うための定義。
// 色は app/globals.css の CSS 変数と同じ値。アイコンは 100×100 の SVG（線は currentColor、塗りは ACCENT_TOKEN）。

export const COLORS = {
  snow: "#F4F7FA", // 雪明かり（背景）
  snowBlue: "#E3EEF3", // 淡い雪青
  ink: "#29445C", // 冬の深い青（文字・見出し）
  winter: "#3B6584", // 冬の青（町の地図）
  lamp: "#D9825B", // 灯りオレンジ（出動）
  ice: "#8FB8C9", // 氷の青（進捗）
  camellia: "#C8A7B8", // 雪椿ピンク（達成）
  warm: "#F5EEE5", // 生成り（使い方）
  white: "#FFFFFF",
} as const;

/** アイコンの中の「差し色」。描く側で好きな色に置き換える */
export const ACCENT_TOKEN = "var(--icon-accent, currentColor)";

export type IconName = "go" | "map" | "card" | "guide" | "settings" | "house" | "town" | "ask" | "chat" | "connect" | "letter" | "bug" | "idea" | "question";

/** 線の書式。w は線の太さ、fill は塗り（なしなら none） */
const st = (w = 7, fill = "none") => `fill="${fill}" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
const A = ACCENT_TOKEN;

/** 線のアイコン（中身だけ。<svg viewBox="0 0 100 100"> で包む） */
export const ICONS: Record<IconName, string> = {
  // 出動: スコップ
  go: `<path d="M26 14 H46" ${st()}/><path d="M36 14 L56 58" ${st()}/><path d="M44 60 L72 48 L84 76 L56 88 Z" ${st(7, A)}/><circle cx="20" cy="70" r="4" fill="currentColor"/><circle cx="30" cy="84" r="3" fill="currentColor"/>`,
  // 町の地図: 折りたたんだ地図とピン
  map: `<path d="M12 26 L36 16 L64 26 L88 16 V74 L64 84 L36 74 L12 84 Z" ${st()}/><path d="M36 16 V74 M64 26 V84" ${st(5)}/><path d="M50 30 c-9 0 -14 7 -14 13 c0 10 14 22 14 22 s14 -12 14 -22 c0 -6 -5 -13 -14 -13 Z" ${st(6, A)}/><circle cx="50" cy="43" r="4" fill="currentColor"/>`,
  // 活動カード: カードと星
  card: `<rect x="22" y="12" width="56" height="76" rx="9" ${st()}/><path d="M50 30 L55.9 42 L69 43.9 L59.5 53.1 L61.8 66.2 L50 60 L38.2 66.2 L40.5 53.1 L31 43.9 L44.1 42 Z" ${st(5, A)}/>`,
  // 使い方: 本
  guide: `<path d="M50 24 C40 16 24 16 14 20 V80 C24 76 40 76 50 84 C60 76 76 76 86 80 V20 C76 16 60 16 50 24 Z" ${st(7, A)}/><path d="M50 24 V84" ${st(5)}/><path d="M24 36 H40 M24 50 H40 M60 36 H76" ${st(5)}/>`,
  // 設定: 歯車
  settings: `<circle cx="50" cy="50" r="14" ${st(7, A)}/><path d="M50 12 V24 M50 76 V88 M12 50 H24 M76 50 H88 M23 23 L32 32 M68 68 L77 77 M77 23 L68 32 M32 68 L23 77" ${st()}/>`,
  // 家と灯り
  house: `<path d="M14 48 L50 16 L86 48 V86 H14 Z" ${st()}/><rect x="38" y="52" width="24" height="20" rx="3" ${st(5, A)}/>`,
  // きょうの町: ならんだ2軒の家と雪
  town: `<path d="M10 56 L32 36 L54 56 V86 H10 Z" ${st(6)}/><path d="M46 46 L68 26 L90 46 V86 H54" ${st(6)}/><rect x="25" y="64" width="14" height="14" rx="2" ${st(5, A)}/><rect x="64" y="54" width="12" height="12" rx="2" ${st(5, A)}/><circle cx="22" cy="18" r="4" fill="currentColor"/><circle cx="40" cy="10" r="3" fill="currentColor"/><circle cx="86" cy="12" r="3" fill="currentColor"/>`,
  // 雪かきを頼む: 家と、上がった手（ハート）
  ask: `<path d="M12 50 L42 24 L72 50 V86 H12 Z" ${st(6)}/><rect x="34" y="60" width="16" height="26" rx="2" ${st(5)}/><path d="M78 40 c-6 -8 -18 -4 -14 6 l14 14 l14 -14 c4 -10 -8 -14 -14 -6 Z" ${st(5, A)}/>`,
  // 隊長に相談: ふきだし
  // つなぐ: 向かい合う2羽（シマエナガ）と、間のハート（広める・誘う・バトン・なかま）
  connect: `<circle cx="28" cy="46" r="16" ${st(6)}/><path d="M12 86 c0 -16 8 -24 16 -24 s16 8 16 24" ${st(6)}/><circle cx="72" cy="46" r="16" ${st(6)}/><path d="M56 86 c0 -16 8 -24 16 -24 s16 8 16 24" ${st(6)}/><path d="M50 36 c-5 -7 -16 -3 -12 6 l12 12 l12 -12 c4 -9 -7 -13 -12 -6 Z" ${st(5, A)}/><circle cx="24" cy="44" r="2.5" fill="currentColor"/><circle cx="76" cy="44" r="2.5" fill="currentColor"/>`,
  chat: `<path d="M16 22 H84 a6 6 0 0 1 6 6 V62 a6 6 0 0 1 -6 6 H46 L28 84 V68 H16 a6 6 0 0 1 -6 -6 V28 a6 6 0 0 1 6 -6 Z" ${st(7, A)}/><circle cx="32" cy="45" r="5" fill="currentColor"/><circle cx="50" cy="45" r="5" fill="currentColor"/><circle cx="68" cy="45" r="5" fill="currentColor"/>`,
  // 要望・バグ報告: 封筒
  letter: `<rect x="12" y="24" width="76" height="54" rx="8" ${st()}/><path d="M14 28 L50 56 L86 28" ${st(7)}/><circle cx="78" cy="26" r="11" ${st(5, A)}/>`,
  // バグ報告: 注意の三角
  bug: `<path d="M50 12 L90 82 a4 4 0 0 1 -4 6 H14 a4 4 0 0 1 -4 -6 Z" ${st(7, A)}/><path d="M50 38 V60" ${st(8)}/><circle cx="50" cy="73" r="5" fill="currentColor"/>`,
  // 要望: 電球
  idea: `<path d="M50 12 c-17 0 -28 12 -28 27 c0 11 7 17 11 24 c2 3 3 6 3 9 H64 c0 -3 1 -6 3 -9 c4 -7 11 -13 11 -24 c0 -15 -11 -27 -28 -27 Z" ${st(7, A)}/><path d="M38 82 H62 M42 92 H58" ${st(7)}/>`,
  // 分からない: 吹き出しのはてな
  question: `<circle cx="50" cy="50" r="38" ${st(7, A)}/><path d="M38 38 c0 -8 6 -13 12 -13 s12 5 12 12 c0 9 -12 10 -12 20" ${st(7)}/><circle cx="50" cy="72" r="5" fill="currentColor"/>`,
};

/** LINE のメニューと Web で同じ名前・説明・色を使う */
export const MENU = {
  // v1.10 のリッチメニュー: きょうの町（ホーム）／雪かきを頼む／町の地図／隊長に相談
  town: { label: "きょうの町", sub: "のぞくだけでもOK", icon: "town", bg: COLORS.lamp, fg: COLORS.white, accent: COLORS.warm },
  ask: { label: "雪かきを頼む", sub: "6〜19時いつでも", icon: "ask", bg: COLORS.ink, fg: COLORS.white, accent: COLORS.camellia },
  consult: { label: "隊長に相談", sub: "なんでも聞いてね", icon: "chat", bg: COLORS.warm, fg: COLORS.ink, accent: COLORS.ice },
  go: { label: "雪かきGO！", sub: "近くの雪かき・手伝いを探す", icon: "go", bg: COLORS.lamp, fg: COLORS.white, accent: COLORS.warm },
  map: { label: "町の地図", sub: "雪の状況・助けが必要な家", icon: "map", bg: COLORS.winter, fg: COLORS.white, accent: COLORS.lamp },
  card: { label: "活動カード", sub: "今日の活動をふりかえる", icon: "card", bg: COLORS.ink, fg: COLORS.white, accent: COLORS.camellia },
  guide: { label: "使い方", sub: "はじめての方へ", icon: "guide", bg: COLORS.warm, fg: COLORS.ink, accent: COLORS.ice },
  settings: { label: "設定", sub: "登録の確認・やり直し", icon: "settings", bg: COLORS.white, fg: COLORS.ink, accent: COLORS.ice },
  connect: { label: "つなぐ", sub: "広める・誘う・バトン・なかま", icon: "connect", bg: COLORS.camellia, fg: COLORS.ink, accent: COLORS.lamp },
} as const satisfies Record<string, { label: string; sub: string; icon: IconName; bg: string; fg: string; accent: string }>;

export type MenuKey = keyof typeof MENU;

/** 画像（resvg）用: currentColor と差し色を実際の色に置き換えたアイコン */
export function iconSvg(name: IconName, fg: string, accent: string): string {
  return ICONS[name].split(ACCENT_TOKEN).join(accent).split("currentColor").join(fg);
}
