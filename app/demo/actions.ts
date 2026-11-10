"use server";

// デモの人をえらぶ（11/10）: えらんだら、雪の朝（頼む家がある）を用意してから、その人として開く
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { JUDGE_CAST, demoHref } from "@/lib/demo-cast";
import { demoEnabled } from "@/lib/env";
import { ensureDemoMorning } from "@/lib/morning/demo-start";
import { recordProblem } from "@/lib/ops/problems";

export async function pickDemoAction(formData: FormData): Promise<void> {
  const as = String(formData.get("as") ?? "");
  const next = String(formData.get("next") ?? "/");
  if (!demoEnabled() || !(JUDGE_CAST as readonly string[]).includes(as)) redirect("/demo");
  // 用意に失敗しても、えらんだ人では開く（今の状態のまま見られる）
  const fresh = await ensureDemoMorning().catch(async (e) => (await recordProblem("demo/start", e), false));
  if (fresh) for (const p of ["/", "/map", "/chat", "/admin"]) revalidatePath(p);
  redirect(demoHref(next, as));
}
