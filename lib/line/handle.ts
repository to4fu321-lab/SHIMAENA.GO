// Webhook のイベントを1つ受け取り、登録の会話を進めて返信する。
// 会話のルールは registration.ts（純粋な関数）。ここは保存・レベル判定・チーム配属・返信という「副作用」だけ。
import { randomBytes } from "node:crypto";
import { judgeLevel } from "../claude/level";
import { assignTeam, makeLinkCode } from "../game/team";
import { sniffImageType } from "../image";
import { answerRollcall, completeWithPhoto, escalateHelpIfDue, joinMission, offerTaskNow, planIfDue, sendThanks, setGoing } from "../morning/ops";
import { repo } from "../repo";
import { getTeam } from "../teams";
import type { FamilyLink, Participant } from "../types";
import { getMessageContent, getProfile, reply } from "./client";
import { MSG } from "./messages";
import { parseText, step, type RegInput, type Registration } from "./registration";
import type { LineEvent, LineMessage } from "./types";

const newId = (prefix: string) => `${prefix}-${randomBytes(6).toString("base64url")}`;

/** LINE のイベントを会話の入力に直す。扱わないイベントは null */
export function toInput(ev: LineEvent): RegInput | null {
  if (ev.type === "follow") return { kind: "follow" };
  if (ev.type === "postback" && "postback" in ev) return { kind: "postback", data: ev.postback.data };
  if (ev.type === "message" && "message" in ev) {
    const m = ev.message;
    if (m.type === "text") return parseText(m.text);
    if (m.type === "location") return { kind: "location", location: [m.latitude, m.longitude] };
  }
  return null;
}

async function nickname(lineUserId: string): Promise<string> {
  return (await getProfile(lineUserId))?.displayName ?? "参加者";
}

/** 2問まで終わった登録を保存し、最後の文面を返す */
export async function finishRegistration(lineUserId: string, reg: Registration): Promise<LineMessage[]> {
  const r = repo();
  const name = await nickname(lineUserId);

  if (reg.role === "helper") {
    const existing = await r.findParticipantByLineUserId(lineUserId);
    const teamId =
      existing?.role === "helper" && existing.teamId ? existing.teamId : assignTeam(await r.countHelpersByTeam());
    const p: Participant = {
      id: existing?.id ?? newId("p"),
      nickname: name,
      role: "helper",
      location: reg.location,
      lineUserId,
      teamId,
      morningMinutes: reg.morningMinutes,
      hasTools: reg.hasTools,
    };
    await r.upsertParticipant(p);
    const team = getTeam(teamId);
    return [MSG.helperDone(team.name, team.colorName)];
  }

  const level = await judgeLevel({ soloMinutes: reg.soloMinutes, clearArea: reg.clearArea });
  // 本人の登録なら、その LINE の参加者を上書き。家族の代理なら、本人の LINE はまだ分からないので新しく作る
  const existing = reg.proxy ? undefined : await r.findParticipantByLineUserId(lineUserId);
  const p: Participant = {
    id: existing?.id ?? newId("p"),
    nickname: reg.proxy ? `${name}さんのご家族` : name,
    role: "requester",
    location: reg.location,
    soloMinutes: reg.soloMinutes,
    clearArea: reg.clearArea,
    level: level.level,
  };
  if (!reg.proxy) p.lineUserId = lineUserId;
  else p.registeredByFamilyId = lineUserId;
  await r.upsertParticipant(p);

  // 拠点（地図の番号）。まだなければ次の番号を振る
  const base = await r.findBaseByRequester(p.id);
  if (!base) await r.upsertBase({ id: `base-${p.id}`, number: await r.nextBaseNumber(), requesterId: p.id });

  const messages: LineMessage[] = [MSG.requesterDone(level.message, level.level, level.requiredPeople)];
  if (reg.proxy) {
    const link: FamilyLink = { familyLineUserId: lineUserId, requesterId: p.id, linkCode: makeLinkCode() };
    await r.addFamilyLink(link);
    messages.push(MSG.proxyDone(link.linkCode));
  }
  return messages;
}

/** 連携コードで、本人の LINE か家族の LINE を依頼者に紐づける */
export async function applyLink(lineUserId: string, code: string, who: "self" | "family"): Promise<LineMessage[]> {
  const r = repo();
  const found = await r.findFamilyLinkByCode(code);
  if (!found) return [MSG.codeNotFound()];
  const requester = await r.findParticipant(found.requesterId);
  if (!requester) return [MSG.codeNotFound()];

  if (who === "self") {
    await r.upsertParticipant({ ...requester, lineUserId });
    return [MSG.linkedSelf()];
  }
  await r.addFamilyLink({ familyLineUserId: lineUserId, requesterId: requester.id, linkCode: makeLinkCode() });
  return [MSG.linkedFamily()];
}

export async function handleEvent(ev: LineEvent): Promise<void> {
  const lineUserId = ev.source.userId;
  if (!lineUserId) return;
  const r = repo();

  if (ev.type === "unfollow") {
    await r.setSession(lineUserId, null);
    return;
  }

  // 点呼の答え（rc:ans=...）は登録の会話とは別に扱う
  if (ev.type === "postback" && "postback" in ev && ev.postback.data.startsWith("rc:")) {
    const messages = await answerRollcall(lineUserId, ev.postback.data);
    if (ev.replyToken) await reply(ev.replyToken, messages);
    await planIfDue();
    await escalateHelpIfDue();
    return;
  }

  // 「いまからやる」（リッチメニュー／文字）→ 何分？ → 近くの小タスクを1件
  if (ev.type === "message" && "message" in ev && ev.message.type === "text" && /^いまからやる$/.test(ev.message.text.trim())) {
    if (ev.replyToken) await reply(ev.replyToken, [MSG.nowAsk()]);
    return;
  }
  if (ev.type === "postback" && "postback" in ev && ev.postback.data.startsWith("now:")) {
    const p = await r.findParticipantByLineUserId(lineUserId);
    const minutes = Number(ev.postback.data.slice(4));
    const messages = !p
      ? [MSG.notRegistered()]
      : minutes === 5 || minutes === 15 || minutes === 30
        ? await offerTaskNow(p.id, minutes)
        : [MSG.nowAsk()];
    if (ev.replyToken) await reply(ev.replyToken, messages);
    return;
  }

  // ヘルプ通知の「行く（5分でも）」「今は無理」、返事なしの「声をかけに行く」
  if (ev.type === "postback" && "postback" in ev && (ev.postback.data.startsWith("help:") || ev.postback.data.startsWith("knock:"))) {
    const data = ev.postback.data;
    const p = await r.findParticipantByLineUserId(lineUserId);
    let messages: LineMessage[];
    if (!p) messages = [MSG.notRegistered()];
    else if (data.startsWith("help:go=")) messages = await joinMission(p.id, data.slice("help:go=".length));
    else if (data.startsWith("knock:")) messages = [MSG.knockThanks()];
    else messages = [MSG.helpDeclined()];
    if (ev.replyToken) await reply(ev.replyToken, messages);
    await escalateHelpIfDue();
    return;
  }

  // ありがとう点呼（お願いした人の3択）
  if (ev.type === "postback" && "postback" in ev && ev.postback.data.startsWith("thanks:")) {
    const messages = await sendThanks(lineUserId, ev.postback.data);
    if (ev.replyToken) await reply(ev.replyToken, messages);
    return;
  }

  // 「行く」「今朝は行けない」
  if (ev.type === "postback" && "postback" in ev && ev.postback.data.startsWith("go:")) {
    const p = await r.findParticipantByLineUserId(lineUserId);
    const messages = p ? await setGoing(p.id, ev.postback.data === "go:yes") : [MSG.notRegistered()];
    if (ev.replyToken) await reply(ev.replyToken, messages);
    return;
  }

  // 写真1枚で「終わりました」
  if (ev.type === "message" && "message" in ev && ev.message.type === "image") {
    const p = await r.findParticipantByLineUserId(lineUserId);
    let messages: LineMessage[];
    if (!p) messages = [MSG.notRegistered()];
    else {
      const content = await getMessageContent(ev.message.id);
      const mediaType = content && sniffImageType(content.bytes);
      messages =
        content && mediaType
          ? (await completeWithPhoto(p.id, { bytes: content.bytes, mediaType })).messages
          : [MSG.photoNotCleared("写真を受け取れませんでした。")];
    }
    if (ev.replyToken) await reply(ev.replyToken, messages);
    return;
  }

  let input = toInput(ev);
  if (!input) return;
  if (input.kind === "code" && !(await r.findFamilyLinkByCode(input.code))) {
    if (ev.replyToken) await reply(ev.replyToken, [MSG.codeNotFound()]);
    return;
  }
  if (input.kind === "text") input = { kind: "text", text: input.text };

  const out = step(await r.getSession(lineUserId), input);
  const messages = [...out.messages];
  if (out.done) messages.push(...(await finishRegistration(lineUserId, out.done)));
  if (out.link) messages.push(...(await applyLink(lineUserId, out.link.code, out.link.who)));
  await r.setSession(lineUserId, out.session);
  if (ev.replyToken && messages.length > 0) await reply(ev.replyToken, messages);
}
