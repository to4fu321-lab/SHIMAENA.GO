"use server";

// LINE で1タップ開始（spec v1.14）: LINE アプリの中の画面で登録する。中身はトークの会話の登録（finishRegistration）と同じ。
import { finishRegistration } from "@/lib/line/handle";
import { getProfileByAccessToken, push } from "@/lib/line/client";
import { repo } from "@/lib/repo";
import type { Registration } from "@/lib/line/registration";
import type { ClearArea, LatLng, MorningMinutes, SoloMinutes } from "@/lib/types";
import { signInWithLiff } from "@/app/map/actions";

export interface StartForm {
  role: "helper" | "requester";
  location: LatLng;
  /** 手伝う側: 朝は何分動ける？（15/30/60）。お願いする側: ひとりだと何分？（15/30/60/unknown） */
  q1: string;
  /** 手伝う側: 道具はある？（yes/no）。お願いする側: どこまで？（entrance/garage/road） */
  q2: string;
}

export async function registerWithLiff(accessToken: string, f: StartForm): Promise<{ ok: boolean; text?: string }> {
  try {
    const profile = await getProfileByAccessToken(accessToken);
    if (!profile) return { ok: false, text: "LINE であなたを確かめられませんでした。LINE アプリで開き直してください。" };
    const [lat, lng] = Array.isArray(f.location) ? f.location.map(Number) : [NaN, NaN];
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { ok: false, text: "家の場所を選んでください。" };

    let reg: Registration;
    if (f.role === "helper") {
      const mm = ({ "15": 15, "30": 30, "60": 60 } as Record<string, MorningMinutes>)[f.q1];
      if (!mm || !["yes", "no"].includes(f.q2)) return { ok: false, text: "2つの質問に答えてください。" };
      reg = { role: "helper", location: [lat, lng], morningMinutes: mm, hasTools: f.q2 === "yes" };
    } else if (f.role === "requester") {
      const sm = ({ "15": 15, "30": 30, "60": 60, unknown: "unknown" } as Record<string, SoloMinutes>)[f.q1];
      const area = (["entrance", "garage", "road"] as ClearArea[]).find((a) => a === f.q2);
      if (!sm || !area) return { ok: false, text: "2つの質問に答えてください。" };
      reg = { role: "requester", proxy: false, location: [lat, lng], soloMinutes: sm, clearArea: area };
    } else {
      return { ok: false, text: "手伝う側か、お願いする側かを選んでください。" };
    }

    const messages = await finishRegistration(profile.userId, reg, profile.displayName);
    await repo().setSession(profile.userId, null); // トークで登録の途中だったら、それは終わりにする
    // チーム発表などを LINE にも（友だちでなければ届かないだけ。失敗しても登録は終わっている）
    void push(profile.userId, messages).catch(() => false);
    const signed = await signInWithLiff(accessToken); // この画面の「自分」にする（cookie）
    return signed.ok ? { ok: true } : { ok: false, text: "登録はできました。もう一度開いてください。" };
  } catch (e) {
    console.error("[start]", e instanceof Error ? e.message : e);
    return { ok: false, text: "うまくいきませんでした。電波のよい所で、もう一度押してください。" };
  }
}
