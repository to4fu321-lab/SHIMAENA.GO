"use server";
// /admin「今朝の雪の歌を作り直す」（spec v1.28）: 今日の曲を Claude にもう一度作曲してもらう（キーなしはプログラムの曲）
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import { songDate, warmSnowSong } from "@/lib/song/day";

export async function remakeSnowSong() {
  await requireAdmin();
  await warmSnowSong(await songDate(), { force: true });
  revalidatePath("/");
  revalidatePath("/song");
  revalidatePath("/admin");
}
