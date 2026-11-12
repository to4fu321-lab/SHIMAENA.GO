// 隊長トークで本人が送った文・ボタン・写真を、今までの LINE の Webhook と同じ処理（lib/line/handle.ts）に渡す（spec v1.17）。
// 入口はここ1つ。本人の送ったものを流れに残し、鍵を取ってから処理する。返事は handleEvent の中で reply → 本人の流れに入る。
import { inboxKeyOf } from "../inbox/key";
import { appendIn } from "../inbox/store";
import { handleEvent } from "../line/handle";
import type { LineEvent } from "../line/types";
import { precheckPhoto } from "../morning/ops";
import { withStateLock } from "../ops/lock";
import type { Participant } from "../types";

export type ChatInput =
  /** shown: 自分の吹き出しに残す文字（本人が打った外国語の文・ボタンの訳。spec v1.36）。処理に渡すのは text（日本語） */
  | { kind: "text"; text: string; shown?: string }
  | { kind: "postback"; data: string; label?: string }
  | { kind: "photo"; bytes: Uint8Array; mediaType: "image/jpeg" | "image/png" | "image/webp" };

export const TEXT_MAX = 300;

/** 本人の入力を処理する。届け先の鍵がない人（家族の代理登録の家）は何もしない（false） */
export async function sendToCaptain(p: Participant, input: ChatInput, now = new Date()): Promise<boolean> {
  const key = inboxKeyOf(p);
  if (!key) return false;
  const base = { replyToken: key, source: { type: "user" as const, userId: key }, timestamp: now.getTime() };
  type MessageEvent = Extract<LineEvent, { type: "message"; message: unknown }>;
  type PostbackEvent = Extract<LineEvent, { type: "postback"; postback: unknown }>;
  let ev: MessageEvent | PostbackEvent;
  if (input.kind === "text") {
    const text = input.text.trim().slice(0, TEXT_MAX);
    if (!text) return false;
    await appendIn(key, { text: input.shown?.trim().slice(0, TEXT_MAX) || text }, now);
    ev = { ...base, type: "message", message: { id: `${now.getTime()}`, type: "text", text } } satisfies MessageEvent;
  } else if (input.kind === "postback") {
    if (input.label) await appendIn(key, { text: input.label }, now); // 押したボタンの文字を、本人の吹き出しとして残す（LINE の displayText と同じ）
    ev = { ...base, type: "postback", postback: { data: input.data } } satisfies PostbackEvent;
  } else {
    await appendIn(key, { photo: true }, now);
    await precheckPhoto(p.id, { bytes: input.bytes, mediaType: input.mediaType }, now); // 写真の確認は鍵の外で先に（map の finishAction と同じ）
    ev = { ...base, type: "message", message: { id: `${now.getTime()}`, type: "image", content: { bytes: input.bytes, mediaType: input.mediaType } } } satisfies MessageEvent;
  }
  await withStateLock(`chat:${input.kind}`, () => handleEvent(ev));
  return true;
}
