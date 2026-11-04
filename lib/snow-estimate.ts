// 雪の深さ・雪質・どけた雪（kg）の推定（spec v1.8）。決めるのは普通のプログラム（Claude は写真から見えたものを返すだけ）。
// 深さは3つの出どころを突き合わせる:
//   photo    … 完了写真に写った「除けたあとの雪の断面」を、Claude が目印（段差・長靴・スコップの刃）と比べて読んだ範囲
//   forecast … Open-Meteo の予報の降雪量（その朝に積もった新しい雪）
//   model    … Open-Meteo の積雪深（モデルの解析値。地面にある雪ぜんぶ）
// 写真の推定は「自信が低い」「予報・積雪深と大きく食い違う」ときは使わない。どれを使ったかを必ず表示する。
// 「計測」ではなく「推定」と書く（AI の読み取りと予報の組み合わせのため）。
import { snowComparison } from "./snowkg";
import type { ClearArea, SnowType } from "./types";

export type DepthSource = "photo" | "forecast" | "model";
export type DepthConfidence = "low" | "mid" | "high";

export interface PhotoDepth {
  min: number;
  max: number;
  confidence: DepthConfidence;
  /** 何を目印にしたか（15字まで） */
  ref?: string;
}

export interface DepthEstimate {
  /** 計算に使う深さ（cm） */
  cm: number;
  source: DepthSource;
  /** 画面とカードに出す言い方（例: 写真から約20〜30cm） */
  label: string;
}

/** 面積の目安（m²）: 玄関前 12 / 車庫前 30 / 道路まで 50 */
export const AREA_M2: Record<ClearArea, number> = { entrance: 12, garage: 30, road: 50 };
export const AREA_LABEL: Record<ClearArea, string> = { entrance: "玄関前", garage: "車庫前", road: "道路まで" };

/** 雪の密度の目安（kg/m³） */
export const SNOW_DENSITY: Record<SnowType, number> = { powder: 100, unknown: 150, wet: 300, icy: 400 };
export const SNOW_LABEL: Record<SnowType, string> = { powder: "軽い粉雪", wet: "重い湿り雪", icy: "凍った雪", unknown: "ふつうの雪" };

const PHOTO_MAX_CM = 150;

/** 写真から読んだ深さを、使ってよいか確かめる（範囲がおかしい・自信が低いものは捨てる） */
export function cleanPhotoDepth(d: Partial<PhotoDepth> | undefined): PhotoDepth | undefined {
  if (!d) return undefined;
  const min = Math.round(Number(d.min));
  const max = Math.round(Number(d.max));
  if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max < min || max > PHOTO_MAX_CM) return undefined;
  if (max - min > 40) return undefined; // 幅が広すぎる＝読めていない
  const confidence: DepthConfidence = d.confidence === "high" || d.confidence === "mid" ? d.confidence : "low";
  return { min, max, confidence, ...(d.ref ? { ref: d.ref } : {}) };
}

/**
 * 計算に使う深さを決める。
 * 1. 写真: 自信が中以上で、予報・積雪深のどちらかと桁が合う（真ん中の値が、目安の 0.4 倍〜2.5 倍＋10cm）ならこれ
 * 2. 予報の降雪量（その朝の新しい雪）
 * 3. 積雪深（予報がないとき）
 */
export function estimateDepth(i: { forecastCm: number; modelDepthCm?: number; photo?: PhotoDepth }): DepthEstimate {
  const refs = [i.forecastCm, i.modelDepthCm ?? 0].filter((x) => x > 0);
  const p = i.photo;
  if (p && p.confidence !== "low") {
    const mid = (p.min + p.max) / 2;
    const agrees = refs.length === 0 || refs.some((r) => mid >= r * 0.4 && mid <= r * 2.5 + 10);
    if (agrees) {
      const range = p.min === p.max ? `約${p.min}cm` : `約${p.min}〜${p.max}cm`;
      return { cm: Math.round(mid), source: "photo", label: `写真から${range}${p.ref ? `（${p.ref}と比べて）` : ""}` };
    }
  }
  if (i.forecastCm > 0) return { cm: i.forecastCm, source: "forecast", label: `予報の降雪 ${i.forecastCm}cm` };
  if ((i.modelDepthCm ?? 0) > 0) return { cm: i.modelDepthCm!, source: "model", label: `積雪の解析値 ${i.modelDepthCm}cm` };
  return { cm: 5, source: "forecast", label: "雪の量が分からないので 5cm として" };
}

/**
 * 雪質と気温が食い違うときは「ふつうの雪」に戻す（写真の見た目だけで決めつけない）。
 * 湿り雪は 0℃ 前後で降る。最低気温 −6℃ 以下で「湿り雪」、+2℃ 以上で「粉雪」は、写真の読み違いとみなす。
 */
export function consistentSnowType(type: SnowType | undefined, tempMinC?: number): SnowType {
  const t = type ?? "unknown";
  if (tempMinC === undefined) return t;
  if (t === "wet" && tempMinC <= -6) return "unknown";
  if (t === "powder" && tempMinC >= 2) return "unknown";
  return t;
}

/** どけた雪（kg）= 面積 × 深さ × 雪質の密度。10kg 単位、最低 10kg */
export function snowKgOf(cm: number, area: ClearArea, type: SnowType = "unknown"): number {
  return Math.max(10, Math.round((AREA_M2[area] * (cm / 100) * SNOW_DENSITY[type]) / 10) * 10);
}

/**
 * 自宅の雪かき（ソロ）のどけた雪（spec v1.8）。手がかり（写真の深さ・その日の予報・積雪深）がない日は出さない（数字を作らない）。
 * 雪の朝の記録が今日のものでなければ、予報と積雪深は使わない（写真だけ）。
 */
export function soloSnow(i: {
  today: string;
  rollcall: { date: string; forecastCm: number; depthCm?: number; tempMinC?: number };
  photo?: PhotoDepth;
  snowType?: SnowType;
  area?: ClearArea;
}): { snowKg: number; snowKgComparison: string; snowKgBasis: string; snowType: SnowType } | undefined {
  const same = i.rollcall.date === i.today;
  const forecastCm = same ? i.rollcall.forecastCm : 0;
  const modelDepthCm = same ? i.rollcall.depthCm : undefined;
  const d = estimateDepth({ forecastCm, modelDepthCm, photo: i.photo });
  const known = d.source === "photo" || (d.source === "forecast" && forecastCm > 0) || d.source === "model";
  if (!known) return undefined;
  const snowType = consistentSnowType(i.snowType, same ? i.rollcall.tempMinC : undefined);
  const area = i.area ?? "entrance";
  const snowKg = snowKgOf(d.cm, area, snowType);
  return { snowKg, snowKgComparison: snowComparison(snowKg), snowKgBasis: kgBasis(d, area, snowType), snowType };
}

/** 計算の元（カードの裏・完了画面に1行で） */
export function kgBasis(d: DepthEstimate, area: ClearArea, type: SnowType = "unknown"): string {
  return `${d.label} × ${AREA_LABEL[area]} ${AREA_M2[area]}m² × ${SNOW_LABEL[type]}`;
}
