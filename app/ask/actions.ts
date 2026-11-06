"use server";

// 雪かきを頼む（spec v1.20 お互いさま）: 同じアプリで、手伝うことも頼むこともできる。
// ①頼む家として登録する（頼み方 おまかせ／一緒に・どこまで） ②頼み方を変える ③今日、雪かき応援を頼む。
// 「自分」は trustedViewer で確かめる（画面の申告は信じない）。
import { revalidatePath } from "next/cache";
import { judgeLevel } from "@/lib/claude/level";
import { readAreaFromPhoto } from "@/lib/claude/area";
import { sniffImageType } from "@/lib/image";
import { finishRegistration } from "@/lib/line/handle";
import { textOf } from "@/lib/line/flex";
import { askForHelpById } from "@/lib/morning/ops";
import { stormStatus } from "@/lib/storm";
import { repo } from "@/lib/repo";
import type { ClearArea, HelpStyle } from "@/lib/types";
import { trustedViewer } from "@/lib/viewer";

export interface AskResult {
  ok: boolean;
  text: string;
}

const STYLES: HelpStyle[] = ["omakase", "together"];
const AREAS: ClearArea[] = ["entrance", "garage", "road"];

async function me(viewerId: string) {
  const id = await trustedViewer(viewerId);
  return id ? repo().findParticipant(id) : undefined;
}

/** 手伝う側の人が、自分の家も「頼める家」にする（チームと手伝う側の答えはそのまま） */
export async function registerHouseAction(viewerId: string, style: string, area: string): Promise<AskResult> {
  const p = await me(viewerId);
  if (!p) return { ok: false, text: "この画面の持ち主を確かめられませんでした。ログインし直してください。" };
  if (!p.lineUserId) return { ok: false, text: "デモの人では登録できません。" };
  const s = STYLES.find((x) => x === style);
  const a = AREAS.find((x) => x === area);
  if (!s || !a) return { ok: false, text: "2つの質問に答えてください。" };
  await finishRegistration(p.lineUserId, { role: "requester", proxy: false, location: p.location, soloMinutes: s === "omakase" ? "unknown" : 30, clearArea: a, helpStyle: s }, p.nickname);
  revalidatePath("/ask");
  revalidatePath("/");
  return { ok: true, text: "登録しました。10cm 以上積もった朝は、近所に雪かき応援を自動でお知らせします。" };
}

/** 頼み方・どこまでを変える（頼む家の人だけ） */
export async function updateHouseAction(viewerId: string, style: string, area: string): Promise<AskResult> {
  const p = await me(viewerId);
  if (!p || p.role !== "requester") return { ok: false, text: "頼む家として登録していません。" };
  const s = STYLES.find((x) => x === style);
  const a = AREAS.find((x) => x === area);
  if (!s || !a) return { ok: false, text: "選び直してください。" };
  const next = { ...p, helpStyle: s, clearArea: a };
  if (a !== p.clearArea || s !== p.helpStyle) {
    const level = await judgeLevel({ soloMinutes: s === "omakase" ? "unknown" : 30, clearArea: a }).catch(() => undefined);
    if (level) next.level = level.level;
  }
  await repo().upsertParticipant(next);
  revalidatePath("/ask");
  return { ok: true, text: "変えました。" };
}

/** 今日、雪かき応援を頼む（6〜19時）。style がなければ登録した頼み方 */
export async function askTodayAction(viewerId: string, style: string): Promise<AskResult> {
  const p = await me(viewerId);
  if (!p) return { ok: false, text: "この画面の持ち主を確かめられませんでした。ログインし直してください。" };
  if ((await stormStatus()).stopped) return { ok: false, text: "警報の日はお休みです。家の中で過ごしてください。" };
  const s = STYLES.find((x) => x === style);
  const messages = await askForHelpById(p.id, new Date(), s);
  revalidatePath("/ask");
  revalidatePath("/");
  revalidatePath("/map");
  return { ok: true, text: messages.map(textOf).join("\n") };
}

export interface AreaPhotoResult {
  ok: boolean;
  area?: ClearArea;
  /** 理由（読めたとき）／どう直すか（読めなかったとき） */
  text: string;
}

/** 写真から「どこまで」を読む（ハンドフリー、11/6 本人の指示）。写真は保存しない。登録した人だけ */
export async function readAreaPhotoAction(formData: FormData): Promise<AreaPhotoResult> {
  const viewerId = String(formData.get("viewerId") ?? "");
  const p = await me(viewerId);
  if (!p) return { ok: false, text: "この画面の持ち主を確かめられませんでした。ログインし直してください。" };
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return { ok: false, text: "写真を選んでください。" };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mediaType = sniffImageType(bytes);
  if (!mediaType) return { ok: false, text: "JPEG・PNG・WebP の写真を送ってください。" };
  const r = await readAreaFromPhoto({ bytes, mediaType });
  if (!r.area) return { ok: false, text: `${r.reason}。ボタンで選んでください。` };
  return { ok: true, area: r.area, text: r.reason };
}
