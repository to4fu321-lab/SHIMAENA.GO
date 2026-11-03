// LINE のリッチメニュー（spec v1.4）: 出動する／町の地図／活動カード／使い方 の4つ。設定は Web の画面（/settings）へ移した。
// 画像は SVG から作る（大きいサイズ 2500×1686）。左半分が「出動する」（いちばん目立つ灯りオレンジ）、右に3つを縦に並べる。
// 色・アイコン・名前は Web と同じもの（lib/brand.ts）。作るときは古い同名メニューを消してから。
import { COLORS, MENU, type MenuKey, iconSvg } from "../brand";
import { svgToPng } from "../cards/png";
import { liffUrl } from "../url";

export { liffUrl };

export const RICH_MENU_NAME = "shimaena-main";
const W = 2500;
const H = 1686;
const GAP = 30; // 4つの領域をはっきり分ける雪の余白
const FONT = "Zen Maru Gothic, sans-serif";

export interface MenuItem {
  key: MenuKey;
  label: string;
  sub: string;
  action: { type: "uri"; uri: string } | { type: "message"; text: string };
  /** タップ領域（LINE の仕様どおり、画像の座標で隙間なく敷きつめる） */
  bounds: { x: number; y: number; width: number; height: number };
}

export function menuItems(): MenuItem[] {
  const half = W / 2;
  const row = H / 3;
  const item = (key: MenuKey, action: MenuItem["action"], bounds: MenuItem["bounds"]): MenuItem => ({
    key,
    label: MENU[key].label,
    sub: MENU[key].sub,
    action,
    bounds,
  });
  return [
    // 「出動する」は文字を送る → Bot が「何分動けますか？」と聞き、近くの手伝いを探す
    item("go", { type: "message", text: MENU.go.label }, { x: 0, y: 0, width: half, height: H }),
    item("map", { type: "uri", uri: liffUrl("/map") }, { x: half, y: 0, width: half, height: row }),
    item("card", { type: "uri", uri: liffUrl("/cards") }, { x: half, y: row, width: half, height: row }),
    item("guide", { type: "uri", uri: liffUrl("/rules") }, { x: half, y: row * 2, width: half, height: H - row * 2 }),
  ];
}

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** 雪の粒（背景の飾り。位置は固定） */
function snowDots(): string {
  const dots = [
    [60, 70, 9], [400, 22, 6], [880, 40, 8], [1240, 120, 7], [1600, 18, 6], [2050, 50, 9], [2440, 110, 7],
    [20, 900, 7], [1246, 820, 8], [2480, 900, 6], [300, 1668, 7], [1100, 1660, 6], [1900, 1668, 8],
  ];
  return dots.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#ffffff"/>`).join("");
}

/** 左の大きな「出動する」 */
function bigTile(it: MenuItem): string {
  const m = MENU[it.key];
  const x = it.bounds.x + GAP;
  const y = it.bounds.y + GAP;
  const w = it.bounds.width - GAP * 1.5;
  const h = it.bounds.height - GAP * 2;
  const cx = x + w / 2;
  return `
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="64" fill="${m.bg}"/>
  <circle cx="${cx}" cy="${y + 520}" r="320" fill="#ffffff"/>
  <g transform="translate(${cx - 220} ${y + 300}) scale(4.4)">${iconSvg(m.icon, COLORS.ink, m.bg)}</g>
  <rect x="${x + 70}" y="${y + 950}" width="${w - 140}" height="${h - 1020}" rx="48" fill="#ffffff"/>
  <text x="${cx}" y="${y + 1190}" font-family="${FONT}" font-size="210" font-weight="700" fill="${COLORS.ink}" text-anchor="middle">${esc(it.label)}</text>
  <text x="${cx}" y="${y + 1370}" font-family="${FONT}" font-size="74" font-weight="700" fill="${COLORS.ink}" text-anchor="middle">${esc(it.sub)}</text>
  <text x="${cx}" y="${y + 1480}" font-family="${FONT}" font-size="60" font-weight="400" fill="${COLORS.ink}" text-anchor="middle">5分だけでも大歓迎</text>`;
}

/** 右の小さな3つ（アイコン＋名前＋説明） */
function smallTile(it: MenuItem): string {
  const m = MENU[it.key];
  const x = it.bounds.x + GAP / 2;
  const y = it.bounds.y + (it.bounds.y === 0 ? GAP : GAP / 2);
  const w = it.bounds.width - GAP * 1.5;
  const h = it.bounds.height - GAP * 1.5;
  const cy = y + h / 2;
  const light = m.bg === COLORS.warm;
  return `
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="56" fill="${m.bg}"${light ? ` stroke="${COLORS.ink}" stroke-opacity="0.25" stroke-width="4"` : ""}/>
  <circle cx="${x + 230}" cy="${cy}" r="170" fill="#ffffff"/>
  <g transform="translate(${x + 230 - 120} ${cy - 120}) scale(2.4)">${iconSvg(m.icon, COLORS.ink, m.accent)}</g>
  <text x="${x + 460}" y="${cy + 10}" font-family="${FONT}" font-size="132" font-weight="700" fill="${m.fg}">${esc(it.label)}</text>
  <text x="${x + 462}" y="${cy + 120}" font-family="${FONT}" font-size="58" font-weight="700" fill="${m.fg}">${esc(it.sub)}</text>`;
}

export function richMenuSvg(items = menuItems()): string {
  const [go, ...rest] = items;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="${COLORS.snowBlue}"/>
  ${snowDots()}
  ${bigTile(go)}
  ${rest.map(smallTile).join("")}
</svg>`;
}

/** LINE API に渡す形 */
export function richMenuObject(items = menuItems()) {
  return {
    size: { width: W, height: H },
    selected: true,
    name: RICH_MENU_NAME,
    chatBarText: "メニュー（出動・地図）",
    areas: items.map((it) => ({
      bounds: it.bounds,
      action: it.action.type === "uri" ? { type: "uri", label: it.label, uri: it.action.uri } : { type: "message", label: it.label, text: it.action.text },
    })),
  };
}

async function lineApi(method: string, url: string, token: string, body?: BodyInit, contentType = "application/json"): Promise<Response> {
  const res = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": contentType }, body });
  if (!res.ok) throw new Error(`${method} ${url} が ${res.status}: ${await res.text()}`);
  return res;
}

/** リッチメニューを作って全員の既定にする。トークンがなければ画像だけ作って何もしない */
export async function setupRichMenu(): Promise<{ richMenuId: string | null; imageBytes: number }> {
  const items = menuItems();
  const png = await svgToPng(richMenuSvg(items), { width: W });
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    console.log(`[line] (送信せず) リッチメニューを作成（画像 ${png.byteLength} バイト）`);
    return { richMenuId: null, imageBytes: png.byteLength };
  }
  // 古い同名メニューを消す
  const list = (await (await lineApi("GET", "https://api.line.me/v2/bot/richmenu/list", token)).json()) as { richmenus?: { richMenuId: string; name: string }[] };
  for (const m of list.richmenus ?? []) {
    if (m.name === RICH_MENU_NAME) await lineApi("DELETE", `https://api.line.me/v2/bot/richmenu/${m.richMenuId}`, token);
  }
  const created = (await (await lineApi("POST", "https://api.line.me/v2/bot/richmenu", token, JSON.stringify(richMenuObject(items)))).json()) as { richMenuId: string };
  await lineApi("POST", `https://api-data.line.me/v2/bot/richmenu/${created.richMenuId}/content`, token, Buffer.from(png), "image/png");
  await lineApi("POST", `https://api.line.me/v2/bot/user/all/richmenu/${created.richMenuId}`, token);
  return { richMenuId: created.richMenuId, imageBytes: png.byteLength };
}
