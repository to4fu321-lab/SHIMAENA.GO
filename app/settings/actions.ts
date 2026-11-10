"use server";

// 設定の操作（spec v1.18）: 「隊長から声をかける」のスイッチ。退会（11/10）
import { revalidatePath } from "next/cache";
import { loadNudge, setNudgeOff } from "@/lib/nudge/store";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PENDING_COOKIE } from "@/lib/auth/pending";
import { deleteParticipantData } from "@/lib/repo";
import { withStateLock } from "@/lib/ops/lock";
import { isDemoViewer, readViewer, trustedViewer, VIEWER_COOKIE } from "@/lib/viewer";

export async function setNudgeAction(viewerId: string, on: boolean): Promise<{ ok: boolean; on: boolean }> {
  const id = await trustedViewer(viewerId);
  if (!id) return { ok: false, on };
  await setNudgeOff(id, !on);
  revalidatePath("/settings");
  return { ok: true, on: !(await loadNudge(id))?.off };
}

// 退会（11/10 本人の指示）: LINE でログインした本人だけ。登録と記録を消して、この端末の印も消す

export async function withdrawAction(): Promise<void> {
  const jar = await cookies();
  const id = readViewer(jar.get(VIEWER_COOKIE)?.value);
  if (!id || isDemoViewer(id)) redirect("/settings"); // デモの架空の人は退会できない（みんなで使う見本のため）
  await withStateLock("withdraw", () => deleteParticipantData(id));
  jar.delete(VIEWER_COOKIE);
  jar.delete(PENDING_COOKIE);
  revalidatePath("/");
  revalidatePath("/map");
  redirect("/login?bye=1");
}
