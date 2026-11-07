"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { jstDate } from "@/lib/jst";
import { isNight } from "@/lib/night";
import { hazard, type RoadReport } from "@/lib/road/hazards";
import { notifyRoadReport } from "@/lib/road/notify";
import { getAlertPref, insertRoadReport, setAlertPref } from "@/lib/road/store";
import { sniffImageType } from "@/lib/image";
import type { PhotoInput } from "@/lib/claude/photo";
import { completeSolo, startHomeNow, stopHomeNow, type SoloClearSummary } from "@/lib/solo/ops";
import { trustedViewer } from "@/lib/viewer";
import { withStateLock } from "@/lib/ops/lock";
import { stormStopText } from "@/lib/storm";
import { findPrivateAreas, WHOLE, type PrivacyResult } from "@/lib/claude/privacy";
import { cleanStrokes } from "@/lib/watch/strokes";

export interface SoloActionResult {
  ok: boolean;
  text: string;
  summary?: SoloClearSummary;
  /** 道の報告: 地図に出した。夜は通知を朝に回す */
  road?: { id: string; later: boolean };
}

/** ソロミッションを完了にする。写真（任意）は画面で縮小した JPEG */
export async function completeSoloAction(formData: FormData): Promise<SoloActionResult> {
  return withStateLock("solo:completeSoloAction", async () => {
    const id = await trustedViewer(String(formData.get("viewerId") ?? ""));
    if (!id) return { ok: false, text: "この画面の持ち主を確かめられませんでした。LINE から開いてください。" };
    const kind = String(formData.get("kind") ?? "");
    const note = String(formData.get("note") ?? "").trim() || undefined;
    let photo: PhotoInput | undefined;
    const file = formData.get("photo");
    if (file instanceof File && file.size > 0) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const mediaType = sniffImageType(bytes);
      if (!mediaType) return { ok: false, text: "JPEG・PNG・WebP の写真を送ってください。" };
      photo = { bytes, mediaType };
    }
    const strokes = cleanStrokes(formData.get("strokes")); // v1.31 スコップカウンター（任意）
    const r = await completeSolo(id, kind, { photo, note, strokes, now: new Date() });
    revalidatePath("/solo");
    revalidatePath("/");
    revalidatePath("/map");
    if (!r.ok) return { ok: false, text: r.text };
    return { ok: true, text: `「${r.summary.label}」完了！ +${r.summary.feathers}羽`, summary: r.summary };
  });
}

/** 自分の家の雪かきを「いまから始める」（ホームの「自宅を雪かき中」に入る） */
export async function startHomeAction(formData: FormData): Promise<{ ok: boolean; text: string }> {
  return withStateLock("solo:startHomeAction", async () => {
    const id = await trustedViewer(String(formData.get("viewerId") ?? ""));
    if (!id) return { ok: false, text: "この画面の持ち主を確かめられませんでした。LINE から開いてください。" };
    const stop = await stormStopText();
    if (stop) return { ok: false, text: stop };
    const r = await startHomeNow(id, new Date());
    revalidatePath("/");
    return r;
  });
}

/** 自分の家の雪かきを途中でやめた（「いま自宅を雪かき中」から抜ける） */
export async function stopHomeAction(formData: FormData): Promise<{ ok: boolean }> {
  return withStateLock("solo:stopHomeAction", async () => {
    const id = await trustedViewer(String(formData.get("viewerId") ?? ""));
    if (!id) return { ok: false };
    await stopHomeNow(id);
    revalidatePath("/");
    return { ok: true };
  });
}

async function readPhoto(file: FormDataEntryValue | null): Promise<PhotoInput | undefined | "bad"> {
  if (!(file instanceof File) || file.size === 0) return undefined;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mediaType = sniffImageType(bytes);
  return mediaType ? { bytes, mediaType } : "bad";
}

/**
 * 道の危険を知らせる（11/4 本人の指示）: 種類・写真・その場所。地図にピンを立て、近くの人へ知らせる。
 * 羽とチームの点は1日1回（2回目からは報告だけ受け付ける）。
 */
export async function reportRoadAction(formData: FormData): Promise<SoloActionResult> {
  const id = await trustedViewer(String(formData.get("viewerId") ?? ""));
  if (!id) return { ok: false, text: "この画面の持ち主を確かめられませんでした。LINE から開いてください。" };
  const stop = await stormStopText();
  if (stop) return { ok: false, text: stop };
  const h = hazard(String(formData.get("hazard") ?? ""));
  if (!h) return { ok: false, text: "どんな危険かを選んでください。" };
  const lat = Number(formData.get("lat"));
  const lng = Number(formData.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return { ok: false, text: "場所がわかりませんでした。位置情報をオンにして、もう一度どうぞ。" };
  }
  const photo = await readPhoto(formData.get("photo"));
  if (!photo || photo === "bad") return { ok: false, text: "写真を1枚つけてください（JPEG・PNG・WebP）。" };
  // 地図と LINE に出すのは、画面でぼかしを入れた小さい写真だけ（spec v1.11）。元の写真は残さない
  const thumb = await readPhoto(formData.get("thumb"));
  if (!thumb || thumb === "bad") return { ok: false, text: "ぼかしを入れた写真が届きませんでした。写真を撮り直してください。" };
  const note = String(formData.get("note") ?? "").trim().slice(0, 60) || undefined;

  const now = new Date();
  const report: RoadReport = {
    id: `rd-${randomBytes(6).toString("base64url")}`,
    participantId: id,
    hazard: h.id,
    location: [lat, lng],
    at: now.toISOString(),
    date: jstDate(now),
  };
  if (note) report.note = note;
  try {
    await insertRoadReport(report, Buffer.from(thumb.bytes).toString("base64"));
  } catch (e) {
    console.error("[road] 報告を保存できませんでした:", e instanceof Error ? e.message : e);
    return { ok: false, text: "報告を保存できませんでした。少し待って、もう一度「地図に報告」を押してください。" };
  }
  after(() => notifyRoadReport(report).catch((e) => console.error("[road] 通知できませんでした:", e instanceof Error ? e.message : e)));

  // 羽とチームの点（1日1回）。写真は Claude が確認する
  const r = await withStateLock("solo:reportRoad", () => completeSolo(id, "report_snow", { photo, note: `${h.label}${note ? `: ${note}` : ""}`, now }));
  revalidatePath("/solo");
  revalidatePath("/map");
  const road = { id: report.id, later: isNight(now) };
  if (!r.ok) return { ok: true, text: `地図に「${h.label}」を出しました。ありがとうございます！`, road };
  return { ok: true, text: `「${h.label}」を報告しました！ +${r.summary.feathers}羽`, summary: r.summary, road };
}

/** 道の報告を LINE で受け取るか（アプリの切りかえ） */
export async function setRoadAlertAction(viewerId: string, enabled: boolean): Promise<boolean | undefined> {
  const id = await trustedViewer(viewerId);
  if (!id) return undefined;
  await setAlertPref(id, enabled);
  return getAlertPref(id);
}

/** 人に見せる写真のぼかす場所（spec v1.11）。ぼかすのは画面。確かめられなければ全体をぼかす */
export async function privacyAction(formData: FormData): Promise<PrivacyResult> {
  const id = await trustedViewer(String(formData.get("viewerId") ?? ""));
  const photo = await readPhoto(formData.get("photo"));
  if (!id || !photo || photo === "bad") return WHOLE;
  return findPrivateAreas(photo);
}
