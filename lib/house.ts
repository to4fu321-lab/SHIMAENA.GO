// 頼む家の住所と、雪かきが要る所（spec v1.72。11/17 本人「雪かきを依頼するが実際の場所を登録できる様になっていない。正確な住所と雪かきをする部分を登録できる様にして」）。
// 住所・目印は、その家に「行く」を押して向かっている人だけに見せる（地図は今までどおり 50m のマス、公開ページには出さない）。
// 住所から地図の位置を探すのは、国土地理院の住所検索（無料・鍵なし）。見つからなくても、地図でピンを合わせれば登録できる。
import type { ClearPart, LatLng } from "./types";

export const CLEAR_PARTS: { id: ClearPart; label: string; icon: string; task: string }[] = [
  { id: "roof", label: "屋根からの落雪の下", icon: "🏠", task: "屋根から落ちた雪の山" },
  { id: "window", label: "窓の前", icon: "🪟", task: "窓の前（明かりと出口）" },
  { id: "tank", label: "灯油タンク・メーター", icon: "🛢", task: "灯油タンク・メーターのまわり" },
  { id: "trash", label: "ゴミ置き場まで", icon: "🗑", task: "ゴミ置き場までの道" },
  { id: "back", label: "裏口・物置", icon: "🚪", task: "裏口・物置の前" },
];

export const ADDRESS_MAX = 100;
export const NOTE_MAX = 60;

/** 住所をきれいにする（前後の空白・改行・制御文字を取る。長すぎれば切る）。空なら undefined */
export function cleanAddress(v: unknown): string | undefined {
  return clean(v, ADDRESS_MAX);
}

export function cleanNote(v: unknown): string | undefined {
  return clean(v, NOTE_MAX);
}

function clean(v: unknown, max: number): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
  return s || undefined;
}

/** 知らない値を捨て、並びを一定に */
export function cleanParts(v: unknown): ClearPart[] {
  const xs = Array.isArray(v) ? v : typeof v === "string" ? v.split(",") : [];
  return CLEAR_PARTS.map((p) => p.id).filter((id) => xs.includes(id));
}

export const partLabel = (id: ClearPart) => CLEAR_PARTS.find((p) => p.id === id)?.label ?? id;

/** 札幌のまわり（北海道）か。住所検索の答えが遠くを指したら使わない */
function nearHokkaido([lat, lng]: LatLng): boolean {
  return lat > 41 && lat < 46 && lng > 139 && lng < 146;
}

export interface Geocoded {
  location: LatLng;
  /** 見つかった住所（「札幌市中央区北一条西二丁目」など） */
  title: string;
}

/** 住所から地図の位置（国土地理院の住所検索）。見つからない・届かないときは undefined。3秒まで */
export async function geocodeAddress(address: string, fetchFn: typeof fetch = fetch): Promise<Geocoded | undefined> {
  const q = cleanAddress(address);
  if (!q) return undefined;
  try {
    const url = new URL("https://msearch.gsi.go.jp/address-search/AddressSearch");
    url.searchParams.set("q", q);
    const res = await fetchFn(url, { signal: AbortSignal.timeout(3000), cache: "no-store" });
    if (!res.ok) return undefined;
    const json = (await res.json()) as { geometry?: { coordinates?: [number, number] }; properties?: { title?: string } }[];
    for (const r of Array.isArray(json) ? json : []) {
      const c = r.geometry?.coordinates;
      if (!c || !Number.isFinite(c[0]) || !Number.isFinite(c[1])) continue;
      const location: LatLng = [c[1], c[0]]; // 答えは [経度, 緯度]
      if (nearHokkaido(location)) return { location, title: r.properties?.title ?? q };
    }
    return undefined;
  } catch {
    return undefined;
  }
}
