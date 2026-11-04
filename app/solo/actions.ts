"use server";

import { revalidatePath } from "next/cache";
import { sniffImageType } from "@/lib/image";
import type { PhotoInput } from "@/lib/claude/photo";
import { completeSolo, type SoloClearSummary } from "@/lib/solo/ops";
import { trustedViewer } from "@/lib/viewer";
import { withStateLock } from "@/lib/ops/lock";

export interface SoloActionResult {
  ok: boolean;
  text: string;
  summary?: SoloClearSummary;
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
    const r = await completeSolo(id, kind, { photo, note, now: new Date() });
    revalidatePath("/solo");
    revalidatePath("/");
    revalidatePath("/map");
    if (!r.ok) return { ok: false, text: r.text };
    return { ok: true, text: `「${r.summary.label}」完了！ +${r.summary.feathers}羽`, summary: r.summary };
  });
}
