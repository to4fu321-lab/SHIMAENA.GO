// 選んだことばの cookie（spec v1.33）。サーバー側（page・server action）でだけ使う。
import { cookies } from "next/headers";
import { LANG_COOKIE, parseLang, type Lang } from "./langs";

/** いま選んでいることば（cookie から。なければ日本語） */
export async function currentLang(): Promise<Lang> {
  return parseLang((await cookies()).get(LANG_COOKIE)?.value);
}

export async function writeLangCookie(lang: Lang): Promise<void> {
  (await cookies()).set(LANG_COOKIE, lang, { path: "/", maxAge: 365 * 86_400, sameSite: "lax", httpOnly: false });
}
