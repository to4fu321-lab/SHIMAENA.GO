// LINE のリッチメニュー（spec 10）: 地図／カード帳／いまからやる／あそびかた／設定。
// 画像は SVG から作る（2500×843）。作るときは古い同名メニューを消してから。
import { svgToPng } from "../cards/png";
import { baseUrl, liffUrl } from "../url";

export { liffUrl };

export const RICH_MENU_NAME = "shimaena-main";
const W = 2500;
const H = 843;

export interface MenuItem {
  label: string;
  icon: string; // 絵文字ではなく簡単な図形の SVG
  action: { type: "uri"; uri: string } | { type: "message"; text: string };
}

export function menuItems(): MenuItem[] {
  return [
    { label: "地図", icon: `<rect x="-60" y="-50" width="120" height="100" rx="14" fill="#fff"/><path d="M-60 -10 L-20 -30 L20 -10 L60 -30 L60 50 L20 30 L-20 50 L-60 30 Z" fill="#cdbaff"/><circle cx="0" cy="0" r="18" fill="#ff4f8b"/>`, action: { type: "uri", uri: liffUrl("/map") } },
    { label: "カード帳", icon: `<rect x="-50" y="-60" width="90" height="120" rx="12" fill="#fff" transform="rotate(-8)"/><rect x="-40" y="-60" width="90" height="120" rx="12" fill="#ffb3d9" transform="rotate(6)"/><circle cx="5" cy="-5" r="22" fill="#fff"/>`, action: { type: "uri", uri: liffUrl("/cards") } },
    { label: "いまからやる", icon: `<circle cx="0" cy="0" r="56" fill="#fff"/><path d="M0 -40 V0 L28 16" stroke="#6b4fcf" stroke-width="10" stroke-linecap="round" fill="none"/>`, action: { type: "message", text: "いまからやる" } },
    { label: "あそびかた", icon: `<rect x="-50" y="-60" width="100" height="120" rx="12" fill="#fff"/><path d="M-28 -24 h56 M-28 0 h56 M-28 24 h32" stroke="#6b4fcf" stroke-width="10" stroke-linecap="round"/>`, action: { type: "uri", uri: `${baseUrl()}/rules` } },
    { label: "設定", icon: `<circle cx="0" cy="0" r="52" fill="#fff"/><circle cx="0" cy="0" r="18" fill="none" stroke="#6b4fcf" stroke-width="10"/><path d="M0 -52 v14 M0 38 v14 M-52 0 h14 M38 0 h14" stroke="#6b4fcf" stroke-width="10" stroke-linecap="round"/>`, action: { type: "message", text: "登録" } },
  ];
}

export function richMenuSvg(items = menuItems()): string {
  const cell = W / items.length;
  const cells = items
    .map(
      (it, i) => `
  <g transform="translate(${cell * i + cell / 2} ${H / 2 - 60})">
    <g transform="scale(1.6)">${it.icon}</g>
    <text x="0" y="200" font-family="Zen Maru Gothic, sans-serif" font-size="72" font-weight="700" fill="#3b2a78" text-anchor="middle">${it.label}</text>
  </g>
  ${i > 0 ? `<line x1="${cell * i}" y1="80" x2="${cell * i}" y2="${H - 80}" stroke="#fff" stroke-width="4" opacity="0.7"/>` : ""}`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe3f1"/><stop offset="1" stop-color="#dff6f3"/></linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>${cells}
</svg>`;
}

/** LINE API に渡す形 */
export function richMenuObject(items = menuItems()) {
  const cell = Math.floor(W / items.length);
  return {
    size: { width: W, height: H },
    selected: true,
    name: RICH_MENU_NAME,
    chatBarText: "メニュー",
    areas: items.map((it, i) => ({
      bounds: { x: cell * i, y: 0, width: cell, height: H },
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
