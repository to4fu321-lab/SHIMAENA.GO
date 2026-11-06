"use server";

// 設定の操作（spec v1.18）: 「隊長から声をかける」のスイッチ
import { revalidatePath } from "next/cache";
import { loadNudge, setNudgeOff } from "@/lib/nudge/store";
import { trustedViewer } from "@/lib/viewer";

export async function setNudgeAction(viewerId: string, on: boolean): Promise<{ ok: boolean; on: boolean }> {
  const id = await trustedViewer(viewerId);
  if (!id) return { ok: false, on };
  await setNudgeOff(id, !on);
  revalidatePath("/settings");
  return { ok: true, on: !(await loadNudge(id))?.off };
}
