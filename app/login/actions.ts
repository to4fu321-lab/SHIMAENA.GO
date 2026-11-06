"use server";

// ブラウザでログイン（spec v1.16）: LINE アプリを使わずに参加する。lib/weblogin.ts
import { cookies } from "next/headers";
import { repo } from "@/lib/repo";
import { signViewer, VIEWER_COOKIE } from "@/lib/viewer";
import { claimLogin, createLogin, newNonce, WEB_LOGIN_MINUTES } from "@/lib/weblogin";

const NONCE_COOKIE = "wl_nonce";
const cookieOpts = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" };

/** 合言葉を出す。sendUrl は「LINE で送る」（公式アカウントへのトークに文が入った状態で LINE が開く） */
export async function startWebLoginAction(): Promise<{ ok: boolean; code?: string; sendUrl?: string; minutes: number }> {
  try {
    const jar = await cookies();
    const nonce = newNonce();
    jar.set(NONCE_COOKIE, nonce, { ...cookieOpts, maxAge: WEB_LOGIN_MINUTES * 60 });
    const code = await createLogin(nonce);
    const raw = process.env.NEXT_PUBLIC_LINE_BOT_ID?.trim();
    const id = raw ? (raw.startsWith("@") ? raw : `@${raw}`) : undefined;
    const sendUrl = id ? `https://line.me/R/oaMessage/${encodeURIComponent(id)}/?${encodeURIComponent(`ログイン ${code}`)}` : undefined;
    return { ok: true, code, sendUrl, minutes: WEB_LOGIN_MINUTES };
  } catch (e) {
    console.error("[weblogin]", e instanceof Error ? e.message : e);
    return { ok: false, minutes: WEB_LOGIN_MINUTES };
  }
}

/** LINE で送られたか確かめる。結ばれていたら、このブラウザを本人にする（180日） */
export async function checkWebLoginAction(code: string): Promise<{ ok: boolean; nickname?: string }> {
  const jar = await cookies();
  const nonce = jar.get(NONCE_COOKIE)?.value;
  if (!nonce || !/^[A-Z0-9]{6}$/.test(code)) return { ok: false };
  const id = await claimLogin(code, nonce).catch(() => undefined);
  if (!id) return { ok: false };
  const p = await repo().findParticipant(id);
  if (!p) return { ok: false };
  jar.delete(NONCE_COOKIE);
  jar.set(VIEWER_COOKIE, signViewer(p.id), { ...cookieOpts, sameSite: "none", secure: true, maxAge: 60 * 60 * 24 * 180 });
  return { ok: true, nickname: p.nickname };
}
