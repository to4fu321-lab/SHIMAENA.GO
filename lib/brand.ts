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

export type IconName = "go" | "map" | "card" | "guide" | "settings" | "house";

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
};

/** LINE のメニューと Web で同じ名前・説明・色を使う */
export const MENU = {
  go: { label: "出動する", sub: "近くの雪かき・手伝いを探す", icon: "go", bg: COLORS.lamp, fg: COLORS.white, accent: COLORS.warm },
  map: { label: "町の地図", sub: "雪の状況・助けが必要な家", icon: "map", bg: COLORS.winter, fg: COLORS.white, accent: COLORS.lamp },
  card: { label: "活動カード", sub: "今日の活動をふりかえる", icon: "card", bg: COLORS.ink, fg: COLORS.white, accent: COLORS.camellia },
  guide: { label: "使い方", sub: "はじめての方へ", icon: "guide", bg: COLORS.warm, fg: COLORS.ink, accent: COLORS.ice },
  settings: { label: "設定", sub: "登録の確認・やり直し", icon: "settings", bg: COLORS.white, fg: COLORS.ink, accent: COLORS.ice },
} as const satisfies Record<string, { label: string; sub: string; icon: IconName; bg: string; fg: string; accent: string }>;

export type MenuKey = keyof typeof MENU;

/** 画像（resvg）用: currentColor と差し色を実際の色に置き換えたアイコン */
export function iconSvg(name: IconName, fg: string, accent: string): string {
  return ICONS[name].split(ACCENT_TOKEN).join(accent).split("currentColor").join(fg);
}
