"use server";

// ことばの切りかえ（spec v1.33）: 隊長トークの 🌐 で選んだことばを cookie に覚える（端末ごと。登録の情報には入れない）。
import { revalidatePath } from "next/cache";
import { writeLangCookie } from "@/lib/i18n/cookie";
import { isLang, type Lang } from "@/lib/i18n/langs";

export async function setLangAction(lang: string): Promise<{ ok: boolean; lang?: Lang }> {
  if (!isLang(lang)) return { ok: false };
  await writeLangCookie(lang);
  revalidatePath("/chat");
  return { ok: true, lang };
}
