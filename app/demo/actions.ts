"use server";

// デモの人をえらぶ（11/10）: えらんだら、雪の朝（頼む家がある）を用意してから、その人として開く
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { JUDGE_CAST, demoHref } from "@/lib/demo-cast";
import { demoEnabled } from "@/lib/env";
import { ensureDemoMorning } from "@/lib/morning/demo-start";
import { runLater } from "@/lib/ops/later";
import { recordProblem } from "@/lib/ops/problems";

/** 人をえらんでから、長くてもこの時間で始める */
const START_MAX_MS = 9000;

export async function pickDemoAction(formData: FormData): Promise<void> {
  const as = String(formData.get("as") ?? "");
  const next = String(formData.get("next") ?? "/");
  if (!demoEnabled() || !(JUDGE_CAST as readonly string[]).includes(as)) redirect("/demo");
  // 用意に失敗しても、えらんだ人では開く（今の状態のまま見られる）
  const job = ensureDemoMorning().catch(async (e) => (await recordProblem("demo/start", e), false));
  // 長くても START_MAX_MS で始める（11/15 本人「遅くとも15秒で開始できないと」）。間に合わなかった用意は、返事のあとで続ける。
  // 画面は数秒ごとに新しくなるので、できあがった朝はそのまま出てくる
  let timer: ReturnType<typeof setTimeout> | undefined;
  const fresh = await Promise.race([job, new Promise<"slow">((ok) => (timer = setTimeout(() => ok("slow"), START_MAX_MS)))]);
  clearTimeout(timer);
  if (fresh === "slow") {
    await recordProblem("demo/start", `雪の朝の用意が ${START_MAX_MS / 1000} 秒で終わらなかったので、先に開きました`);
    runLater("demo/start", async () => void (await job));
  } else if (fresh) for (const p of ["/", "/map", "/chat", "/admin"]) revalidatePath(p);
  redirect(demoHref(next, as));
}
