"use server";

// はじめる（spec v1.17）: LINE でログインした人が、画面で30秒の登録をする。中身はトークの会話の登録（finishRegistration）と同じ。
// 誰の登録かは cookie で決める: 登録前の印（LINE でログインしたが未登録）か、この画面の「自分」（登録のやり直し）。画面側の申告は信じない。
import { cookies } from "next/headers";
import { PENDING_COOKIE, readPending } from "@/lib/auth/pending";
import { applyLink, finishRegistration } from "@/lib/line/handle";
import { textOf } from "@/lib/line/flex";
import type { Registration } from "@/lib/line/registration";
import { repo } from "@/lib/repo";
import type { ClearArea, HelpStyle, LatLng, MorningMinutes, SoloMinutes } from "@/lib/types";
import { readViewer, signViewer, VIEWER_COOKIE } from "@/lib/viewer";

export interface StartForm {
  role: "helper" | "requester" | "family";
  location: LatLng;
  /** 手伝う側: 朝は何分動ける？（15/30/60）。お願いする側・家族: 頼み方（omakase=おまかせ／together=一緒にやる。spec v1.20） */
  q1: string;
  /** 手伝う側: 道具はある？（yes/no）。お願いする側・家族: どこまで？（entrance/garage/road） */
  q2: string;
}

export interface StartResult {
  ok: boolean;
  text?: string;
  /** 家族の代わりに登録したとき: ご本人・ほかの家族が紐づけに使う連携コード */
  linkCode?: string;
}

const cookieOpts = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" };

/** いま登録しようとしている人（LINE のアカウント ID と表示名） */
async function who(): Promise<{ lineUserId: string; displayName: string } | undefined> {
  const jar = await cookies();
  const pending = readPending(jar.get(PENDING_COOKIE)?.value);
  if (pending) return { lineUserId: pending.lineUserId, displayName: pending.displayName };
  const id = readViewer(jar.get(VIEWER_COOKIE)?.value);
  const p = id ? await repo().findParticipant(id) : undefined;
  return p?.lineUserId ? { lineUserId: p.lineUserId, displayName: p.nickname } : undefined;
}

export async function registerAction(f: StartForm): Promise<StartResult> {
  try {
    const me = await who();
    if (!me) return { ok: false, text: "ログインが切れています。もう一度「LINE でログイン」を押してください。" };
    const [lat, lng] = Array.isArray(f.location) ? f.location.map(Number) : [NaN, NaN];
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { ok: false, text: "家の場所を選んでください。" };

    let reg: Registration;
    if (f.role === "helper") {
      const mm = ({ "15": 15, "30": 30, "60": 60 } as Record<string, MorningMinutes>)[f.q1];
      if (!mm || !["yes", "no"].includes(f.q2)) return { ok: false, text: "2つの質問に答えてください。" };
      reg = { role: "helper", location: [lat, lng], morningMinutes: mm, hasTools: f.q2 === "yes" };
    } else if (f.role === "requester" || f.role === "family") {
      const style = (["omakase", "together"] as HelpStyle[]).find((x) => x === f.q1);
      const area = (["entrance", "garage", "road"] as ClearArea[]).find((a) => a === f.q2);
      if (!style || !area) return { ok: false, text: "2つの質問に答えてください。" };
      // おまかせ = ひとりではできない家として、一緒に = ひとりで 30分くらいの家としてレベルを決める
      const sm: SoloMinutes = style === "omakase" ? "unknown" : 30;
      reg = { role: "requester", proxy: f.role === "family", location: [lat, lng], soloMinutes: sm, clearArea: area, helpStyle: style };
    } else {
      return { ok: false, text: "手伝う側か、お願いする側かを選んでください。" };
    }

    const messages = await finishRegistration(me.lineUserId, reg, me.displayName);
    await repo().setSession(me.lineUserId, null); // トークで登録の途中だったら、それは終わりにする
    const jar = await cookies();
    if (f.role === "family") {
      // 家族の代わり: 家族本人は参加者ではない（本人の家が登録される）。連携コードを画面に出す。印はそのまま（あとで自分も登録できる）
      const code = messages.map(textOf).join("\n").match(/連携コード[:：]\s*(\d{6})/)?.[1];
      return { ok: true, linkCode: code };
    }
    const p = await repo().findParticipantByLineUserId(me.lineUserId);
    if (!p) return { ok: false, text: "登録はできました。もう一度開いてください。" };
    jar.delete(PENDING_COOKIE);
    jar.set(VIEWER_COOKIE, signViewer(p.id), { ...cookieOpts, maxAge: 60 * 60 * 24 * 180 }); // この画面の「自分」にする
    return { ok: true };
  } catch (e) {
    console.error("[start]", e instanceof Error ? e.message : e);
    return { ok: false, text: "うまくいきませんでした。電波のよい所で、もう一度押してください。" };
  }
}

/** 連携コード（6桁）で、本人か家族として、お願いする側の家に紐づく */
export async function linkCodeAction(code: string, whoAmI: "self" | "family"): Promise<StartResult> {
  const me = await who();
  if (!me) return { ok: false, text: "ログインが切れています。もう一度「LINE でログイン」を押してください。" };
  const c = code.replace(/\D/g, "");
  if (c.length !== 6) return { ok: false, text: "6桁の数字を入れてください。" };
  const found = await repo().findFamilyLinkByCode(c);
  if (!found) return { ok: false, text: "その番号は見つかりませんでした。番号を教えてくれたご家族に確かめてください。" };
  const messages = await applyLink(me.lineUserId, c, whoAmI);
  const jar = await cookies();
  if (whoAmI === "self") {
    const p = await repo().findParticipantByLineUserId(me.lineUserId);
    if (p) {
      jar.delete(PENDING_COOKIE);
      jar.set(VIEWER_COOKIE, signViewer(p.id), { ...cookieOpts, maxAge: 60 * 60 * 24 * 180 });
    }
  }
  return { ok: true, text: messages.map(textOf).join(" ") };
}
