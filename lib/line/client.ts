// 送り口（spec v1.17）: 文面を本人の「隊長トーク」（lib/inbox/store.ts）に入れる。LINE の Messaging API には送らない。
// 名前（push・multicast・reply）は LINE のときのまま: 呼ぶ側（朝の運用・カード・なかま・道の報告）を変えずに済むように。
//   push(鍵, 文面)        … 1人へ。鍵は lib/inbox/key.ts の inboxKeyOf（本物の人は LINE のアカウント ID、架空の人は demo:<ID>）
//   multicast(鍵[], 文面) … 何人かへ同じ文面
//   reply(鍵, 文面)       … トークで本人が送った文・ボタンへの返事（鍵は本人の鍵。LINE の replyToken ではない）
// 届けた印の通知（Web Push）は T81 でここから送る。保存の失敗は例外にせず、/admin の「問題」に残す（雪かきの流れを止めない）。
import { appendOut } from "../inbox/store";
import { recordProblem } from "../ops/problems";
import type { LineMessage } from "./types";

/** LINE ログインの鍵（LINE はログインだけに使う。spec v1.17） */
export function hasLineKeys(): boolean {
  return Boolean(process.env.LINE_LOGIN_CHANNEL_ID && process.env.LINE_LOGIN_CHANNEL_SECRET);
}

/** 1人の隊長トークに文面を入れる。入れられたら true、失敗で false（例外は投げない） */
export async function deliver(key: string, messages: LineMessage[]): Promise<boolean> {
  if (!key || messages.length === 0) return true;
  try {
    await appendOut(key, messages);
    return true;
  } catch (e) {
    await recordProblem("inbox/deliver", e);
    return false;
  }
}

/** 1人へ */
export async function push(to: string, messages: LineMessage[]): Promise<boolean> {
  return deliver(to, messages);
}

/** 同じ文面を何人かへ（同じ鍵は1回だけ）。全員に入れられたら true */
export async function multicast(to: string[], messages: LineMessage[]): Promise<boolean> {
  let ok = true;
  for (const key of new Set(to)) ok = (await deliver(key, messages)) && ok;
  return ok;
}

/** トークでの返事（鍵は本人の鍵） */
export async function reply(key: string, messages: LineMessage[]): Promise<boolean> {
  return deliver(key, messages);
}
